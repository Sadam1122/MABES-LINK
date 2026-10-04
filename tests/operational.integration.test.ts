import "../scripts/load-env";

import { rm } from "node:fs/promises";
import path from "node:path";
import {
  AppointmentStatus,
  CaseOrigin,
  EmailDeliveryStatus,
  OutboxJobType,
  OutboxStatus,
  Role,
  ServiceCaseStatus,
} from "@prisma/client";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import {
  geolocationErrorMessage,
  googleMapsLocationUrl,
  googleMapsNavigationUrl,
  haversineMeters,
} from "@/lib/geo";
import { deliverInternalEmail } from "@/lib/notifications";
import type { Actor } from "@/lib/session";
import {
  addLocationPhoto,
  deleteLocationPhoto,
  getLocationPhoto,
  replaceLocationPhoto,
  validateAndEncodeLocationImage,
} from "@/lib/services/location-photos";
import {
  createServiceCase,
  getServiceCase,
  listServiceCases,
  updateServiceCase,
} from "@/lib/services/service-cases";
import { updateProspect } from "@/lib/services/prospects";
import { prospectPatchSchema } from "@/lib/validation";

const suffix = crypto.randomUUID().slice(0, 8);
const branchId = `operational-main-${suffix}`;
const otherBranchId = `operational-other-${suffix}`;
const prospectId = `operational-prospect-${suffix}`;
const storageRoot = path.join(
  process.cwd(),
  ".data",
  `test-private-uploads-${suffix}`,
);
const actorA: Actor = {
  id: `operational-out-a-${suffix}`,
  name: "Petugas Operasional A",
  email: `operational-a-${suffix}@example.invalid`,
  role: Role.OUT_BRANCH,
  branchId,
};
const actorB: Actor = {
  id: `operational-out-b-${suffix}`,
  name: "Petugas Operasional B",
  email: `operational-b-${suffix}@example.invalid`,
  role: Role.OUT_BRANCH,
  branchId,
};
const actorOtherBranch: Actor = {
  id: `operational-other-${suffix}`,
  name: "Petugas Cabang Lain",
  email: `operational-other-${suffix}@example.invalid`,
  role: Role.OUT_BRANCH,
  branchId: otherBranchId,
};
const supervisor: Actor = {
  id: `operational-supervisor-${suffix}`,
  name: "Supervisor",
  email: `operational-supervisor-${suffix}@example.invalid`,
  role: Role.SUPERVISOR,
  branchId,
};
const caseIds: string[] = [];
const photoIds: string[] = [];

describe("operasional ServiceCase, lokasi, dan storage privat", () => {
  beforeAll(async () => {
    process.env.PRIVATE_STORAGE_PATH = storageRoot;
    await db.branch.createMany({
      data: [
        {
          id: branchId,
          code: `O${suffix}`,
          name: "Cabang Uji Operasional",
          classCode: "B.2",
        },
        {
          id: otherBranchId,
          code: `P${suffix}`,
          name: "Cabang Uji Pembanding",
          classCode: "B.2",
        },
      ],
    });
    await db.user.createMany({
      data: [actorA, actorB, actorOtherBranch, supervisor].map((actor) => ({
        id: actor.id,
        name: actor.name,
        email: actor.email,
        emailVerified: true,
        role: actor.role,
        active: true,
        isTest: false,
        branchId: actor.branchId,
      })),
    });
    await db.prospect.create({
      data: {
        id: prospectId,
        internalCode: `OP-${suffix}`,
        cakraReference: `CAKRA-OP-${suffix}`,
        businessAlias: "Lokasi Usaha Samaran",
        need: "Kebutuhan layanan operasional samaran",
        contactPic: "PIC Samaran",
        branchId,
        assignedToId: actorA.id,
        createdById: actorA.id,
      },
    });
  });

  afterAll(async () => {
    await db.emailDelivery.deleteMany({
      where: { outboxJob: { serviceCaseId: { in: caseIds } } },
    });
    await db.outboxJob.deleteMany({
      where: { serviceCaseId: { in: caseIds } },
    });
    await db.notification.deleteMany({
      where: { serviceCaseId: { in: caseIds } },
    });
    await db.locationPhoto.deleteMany({ where: { prospectId } });
    await db.serviceCase.deleteMany({ where: { id: { in: caseIds } } });
    await db.auditLog.deleteMany({ where: { branchId } });
    await db.prospect.deleteMany({ where: { id: prospectId } });
    await db.user.deleteMany({
      where: {
        id: { in: [actorA.id, actorB.id, actorOtherBranch.id, supervisor.id] },
      },
    });
    await db.branch.deleteMany({
      where: { id: { in: [branchId, otherBranchId] } },
    });
    await rm(storageRoot, { recursive: true, force: true });
    await db.$disconnect();
  });

  it("menyimpan koordinat nol, menolak batas/pasangan invalid, dan membentuk URL resmi", async () => {
    expect(
      prospectPatchSchema.safeParse({ version: 1, latitude: 0, longitude: 0 })
        .success,
    ).toBe(true);
    expect(
      prospectPatchSchema.safeParse({ version: 1, latitude: 91, longitude: 0 })
        .success,
    ).toBe(false);
    expect(
      prospectPatchSchema.safeParse({ version: 1, latitude: -6.15 }).success,
    ).toBe(false);
    const updated = await updateProspect(actorA, prospectId, {
      version: 1,
      latitude: 0,
      longitude: 0,
      locationLabel: "Titik ekuator",
      locationSource: "MANUAL_COORDINATES",
    });
    expect(updated.latitude?.toString()).toBe("0");
    expect(updated.longitude?.toString()).toBe("0");
    expect(updated.locationUpdatedAt).toBeInstanceOf(Date);
    expect(updated.locationSource).toBe("MANUAL_COORDINATES");

    const location = new URL(
      googleMapsLocationUrl({ latitude: -6.1501234, longitude: 106.8205678 }),
    );
    expect(location.origin + location.pathname).toBe(
      "https://www.google.com/maps/search/",
    );
    expect(location.searchParams.get("api")).toBe("1");
    expect(location.searchParams.get("query")).toBe("-6.1501234,106.8205678");
    const navigation = new URL(
      googleMapsNavigationUrl({
        latitude: -6.1501234,
        longitude: 106.8205678,
      }),
    );
    expect(navigation.searchParams.get("destination")).toBe(
      "-6.1501234,106.8205678",
    );
    expect(navigation.searchParams.get("dir_action")).toBe("navigate");
    expect(
      haversineMeters(
        { latitude: 0, longitude: 0 },
        { latitude: 0, longitude: 1 },
      ),
    ).toBeCloseTo(111_195, -1);
    expect(geolocationErrorMessage(1)).toContain("ditolak");
    expect(geolocationErrorMessage(2)).toContain("tidak tersedia");
    expect(geolocationErrorMessage(3)).toContain("batas waktu");
  });

  it("mewajibkan PIC mengakui pekerjaan dan menolak akses lintas penugasan/cabang", async () => {
    const prospectBeforeAppointment = await db.prospect.findUniqueOrThrow({
      where: { id: prospectId },
      select: { version: true },
    });
    const item = await createServiceCase(supervisor, {
      prospectId,
      prospectVersion: prospectBeforeAppointment.version,
      origin: CaseOrigin.OUT_BRANCH,
      title: "Penanganan layanan samaran",
      description: "Kendala aktivasi melalui prosedur resmi",
      picId: actorA.id,
      nextAction: "Hubungi untuk membuat janji",
      dueAt: new Date(Date.now() + 3_600_000),
      appointmentStatus: AppointmentStatus.NEEDS_SCHEDULING,
      sourceSystem: "CAKRA",
      sourceReference: `OP-SOURCE-${suffix}`,
      contactPic: "Kontak Janji Samaran",
      businessAlias: "Toko Janji Samaran",
      locationLabel: "Pintu utama lokasi samaran",
      latitude: -6.1447,
      longitude: 106.81825,
      locationSource: "MAP_PIN",
    });
    caseIds.push(item.id);
    expect(item.status).toBe(ServiceCaseStatus.ASSIGNED);
    const appointmentProspect = await db.prospect.findUniqueOrThrow({
      where: { id: prospectId },
      select: {
        contactPic: true,
        businessAlias: true,
        locationLabel: true,
        latitude: true,
        longitude: true,
      },
    });
    expect(appointmentProspect).toMatchObject({
      contactPic: "Kontak Janji Samaran",
      businessAlias: "Toko Janji Samaran",
      locationLabel: "Pintu utama lokasi samaran",
    });
    expect(appointmentProspect.latitude?.toString()).toBe("-6.1447");
    expect(appointmentProspect.longitude?.toString()).toBe("106.81825");
    expect(
      await db.auditLog.count({
        where: {
          entityType: "Prospect",
          entityId: prospectId,
          action: "APPOINTMENT_CONTEXT_UPDATED",
        },
      }),
    ).toBe(1);
    expect(
      await db.outboxJob.count({
        where: { serviceCaseId: item.id, status: OutboxStatus.PENDING },
      }),
    ).toBe(2);
    await expect(getServiceCase(actorB, item.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      getServiceCase(actorOtherBranch, item.id),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      updateServiceCase(supervisor, item.id, {
        version: item.version,
        status: ServiceCaseStatus.ACCEPTED,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      updateServiceCase(actorA, item.id, {
        version: item.version,
        status: ServiceCaseStatus.HANDLED,
      }),
    ).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
    const accepted = await updateServiceCase(actorA, item.id, {
      version: item.version,
      status: ServiceCaseStatus.ACCEPTED,
    });
    expect(accepted.acceptedById).toBe(actorA.id);
    expect(accepted.acceptedAt).toBeInstanceOf(Date);
  });

  it("reschedule, pergantian PIC, konfirmasi, dan selesai membatalkan reminder lama", async () => {
    const item = await createServiceCase(supervisor, {
      prospectId,
      origin: CaseOrigin.IN_BRANCH,
      title: "Konfirmasi janji samaran",
      description: "Tugas internal tanpa undangan otomatis kepada nasabah",
      picId: actorA.id,
      nextAction: "Buat janji",
      dueAt: new Date(Date.now() + 7_200_000),
      appointmentStatus: AppointmentStatus.NEEDS_SCHEDULING,
    });
    caseIds.push(item.id);
    const changed = await updateServiceCase(supervisor, item.id, {
      version: item.version,
      picId: actorB.id,
      dueAt: new Date(Date.now() + 10_800_000),
      appointmentStatus: AppointmentStatus.PENDING_CONFIRMATION,
    });
    expect(
      await db.outboxJob.count({
        where: {
          serviceCaseId: item.id,
          scheduleVersion: item.version,
          status: OutboxStatus.CANCELLED,
        },
      }),
    ).toBe(2);
    expect(
      await db.outboxJob.count({
        where: {
          serviceCaseId: item.id,
          scheduleVersion: changed.version,
          recipientId: actorB.id,
          status: OutboxStatus.PENDING,
        },
      }),
    ).toBe(2);
    const confirmed = await updateServiceCase(actorB, item.id, {
      version: changed.version,
      appointmentStatus: AppointmentStatus.CONFIRMED,
      appointmentAt: new Date(Date.now() + 86_400_000),
    });
    expect(confirmed.appointmentStatus).toBe(AppointmentStatus.CONFIRMED);
    const confirmedJobs = await db.outboxJob.findMany({
        where: {
          serviceCaseId: item.id,
          scheduleVersion: confirmed.version,
          status: OutboxStatus.PENDING,
        },
        orderBy: { runAt: "asc" },
    });
    expect(confirmedJobs).toHaveLength(2);
    expect(confirmedJobs.every((job) => job.recipientId === actorB.id)).toBe(
      true,
    );
    const dueJob = confirmedJobs.find(
      (job) => job.type === OutboxJobType.APPOINTMENT_ACTION_DUE,
    );
    const preJob = confirmedJobs.find(
      (job) => job.type === OutboxJobType.APPOINTMENT_PRE_DUE,
    );
    expect(dueJob?.runAt.getTime()).toBe(confirmed.appointmentAt?.getTime());
    expect(preJob?.runAt.getTime()).toBe(
      (confirmed.appointmentAt?.getTime() ?? 0) - 30 * 60_000,
    );
    const accepted = await updateServiceCase(actorB, item.id, {
      version: confirmed.version,
      status: ServiceCaseStatus.ACCEPTED,
    });
    const processing = await updateServiceCase(actorB, item.id, {
      version: accepted.version,
      status: ServiceCaseStatus.IN_PROGRESS,
    });
    const handled = await updateServiceCase(actorB, item.id, {
      version: processing.version,
      status: ServiceCaseStatus.HANDLED,
    });
    expect(handled.handledAt).toBeInstanceOf(Date);
    expect(
      await db.outboxJob.count({
        where: {
          serviceCaseId: item.id,
          status: { in: [OutboxStatus.PENDING, OutboxStatus.PROCESSING] },
        },
      }),
    ).toBe(0);
    expect(await db.usageVerification.count({ where: { prospectId } })).toBe(0);
    const verified = await updateServiceCase(supervisor, item.id, {
      version: handled.version,
      status: ServiceCaseStatus.VERIFIED,
    });
    const closed = await updateServiceCase(supervisor, item.id, {
      version: verified.version,
      status: ServiceCaseStatus.CLOSED,
    });
    expect(closed.closedAt).toBeInstanceOf(Date);
  });

  it("menyembunyikan ruang data test dari daftar operasional", async () => {
    const testCase = await db.serviceCase.create({
      data: {
        code: `TEST-ISOLATED-${suffix}`,
        branchId,
        prospectId,
        origin: CaseOrigin.OUT_BRANCH,
        status: ServiceCaseStatus.ASSIGNED,
        title: "Data uji terisolasi",
        description: "Tidak boleh muncul dalam daftar operasional",
        picId: actorA.id,
        createdById: actorA.id,
        nextAction: "Uji isolasi",
        dueAt: new Date(),
        isTest: true,
        testNamespace: `isolated-${suffix}`,
      },
    });
    caseIds.push(testCase.id);
    const visible = await listServiceCases(supervisor, {
      page: 1,
      pageSize: 100,
      search: `TEST-ISOLATED-${suffix}`,
    });
    expect(visible.pagination.total).toBe(0);
  });

  it("memvalidasi, re-encode, mengotorisasi, dan menghapus gambar privat", async () => {
    const png = await sharp({
      create: {
        width: 16,
        height: 12,
        channels: 3,
        background: { r: 30, g: 90, b: 150 },
      },
    })
      .png()
      .toBuffer();
    const encoded = await validateAndEncodeLocationImage(png);
    expect(encoded.mimeType).toBe("image/webp");
    expect(encoded.width).toBe(16);
    await expect(
      validateAndEncodeLocationImage(Buffer.from("not-an-image")),
    ).rejects.toMatchObject({ code: "INVALID_IMAGE" });
    await expect(
      validateAndEncodeLocationImage(
        Buffer.from(
          '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>',
        ),
      ),
    ).rejects.toMatchObject({ code: "INVALID_IMAGE_TYPE" });

    const photo = await addLocationPhoto(
      actorA,
      prospectId,
      new File([png], "lokasi.png", { type: "image/png" }),
    );
    photoIds.push(photo.id);
    expect(photo.storageKey.endsWith(".webp")).toBe(true);
    const loaded = await getLocationPhoto(actorA, photo.id);
    expect(loaded.data.length).toBeGreaterThan(0);
    await expect(getLocationPhoto(actorB, photo.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    const replacement = await sharp({
      create: {
        width: 8,
        height: 8,
        channels: 3,
        background: { r: 20, g: 180, b: 70 },
      },
    })
      .jpeg()
      .toBuffer();
    const replaced = await replaceLocationPhoto(
      actorA,
      photo.id,
      new File([replacement], "pengganti.jpg", { type: "image/jpeg" }),
    );
    expect(replaced.id).toBe(photo.id);
    expect(replaced.checksum).not.toBe(photo.checksum);
    await deleteLocationPhoto(actorA, photo.id);
    await expect(getLocationPhoto(actorA, photo.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("membentuk email uji tanpa identitas nasabah melalui transport dry-run", async () => {
    const originalEnabled = process.env.EMAIL_ENABLED;
    const originalDryRun = process.env.SMTP_DRY_RUN;
    process.env.EMAIL_ENABLED = "true";
    process.env.SMTP_DRY_RUN = "true";
    let captured: { subject?: string; text?: string; to?: string } = {};
    const result = await deliverInternalEmail(
      {
        to: "sadamalrasyid1@gmail.com",
        taskCode: `UJI-${suffix}`,
        reminderType: "Perlu membuat janji",
        scheduledAt: new Date("2026-10-03T01:00:00.000Z"),
        link: "https://internal.example/work/task",
        isTest: true,
      },
      db,
      {
        sendMail: async (mail: typeof captured) => {
          captured = mail;
          return { messageId: "dry-run-message", message: "preview" };
        },
      } as never,
    );
    if (originalEnabled === undefined) delete process.env.EMAIL_ENABLED;
    else process.env.EMAIL_ENABLED = originalEnabled;
    if (originalDryRun === undefined) delete process.env.SMTP_DRY_RUN;
    else process.env.SMTP_DRY_RUN = originalDryRun;
    expect(result.status).toBe(EmailDeliveryStatus.DRY_RUN);
    expect(captured.to).toBe("sadamalrasyid1@gmail.com");
    expect(captured.subject).toBe(
      `[UJI] Pengingat Membuat Janji Akuisisi — UJI-${suffix}`,
    );
    expect(captured.text).toContain("Silakan hubungi calon nasabah");
    expect(captured.text).toContain("Waktu tindak lanjut:");
    expect(captured.text).toContain("Buka detail pekerjaan:");
    expect(captured.text).not.toMatch(
      /rekening|saldo|alamat nasabah|nomor telepon/i,
    );
  });
});
