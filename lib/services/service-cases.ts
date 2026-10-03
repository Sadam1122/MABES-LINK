import {
  AppointmentStatus,
  Prisma,
  Role,
  ServiceCaseStatus,
} from "@prisma/client";
import type { z } from "zod";

import { writeAudit } from "@/lib/audit";
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
  paginationSchema,
  serviceCaseCreateSchema,
  serviceCasePatchSchema,
} from "@/lib/validation";
import { assertServiceCaseTransition } from "@/lib/workflow";

type PageInput = z.infer<typeof paginationSchema> & {
  status?: ServiceCaseStatus;
  appointmentStatus?: AppointmentStatus;
  overdue?: boolean;
};
type CreateInput = z.infer<typeof serviceCaseCreateSchema>;
type PatchInput = z.infer<typeof serviceCasePatchSchema>;

const include = {
  prospect: {
    select: {
      id: true,
      internalCode: true,
      cakraReference: true,
      businessAlias: true,
      need: true,
      locationLabel: true,
      latitude: true,
      longitude: true,
      usageVerifications: { where: { status: "VERIFIED" as const }, take: 1 },
    },
  },
  pic: { select: { id: true, name: true, role: true } },
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
                prospect: {
                  internalCode: { contains: input.search, mode: "insensitive" },
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
  const [items, total] = await db.$transaction([
    db.serviceCase.findMany({
      where,
      include,
      orderBy: [{ status: "asc" }, { dueAt: "asc" }],
      skip,
      take: input.pageSize,
    }),
    db.serviceCase.count({ where }),
  ]);
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
      current.picId !== actor.id
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
    const terminal =
      updated.status === ServiceCaseStatus.HANDLED ||
      updated.status === ServiceCaseStatus.VERIFIED ||
      updated.status === ServiceCaseStatus.CLOSED ||
      updated.status === ServiceCaseStatus.CANCELLED;
    if (
      terminal ||
      (updated.appointmentStatus !== AppointmentStatus.NEEDS_SCHEDULING &&
        updated.appointmentStatus !== AppointmentStatus.PENDING_CONFIRMATION)
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
