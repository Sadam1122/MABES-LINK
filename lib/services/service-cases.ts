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
type AppointmentCreateInput = z.infer<typeof appointmentCreateSchema>;
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
                  businessAlias: { contains: input.search, mode: "insensitive" },
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
  return {
    items,
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
  if (input.appointmentAt.getTime() <= Date.now())
    throw new AppError(
      "Waktu janji harus berada setelah waktu sekarang.",
      422,
      "APPOINTMENT_TIME_INVALID",
    );
  const pics = await db.user.findMany({
    where: {
      id: { in: input.picIds },
      active: true,
      isTest: false,
      role: { in: [Role.OUT_BRANCH, Role.CS] },
      branchId: { not: null },
    },
    select: { id: true, branchId: true },
  });
  if (pics.length !== input.picIds.length)
    throw new AppError(
      "Seluruh PIC harus merupakan akun CS/OUTBRANCH aktif.",
      422,
      "INVALID_ASSIGNEE",
    );
  const branchIds = new Set(pics.map((pic) => pic.branchId));
  if (branchIds.size !== 1)
    throw new AppError(
      "Seluruh PIC harus berada pada cabang yang sama.",
      422,
      "INVALID_ASSIGNEE_BRANCH",
    );
  const branchId = pics[0].branchId!;
  if (actor.role !== Role.ADMIN && actor.branchId !== branchId)
    throw new AppError(
      "PIC berada di luar cabang Anda.",
      403,
      "FORBIDDEN",
    );
  const primaryPicId = input.picIds[0];
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
        locationUpdatedAt: new Date(),
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
        dueAt: input.appointmentAt,
        appointmentStatus: AppointmentStatus.CONFIRMED,
        appointmentAt: input.appointmentAt,
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
      data: input.picIds.map((userId) => ({ serviceCaseId: item.id, userId })),
      skipDuplicates: true,
    });
    await scheduleServiceCaseJobs(tx, item, branchId);
    for (const recipientId of input.picIds) {
      await createAssignmentNotification(tx, {
        recipientId,
        branchId,
        type: "SERVICE_ASSIGNMENT",
        title: "Janji akuisisi baru",
        message: `${item.code} ditugaskan kepada Anda sebagai PIC internal.`,
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
      after: { internalCode, assignedToId: primaryPicId, mappingMarkerIcon: input.mappingMarkerIcon },
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
        participantIds: input.picIds,
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
  if (input.picId && input.picId !== current.picId) {
    if (actor.role !== Role.SUPERVISOR && actor.role !== Role.ADMIN)
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
  const targetAppointmentStatus =
    input.appointmentStatus ?? current.appointmentStatus;
  const targetAppointmentAt =
    input.appointmentAt !== undefined
      ? input.appointmentAt
      : current.appointmentAt;
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
        dueAt: input.dueAt,
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
      await tx.serviceCaseParticipant.deleteMany({
        where: { serviceCaseId: id, userId: current.picId },
      });
      await tx.serviceCaseParticipant.upsert({
        where: { serviceCaseId_userId: { serviceCaseId: id, userId: input.picId } },
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
      },
      after: {
        status: updated.status,
        picId: updated.picId,
        dueAt: updated.dueAt.toISOString(),
        appointmentStatus: updated.appointmentStatus,
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
      after: { status: ServiceCaseStatus.CANCELLED, deletedAt: new Date().toISOString() },
      requestId,
    });
    return { id, archived: true };
  });
}
