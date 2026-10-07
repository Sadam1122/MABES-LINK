import {
  AcquisitionMetricUnit,
  AcquisitionStatus,
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

import { mappingMarkerIcons } from "@/lib/mapping-icons";
import {
  acquisitionCategoryIds,
  isAcquisitionProductInCategory,
} from "@/lib/acquisition-products";

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
  locationSource: z
    .enum(["MAP_PIN", "MANUAL_COORDINATES", "DEVICE_GEOLOCATION"])
    .optional()
    .nullable(),
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
    locationSource: z
      .enum(["MAP_PIN", "MANUAL_COORDINATES", "DEVICE_GEOLOCATION"])
      .nullable()
      .optional(),
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

export const mappingLocationPatchSchema = z
  .object({
    version: z.number().int().positive(),
    latitude: z.number().min(-90).max(90).nullable(),
    longitude: z.number().min(-180).max(180).nullable(),
    locationLabel: optionalTrimmed(120),
    locationSource: z
      .enum(["MAP_PIN", "MANUAL_COORDINATES", "DEVICE_GEOLOCATION", "WORKBOOK_UNVERIFIED"])
      .nullable(),
    mappingMarkerIcon: z.enum(mappingMarkerIcons).optional(),
  })
  .superRefine((value, ctx) => {
    if ((value.latitude == null) !== (value.longitude == null))
      ctx.addIssue({
        code: "custom",
        path: ["latitude"],
        message: "Latitude dan longitude harus diisi bersama.",
      });
    if (value.latitude != null && value.locationSource == null)
      ctx.addIssue({
        code: "custom",
        path: ["locationSource"],
        message: "Sumber lokasi wajib untuk koordinat yang disimpan.",
      });
  });

export const mappingLocationCreateSchema = z.object({
  businessAlias: z.string().trim().min(2).max(120),
  contactPic: optionalTrimmed(100).transform((value) => value || null),
  need: z.string().trim().max(500).default("Belum dikonfirmasi"),
  assignedToId: z.string().min(1),
  areaBlock: optionalTrimmed(100).transform((value) => value || null),
  businessSector: optionalTrimmed(100).transform((value) => value || null),
  addressHint: optionalTrimmed(220).transform((value) => value || null),
  productNeeds: z.array(z.string().trim().min(2).max(80)).max(12).default([]),
  locationLabel: optionalTrimmed(120).transform((value) => value || null),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  locationSource: z.enum([
    "MAP_PIN",
    "MANUAL_COORDINATES",
    "DEVICE_GEOLOCATION",
  ]).nullable(),
  mappingMarkerIcon: z.enum(mappingMarkerIcons),
}).refine((value) => (value.latitude === null) === (value.longitude === null), {
  path: ["longitude"], message: "Latitude dan longitude harus diisi bersama atau sama-sama kosong.",
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
    prospectVersion: z.number().int().positive().optional(),
    contactPic: z.string().trim().min(2).max(100).optional(),
    businessAlias: z.string().trim().min(2).max(120).optional(),
    locationLabel: optionalTrimmed(120),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    locationSource: z
      .enum(["MAP_PIN", "MANUAL_COORDINATES", "DEVICE_GEOLOCATION"])
      .nullable()
      .optional(),
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
    if ((value.latitude == null) !== (value.longitude == null))
      ctx.addIssue({
        code: "custom",
        path: ["latitude"],
        message: "Latitude dan longitude harus diisi bersama.",
      });
    const updatesProspect =
      value.contactPic !== undefined ||
      value.businessAlias !== undefined ||
      value.locationLabel !== undefined ||
      value.latitude !== undefined ||
      value.longitude !== undefined ||
      value.locationSource !== undefined;
    if (updatesProspect && !value.prospectVersion)
      ctx.addIssue({
        code: "custom",
        path: ["prospectVersion"],
        message: "Versi referensi wajib untuk memperbarui data janji.",
      });
  });

export const appointmentCreateSchema = z
  .object({
    acquisitionCategory: z.enum(acquisitionCategoryIds),
    acquisitionProduct: z.string().trim().min(1).max(80),
    acquisitionStatus: z
      .nativeEnum(AcquisitionStatus)
      .default(AcquisitionStatus.PROSPECT),
    contactName: z.string().trim().min(2).max(100),
    businessAlias: optionalTrimmed(120).transform((value) => value || null),
    customerCif: optionalTrimmed(40)
      .refine(
        (value) => !value || /^[A-Za-z0-9-]+$/.test(value),
        "CIF hanya boleh memuat huruf, angka, dan tanda hubung.",
      )
      .transform((value) => value || null),
    customerAccount: optionalTrimmed(40)
      .refine(
        (value) => !value || /^\d{6,30}$/.test(value),
        "Nomor rekening harus 6–30 digit.",
      )
      .transform((value) => value || null),
    customerPhone: optionalTrimmed(30)
      .refine(
        (value) => !value || /^\+?[0-9][0-9\s()-]{7,29}$/.test(value),
        "Nomor HP tidak valid.",
      )
      .transform((value) => value || null),
    reason: z.string().trim().min(5).max(700),
    nextAction: z.string().trim().min(3).max(300),
    picIds: z.array(z.string().min(1)).min(1).max(10),
    appointmentAt: z.coerce.date(),
    targetValue: z.number().min(0).max(999_999_999_999_999).nullable(),
    realizationValue: z.number().min(0).max(999_999_999_999_999).nullable(),
    metricUnit: z.nativeEnum(AcquisitionMetricUnit).nullable(),
    locationLabel: z.string().trim().min(2).max(120),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    locationSource: z.enum([
      "MAP_PIN",
      "MANUAL_COORDINATES",
      "DEVICE_GEOLOCATION",
    ]),
    mappingMarkerIcon: z.enum(mappingMarkerIcons).default("STORE"),
  })
  .superRefine((value, ctx) => {
    if (
      !isAcquisitionProductInCategory(
        value.acquisitionCategory,
        value.acquisitionProduct,
      )
    )
      ctx.addIssue({
        code: "custom",
        path: ["acquisitionProduct"],
        message: "Produk tidak sesuai dengan kategori yang dipilih.",
      });
    if (
      (value.targetValue != null || value.realizationValue != null) &&
      value.metricUnit == null
    )
      ctx.addIssue({
        code: "custom",
        path: ["metricUnit"],
        message: "Satuan wajib dipilih jika target atau realisasi diisi.",
      });
    if (new Set(value.picIds).size !== value.picIds.length)
      ctx.addIssue({
        code: "custom",
        path: ["picIds"],
        message: "PIC internal tidak boleh duplikat.",
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
    acquisitionStatus: z.nativeEnum(AcquisitionStatus).optional(),
    targetValue: z.number().min(0).max(999_999_999_999_999).nullable().optional(),
    realizationValue: z
      .number()
      .min(0)
      .max(999_999_999_999_999)
      .nullable()
      .optional(),
    metricUnit: z.nativeEnum(AcquisitionMetricUnit).nullable().optional(),
    customerCif: optionalTrimmed(40),
    customerAccount: optionalTrimmed(40),
    customerPhone: optionalTrimmed(30),
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
