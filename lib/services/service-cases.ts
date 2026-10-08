import {
  AcquisitionStatus,
  AppointmentStatus,
  Prisma,
  Role,
  ServiceCaseStatus,
} from "@prisma/client";
import type { z } from "zod";

import { writeAudit } from "@/lib/audit";
import {
  getAcquisitionCategory,
  getAcquisitionProduct,
} from "@/lib/acquisition-products";
import {
  prospectScope,
  requireBranch,
  serviceCaseScope,
} from "@/lib/authorization";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import {
  cancelServiceCaseJobs,
  createAssignmentNotification,
  scheduleServiceCaseJobs,
} from "@/lib/notifications";
import type { Actor } from "@/lib/session";
import { makeCode } from "@/lib/utils";
import type {
  appointmentCreateSchema,
  paginationSchema,
  serviceCaseCreateSchema,
  serviceCasePatchSchema,
} from "@/lib/validation";
import { assertServiceCaseTransition } from "@/lib/workflow";

type PageInput = z.infer<typeof paginationSchema> & {
  status?: ServiceCaseStatus;
  appointmentStatus?: AppointmentStatus;
  acquisitionStatus?: AcquisitionStatus;
  acquisitionCategory?: string;
  overdue?: boolean;
};
type CreateInput = z.infer<typeof serviceCaseCreateSchema>;
type AppointmentCreateInput = Omit<
  z.infer<typeof appointmentCreateSchema>,
  "appointmentStatus"
> & {
  appointmentStatus?: "NEEDS_SCHEDULING" | "PENDING_CONFIRMATION" | "CONFIRMED";
};
type PatchInput = z.infer<typeof serviceCasePatchSchema>;

const include = {
  prospect: {
    select: {
      id: true,
      internalCode: true,
      cakraReference: true,
      businessAlias: true,
      contactPic: true,
      need: true,
      locationLabel: true,
      latitude: true,
      longitude: true,
      locationVerifiedAt: true,
      locationUpdatedAt: true,
      productNeeds: true,
      locationPhotos: {
        select: { id: true, width: true, height: true },
        orderBy: { createdAt: "desc" as const },
        take: 3,
      },
      usageVerifications: { where: { status: "VERIFIED" as const }, take: 1 },
    },
  },
  pic: { select: { id: true, name: true, role: true } },
  participants: {
    include: { user: { select: { id: true, name: true, role: true } } },
    orderBy: { createdAt: "asc" as const },
  },
  acceptedBy: { select: { id: true, name: true } },
} as const;

export async function listServiceCases(actor: Actor, input: PageInput) {
  const where: Prisma.ServiceCaseWhereInput = {
    AND: [
      serviceCaseScope(actor),
      input.status ? { status: input.status } : {},
      input.appointmentStatus
        ? { appointmentStatus: input.appointmentStatus }
        : {},
      input.acquisitionStatus
        ? { acquisitionStatus: input.acquisitionStatus }
        : {},
      input.acquisitionCategory
        ? { acquisitionCategory: input.acquisitionCategory }
        : {},
      input.overdue
        ? {
            dueAt: { lt: new Date() },
            OR: [
              { sourceSystem: null },
              { sourceSystem: { not: "MABES_LINK" } },
              {
                appointmentAt: { not: null },
                appointmentStatus: { notIn: ["COMPLETED", "CANCELLED"] },
              },
            ],
            status: {
              notIn: [
                ServiceCaseStatus.HANDLED,
                ServiceCaseStatus.VERIFIED,
                ServiceCaseStatus.CLOSED,
                ServiceCaseStatus.CANCELLED,
              ],
            },
          }
        : {},
      input.search
        ? {
            OR: [
              { code: { contains: input.search, mode: "insensitive" } },
              { title: { contains: input.search, mode: "insensitive" } },
              {
                acquisitionProduct: {
                  contains: input.search,
                  mode: "insensitive",
                },
              },
              {
                prospect: {
                  internalCode: { contains: input.search, mode: "insensitive" },
                },
              },
              {
                prospect: {
                  businessAlias: {
                    contains: input.search,
                    mode: "insensitive",
                  },
                },
              },
              {
                prospect: {
                  contactPic: { contains: input.search, mode: "insensitive" },
                },
              },
              {
                sourceReference: {
                  contains: input.search,
                  mode: "insensitive",
                },
              },
            ],
          }
        : {},
    ],
  };
  const skip = (input.page - 1) * input.pageSize;
  const items = await db.serviceCase.findMany({
    where,
    include,
    orderBy: [{ status: "asc" }, { dueAt: "asc" }],
    skip,
    take: input.pageSize,
  });
  const total = await db.serviceCase.count({ where });
  // Fetch only current reminder versions/recipients for already-authorized rows.
  // Do not load all members' jobs or create an N+1 query per card.
  const reminderScope = items
    .filter(
      (item) =>
        item.appointmentStatus === "CONFIRMED" &&
        item.appointmentAt &&
        (item.sourceSystem !== "MABES_LINK" || item.acceptedAt) &&
        !["HANDLED", "VERIFIED", "CLOSED", "CANCELLED"].includes(item.status),
    )
    .map((item) => ({
      serviceCaseId: item.id,
      scheduleVersion: item.version,
      recipientId:
        item.picId === actor.id ||
        item.participants.some((p) => p.userId === actor.id)
          ? actor.id
          : item.picId,
    }));
  const reminderJobs = reminderScope.length
    ? await db.outboxJob.findMany({
        where: {
          type: { in: ["APPOINTMENT_PRE_DUE", "APPOINTMENT_ACTION_DUE"] },
          status: { in: ["PENDING", "PROCESSING"] },
          OR: reminderScope,
        },
        select: { id: true, serviceCaseId: true, runAt: true, payload: true },
        orderBy: { runAt: "asc" },
      })
    : [];
  const serverNow = new Date();
  const reminders = new Map<
    string,
    {
      id: string;
      runAt: string;
      expiresAt: string | null;
      snoozeMinutes: number | null;
    }
  >();
  for (const job of reminderJobs) {
    const payload = job.payload as {
      policy?: string;
      expiresAt?: string;
      snoozeMinutes?: number;
    } | null;
    if (
      !job.serviceCaseId ||
      reminders.has(job.serviceCaseId) ||
      payload?.policy !== "APPOINTMENT_V2" ||
      (payload.expiresAt &&
        !(Date.parse(payload.expiresAt) > serverNow.getTime()))
    )
      continue;
    reminders.set(job.serviceCaseId, {
      id: job.id,
      runAt: job.runAt.toISOString(),
      expiresAt: payload.expiresAt ?? null,
      snoozeMinutes: [1, 5, 10].includes(payload.snoozeMinutes ?? 0)
        ? payload.snoozeMinutes!
        : null,
    });
  }
  return {
    items: items.map((item) => ({
      ...item,
      nextReminder: reminders.get(item.id) ?? null,
    })),
    serverNow: serverNow.toISOString(),
    pagination: {
      page: input.page,
      pageSize: input.pageSize,
      total,
      pages: Math.ceil(total / input.pageSize),
    },
  };
}

export async function getServiceCase(actor: Actor, id: string) {
  const item = await db.serviceCase.findFirst({
    where: { id, AND: [serviceCaseScope(actor)] },
    include: {
      ...include,
      notifications: { orderBy: { createdAt: "desc" }, take: 10 },
      outboxJobs: {
        where: {
          type: { in: ["APPOINTMENT_PRE_DUE", "APPOINTMENT_ACTION_DUE"] },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          id: true,
          recipientId: true,
          scheduleVersion: true,
          runAt: true,
          status: true,
          payload: true,
        },
      },
    },
  });
  if (!item)
    throw new AppError(
      "Pekerjaan tidak ditemukan atau bukan tanggung jawab Anda.",
      404,
      "NOT_FOUND",
    );
  return item;
}

export async function listAppointmentLocations(actor: Actor) {
  return db.serviceCase.findMany({
    where: {
      AND: [
        serviceCaseScope(actor),
        { appointmentAt: { not: null } },
        {
          prospect: {
            latitude: { not: null },
            longitude: { not: null },
          },
        },
      ],
    },
    select: {
      id: true,
      code: true,
      title: true,
      status: true,
      appointmentStatus: true,
      appointmentAt: true,
      dueAt: true,
      prospect: {
        select: {
          businessAlias: true,
          contactPic: true,
          locationLabel: true,
          latitude: true,
          longitude: true,
          mappingMarkerIcon: true,
          locationPhotos: {
            select: { id: true },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      },
      pic: { select: { id: true, name: true } },
      participants: {
        select: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { appointmentAt: "asc" },
    take: 500,
  });
}

export async function createServiceCase(
  actor: Actor,
  input: CreateInput,
  requestId?: string | null,
) {
  if (!Object.values(Role).includes(actor.role))
    throw new AppError(
      "Anda tidak berwenang membuat pekerjaan.",
      403,
      "FORBIDDEN",
    );
  const prospect = await db.prospect.findFirst({
    where: { id: input.prospectId, AND: [prospectScope(actor)] },
  });
  if (!prospect)
    throw new AppError(
      "Referensi pekerjaan tidak ditemukan.",
      404,
      "NOT_FOUND",
    );
  const branchId = prospect.branchId || requireBranch(actor);
  const pic = await db.user.findFirst({
    where: { id: input.picId, branchId, active: true, isTest: false },
  });
  if (!pic)
    throw new AppError(
      "PIC harus aktif dan berada di cabang yang sama.",
      422,
      "INVALID_ASSIGNEE",
    );
  if (
    actor.role !== Role.SUPERVISOR &&
    actor.role !== Role.ADMIN &&
    input.picId !== actor.id
  )
    throw new AppError(
      "Penugasan ke petugas lain memerlukan supervisor.",
      403,
      "FORBIDDEN",
    );

  return db.$transaction(async (tx) => {
    const updatesProspect =
      input.contactPic !== undefined ||
      input.businessAlias !== undefined ||
      input.locationLabel !== undefined ||
      input.latitude !== undefined ||
      input.longitude !== undefined ||
      input.locationSource !== undefined;
    if (updatesProspect) {
      const updated = await tx.prospect.updateMany({
        where: { id: prospect.id, version: input.prospectVersion },
        data: {
          contactPic: input.contactPic,
          businessAlias: input.businessAlias,
          locationLabel: input.locationLabel,
          latitude: input.latitude,
          longitude: input.longitude,
          locationSource: input.locationSource,
          locationUpdatedAt:
            input.latitude !== undefined ||
            input.longitude !== undefined ||
            input.locationLabel !== undefined ||
            input.locationSource !== undefined
              ? new Date()
              : undefined,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1)
        throw new AppError(
          "Referensi telah diubah pengguna lain. Muat ulang lalu coba lagi.",
          409,
          "VERSION_CONFLICT",
        );
      await writeAudit(tx, actor, {
        entityType: "Prospect",
        entityId: prospect.id,
        action: "APPOINTMENT_CONTEXT_UPDATED",
        branchId,
        before: {
          contactPic: prospect.contactPic,
          businessAlias: prospect.businessAlias,
          latitude: prospect.latitude,
          longitude: prospect.longitude,
        },
        after: {
          contactPic: input.contactPic ?? prospect.contactPic,
          businessAlias: input.businessAlias ?? prospect.businessAlias,
          latitude: input.latitude ?? prospect.latitude,
          longitude: input.longitude ?? prospect.longitude,
          locationSource: input.locationSource,
        },
        requestId,
      });
    }
    const item = await tx.serviceCase.create({
      data: {
        code: makeCode("ML-11539"),
        branchId,
        prospectId: input.prospectId,
        origin: input.origin,
        status: ServiceCaseStatus.ASSIGNED,
        title: input.title,
        description: input.description,
        picId: input.picId,
        createdById: actor.id,
        nextAction: input.nextAction,
        dueAt: input.dueAt,
        appointmentStatus: input.appointmentStatus,
        appointmentAt: input.appointmentAt,
        sourceSystem: input.sourceSystem,
        sourceReference: input.sourceReference,
      },
    });
    await tx.serviceCaseParticipant.create({
      data: { serviceCaseId: item.id, userId: item.picId },
    });
    await scheduleServiceCaseJobs(tx, item, branchId);
    await createAssignmentNotification(tx, {
      recipientId: item.picId,
      branchId,
      type: "SERVICE_ASSIGNMENT",
      title: "Pekerjaan baru",
      message: `${item.code} ditugaskan kepada Anda.`,
      link: `/work/${item.id}`,
      dedupKey: `service-assignment:${item.id}:v${item.version}`,
      serviceCaseId: item.id,
    });
    await writeAudit(tx, actor, {
      entityType: "ServiceCase",
      entityId: item.id,
      action: "SERVICE_CASE_CREATED_AND_ASSIGNED",
      branchId,
      after: {
        code: item.code,
        status: item.status,
        picId: item.picId,
        appointmentStatus: item.appointmentStatus,
      },
      requestId,
    });
    return item;
  });
}

export async function createAppointment(
  actor: Actor,
  input: AppointmentCreateInput,
  requestId?: string | null,
) {
  // Preserve old API callers; the UI explicitly defaults to NEEDS_SCHEDULING.
  const appointmentStatus =
    input.appointmentStatus ?? AppointmentStatus.CONFIRMED;
  if (appointmentStatus === "CONFIRMED" && !input.appointmentAt)
    throw new AppError(
      "Waktu janji wajib jika dikonfirmasi.",
      422,
      "APPOINTMENT_TIME_REQUIRED",
    );
  if (input.appointmentAt && input.appointmentAt.getTime() <= Date.now())
    throw new AppError(
      "Waktu janji harus berada setelah waktu sekarang.",
      422,
      "APPOINTMENT_TIME_INVALID",
    );
  const companionIds = (input.companionIds ?? input.picIds ?? []).filter(
    (id) => id !== actor.id,
  );
  const branchId = requireBranch(actor);
  if (!branchId)
    throw new AppError(
      "Akun pembuat janji harus terhubung ke cabang.",
      422,
      "BRANCH_REQUIRED",
    );
  const pics = await db.user.findMany({
    where: {
      id: { in: companionIds },
      active: true,
      isTest: false,
      role: { in: [Role.OUT_BRANCH, Role.CS] },
      branchId: { not: null },
    },
    select: { id: true, branchId: true },
  });
  if (pics.length !== companionIds.length)
    throw new AppError(
      "Anggota pendamping harus akun CS/OUTBRANCH aktif.",
      422,
      "INVALID_ASSIGNEE",
    );
  if (pics.some((pic) => pic.branchId !== branchId))
    throw new AppError(
      "Anggota pendamping harus berada pada cabang pembuat janji.",
      403,
      "INVALID_ASSIGNEE_BRANCH",
    );
  const primaryPicId = actor.id;
  const category = getAcquisitionCategory(input.acquisitionCategory);
  const product = getAcquisitionProduct(
    input.acquisitionCategory,
    input.acquisitionProduct,
  );
  if (!category || !product)
    throw new AppError(
      "Kategori atau produk akuisisi tidak valid.",
      422,
      "INVALID_ACQUISITION_PRODUCT",
    );

  return db.$transaction(async (tx) => {
    const now = new Date();
    const internalCode = makeCode("PR-11539");
    const prospect = await tx.prospect.create({
      data: {
        internalCode,
        businessAlias: input.businessAlias ?? "Usaha belum dicantumkan",
        need: input.reason,
        contactPic: input.contactName,
        branchId,
        assignedToId: primaryPicId,
        createdById: actor.id,
        locationLabel: input.locationLabel,
        latitude: input.latitude,
        longitude: input.longitude,
        locationSource: input.locationSource,
        mappingMarkerIcon: input.mappingMarkerIcon,
        locationUpdatedAt: now,
        locationVerifiedAt: input.locationVerified ? now : null,
        productNeeds: [product.label],
      },
    });
    const item = await tx.serviceCase.create({
      data: {
        code: makeCode("ML-11539"),
        branchId,
        prospectId: prospect.id,
        origin: actor.role === Role.CS ? "IN_BRANCH" : "OUT_BRANCH",
        status: ServiceCaseStatus.ASSIGNED,
        title: `${product.label} · ${input.businessAlias ?? internalCode}`,
        description: input.reason,
        picId: primaryPicId,
        createdById: actor.id,
        nextAction: input.nextAction,
        dueAt: input.appointmentAt ?? now, // Legacy internal deadline, not a second appointment input.
        appointmentStatus,
        appointmentAt: input.appointmentAt ?? null,
        sourceSystem: "MABES_LINK",
        acquisitionCategory: category.id,
        acquisitionProduct: product.id,
        acquisitionStatus: input.acquisitionStatus,
        targetValue: input.targetValue,
        realizationValue: input.realizationValue,
        metricUnit: input.metricUnit,
        customerCif: input.customerCif,
        customerAccount: input.customerAccount,
        customerPhone: input.customerPhone,
      },
    });
    await tx.serviceCaseParticipant.createMany({
      data: [actor.id, ...companionIds].map((userId) => ({
        serviceCaseId: item.id,
        userId,
      })),
      skipDuplicates: true,
    });
    await scheduleServiceCaseJobs(tx, item, branchId);
    for (const recipientId of [actor.id, ...companionIds]) {
      await createAssignmentNotification(tx, {
        recipientId,
        branchId,
        type: "SERVICE_ASSIGNMENT",
        title: "Janji akuisisi baru",
        message: `${item.code}: Anda ${recipientId === actor.id ? "memegang kendali layanan" : "menjadi anggota pendamping/pengganti"}.`,
        link: `/work/${item.id}`,
        dedupKey: `service-assignment:${item.id}:${recipientId}:v${item.version}`,
        serviceCaseId: item.id,
      });
    }
    await writeAudit(tx, actor, {
      entityType: "Prospect",
      entityId: prospect.id,
      action: "APPOINTMENT_PROSPECT_CREATED",
      branchId,
      after: {
        internalCode,
        assignedToId: primaryPicId,
        mappingMarkerIcon: input.mappingMarkerIcon,
      },
      requestId,
    });
    await writeAudit(tx, actor, {
      entityType: "ServiceCase",
      entityId: item.id,
      action: "APPOINTMENT_CREATED_AND_ASSIGNED",
      branchId,
      after: {
        code: item.code,
        appointmentStatus: item.appointmentStatus,
        ownerId: actor.id,
        companionIds,
        locationVerified: Boolean(input.locationVerified),
        acquisitionCategory: category.id,
        acquisitionProduct: product.id,
        acquisitionStatus: item.acquisitionStatus,
        targetValue: item.targetValue,
        realizationValue: item.realizationValue,
        metricUnit: item.metricUnit,
      },
      requestId,
    });
    return { ...item, prospectId: prospect.id };
  });
}

export async function updateServiceCase(
  actor: Actor,
  id: string,
  input: PatchInput,
  requestId?: string | null,
) {
  const current = await db.serviceCase.findFirst({
    where: { id, AND: [serviceCaseScope(actor)] },
  });
  if (!current)
    throw new AppError(
      "Pekerjaan tidak ditemukan atau bukan tanggung jawab Anda.",
      404,
      "NOT_FOUND",
    );
  if (input.status) {
    assertServiceCaseTransition(current.status, input.status);
    if (
      input.status === ServiceCaseStatus.ACCEPTED &&
      current.picId !== actor.id &&
      !(await db.serviceCaseParticipant.findUnique({
        where: {
          serviceCaseId_userId: { serviceCaseId: current.id, userId: actor.id },
        },
        select: { userId: true },
      }))
    )
      throw new AppError(
        "Hanya PIC penerima yang dapat menerima pekerjaan.",
        403,
        "FORBIDDEN",
      );
    if (
      (input.status === ServiceCaseStatus.VERIFIED ||
        input.status === ServiceCaseStatus.CLOSED) &&
      actor.role !== Role.SUPERVISOR &&
      actor.role !== Role.ADMIN
    )
      throw new AppError(
        "Verifikasi dan penutupan memerlukan supervisor.",
        403,
        "FORBIDDEN",
      );
  }
  if (input.takeControl) {
    if (["HANDLED", "VERIFIED", "CLOSED", "CANCELLED"].includes(current.status))
      throw new AppError(
        "Pekerjaan sudah selesai atau dibatalkan.",
        422,
        "INVALID_TRANSITION",
      );
    const member = await db.serviceCaseParticipant.findUnique({
      where: { serviceCaseId_userId: { serviceCaseId: id, userId: actor.id } },
    });
    if (
      !member ||
      actor.branchId !== current.branchId ||
      ![Role.CS, Role.OUT_BRANCH].includes(actor.role as "CS" | "OUT_BRANCH")
    )
      throw new AppError(
        "Hanya anggota pendamping aktif di cabang ini dapat mengambil alih.",
        403,
        "FORBIDDEN",
      );
    if (input.picId && input.picId !== actor.id)
      throw new AppError(
        "Pengambilalihan hanya untuk diri sendiri.",
        403,
        "FORBIDDEN",
      );
    input = { ...input, picId: actor.id };
  }
  if (input.picId && input.picId !== current.picId) {
    if (
      !input.takeControl &&
      actor.role !== Role.SUPERVISOR &&
      actor.role !== Role.ADMIN
    )
      throw new AppError(
        "Pergantian PIC memerlukan supervisor.",
        403,
        "FORBIDDEN",
      );
    const pic = await db.user.findFirst({
      where: {
        id: input.picId,
        branchId: current.branchId,
        active: true,
        isTest: false,
      },
    });
    if (!pic) throw new AppError("PIC tidak valid.", 422, "INVALID_ASSIGNEE");
  }
  // Accepting an acquisition appointment is an explicit acknowledgement of its
  // recorded time. Do not invent a time or activate reminders before acceptance.
  if (current.sourceSystem === "MABES_LINK" && input.status === "ACCEPTED") {
    const time =
      input.appointmentAt !== undefined
        ? input.appointmentAt
        : current.appointmentAt;
    if (!time || time <= new Date())
      throw new AppError(
        "Isi waktu janji (WIB) di masa depan sebelum menerima pekerjaan.",
        422,
        "APPOINTMENT_TIME_REQUIRED",
      );
    if (
      ["CANCELLED", "COMPLETED"].includes(current.appointmentStatus) &&
      !input.appointmentStatus
    )
      throw new AppError(
        "Jadwalkan kembali janji sebelum menerima pekerjaan.",
        422,
        "INVALID_TRANSITION",
      );
    input = { ...input, appointmentStatus: "CONFIRMED" };
  }
  const targetAppointmentStatus =
    input.appointmentStatus ?? current.appointmentStatus;
  const targetAppointmentAt =
    input.appointmentAt !== undefined
      ? input.appointmentAt
      : current.appointmentAt;
  if (
    targetAppointmentStatus === "CONFIRMED" &&
    targetAppointmentAt &&
    (input.appointmentAt !== undefined ||
      (input.appointmentStatus === "CONFIRMED" &&
        current.appointmentStatus !== "CONFIRMED")) &&
    targetAppointmentAt <= new Date()
  )
    throw new AppError(
      "Waktu janji terkonfirmasi harus di masa depan.",
      422,
      "APPOINTMENT_TIME_INVALID",
    );
  if (
    targetAppointmentStatus === AppointmentStatus.CONFIRMED &&
    !targetAppointmentAt
  )
    throw new AppError(
      "Waktu janji wajib sebelum dikonfirmasi.",
      422,
      "APPOINTMENT_TIME_REQUIRED",
    );
  if (input.status === ServiceCaseStatus.WAITING_CUSTOMER && !input.waitReason)
    throw new AppError(
      "Alasan menunggu nasabah wajib dicatat.",
      422,
      "WAIT_REASON_REQUIRED",
    );
  if (input.status === ServiceCaseStatus.WAITING_SYSTEM && !input.waitReason)
    throw new AppError(
      "Alasan menunggu sistem wajib dicatat.",
      422,
      "WAIT_REASON_REQUIRED",
    );
  if (input.status === ServiceCaseStatus.ESCALATED && !input.escalationReason)
    throw new AppError(
      "Alasan eskalasi wajib dicatat.",
      422,
      "ESCALATION_REASON_REQUIRED",
    );

  return db.$transaction(async (tx) => {
    const now = new Date();
    const result = await tx.serviceCase.updateMany({
      where: { id, version: input.version },
      data: {
        status: input.status,
        picId: input.picId,
        nextAction: input.nextAction,
        dueAt:
          current.sourceSystem === "MABES_LINK"
            ? (targetAppointmentAt ?? undefined)
            : input.dueAt,
        appointmentStatus: input.appointmentStatus,
        appointmentAt: input.appointmentAt,
        waitReason: input.waitReason,
        escalationReason: input.escalationReason,
        acquisitionStatus: input.acquisitionStatus,
        targetValue: input.targetValue,
        realizationValue: input.realizationValue,
        metricUnit: input.metricUnit,
        customerCif: input.customerCif,
        customerAccount: input.customerAccount,
        customerPhone: input.customerPhone,
        acceptedAt:
          input.status === ServiceCaseStatus.ACCEPTED ? now : undefined,
        acceptedById:
          input.status === ServiceCaseStatus.ACCEPTED ? actor.id : undefined,
        handledAt: input.status === ServiceCaseStatus.HANDLED ? now : undefined,
        verifiedAt:
          input.status === ServiceCaseStatus.VERIFIED ? now : undefined,
        closedAt: input.status === ServiceCaseStatus.CLOSED ? now : undefined,
        reopenedAt:
          input.status === ServiceCaseStatus.REOPENED ? now : undefined,
        version: { increment: 1 },
      },
    });
    if (result.count !== 1)
      throw new AppError(
        "Data telah diubah pengguna lain. Muat ulang.",
        409,
        "VERSION_CONFLICT",
      );
    const updated = await tx.serviceCase.findUniqueOrThrow({ where: { id } });
    if (input.picId && input.picId !== current.picId) {
      // The former owner remains a companion; takeover is explicitly audited.
      if (current.sourceSystem !== "MABES_LINK" && !input.takeControl)
        await tx.serviceCaseParticipant.deleteMany({
          where: { serviceCaseId: id, userId: current.picId },
        });
      await tx.serviceCaseParticipant.upsert({
        where: {
          serviceCaseId_userId: { serviceCaseId: id, userId: input.picId },
        },
        create: { serviceCaseId: id, userId: input.picId },
        update: {},
      });
    }
    const terminal =
      updated.status === ServiceCaseStatus.HANDLED ||
      updated.status === ServiceCaseStatus.VERIFIED ||
      updated.status === ServiceCaseStatus.CLOSED ||
      updated.status === ServiceCaseStatus.CANCELLED;
    if (
      terminal ||
      (updated.appointmentStatus !== AppointmentStatus.NEEDS_SCHEDULING &&
        updated.appointmentStatus !== AppointmentStatus.PENDING_CONFIRMATION &&
        updated.appointmentStatus !== AppointmentStatus.CONFIRMED)
    )
      await cancelServiceCaseJobs(
        tx,
        id,
        "Pekerjaan/janji tidak lagi memerlukan reminder.",
      );
    else await scheduleServiceCaseJobs(tx, updated, updated.branchId);
    if (updated.picId !== current.picId) {
      await createAssignmentNotification(tx, {
        recipientId: updated.picId,
        branchId: updated.branchId,
        type: "SERVICE_ASSIGNMENT",
        title: "PIC pekerjaan diubah",
        message: `${updated.code} kini menjadi tanggung jawab Anda.`,
        link: `/work/${updated.id}`,
        dedupKey: `service-assignment:${updated.id}:v${updated.version}`,
        serviceCaseId: updated.id,
      });
    }
    const participantRows = await tx.serviceCaseParticipant.findMany({
      where: { serviceCaseId: id },
      select: { userId: true },
    });
    for (const recipientId of new Set([
      updated.picId,
      ...participantRows.map((row) => row.userId),
    ])) {
      await createAssignmentNotification(tx, {
        recipientId,
        branchId: updated.branchId,
        type: "SERVICE_STATUS",
        title: "Janji atau pekerjaan diperbarui",
        message: `${updated.code} memiliki perubahan status, jadwal, atau tindak lanjut.`,
        link: `/work/${updated.id}`,
        dedupKey: `service-update:${updated.id}:${recipientId}:v${updated.version}`,
        serviceCaseId: updated.id,
      });
    }
    await writeAudit(tx, actor, {
      entityType: "ServiceCase",
      entityId: id,
      action: `SERVICE_CASE_${updated.status}`,
      branchId: updated.branchId,
      before: {
        status: current.status,
        picId: current.picId,
        dueAt: current.dueAt.toISOString(),
        appointmentStatus: current.appointmentStatus,
        appointmentAt: current.appointmentAt?.toISOString() ?? null,
      },
      after: {
        status: updated.status,
        picId: updated.picId,
        dueAt: updated.dueAt.toISOString(),
        appointmentStatus: updated.appointmentStatus,
        appointmentAt: updated.appointmentAt?.toISOString() ?? null,
        takeoverByCompanion: Boolean(input.takeControl),
      },
      requestId,
    });
    return updated;
  });
}

export async function archiveServiceCase(
  actor: Actor,
  id: string,
  version: number,
  requestId?: string | null,
) {
  const current = await db.serviceCase.findFirst({
    where: { id, AND: [serviceCaseScope(actor)] },
  });
  if (!current)
    throw new AppError(
      "Pekerjaan tidak ditemukan atau bukan tanggung jawab Anda.",
      404,
      "NOT_FOUND",
    );
  const allowed =
    actor.role === Role.ADMIN ||
    actor.role === Role.SUPERVISOR ||
    current.createdById === actor.id;
  if (!allowed)
    throw new AppError(
      "Hanya pembuat, supervisor cabang, atau ADMIN yang dapat menghapus kartu.",
      403,
      "FORBIDDEN",
    );
  return db.$transaction(async (tx) => {
    const changed = await tx.serviceCase.updateMany({
      where: { id, version, deletedAt: null },
      data: {
        deletedAt: new Date(),
        status: ServiceCaseStatus.CANCELLED,
        appointmentStatus: AppointmentStatus.CANCELLED,
        appointmentAt: null,
        version: { increment: 1 },
      },
    });
    if (changed.count !== 1)
      throw new AppError(
        "Data telah berubah. Muat ulang sebelum menghapus.",
        409,
        "VERSION_CONFLICT",
      );
    await cancelServiceCaseJobs(
      tx,
      id,
      "Kartu akuisisi dihapus dari daftar operasional.",
    );
    await writeAudit(tx, actor, {
      entityType: "ServiceCase",
      entityId: id,
      action: "SERVICE_CASE_ARCHIVED",
      branchId: current.branchId,
      before: { status: current.status, deletedAt: null },
      after: {
        status: ServiceCaseStatus.CANCELLED,
        deletedAt: new Date().toISOString(),
      },
      requestId,
    });
    return { id, archived: true };
  });
}
