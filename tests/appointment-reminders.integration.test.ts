import "../scripts/load-env";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  claimJobs,
  processJob,
  recoverExpiredLeases,
  reconcileAppointmentJobs,
} from "@/lib/notifications";
import {
  createAppointment,
  getServiceCase,
  listServiceCases,
  updateServiceCase,
} from "@/lib/services/service-cases";
import { claimNotificationPresentation } from "@/lib/services/notifications";
import {
  actOnAppointmentAlarm,
  alarmActionSchema,
  getAppointmentAlarm,
} from "@/lib/services/appointment-alarm";
import type { Actor } from "@/lib/session";

const prefix = `appointment-${crypto.randomUUID().slice(0, 8)}`;
const branchId = `${prefix}-branch`,
  otherBranchId = `${prefix}-other`;
const owner: Actor = {
  id: `${prefix}-owner`,
  name: "Pembuat Samaran",
  email: `${prefix}-owner@example.invalid`,
  role: "OUT_BRANCH",
  branchId,
};
const companion: Actor = {
  ...owner,
  id: `${prefix}-cs`,
  name: "Pendamping Samaran",
  email: `${prefix}-cs@example.invalid`,
  role: "CS",
};
const outsider: Actor = {
  ...owner,
  id: `${prefix}-outside`,
  email: `${prefix}-outside@example.invalid`,
};
const foreign: Actor = {
  ...owner,
  id: `${prefix}-foreign`,
  email: `${prefix}-foreign@example.invalid`,
  branchId: otherBranchId,
};
const cases: string[] = [],
  prospects: string[] = [];
const form = {
  acquisitionCategory: "LIVIN_MERCHANT" as const,
  acquisitionProduct: "LIVIN_MERCHANT_QRIS",
  acquisitionStatus: "PROSPECT" as const,
  customerCif: null,
  customerAccount: null,
  customerPhone: null,
  contactName: "Kontak Samaran",
  businessAlias: null,
  reason: "Discovery kebutuhan pembayaran samaran",
  nextAction: "Konfirmasi agenda",
  targetValue: null,
  realizationValue: null,
  metricUnit: null,
  latitude: null,
  longitude: null,
  locationLabel: "",
  locationSource: "MAP_PIN" as const,
  mappingMarkerIcon: "STORE" as const,
};
async function appointment(withCompanion = false) {
  const item = await createAppointment(owner, {
    ...form,
    companionIds: withCompanion ? [companion.id] : [],
    appointmentStatus: "CONFIRMED",
    appointmentAt: new Date(Date.now() + 35 * 3600_000),
  });
  cases.push(item.id);
  prospects.push(item.prospectId);
  return updateServiceCase(owner, item.id, {
    version: item.version,
    status: "ACCEPTED",
  });
}

describe("janji, worker, pembatalan dan klaim alarm persisten", () => {
  beforeAll(async () => {
    expect(process.env.DATABASE_PURPOSE).toBe("testing");
    await db.branch.createMany({
      data: [branchId, otherBranchId].map((id, i) => ({
        id,
        code: `${prefix.slice(-8)}${i}`,
        name: "Cabang Samaran",
        classCode: "B.2",
      })),
    });
    await db.user.createMany({
      data: [owner, companion, outsider, foreign].map((actor) => ({
        ...actor,
        active: true,
        emailVerified: true,
      })),
    });
  });
  afterAll(async () => {
    await db.emailDelivery.deleteMany({
      where: { recipientId: { startsWith: prefix } },
    });
    await db.notification.deleteMany({
      where: { recipientId: { startsWith: prefix } },
    });
    await db.outboxJob.deleteMany({
      where: { recipientId: { startsWith: prefix } },
    });
    await db.serviceCase.deleteMany({ where: { id: { in: cases } } });
    await db.prospect.deleteMany({ where: { id: { in: prospects } } });
    await db.auditLog.deleteMany({
      where: { branchId: { in: [branchId, otherBranchId] } },
    });
    await db.user.deleteMany({ where: { id: { startsWith: prefix } } });
    await db.branch.deleteMany({
      where: { id: { in: [branchId, otherBranchId] } },
    });
    await db.$disconnect();
  });
  it("janji tanpa waktu bukan overdue; kasus legacy tanpa source tetap memakai tenggatnya", async () => {
    const unscheduled = await createAppointment(owner, {
      ...form,
      companionIds: [],
      appointmentStatus: "NEEDS_SCHEDULING",
      appointmentAt: null,
    });
    cases.push(unscheduled.id);
    prospects.push(unscheduled.prospectId);
    await expect(
      updateServiceCase(owner, unscheduled.id, {
        version: unscheduled.version,
        status: "ACCEPTED",
      }),
    ).rejects.toMatchObject({ code: "APPOINTMENT_TIME_REQUIRED" });
    const legacy = await db.serviceCase.create({
      data: {
        code: `${prefix}-legacy-deadline`,
        branchId,
        prospectId: unscheduled.prospectId,
        origin: "IN_BRANCH",
        status: "ASSIGNED",
        title: "Kendala layanan samaran",
        description: "Kasus legacy dengan tenggat",
        picId: owner.id,
        createdById: owner.id,
        nextAction: "Tangani kendala resmi",
        dueAt: new Date(Date.now() - 60_000),
      },
    });
    cases.push(legacy.id);
    const overdue = await listServiceCases(owner, {
      page: 1,
      pageSize: 100,
      overdue: true,
    });
    expect(overdue.items.some((item) => item.id === unscheduled.id)).toBe(
      false,
    );
    expect(overdue.items.some((item) => item.id === legacy.id)).toBe(true);
  });
  it("ringkasan countdown hanya berisi job versi/anggota yang berwenang", async () => {
    const item = await appointment(true);
    const pending = await db.outboxJob.findFirstOrThrow({
      where: {
        serviceCaseId: item.id,
        recipientId: owner.id,
        status: "PENDING",
      },
      orderBy: { runAt: "asc" },
    });
    const ownedList = await listServiceCases(owner, {
      page: 1,
      pageSize: 100,
      search: item.code,
    });
    expect(ownedList.items[0].nextReminder?.id).toBe(pending.id);
    expect(ownedList.items[0].nextReminder?.runAt).toBe(
      pending.runAt.toISOString(),
    );
    const companionList = await listServiceCases(companion, {
      page: 1,
      pageSize: 100,
      search: item.code,
    });
    const companionJob = await db.outboxJob.findFirstOrThrow({
      where: {
        serviceCaseId: item.id,
        recipientId: companion.id,
        status: "PENDING",
      },
      orderBy: { runAt: "asc" },
    });
    expect(companionList.items[0].nextReminder?.id).toBe(companionJob.id);
    expect(
      (
        await listServiceCases(outsider, {
          page: 1,
          pageSize: 100,
          search: item.code,
        })
      ).items,
    ).toHaveLength(0);
    expect(
      (
        await listServiceCases(foreign, {
          page: 1,
          pageSize: 100,
          search: item.code,
        })
      ).items,
    ).toHaveLength(0);
    await db.serviceCase.update({
      where: { id: item.id },
      data: { version: { increment: 1 } },
    });
    expect(
      (
        await listServiceCases(owner, {
          page: 1,
          pageSize: 100,
          search: item.code,
        })
      ).items[0].nextReminder,
    ).toBeNull();
  });
  it("Terima pekerjaan mengonfirmasi waktu tercatat dan baru mengaktifkan alarm; selesai janji tidak menjadi layanan selesai", async () => {
    const item = await createAppointment(owner, {
      ...form,
      companionIds: [],
      appointmentStatus: "PENDING_CONFIRMATION",
      appointmentAt: new Date(Date.now() + 35 * 3600_000),
    });
    cases.push(item.id);
    prospects.push(item.prospectId);
    expect(
      await db.outboxJob.count({ where: { serviceCaseId: item.id } }),
    ).toBe(0);
    // Simulate a V2 job created before the acceptance rule was introduced.
    await db.outboxJob.create({
      data: {
        type: "APPOINTMENT_PRE_DUE",
        serviceCaseId: item.id,
        recipientId: owner.id,
        branchId,
        scheduleVersion: item.version,
        runAt: new Date(Date.now() + 3600_000),
        dedupKey: `appointment:${item.id}:v2:old`,
      },
    });
    await reconcileAppointmentJobs(db);
    expect(
      await db.outboxJob.count({
        where: { serviceCaseId: item.id, status: "PENDING" },
      }),
    ).toBe(0);
    const accepted = await updateServiceCase(owner, item.id, {
      version: item.version,
      status: "ACCEPTED",
    });
    expect(accepted.appointmentStatus).toBe("CONFIRMED");
    expect(accepted.acceptedById).toBe(owner.id);
    expect(
      await db.outboxJob.count({
        where: {
          serviceCaseId: item.id,
          scheduleVersion: accepted.version,
          status: "PENDING",
        },
      }),
    ).toBe(3);
    const completed = await updateServiceCase(owner, item.id, {
      version: accepted.version,
      appointmentStatus: "COMPLETED",
    });
    expect(completed.status).toBe("ACCEPTED");
    expect(completed.handledAt).toBeNull();
    await db.serviceCase.update({
      where: { id: item.id },
      data: {
        dueAt: new Date(Date.now() - 60_000),
        appointmentAt: new Date(Date.now() - 60_000),
      },
    });
    expect(
      (
        await listServiceCases(owner, { page: 1, pageSize: 100, overdue: true })
      ).items.some((row) => row.id === item.id),
    ).toBe(false);
    expect(
      await db.outboxJob.count({
        where: { serviceCaseId: item.id, status: "PENDING" },
      }),
    ).toBe(0);
    expect(
      await db.usageVerification.count({
        where: { prospectId: item.prospectId },
      }),
    ).toBe(0);
  });
  it("creator adalah kendali, pendamping dapat mengambil alih eksplisit; petugas/cabang lain ditolak", async () => {
    const item = await appointment(true);
    expect(item.picId).toBe(owner.id);
    expect(
      (await db.prospect.findUniqueOrThrow({ where: { id: item.prospectId } }))
        .assignedToId,
    ).toBe(owner.id);
    expect(
      (await getServiceCase(companion, item.id)).participants,
    ).toHaveLength(2);
    await expect(getServiceCase(outsider, item.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(getServiceCase(foreign, item.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      updateServiceCase(companion, item.id, {
        version: item.version,
        picId: companion.id,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const taken = await updateServiceCase(companion, item.id, {
      version: item.version,
      takeControl: true,
    });
    expect(taken.picId).toBe(companion.id);
    expect(
      (
        await db.outboxJob.findMany({
          where: { serviceCaseId: item.id, scheduleVersion: item.version },
        })
      ).every((j) => j.status === "CANCELLED"),
    ).toBe(true);
    const cancelled = await updateServiceCase(companion, item.id, {
      version: taken.version,
      appointmentStatus: "CANCELLED",
    });
    expect(cancelled.appointmentStatus).toBe("CANCELLED");
    expect(
      await db.outboxJob.count({
        where: { serviceCaseId: item.id, status: "PENDING" },
      }),
    ).toBe(0);
  });
  it("dua worker mengklaim job berlainan, satu publikasi, satu alarm/pop-up per penerima", async () => {
    const item = await appointment();
    const first = await db.outboxJob.findFirstOrThrow({
      where: { serviceCaseId: item.id },
      orderBy: { runAt: "asc" },
    });
    const [a, b] = await Promise.all([
      claimJobs(db, `${prefix}-worker-a`, first.runAt, 100),
      claimJobs(db, `${prefix}-worker-b`, first.runAt, 100),
    ]);
    expect(
      a.map((j) => j.id).filter((id) => b.some((j) => j.id === id)),
    ).toEqual([]);
    const jobs = [...a, ...b].filter((j) => j.id === first.id);
    expect(jobs).toHaveLength(1);
    await processJob(db, jobs[0], first.runAt, null);
    const notice = await db.notification.findUniqueOrThrow({
      where: { dedupKey: `job:${first.id}` },
    });
    expect(notice.reminderExpiresAt).not.toBeNull();
    const claims = await Promise.all([
      claimNotificationPresentation(owner, notice.id, "AUDIO"),
      claimNotificationPresentation(owner, notice.id, "AUDIO"),
    ]);
    expect(claims.filter((c) => c.claimed)).toHaveLength(1);
    expect(
      (await claimNotificationPresentation(owner, notice.id, "POPUP")).claimed,
    ).toBe(true);
    expect(
      (await claimNotificationPresentation(owner, notice.id, "POPUP")).claimed,
    ).toBe(false);
    await expect(
      claimNotificationPresentation(outsider, notice.id, "AUDIO"),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      claimNotificationPresentation(
        { ...owner, branchId: otherBranchId },
        notice.id,
        "AUDIO",
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await processJob(db, jobs[0], first.runAt, null);
    expect(
      await db.notification.count({ where: { dedupKey: `job:${first.id}` } }),
    ).toBe(1);
  });
  it("snooze persisten/idempotent hanya untuk penerima, seluruh anggota tetap menerima pengingatnya", async () => {
    const item = await appointment(true);
    const jobs = await db.outboxJob.findMany({
      where: { serviceCaseId: item.id },
      orderBy: { runAt: "asc" },
    });
    expect(new Set(jobs.map((j) => j.recipientId))).toEqual(
      new Set([owner.id, companion.id]),
    );
    for (const first of jobs.filter(
      (j) => j.runAt.getTime() === jobs[0].runAt.getTime(),
    )) {
      await db.outboxJob.update({
        where: { id: first.id },
        data: { status: "PROCESSING" },
      });
      await processJob(db, first, first.runAt, null);
    }
    const own = await db.notification.findFirstOrThrow({
      where: {
        serviceCaseId: item.id,
        recipientId: owner.id,
        type: "APPOINTMENT_PRE_DUE",
      },
    });
    const other = await db.notification.findFirstOrThrow({
      where: {
        serviceCaseId: item.id,
        recipientId: companion.id,
        type: "APPOINTMENT_PRE_DUE",
      },
    });
    expect((await getAppointmentAlarm(owner, own.id)).active).toBe(true);
    await expect(getAppointmentAlarm(outsider, own.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      getAppointmentAlarm({ ...owner, branchId: otherBranchId }, own.id),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(
      alarmActionSchema.safeParse({ action: "SNOOZE", minutes: 2 }).success,
    ).toBe(false);
    const [a, b] = await Promise.all([
      actOnAppointmentAlarm(owner, own.id, { action: "SNOOZE", minutes: 1 }),
      actOnAppointmentAlarm(owner, own.id, { action: "SNOOZE", minutes: 1 }),
    ]);
    expect(a.snoozedUntil).toEqual(b.snoozedUntil);
    expect(
      await db.outboxJob.count({
        where: { dedupKey: `alarm-snooze:${own.id}` },
      }),
    ).toBe(1);
    expect((await getAppointmentAlarm(companion, other.id)).active).toBe(true);
    expect((await getAppointmentAlarm(owner, own.id)).active).toBe(false);
    const child = await db.outboxJob.findUniqueOrThrow({
      where: { dedupKey: `alarm-snooze:${own.id}` },
    });
    const taken = (
      await claimJobs(db, `${prefix}-snooze-worker`, child.runAt, 100)
    ).find((j) => j.id === child.id)!;
    await processJob(db, taken, child.runAt, null);
    const repeated = await db.notification.findUniqueOrThrow({
      where: { dedupKey: `job:${child.id}` },
    });
    expect(repeated.title).toContain("diingatkan kembali");
    expect((await getAppointmentAlarm(owner, repeated.id)).active).toBe(true);
    const second = await actOnAppointmentAlarm(owner, repeated.id, {
      action: "SNOOZE",
      minutes: 5,
    });
    expect(second.snoozedUntil).not.toBeNull();
    await updateServiceCase(owner, item.id, {
      version: item.version,
      appointmentStatus: "COMPLETED",
    });
    expect(
      await db.outboxJob.count({
        where: { serviceCaseId: item.id, status: "PENDING" },
      }),
    ).toBe(0);
    expect((await getAppointmentAlarm(companion, other.id)).active).toBe(false);
  });
  it("semua pendamping mendapat tiga slot termasuk waktu janji, tanpa penerima di luar penugasan", async () => {
    const created = await createAppointment(owner, {
      ...form,
      companionIds: [companion.id, outsider.id],
      appointmentStatus: "CONFIRMED",
      appointmentAt: new Date(Date.now() + 35 * 3600_000),
    });
    cases.push(created.id);
    prospects.push(created.prospectId);
    await updateServiceCase(owner, created.id, {
      version: created.version,
      status: "ACCEPTED",
    });
    const jobs = await db.outboxJob.findMany({
      where: { serviceCaseId: created.id, status: "PENDING" },
    });
    expect(jobs).toHaveLength(9);
    for (const id of [owner.id, companion.id, outsider.id]) {
      expect(jobs.filter((job) => job.recipientId === id)).toHaveLength(3);
    }
    expect(jobs.some((job) => job.recipientId === foreign.id)).toBe(false);
  });
  it.each([1, 5, 10] as const)(
    "snooze %i menit memakai waktu server dan satu job versi aktif",
    async (minutes) => {
      const item = await appointment();
      const job = await db.outboxJob.findFirstOrThrow({
        where: { serviceCaseId: item.id },
      });
      const notice = await db.notification.create({
        data: {
          recipientId: owner.id,
          branchId,
          serviceCaseId: item.id,
          type: "APPOINTMENT_PRE_DUE",
          title: "Alarm samaran",
          message: "Pengingat",
          link: `/work/${item.id}`,
          dedupKey: `job:${job.id}`,
        },
      });
      const before = Date.now();
      const result = await actOnAppointmentAlarm(owner, notice.id, {
        action: "SNOOZE",
        minutes,
      });
      expect(result.snoozedUntil!.getTime()).toBeGreaterThanOrEqual(
        before + minutes * 60000,
      );
      expect(result.snoozedUntil!.getTime()).toBeLessThanOrEqual(
        Date.now() + minutes * 60000,
      );
      const child = await db.outboxJob.findUniqueOrThrow({
        where: { dedupKey: `alarm-snooze:${notice.id}` },
      });
      expect(child.scheduleVersion).toBe(item.version);
      expect(child.recipientId).toBe(owner.id);
      expect(child.runAt).toEqual(result.snoozedUntil);
      expect(child.payload).toMatchObject({ snoozeMinutes: minutes });
      const changed = await updateServiceCase(owner, item.id, {
        version: item.version,
        appointmentAt: new Date(Date.now() + 48 * 3600_000),
        appointmentStatus: "CONFIRMED",
      });
      expect(changed.version).toBeGreaterThan(item.version);
      expect(
        (await db.outboxJob.findUniqueOrThrow({ where: { id: child.id } }))
          .status,
      ).toBe("CANCELLED");
    },
  );
  it("Matikan hanya mematikan penerima sendiri; snooze sesudah waktu janji ditolak", async () => {
    const item = await appointment();
    const job = await db.outboxJob.findFirstOrThrow({
      where: { serviceCaseId: item.id },
    });
    const notice = await db.notification.create({
      data: {
        recipientId: owner.id,
        branchId,
        serviceCaseId: item.id,
        type: "APPOINTMENT_PRE_DUE",
        title: "Alarm samaran",
        message: "Pengingat",
        link: `/work/${item.id}`,
        dedupKey: `job:${job.id}`,
      },
    });
    await db.serviceCase.update({
      where: { id: item.id },
      data: { appointmentAt: new Date(Date.now() + 30_000) },
    });
    await expect(
      actOnAppointmentAlarm(owner, notice.id, { action: "SNOOZE", minutes: 1 }),
    ).rejects.toMatchObject({ code: "SNOOZE_TOO_LATE" });
    await actOnAppointmentAlarm(owner, notice.id, { action: "DISMISS" });
    expect((await getAppointmentAlarm(owner, notice.id)).active).toBe(false);
    expect(
      await db.outboxJob.count({
        where: { dedupKey: `alarm-snooze:${notice.id}` },
      }),
    ).toBe(0);
  });
  it("alarm saat janji tiba diterbitkan satu kali, snooze setelah janji kembali berbunyi dan reschedule membatalkannya", async () => {
    const item = await appointment(true);
    const at = new Date(Date.now() - 1000);
    await db.serviceCase.update({
      where: { id: item.id },
      data: { appointmentAt: at },
    });
    const job = await db.outboxJob.findFirstOrThrow({
      where: {
        serviceCaseId: item.id,
        recipientId: owner.id,
        type: "APPOINTMENT_ACTION_DUE",
      },
    });
    const due = await db.outboxJob.update({
      where: { id: job.id },
      data: {
        status: "PROCESSING",
        runAt: at,
        payload: {
          policy: "APPOINTMENT_V2",
          minutesBefore: 0,
          appointmentAt: at.toISOString(),
          expiresAt: new Date(at.getTime() + 90_000).toISOString(),
        },
      },
    });
    await processJob(db, due, new Date(), null);
    const notice = await db.notification.findUniqueOrThrow({
      where: { dedupKey: `job:${due.id}` },
    });
    expect(notice.type).toBe("APPOINTMENT_ACTION_DUE");
    expect(notice.title).toContain("waktunya sekarang");
    expect((await getAppointmentAlarm(owner, notice.id)).active).toBe(true);
    expect(
      (await claimNotificationPresentation(owner, notice.id, "POPUP")).claimed,
    ).toBe(true);
    expect(
      (await claimNotificationPresentation(owner, notice.id, "AUDIO")).claimed,
    ).toBe(true);
    expect(
      (await claimNotificationPresentation(owner, notice.id, "AUDIO")).claimed,
    ).toBe(false);
    await expect(
      getAppointmentAlarm(outsider, notice.id),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    const result = await actOnAppointmentAlarm(owner, notice.id, {
      action: "SNOOZE",
      minutes: 1,
    });
    expect(result.snoozedUntil!.getTime()).toBeGreaterThan(at.getTime());
    const child = await db.outboxJob.findUniqueOrThrow({
      where: { dedupKey: `alarm-snooze:${notice.id}` },
    });
    expect(child.type).toBe("APPOINTMENT_ACTION_DUE");
    await db.outboxJob.update({
      where: { id: child.id },
      data: { status: "PROCESSING" },
    });
    await processJob(db, child, child.runAt, null);
    const repeated = await db.notification.findUniqueOrThrow({
      where: { dedupKey: `job:${child.id}` },
    });
    expect((await getAppointmentAlarm(owner, repeated.id)).active).toBe(true);
    expect(
      (await claimNotificationPresentation(owner, repeated.id, "AUDIO"))
        .claimed,
    ).toBe(true);
    const extended = await updateServiceCase(owner, item.id, {
      version: item.version,
      appointmentAt: new Date(Date.now() + 48 * 3600_000),
      appointmentStatus: "CONFIRMED",
    });
    expect((await getAppointmentAlarm(owner, repeated.id)).active).toBe(false);
    const fresh = await db.outboxJob.findMany({
      where: {
        serviceCaseId: item.id,
        scheduleVersion: extended.version,
        type: "APPOINTMENT_ACTION_DUE",
        status: "PENDING",
      },
    });
    expect(fresh).toHaveLength(2);
    expect(
      fresh.every(
        (j) => j.runAt.getTime() === extended.appointmentAt!.getTime(),
      ),
    ).toBe(true);
  });
  it("restart dua worker menambah alarm waktu janji pada record lama tanpa mengulang pengingat terdahulu", async () => {
    const item = await appointment(true);
    await db.outboxJob.deleteMany({
      where: { serviceCaseId: item.id, type: "APPOINTMENT_ACTION_DUE" },
    });
    const before = await db.outboxJob.findMany({
      where: { serviceCaseId: item.id },
      orderBy: { id: "asc" },
    });
    await Promise.all([
      reconcileAppointmentJobs(db),
      reconcileAppointmentJobs(db),
    ]);
    const after = await db.outboxJob.findMany({
      where: { serviceCaseId: item.id, type: "APPOINTMENT_PRE_DUE" },
      orderBy: { id: "asc" },
    });
    expect(after.map((j) => [j.id, j.status])).toEqual(
      before.map((j) => [j.id, j.status]),
    );
    expect(
      await db.outboxJob.count({
        where: { serviceCaseId: item.id, type: "APPOINTMENT_ACTION_DUE" },
      }),
    ).toBe(2);
    expect(
      (await db.serviceCase.findUniqueOrThrow({ where: { id: item.id } }))
        .version,
    ).toBe(item.version);
  });
  it("alarm saat janji yang kedaluwarsa tidak dikejar setelah restart", async () => {
    const item = await appointment();
    const due = await db.outboxJob.findFirstOrThrow({
      where: { serviceCaseId: item.id, type: "APPOINTMENT_ACTION_DUE" },
    });
    await db.outboxJob.update({
      where: { id: due.id },
      data: { status: "PROCESSING" },
    });
    await processJob(db, due, new Date(due.runAt.getTime() + 120_000), null);
    expect(
      (await db.outboxJob.findUniqueOrThrow({ where: { id: due.id } })).status,
    ).toBe("CANCELLED");
    expect(
      await db.notification.count({ where: { dedupKey: `job:${due.id}` } }),
    ).toBe(0);
  });
  it("reschedule dan selesai membatalkan versi lama; notification lama tidak boleh berbunyi", async () => {
    const item = await appointment();
    const old = await db.outboxJob.findFirstOrThrow({
      where: { serviceCaseId: item.id },
      orderBy: { runAt: "asc" },
    });
    const notice = await db.notification.create({
      data: {
        recipientId: owner.id,
        branchId,
        serviceCaseId: item.id,
        type: "APPOINTMENT_PRE_DUE",
        title: "Kode samaran",
        message: "Pengingat",
        link: `/work/${item.id}`,
        dedupKey: `job:${old.id}`,
        reminderExpiresAt: new Date(Date.now() + 60_000),
      },
    });
    const changed = await updateServiceCase(owner, item.id, {
      version: item.version,
      appointmentStatus: "CONFIRMED",
      appointmentAt: new Date(Date.now() + 48 * 3600_000),
    });
    expect(
      (await claimNotificationPresentation(owner, notice.id, "AUDIO")).claimed,
    ).toBe(false);
    expect(
      await db.outboxJob.count({
        where: {
          serviceCaseId: item.id,
          scheduleVersion: changed.version,
          status: "PENDING",
        },
      }),
    ).toBe(3);
    const processing = await updateServiceCase(owner, item.id, {
      version: changed.version,
      status: "IN_PROGRESS",
    });
    await updateServiceCase(owner, item.id, {
      version: processing.version,
      status: "HANDLED",
    });
    expect(
      await db.outboxJob.count({
        where: { serviceCaseId: item.id, status: "PENDING" },
      }),
    ).toBe(0);
    expect(
      await db.usageVerification.count({
        where: { prospectId: item.prospectId },
      }),
    ).toBe(0);
  });
  it("restart memulihkan lease tetapi membatalkan pengingat terlewat; rekonsiliasi dua worker aman", async () => {
    const item = await appointment();
    const first = await db.outboxJob.findFirstOrThrow({
      where: { serviceCaseId: item.id },
      orderBy: { runAt: "asc" },
    });
    const expired = new Date(first.runAt.getTime() + 120_000);
    await db.outboxJob.update({
      where: { id: first.id },
      data: { status: "PROCESSING", attempts: 1, leaseExpiresAt: first.runAt },
    });
    await recoverExpiredLeases(db, expired);
    expect(
      (await db.outboxJob.findUniqueOrThrow({ where: { id: first.id } }))
        .status,
    ).toBe("PENDING");
    const claimed = (
      await claimJobs(db, `${prefix}-restarted`, expired, 100)
    ).find((j) => j.id === first.id)!;
    await processJob(db, claimed, expired, null);
    expect(
      (await db.outboxJob.findUniqueOrThrow({ where: { id: first.id } }))
        .status,
    ).toBe("CANCELLED");
    expect(
      await db.notification.count({ where: { dedupKey: `job:${first.id}` } }),
    ).toBe(0);
    const legacy = await appointment();
    await db.outboxJob.deleteMany({ where: { serviceCaseId: legacy.id } });
    await db.outboxJob.create({
      data: {
        type: "APPOINTMENT_PRE_DUE",
        recipientId: owner.id,
        branchId,
        serviceCaseId: legacy.id,
        scheduleVersion: legacy.version,
        runAt: new Date(Date.now() + 3600_000),
        dedupKey: `${prefix}-legacy`,
      },
    });
    await Promise.all([
      reconcileAppointmentJobs(db),
      reconcileAppointmentJobs(db),
    ]);
    expect(
      await db.outboxJob.count({
        where: {
          serviceCaseId: legacy.id,
          status: "PENDING",
          dedupKey: { contains: ":v2:" },
        },
      }),
    ).toBe(3);
    expect(
      (
        await db.outboxJob.findUniqueOrThrow({
          where: { dedupKey: `${prefix}-legacy` },
        })
      ).status,
    ).toBe("CANCELLED");
  });
});
