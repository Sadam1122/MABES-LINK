import {
  AppointmentStatus,
  BatchType,
  CaseOrigin,
  ExceptionCategory,
  ExceptionStatus,
  FollowUpStatus,
  HandoverStatus,
  OpportunityStage,
  Role,
  ServiceCaseStatus,
  UsageStatus,
  VisitOutcome,
} from "@prisma/client";
import { z } from "zod";

const optionalTrimmed = (max: number) =>
  z.string().trim().max(max).optional().nullable();

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
});

export const prospectCreateSchema = z.object({
  cakraReference: optionalTrimmed(80).transform((value) => value || null),
  businessAlias: z.string().trim().min(2).max(120),
  need: z.string().trim().min(5).max(500),
  contactPic: z.string().trim().min(2).max(100),
  assignedToId: z.string().min(1).optional(),
  areaBlock: optionalTrimmed(100).transform((value) => value || null),
  businessSector: optionalTrimmed(100).transform((value) => value || null),
  addressHint: optionalTrimmed(220).transform((value) => value || null),
  latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
  productNeeds: z.array(z.string().trim().min(2).max(80)).max(12).default([]),
  locationLabel: optionalTrimmed(120).transform((value) => value || null),
});

export const prospectPatchSchema = z
  .object({
    version: z.number().int().positive(),
    opportunityStage: z.nativeEnum(OpportunityStage).optional(),
    assignedToId: z.string().min(1).optional(),
    need: z.string().trim().min(5).max(500).optional(),
    contactPic: z.string().trim().min(2).max(100).optional(),
    areaBlock: optionalTrimmed(100),
    businessSector: optionalTrimmed(100),
    addressHint: optionalTrimmed(220),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    productNeeds: z.array(z.string().trim().min(2).max(80)).max(12).optional(),
    locationLabel: optionalTrimmed(120),
  })
  .superRefine((value, ctx) => {
    if ((value.latitude == null) !== (value.longitude == null)) {
      ctx.addIssue({
        code: "custom",
        path: ["latitude"],
        message: "Latitude dan longitude harus diisi bersama.",
      });
    }
  });

export const visitCreateSchema = z
  .object({
    prospectId: z.string().min(1),
    visitedAt: z.coerce.date(),
    outcome: z.nativeEnum(VisitOutcome),
    notes: z.string().trim().min(3).max(700),
    nextAction: optionalTrimmed(300),
    nextActionDueAt: z.coerce.date().optional().nullable(),
    createFollowUp: z.boolean().default(false),
  })
  .superRefine((value, ctx) => {
    if (value.createFollowUp && (!value.nextAction || !value.nextActionDueAt)) {
      ctx.addIssue({
        code: "custom",
        path: ["nextAction"],
        message: "Next action dan jadwal wajib untuk membuat tindak lanjut.",
      });
    }
  });

export const notificationConfigSchema = z.object({
  reminderMinutesBefore: z.number().int().min(0).max(1440).default(30),
  digestTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .default("08:00"),
  quietStart: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .default("20:00"),
  quietEnd: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .default("07:00"),
  timezone: z.literal("Asia/Jakarta").default("Asia/Jakarta"),
});

export const serviceCaseCreateSchema = z
  .object({
    prospectId: z.string().min(1),
    origin: z.nativeEnum(CaseOrigin),
    title: z.string().trim().min(3).max(160),
    description: z.string().trim().min(5).max(700),
    picId: z.string().min(1),
    nextAction: z.string().trim().min(3).max(300),
    dueAt: z.coerce.date(),
    appointmentStatus: z
      .nativeEnum(AppointmentStatus)
      .default(AppointmentStatus.NEEDS_SCHEDULING),
    appointmentAt: z.coerce.date().optional().nullable(),
    sourceSystem: optionalTrimmed(40),
    sourceReference: optionalTrimmed(100),
  })
  .superRefine((value, ctx) => {
    if (
      value.appointmentStatus === AppointmentStatus.CONFIRMED &&
      !value.appointmentAt
    )
      ctx.addIssue({
        code: "custom",
        path: ["appointmentAt"],
        message: "Waktu janji wajib untuk janji terkonfirmasi.",
      });
    if ((value.sourceSystem == null) !== (value.sourceReference == null))
      ctx.addIssue({
        code: "custom",
        path: ["sourceReference"],
        message: "Sistem dan referensi sumber harus diisi bersama.",
      });
  });

export const serviceCasePatchSchema = z
  .object({
    version: z.number().int().positive(),
    status: z.nativeEnum(ServiceCaseStatus).optional(),
    picId: z.string().min(1).optional(),
    nextAction: z.string().trim().min(3).max(300).optional(),
    dueAt: z.coerce.date().optional(),
    appointmentStatus: z.nativeEnum(AppointmentStatus).optional(),
    appointmentAt: z.coerce.date().optional().nullable(),
    waitReason: optionalTrimmed(500),
    escalationReason: optionalTrimmed(500),
  })
  .superRefine((value, ctx) => {
    if (
      value.appointmentStatus === AppointmentStatus.CONFIRMED &&
      !value.appointmentAt
    )
      ctx.addIssue({
        code: "custom",
        path: ["appointmentAt"],
        message: "Waktu janji wajib untuk janji terkonfirmasi.",
      });
  });

export const followUpCreateSchema = z.object({
  prospectId: z.string().min(1),
  assignedToId: z.string().min(1).optional(),
  summary: z.string().trim().min(3).max(500),
  nextAction: z.string().trim().min(3).max(300),
  dueAt: z.coerce.date(),
});

export const followUpPatchSchema = z.object({
  version: z.number().int().positive(),
  status: z.nativeEnum(FollowUpStatus).optional(),
  assignedToId: z.string().min(1).optional(),
  nextAction: z.string().trim().min(3).max(300).optional(),
  dueAt: z.coerce.date().optional(),
});

export const handoverCreateSchema = z
  .object({
    type: z.nativeEnum(BatchType),
    title: z.string().trim().min(3).max(150),
    receiverId: z.string().min(1),
    prospectIds: z.array(z.string().min(1)).min(1).max(100),
  })
  .superRefine((value, ctx) => {
    if (value.type === BatchType.SINGLE && value.prospectIds.length !== 1) {
      ctx.addIssue({
        code: "custom",
        path: ["prospectIds"],
        message: "Batch SINGLE harus berisi tepat satu prospek.",
      });
    }
    if (new Set(value.prospectIds).size !== value.prospectIds.length) {
      ctx.addIssue({
        code: "custom",
        path: ["prospectIds"],
        message: "Prospek duplikat dalam batch.",
      });
    }
  });

export const handoverPatchSchema = z.object({
  version: z.number().int().positive(),
  status: z.nativeEnum(HandoverStatus),
});

export const exceptionCreateSchema = z.object({
  prospectId: z.string().min(1).optional().nullable(),
  category: z.nativeEnum(ExceptionCategory),
  title: z.string().trim().min(5).max(150),
  detail: z.string().trim().min(10).max(700),
  assignedToId: z.string().min(1).optional().nullable(),
});

export const exceptionPatchSchema = z.object({
  version: z.number().int().positive(),
  status: z.nativeEnum(ExceptionStatus),
  assignedToId: z.string().min(1).optional().nullable(),
});

export const usageCreateSchema = z.object({
  prospectId: z.string().min(1),
  status: z.nativeEnum(UsageStatus).default(UsageStatus.VERIFIED),
  usedAt: z.coerce
    .date()
    .refine(
      (date) => date <= new Date(),
      "Tanggal penggunaan tidak boleh di masa depan.",
    ),
  evidenceReference: z.string().trim().min(4).max(150),
  note: optionalTrimmed(500).transform((value) => value || null),
});

export const userCreateSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(200),
  password: z.string().min(12).max(128),
  role: z.nativeEnum(Role),
  branchId: z.string().min(1).nullable(),
});

export const userPatchSchema = z.object({
  role: z.nativeEnum(Role).optional(),
  branchId: z.string().min(1).nullable().optional(),
  active: z.boolean().optional(),
  emailNotificationsEnabled: z.boolean().optional(),
});

export const pilotConfigSchema = z.object({
  days: z.coerce.number().int().min(1).max(90),
  startedAt: z.string().date(),
});
