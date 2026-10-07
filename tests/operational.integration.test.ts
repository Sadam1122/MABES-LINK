import "../scripts/load-env";

import { existsSync, readFileSync } from "node:fs";
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
import ExcelJS from "exceljs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { commitMappingImport, exportWorkbook, parseMappingWorkbook, planMappingImport, templateWorkbook } from "@/lib/mapping-excel";
import {
  geolocationErrorMessage,
  googleMapsLocationUrl,
  googleMapsAddressSearchUrl,
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
  archiveServiceCase,
  createAppointment,
  createServiceCase,
  getServiceCase,
  listAppointmentLocations,
  listServiceCases,
  updateServiceCase,
} from "@/lib/services/service-cases";
import {
  createMappingLocation,
  updateMappingLocation,
} from "@/lib/services/mapping";
import { getMappingDiscovery, saveMappingDiscovery, saveMappingOpportunity } from "@/lib/services/mapping-discovery";
import { listMappingProspects } from "@/lib/services/visits";
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
const createdProspectIds: string[] = [];
const photoIds: string[] = [];
const suppliedWorkbook = path.join(process.cwd(), "link_mapping_6_Oktober_2026_REVISI.xlsx");

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
    await db.auditLog.deleteMany({ where: { branchId: { in: [branchId, otherBranchId] } } });
    await db.usageVerification.deleteMany({
      where: { prospectId: { in: createdProspectIds } },
    });
    await db.prospect.deleteMany({
      where: { id: { in: [prospectId, ...createdProspectIds] } },
    });
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
    const sameBranchUpdate = await updateMappingLocation(actorB, prospectId, {
      version: updated.version,
      latitude: -6.1447,
      longitude: 106.81825,
      locationLabel: "Mapping bersama cabang",
      locationSource: "MAP_PIN",
    });
    expect(sameBranchUpdate.locationLabel).toBe("Mapping bersama cabang");
    const mappingAudit = await db.auditLog.findFirstOrThrow({
      where: {
        entityType: "Prospect",
        entityId: prospectId,
        action: "MAPPING_LOCATION_UPDATED",
      },
      orderBy: { createdAt: "desc" },
      select: { actorId: true, actorName: true, actorRole: true },
    });
    expect(mappingAudit).toEqual({
      actorId: actorB.id,
      actorName: actorB.name,
      actorRole: Role.OUT_BRANCH,
    });
    await expect(
      updateMappingLocation(actorOtherBranch, prospectId, {
        version: sameBranchUpdate.version,
        latitude: -6.1447,
        longitude: 106.81825,
        locationLabel: "Tidak boleh tersimpan",
        locationSource: "MAP_PIN",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    const location = new URL(
      googleMapsLocationUrl({ latitude: -6.1501234, longitude: 106.8205678 }),
    );
    expect(location.origin + location.pathname).toBe(
      "https://www.google.com/maps/search/",
    );
    expect(location.searchParams.get("api")).toBe("1");
    expect(location.searchParams.get("query")).toBe("-6.1501234,106.8205678");
    const addressSearch = new URL(googleMapsAddressSearchUrl("Jl. Mangga Besar No. 10, Jakarta"));
    expect(addressSearch.searchParams.get("query")).toBe("Jl. Mangga Besar No. 10, Jakarta");
    expect(addressSearch.searchParams.get("api")).toBe("1");
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

  it("template Excel mengimpor lokasi tanpa memverifikasi penggunaan, menolak lintas cabang, dan menjaga versi", async () => {
    const template = await templateWorkbook();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(template) as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    const sheet = workbook.getWorksheet("Mapping")!;
    expect(sheet.rowCount).toBe(1);
    expect(workbook.getWorksheet("Contoh")?.getCell("D4").value).toBe("Kedai Contoh Samaran");
    expect(workbook.getWorksheet("Contoh")?.getCell("F4").value).toBeNull();
    expect(workbook.getWorksheet("Pilihan Ikon")?.getCell("A9").value).toBe("CAFE");
    expect(workbook.getWorksheet("Pilihan Ikon")?.getCell("B9").value).toBe("☕");
    expect(workbook.getWorksheet("Petunjuk")?.getCell("A2").value).toBe("HIJAU · WAJIB");
    expect(sheet.getCell("D1").fill).toMatchObject({ fgColor: { argb: "FF047857" } });
    expect(sheet.getCell("F1").fill).toMatchObject({ fgColor: { argb: "FF245A91" } });
    expect((await parseMappingWorkbook(new File([Buffer.from(template)], "template.xlsx"))).rows).toHaveLength(0);
    sheet.addRow(["", "", `O${suffix}`, "Toko Samaran Excel", "Titik impor", 0, 0,
      actorA.email, "Blok Uji", "Ritel", "Sebelah pasar", "QRIS; EDC", "", "CAFE"]);
    const file = new File([Buffer.from(await workbook.xlsx.writeBuffer())], "mapping.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const preview = await planMappingImport(actorA, file);
    expect(preview.summary).toEqual({ total: 1, create: 1, update: 0, invalid: 0 });
    expect((await planMappingImport(actorOtherBranch, file)).summary.invalid).toBe(1);
    await commitMappingImport(actorA, file);
    const created = await db.prospect.findFirstOrThrow({ where: { branchId, businessAlias: "Toko Samaran Excel" }, include: { usageVerifications: true } });
    createdProspectIds.push(created.id);
    expect(created.latitude?.toString()).toBe("0");
    expect(created.longitude?.toString()).toBe("0");
    expect(created.locationSource).toBe("WORKBOOK_UNVERIFIED");
    expect(created.usageVerifications).toHaveLength(0);
    expect(await db.notification.count({ where: { recipientId: actorA.id, dedupKey: `mapping-import-created:${created.id}` } })).toBe(1);
    expect((await planMappingImport(actorA, file)).summary.invalid).toBe(1);
    const exported = new ExcelJS.Workbook();
    await exported.xlsx.load(Buffer.from(await exportWorkbook(actorA)) as unknown as Parameters<typeof exported.xlsx.load>[0]);
    expect(exported.getWorksheet("Mapping")!.getColumn(1).values).toContain(created.internalCode);
    const otherExport = new ExcelJS.Workbook();
    await otherExport.xlsx.load(Buffer.from(await exportWorkbook(actorOtherBranch)) as unknown as Parameters<typeof otherExport.xlsx.load>[0]);
    expect(otherExport.getWorksheet("Mapping")!.getColumn(1).values).not.toContain(created.internalCode);
    const updateBook = new ExcelJS.Workbook();
    await updateBook.xlsx.load(Buffer.from(template) as unknown as Parameters<typeof updateBook.xlsx.load>[0]);
    updateBook.getWorksheet("Mapping")!.addRow([created.internalCode, created.version, `O${suffix}`, "", "Titik diperbarui", 0, 0, "", "", "", "", "", "", ""]);
    const updateFile = new File([Buffer.from(await updateBook.xlsx.writeBuffer())], "update.xlsx");
    expect((await planMappingImport(actorA, updateFile)).summary.update).toBe(1);
    await commitMappingImport(actorA, updateFile);
    expect((await planMappingImport(actorA, updateFile)).summary.invalid).toBe(1);
    const afterUpdate = await db.prospect.findUniqueOrThrow({ where: { id: created.id } });
    expect(afterUpdate.locationLabel).toBe("Titik diperbarui");
    expect(afterUpdate.areaBlock).toBe("Blok Uji");
    expect(afterUpdate.mappingMarkerIcon).toBe("CAFE");
    const invalidBook = new ExcelJS.Workbook();
    await invalidBook.xlsx.load(Buffer.from(template) as unknown as Parameters<typeof invalidBook.xlsx.load>[0]);
    const invalid = invalidBook.getWorksheet("Mapping")!;
    invalid.addRow(["", "", `O${suffix}`, "Bad", "", 91, 0, actorA.email]);
    invalid.addRow(["", "", `O${suffix}`, { formula: "1+1", result: 2 }, "", -6.15, 106.8, actorA.email]);
    const invalidFile = new File([Buffer.from(await invalidBook.xlsx.writeBuffer())], "invalid.xlsx");
    expect((await parseMappingWorkbook(invalidFile)).errors).toHaveLength(2);

    const noPinBook = new ExcelJS.Workbook();
    await noPinBook.xlsx.load(Buffer.from(template) as unknown as Parameters<typeof noPinBook.xlsx.load>[0]);
    noPinBook.getWorksheet("Mapping")!.addRow(["", "", "", `Toko Tanpa Pin ${suffix}`, "", "", "", "", "", "", "", "", "", "CAFE"]);
    const noPinFile = new File([Buffer.from(await noPinBook.xlsx.writeBuffer())], "tanpa-pin.xlsx");
    expect((await planMappingImport(actorA, noPinFile)).summary).toEqual({ total: 1, create: 1, update: 0, invalid: 0 });
    await commitMappingImport(actorA, noPinFile);
    const noPin = await db.prospect.findFirstOrThrow({ where: { branchId, businessAlias: `Toko Tanpa Pin ${suffix}` } });
    createdProspectIds.push(noPin.id);
    expect(noPin.latitude).toBeNull();
    expect(noPin.longitude).toBeNull();
    expect(noPin.mappingImportedAt).not.toBeNull();
    expect((await listMappingProspects(actorA, { page: 1, pageSize: 100 })).items.some((item) => item.id === noPin.id)).toBe(true);
    expect((await planMappingImport(actorA, noPinFile)).summary.invalid).toBe(1);
    await updateMappingLocation(actorA, noPin.id, { version: noPin.version,
      latitude: -6.145, longitude: 106.818, locationLabel: "Titik ditemukan",
      locationSource: "MAP_PIN" });
    expect((await listMappingProspects(actorA, { page: 1, pageSize: 100 })).items.some((item) => item.id === noPin.id)).toBe(true);
  });

  it("menambah lokasi prospek tanpa memverifikasi penggunaan dan menolak PIC lintas cabang", async () => {
    const mapped = await createMappingLocation(actorB, {
      businessAlias: "Toko Mapping Samaran",
      contactPic: null,
      need: "Menggunakan QRIS untuk transaksi usaha",
      assignedToId: actorB.id,
      areaBlock: "Blok Uji",
      businessSector: "Retail",
      addressHint: "Dekat persimpangan uji",
      productNeeds: ["QRIS"],
      locationLabel: "Toko Uji Mapping",
      latitude: -6.1447,
      longitude: 106.81825,
      locationSource: "MAP_PIN",
      mappingMarkerIcon: "MARKET",
    });
    createdProspectIds.push(mapped.id);
    expect(mapped.mappingMarkerIcon).toBe("MARKET");
    expect(mapped.branchId).toBe(branchId);
    expect(mapped.contactPic).toBe("Tidak dicantumkan");
    expect(mapped.need).toBe("Belum dikonfirmasi");
    expect(await db.usageVerification.count({ where: { prospectId: mapped.id } })).toBe(0);
    expect(await db.mappingDiscovery.count({ where: { prospectId: mapped.id } })).toBe(1);
    await expect(
      createMappingLocation(actorOtherBranch, {
        businessAlias: "Tidak Boleh Tersimpan",
        contactPic: null,
        need: "Uji pembatasan cabang",
        assignedToId: actorB.id,
        areaBlock: null,
        businessSector: null,
        addressHint: null,
        productNeeds: ["QRIS"],
        locationLabel: null,
        latitude: 0,
        longitude: 0,
        locationSource: "MANUAL_COORDINATES",
        mappingMarkerIcon: "STORE",
      }),
    ).rejects.toMatchObject({ code: "INVALID_ASSIGNEE" });
  });

  it.skipIf(!existsSync(suppliedWorkbook))("merencanakan impor 42 baris workbook revisi tanpa menulis data", async () => {
    const file = new File([readFileSync(suppliedWorkbook)], "link_mapping_6_Oktober_2026_REVISI.xlsx");
    const plan = await planMappingImport(actorA, file);
    expect(plan.summary).toEqual({ total: 42, create: 42, update: 0, invalid: 0 });
  });

  it("membatasi discovery per PIC dan membatalkan reminder ketika respons berubah", async () => {
    const previousApproval = process.env.MAPPING_APPROVED_PRODUCT_CODES;
    process.env.MAPPING_APPROVED_PRODUCT_CODES = "LIVIN_MERCHANT_QRIS";
    let taskId: string | null = null;
    try {
      await expect(getMappingDiscovery(actorOtherBranch, prospectId)).rejects.toMatchObject({ code: "NOT_FOUND" });
      const profile = {
        version: 0, segments: ["PEMBISNIS" as const], opportunityTags: ["LIVIN_MERCHANT_QRIS" as const],
        usedProductsKnown: false, usedProducts: [], usedProductsOther: null, sourceType: "FIELD_DISCOVERY" as const,
        sourceUrl: null, sourceCheckedAt: null, riskReviewRequired: false, foodRule: "EITHER" as const,
        gofoodRating: null, gofoodReviews: null, gofoodUrl: null, gofoodCheckedAt: null,
        grabfoodRating: null, grabfoodReviews: null, grabfoodUrl: null, grabfoodCheckedAt: null,
      };
      await expect(saveMappingDiscovery(actorB, prospectId, profile)).rejects.toMatchObject({ code: "FORBIDDEN" });
      await saveMappingDiscovery(actorA, prospectId, profile);
      const dueAt = new Date(Date.now() + 3_600_000);
      const opportunity = await saveMappingOpportunity(actorA, prospectId, {
        productCode: "LIVIN_MERCHANT_QRIS", needSummary: "Usaha menyatakan perlu menerima pembayaran QRIS",
        discoveryDone: true, needConfirmed: true, benefitExplained: true,
        response: "FOLLOW_UP", followUpConsent: true, nextAction: "Hubungi PIC untuk tindak lanjut",
        dueAt, evidenceNote: "Diskusi usaha pada kunjungan uji", assignedToId: actorA.id, version: 0,
      });
      taskId = opportunity.followUpId;
      expect(taskId).toBeTruthy();
      expect(await db.outboxJob.count({ where: { followUpId: taskId!, status: "PENDING" } })).toBe(2);
      await expect(saveMappingOpportunity(actorB, prospectId, {
        productCode: "LIVIN_MERCHANT_QRIS", needSummary: "Usaha menyatakan perlu menerima pembayaran QRIS",
        discoveryDone: true, needConfirmed: true, benefitExplained: true,
        response: "NOT_INTERESTED", followUpConsent: false, nextAction: null, dueAt: null,
        evidenceNote: "Diskusi uji", assignedToId: actorB.id, version: opportunity.version,
      })).rejects.toMatchObject({ code: "FORBIDDEN" });
      const reassigned = await saveMappingOpportunity(supervisor, prospectId, {
        productCode: "LIVIN_MERCHANT_QRIS", needSummary: "Usaha menyatakan perlu menerima pembayaran QRIS",
        discoveryDone: true, needConfirmed: true, benefitExplained: true,
        response: "FOLLOW_UP", followUpConsent: true, nextAction: "PIC baru menghubungi usaha",
        dueAt: new Date(dueAt.getTime() + 3_600_000), evidenceNote: "Pergantian PIC sesuai penugasan uji",
        assignedToId: actorB.id, version: opportunity.version,
      });
      expect(await db.outboxJob.count({ where: { followUpId: taskId!, status: "CANCELLED" } })).toBe(2);
      expect(await db.outboxJob.count({ where: { followUpId: taskId!, status: "PENDING", recipientId: actorB.id } })).toBe(2);
      expect(await db.notification.count({ where: { followUpId: taskId!, recipientId: actorB.id } })).toBeGreaterThan(0);
      await saveMappingOpportunity(supervisor, prospectId, {
        productCode: "LIVIN_MERCHANT_QRIS", needSummary: "Usaha menyatakan perlu menerima pembayaran QRIS",
        discoveryDone: true, needConfirmed: true, benefitExplained: true,
        response: "NOT_INTERESTED", followUpConsent: false, nextAction: null, dueAt: null,
        evidenceNote: "Calon nasabah tidak berminat pada diskusi lanjutan", assignedToId: actorB.id, version: reassigned.version,
      });
      expect((await db.followUp.findUniqueOrThrow({ where: { id: taskId! } })).status).toBe("CANCELLED");
      expect(await db.outboxJob.count({ where: { followUpId: taskId!, status: "PENDING" } })).toBe(0);
      expect(await db.usageVerification.count({ where: { prospectId } })).toBe(0);
    } finally {
      if (taskId) {
        await db.notification.deleteMany({ where: { followUpId: taskId } });
        await db.outboxJob.deleteMany({ where: { followUpId: taskId } });
        await db.mappingOpportunity.deleteMany({ where: { prospectId } });
        await db.followUp.deleteMany({ where: { id: taskId } });
      }
      await db.mappingDiscovery.deleteMany({ where: { prospectId } });
      if (previousApproval == null) delete process.env.MAPPING_APPROVED_PRODUCT_CODES;
      else process.env.MAPPING_APPROVED_PRODUCT_CODES = previousApproval;
    }
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

  it("membuat janji tanpa referensi manual, mengingatkan beberapa PIC, memetakan, dan soft-delete", async () => {
    const appointment = await createAppointment(actorA, {
      acquisitionCategory: "LIVIN_MERCHANT",
      acquisitionProduct: "LIVIN_MERCHANT_QRIS",
      acquisitionStatus: "PROSPECT",
      customerCif: null,
      customerAccount: null,
      customerPhone: null,
      nextAction: "Hubungi kontak untuk memastikan agenda janji",
      targetValue: null,
      realizationValue: null,
      metricUnit: null,
      contactName: "Kontak Lokasi Samaran",
      businessAlias: "Toko Janji Multipic",
      reason: "Pertemuan kebutuhan transaksi usaha samaran",
      picIds: [actorA.id, actorB.id],
      appointmentAt: new Date(Date.now() + 86_400_000),
      locationLabel: "Ruko samaran pintu kiri",
      latitude: -6.1451,
      longitude: 106.8179,
      locationSource: "MANUAL_COORDINATES",
      mappingMarkerIcon: "TOWER",
    });
    caseIds.push(appointment.id);
    createdProspectIds.push(appointment.prospectId);
    expect((await db.prospect.findUniqueOrThrow({ where: { id: appointment.prospectId } })).mappingMarkerIcon).toBe("TOWER");
    expect(
      await db.serviceCaseParticipant.count({
        where: { serviceCaseId: appointment.id },
      }),
    ).toBe(2);
    expect(
      await db.outboxJob.count({
        where: {
          serviceCaseId: appointment.id,
          status: OutboxStatus.PENDING,
        },
      }),
    ).toBe(14);
    expect((await getServiceCase(actorB, appointment.id)).id).toBe(
      appointment.id,
    );
    expect(
      (await listAppointmentLocations(actorB)).some(
        (item) => item.id === appointment.id,
      ),
    ).toBe(true);
    await archiveServiceCase(actorA, appointment.id, appointment.version);
    expect(
      await db.outboxJob.count({
        where: {
          serviceCaseId: appointment.id,
          status: { in: [OutboxStatus.PENDING, OutboxStatus.PROCESSING] },
        },
      }),
    ).toBe(0);
    await expect(getServiceCase(actorA, appointment.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(
      await db.auditLog.findFirst({
        where: {
          entityType: "ServiceCase",
          entityId: appointment.id,
          action: "SERVICE_CASE_ARCHIVED",
          actorId: actorA.id,
          actorRole: Role.OUT_BRANCH,
        },
      }),
    ).not.toBeNull();
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
    expect(confirmedJobs).toHaveLength(7);
    expect(confirmedJobs.every((job) => job.recipientId === actorB.id)).toBe(
      true,
    );
    const dueJob = confirmedJobs.find(
      (job) => job.type === OutboxJobType.APPOINTMENT_ACTION_DUE,
    );
    const preJob = confirmedJobs.find(
      (job) => job.type === OutboxJobType.APPOINTMENT_PRE_DUE,
    );
    const preJobs = confirmedJobs.filter(
      (job) => job.type === OutboxJobType.APPOINTMENT_PRE_DUE,
    );
    expect(preJobs).toHaveLength(6);
    expect(
      preJobs
        .slice(1)
        .every(
          (job, index) =>
            job.runAt.getTime() - preJobs[index].runAt.getTime() === 5 * 60_000,
        ),
    ).toBe(true);
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
    expect((await getLocationPhoto(actorB, photo.id)).photo.id).toBe(photo.id);
    await expect(
      getLocationPhoto(actorOtherBranch, photo.id),
    ).rejects.toMatchObject({
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
    const photoNotices = await db.notification.findMany({
      where: {
        recipientId: actorA.id,
        title: {
          in: [
            "Foto mapping ditambahkan",
            "Foto mapping diganti",
            "Foto mapping dihapus",
          ],
        },
      },
      select: { title: true },
    });
    expect(new Set(photoNotices.map((notice) => notice.title))).toEqual(
      new Set([
        "Foto mapping ditambahkan",
        "Foto mapping diganti",
        "Foto mapping dihapus",
      ]),
    );
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
