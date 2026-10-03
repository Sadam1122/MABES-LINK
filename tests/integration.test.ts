import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import {
  BatchType,
  HandoverStatus,
  OpportunityStage,
  PrismaClient,
  Role,
  UsageStatus,
} from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import {
  createHandover,
  getHandover,
  updateHandover,
} from "@/lib/services/handovers";
import { getProspect, updateProspect } from "@/lib/services/prospects";
import { createUsageVerification } from "@/lib/services/usage";

const suffix = crypto.randomUUID().slice(0, 8);
const prospectId = `test-prospect-${suffix}`;
const internalCode = `TEST-PR-${suffix}`;
const evidenceReference = `TEST-EVIDENCE-${suffix}`;
const branchId = `test-main-${suffix}`;
const otherBranchId = `test-other-${suffix}`;
let batchId = "";

const outActor: Actor = {
  id: `test-out-${suffix}`,
  name: "Raka Out-branch",
  email: `out-${suffix}@example.invalid`,
  role: Role.OUT_BRANCH,
  branchId,
};
const otherOfficer: Actor = {
  id: `test-out2-${suffix}`,
  name: "Dina Out-branch",
  email: `out2-${suffix}@example.invalid`,
  role: Role.OUT_BRANCH,
  branchId,
};
const csActor: Actor = {
  id: `test-cs-${suffix}`,
  name: "Sari Customer Service",
  email: `cs-${suffix}@example.invalid`,
  role: Role.CS,
  branchId,
};
const otherBranchActor: Actor = {
  id: `test-other-user-${suffix}`,
  name: "Petugas Cabang Lain",
  email: `other-${suffix}@example.invalid`,
  role: Role.OUT_BRANCH,
  branchId: otherBranchId,
};

describe("integrasi akses dan alur handover", () => {
  beforeAll(async () => {
    await db.branch.createMany({
      data: [
        {
          id: branchId,
          code: `T${suffix}`,
          name: "Cabang Uji Utama",
          classCode: "B.2",
        },
        {
          id: otherBranchId,
          code: `U${suffix}`,
          name: "Cabang Uji Lain",
          classCode: "B.2",
        },
      ],
    });
    await db.user.createMany({
      data: [outActor, otherOfficer, csActor, otherBranchActor].map(
        (actor) => ({
          ...actor,
          emailVerified: true,
          active: true,
        }),
      ),
    });
    await db.prospect.create({
      data: {
        id: prospectId,
        internalCode,
        businessAlias: `Prospek Integrasi ${suffix}`,
        need: "Kebutuhan pengujian integrasi tanpa data nasabah",
        contactPic: "PIC Test",
        opportunityStage: OpportunityStage.NEED_CONFIRMED,
        branchId,
        assignedToId: outActor.id,
        createdById: outActor.id,
      },
    });
  });

  afterAll(async () => {
    await db.usageVerification.deleteMany({ where: { prospectId } });
    if (batchId) await db.handoverBatch.deleteMany({ where: { id: batchId } });
    await db.auditLog.deleteMany({ where: { branchId } });
    await db.prospect.deleteMany({ where: { id: prospectId } });
    await db.appConfig.deleteMany({ where: { key: `restart-test-${suffix}` } });
    await db.user.deleteMany({
      where: {
        id: {
          in: [outActor.id, otherOfficer.id, csActor.id, otherBranchActor.id],
        },
      },
    });
    await db.branch.deleteMany({
      where: { id: { in: [branchId, otherBranchId] } },
    });
    await db.$disconnect();
  });

  it("menolak akses lintas petugas dan lintas cabang", async () => {
    await expect(getProspect(otherOfficer, prospectId)).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
    });
    await expect(
      getProspect(otherBranchActor, prospectId),
    ).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
  });

  it("handover hanya dapat diakui penerima", async () => {
    const batch = await createHandover(outActor, {
      type: BatchType.SINGLE,
      title: `Handover test ${suffix}`,
      receiverId: csActor.id,
      prospectIds: [prospectId],
    });
    batchId = batch.id;
    const submitted = await updateHandover(outActor, batch.id, {
      version: batch.version,
      status: HandoverStatus.SUBMITTED,
    });
    await expect(
      updateHandover(outActor, batch.id, {
        version: submitted.version,
        status: HandoverStatus.ACCEPTED,
      }),
    ).rejects.toBeInstanceOf(AppError);
    const accepted = await updateHandover(csActor, batch.id, {
      version: submitted.version,
      status: HandoverStatus.ACCEPTED,
    });
    expect(accepted.acceptedAt).toBeInstanceOf(Date);
    const visibleToReceiver = await getHandover(csActor, batch.id);
    expect(visibleToReceiver.receiverId).toBe(csActor.id);
  });

  it("menolak perubahan status tidak valid", async () => {
    const current = await getHandover(csActor, batchId);
    await expect(
      updateHandover(csActor, batchId, {
        version: current.version,
        status: HandoverStatus.READY,
      }),
    ).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
    await expect(
      updateHandover(csActor, batchId, {
        version: current.version,
        status: HandoverStatus.ON_HOLD,
      }),
    ).rejects.toMatchObject({ code: "EXCEPTION_REQUIRED" });
  });

  it("CS tidak dapat mengubah PIC atau tahap prospek secara langsung", async () => {
    const prospect = await db.prospect.findUniqueOrThrow({
      where: { id: prospectId },
    });
    await expect(
      updateProspect(csActor, prospectId, {
        version: prospect.version,
        opportunityStage: OpportunityStage.CLOSED_LOST,
      }),
    ).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
  });

  it("siap tidak otomatis menjadi penggunaan", async () => {
    const accepted = await getHandover(csActor, batchId);
    const processing = await updateHandover(csActor, batchId, {
      version: accepted.version,
      status: HandoverStatus.PROCESSING,
    });
    const ready = await updateHandover(csActor, batchId, {
      version: processing.version,
      status: HandoverStatus.READY,
    });
    expect(ready.status).toBe(HandoverStatus.READY);
    expect(await db.usageVerification.count({ where: { prospectId } })).toBe(0);

    await createUsageVerification(csActor, {
      prospectId,
      status: UsageStatus.VERIFIED,
      usedAt: new Date(),
      evidenceReference,
      note: "Bukti test",
    });
    expect(
      await db.usageVerification.count({
        where: { prospectId, status: UsageStatus.VERIFIED },
      }),
    ).toBe(1);
  });

  it("data bertahan setelah client database direstart", async () => {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL tidak tersedia.");
    const key = `restart-test-${suffix}`;
    const first = new PrismaClient({
      adapter: new PrismaPg({ connectionString }),
    });
    await first.appConfig.create({ data: { key, value: { persisted: true } } });
    await first.$disconnect();
    const second = new PrismaClient({
      adapter: new PrismaPg({ connectionString }),
    });
    const found = await second.appConfig.findUnique({ where: { key } });
    await second.$disconnect();
    expect(found?.value).toEqual({ persisted: true });
  });
});
