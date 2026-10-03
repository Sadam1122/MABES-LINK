import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import {
  BatchType,
  EmailDeliveryStatus,
  FollowUpStatus,
  HandoverStatus,
  OpportunityStage,
  OutboxJobType,
  OutboxStatus,
  PrismaClient,
  Role,
  UsageStatus,
  VisitOutcome,
} from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import {
  applyJakartaQuietHours,
  claimJobs,
  deliverInternalEmail,
  jakartaTimeToUtc,
} from "@/lib/notifications";
import type { Actor } from "@/lib/session";
import { createFollowUp, updateFollowUp } from "@/lib/services/follow-ups";
import { createHandover, updateHandover } from "@/lib/services/handovers";
import { listNotifications } from "@/lib/services/notifications";
import { createUsageVerification } from "@/lib/services/usage";
import { createVisit } from "@/lib/services/visits";

const suffix = crypto.randomUUID().slice(0, 8);
const prospectId = `stage2-prospect-${suffix}`;
const internalCode = `S2-${suffix}`;
const branchId = `stage2-branch-${suffix}`;
const out: Actor = {
  id: `stage2-out-${suffix}`,
  name: "Raka",
  email: `stage2-out-${suffix}@example.invalid`,
  role: Role.OUT_BRANCH,
  branchId,
};
const out2: Actor = {
  id: `stage2-out2-${suffix}`,
  name: "Dina",
  email: `stage2-out2-${suffix}@example.invalid`,
  role: Role.OUT_BRANCH,
  branchId,
};
const supervisor: Actor = {
  id: `stage2-supervisor-${suffix}`,
  name: "Bima",
  email: `stage2-supervisor-${suffix}@example.invalid`,
  role: Role.SUPERVISOR,
  branchId,
};
const cs: Actor = {
  id: `stage2-cs-${suffix}`,
  name: "Sari",
  email: `stage2-cs-${suffix}@example.invalid`,
  role: Role.CS,
  branchId,
};
let flowFollowUpId = "";
let flowBatchId = "";

function client() {
  if (!process.env.DATABASE_URL)
    throw new Error("DATABASE_URL tidak tersedia.");
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
}

describe("tahap 2 mapping, outbox, SSE dan SMTP", () => {
  beforeAll(async () => {
    await db.branch.create({
      data: {
        id: branchId,
        code: `S${suffix}`,
        name: "Cabang Uji Scheduler",
        classCode: "B.2",
      },
    });
    await db.user.createMany({
      data: [out, out2, supervisor, cs].map((actor) => ({
        ...actor,
        emailVerified: true,
        active: true,
      })),
    });
    await db.prospect.create({
      data: {
        id: prospectId,
        internalCode,
        businessAlias: `Mapping Demo ${suffix}`,
        need: "Kebutuhan demo tahap dua",
        contactPic: "PIC Samaran",
        branchId,
        assignedToId: out.id,
        createdById: out.id,
        areaBlock: "Blok Test",
        businessSector: "Jasa",
        addressHint: "Area demo",
        latitude: -6.15,
        longitude: 106.82,
        productNeeds: ["Payroll"],
      },
    });
  });

  afterAll(async () => {
    await db.emailDelivery.deleteMany({
      where: { outboxJob: { dedupKey: { contains: suffix } } },
    });
    await db.outboxJob.deleteMany({
      where: {
        OR: [{ dedupKey: { contains: suffix } }, { followUp: { prospectId } }],
      },
    });
    await db.notification.deleteMany({
      where: {
        OR: [
          { dedupKey: { contains: suffix } },
          { followUp: { prospectId } },
          { handoverId: flowBatchId || undefined },
        ],
      },
    });
    await db.usageVerification.deleteMany({ where: { prospectId } });
    if (flowBatchId)
      await db.handoverBatch.deleteMany({ where: { id: flowBatchId } });
    await db.followUp.deleteMany({ where: { prospectId } });
    await db.visit.deleteMany({ where: { prospectId } });
    await db.auditLog.deleteMany({ where: { branchId } });
    await db.prospect.deleteMany({ where: { id: prospectId } });
    await db.user.deleteMany({
      where: { id: { in: [out.id, out2.id, supervisor.id, cs.id] } },
    });
    await db.branch.delete({ where: { id: branchId } });
    await db.$disconnect();
  });

  it("menghitung timezone Asia/Jakarta dan quiet hours dengan benar", () => {
    expect(
      jakartaTimeToUtc(
        { year: 2026, month: 10, day: 2 },
        "08:00",
      ).toISOString(),
    ).toBe("2026-10-02T01:00:00.000Z");
    expect(
      applyJakartaQuietHours(
        new Date("2026-10-02T14:30:00.000Z"),
        "20:00",
        "07:00",
      ).toISOString(),
    ).toBe("2026-10-03T00:00:00.000Z");
  });

  it("dua worker tidak mengklaim job yang sama", async () => {
    const key = `concurrent-${suffix}`;
    await db.outboxJob.create({
      data: {
        type: OutboxJobType.OVERDUE_DIGEST,
        dedupKey: key,
        recipientId: out.id,
        branchId: out.branchId,
        runAt: new Date("1999-12-31T23:59:00Z"),
      },
    });
    const a = client();
    const b = client();
    const [one, two] = await Promise.all([
      claimJobs(a, `a-${suffix}`, new Date("2000-01-01T00:00:00Z"), 1),
      claimJobs(b, `b-${suffix}`, new Date("2000-01-01T00:00:00Z"), 1),
    ]);
    await a.$disconnect();
    await b.$disconnect();
    expect([...one, ...two].filter((job) => job.id).length).toBe(1);
    await db.outboxJob.update({
      where: { dedupKey: key },
      data: { status: OutboxStatus.CANCELLED },
    });
  });

  it("restart client mengejar reminder terlewat", async () => {
    const key = `restart-${suffix}`;
    await db.outboxJob.create({
      data: {
        type: OutboxJobType.OVERDUE_DIGEST,
        dedupKey: key,
        recipientId: out.id,
        branchId: out.branchId,
        runAt: new Date("2000-01-01T00:00:00Z"),
      },
    });
    const first = client();
    await first.$disconnect();
    const second = client();
    const jobs = await claimJobs(
      second,
      `restart-worker-${suffix}`,
      new Date("2000-01-01T00:01:00Z"),
      10,
    );
    await second.$disconnect();
    expect(jobs.some((job) => job.id && job.recipientId === out.id)).toBe(true);
    await db.outboxJob.update({
      where: { dedupKey: key },
      data: { status: OutboxStatus.CANCELLED },
    });
  });

  it("reschedule, reassign, dan complete membatalkan versi lama", async () => {
    await db.prospect.update({
      where: { id: prospectId },
      data: { opportunityStage: OpportunityStage.NEED_CONFIRMED },
    });
    const created = await createFollowUp(out, {
      prospectId,
      summary: "Tindak lanjut hasil mapping",
      nextAction: "Hubungi PIC",
      dueAt: new Date(Date.now() + 3_600_000),
    });
    const rescheduled = await updateFollowUp(supervisor, created.id, {
      version: created.version,
      assignedToId: out2.id,
      dueAt: new Date(Date.now() + 7_200_000),
    });
    const old = await db.outboxJob.count({
      where: {
        followUpId: created.id,
        scheduleVersion: created.version,
        status: OutboxStatus.CANCELLED,
      },
    });
    expect(old).toBe(2);
    const done = await updateFollowUp(supervisor, created.id, {
      version: rescheduled.version,
      status: FollowUpStatus.COMPLETED,
    });
    expect(done.status).toBe(FollowUpStatus.COMPLETED);
    expect(
      await db.outboxJob.count({
        where: {
          followUpId: created.id,
          status: { in: [OutboxStatus.PENDING, OutboxStatus.PROCESSING] },
        },
      }),
    ).toBe(0);
  });

  it("SSE/query notifikasi tidak bocor ke pengguna lain", async () => {
    await db.notification.createMany({
      data: [
        {
          recipientId: out.id,
          branchId: out.branchId,
          type: "PIC_ASSIGNMENT",
          title: "Untuk Raka",
          message: "Internal",
          link: "/follow-ups",
          dedupKey: `notice-out-${suffix}`,
        },
        {
          recipientId: out2.id,
          branchId: out2.branchId,
          type: "PIC_ASSIGNMENT",
          title: "Untuk Dina",
          message: "Internal",
          link: "/follow-ups",
          dedupKey: `notice-out2-${suffix}`,
        },
      ],
    });
    const visible = await listNotifications(out, undefined, 100);
    expect(visible.some((item) => item.title === "Untuk Raka")).toBe(true);
    expect(visible.some((item) => item.title === "Untuk Dina")).toBe(false);
  });

  it("membedakan SMTP dry-run, kuota, dan kegagalan", async () => {
    const original = {
      enabled: process.env.EMAIL_ENABLED,
      dry: process.env.SMTP_DRY_RUN,
      limit: process.env.EMAIL_DAILY_LIMIT,
    };
    process.env.EMAIL_ENABLED = "true";
    process.env.SMTP_DRY_RUN = "true";
    const input = {
      to: out.email,
      taskCode: internalCode,
      reminderType: "Uji",
      scheduledAt: new Date(),
      link: "http://localhost:3000/follow-ups",
    };
    expect((await deliverInternalEmail(input)).status).toBe(
      EmailDeliveryStatus.DRY_RUN,
    );
    process.env.SMTP_DRY_RUN = "false";
    process.env.EMAIL_DAILY_LIMIT = "0";
    expect(
      (
        await deliverInternalEmail(input, db, {
          sendMail: async () => ({ messageId: "never" }),
        } as never)
      ).status,
    ).toBe(EmailDeliveryStatus.QUOTA_BLOCKED);
    process.env.EMAIL_DAILY_LIMIT = "999";
    expect(
      (
        await deliverInternalEmail(input, db, {
          sendMail: async () => {
            throw new Error("SMTP rejected");
          },
        } as never)
      ).status,
    ).toBe(EmailDeliveryStatus.FAILED);
    process.env.EMAIL_ENABLED = original.enabled;
    process.env.SMTP_DRY_RUN = original.dry;
    process.env.EMAIL_DAILY_LIMIT = original.limit;
  });

  it("menjalankan alur mapping → visit → follow-up → reminder → handover → siap → penggunaan", async () => {
    await db.prospect.update({
      where: { id: prospectId },
      data: { opportunityStage: OpportunityStage.NEW, assignedToId: out.id },
    });
    const result = await createVisit(out, {
      prospectId,
      visitedAt: new Date(),
      outcome: VisitOutcome.FOLLOW_UP_REQUIRED,
      notes: "Kebutuhan payroll dikonfirmasi saat visit demo",
      nextAction: "Konfirmasi jadwal handover",
      nextActionDueAt: new Date(Date.now() + 60_000),
      createFollowUp: true,
    });
    if (!result.followUp) throw new Error("Follow-up tidak dibuat.");
    flowFollowUpId = result.followUp.id;
    await db.outboxJob.updateMany({
      where: { followUpId: flowFollowUpId },
      data: { runAt: new Date("2000-01-01T00:00:00Z") },
    });
    const claimed = await claimJobs(
      db,
      `flow-${suffix}`,
      new Date("2000-01-01T00:01:00Z"),
      10,
    );
    expect(claimed.some((job) => job.followUpId === flowFollowUpId)).toBe(true);
    await updateFollowUp(out, flowFollowUpId, {
      version: result.followUp.version,
      status: FollowUpStatus.COMPLETED,
    });
    const batch = await createHandover(out, {
      type: BatchType.SINGLE,
      title: `Handover flow ${suffix}`,
      receiverId: cs.id,
      prospectIds: [prospectId],
    });
    flowBatchId = batch.id;
    const submitted = await updateHandover(out, batch.id, {
      version: batch.version,
      status: HandoverStatus.SUBMITTED,
    });
    const accepted = await updateHandover(cs, batch.id, {
      version: submitted.version,
      status: HandoverStatus.ACCEPTED,
    });
    const processing = await updateHandover(cs, batch.id, {
      version: accepted.version,
      status: HandoverStatus.PROCESSING,
    });
    await updateHandover(cs, batch.id, {
      version: processing.version,
      status: HandoverStatus.READY,
    });
    expect(await db.usageVerification.count({ where: { prospectId } })).toBe(0);
    await createUsageVerification(cs, {
      prospectId,
      status: UsageStatus.VERIFIED,
      usedAt: new Date(),
      evidenceReference: `S2-EVIDENCE-${suffix}`,
      note: "Referensi bukti demo",
    });
    expect(
      await db.usageVerification.count({
        where: { prospectId, status: UsageStatus.VERIFIED },
      }),
    ).toBe(1);
  });
});
