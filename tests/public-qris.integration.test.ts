import "../scripts/load-env";

import QRCode from "qrcode";
import { describe, expect, it } from "vitest";

describe("permintaan QRIS Custom publik pada database testing", () => {
  it("worker menghapus sesi QR kedaluwarsa dan token tidak dapat dipakai lagi", async () => {
    process.env.DATABASE_PURPOSE = "testing";
    process.env.TEST_DATABASE_NAME = "mabeslink_test";
    const { db } = await import("@/lib/db");
    const { createQrisSession, loadQrisSession } = await import("@/lib/qris-custom");
    const { cleanupExpiredQrisSessions } = await import("@/lib/qris-cleanup");
    const qr = await QRCode.toBuffer("000201010212QRIS-EXPIRY-TEST-11539", { width: 600, type: "png" });
    const session = await createQrisSession(qr, "image/png");
    await db.qrisDesignSession.update({ where: { id: session.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await cleanupExpiredQrisSessions()).toBeGreaterThanOrEqual(1);
    await expect(loadQrisSession(session.id, session.token)).rejects.toMatchObject({ code: "SESSION_NOT_FOUND" });
  });
  it("tanpa consent tidak membuat prospek; dengan consent deduplikasi dan hanya terlihat di cabang", async () => {
    process.env.DATABASE_PURPOSE = "testing";
    process.env.TEST_DATABASE_NAME = "mabeslink_test";
    const { db } = await import("@/lib/db");
    const {
      createQrisSession,
      deleteQrisSession,
      checkPublicRateLimit,
      hashValue,
    } = await import("@/lib/qris-custom");
    const { submitPublicQrisContact } = await import(
      "@/lib/services/public-qris"
    );
    const { listMappingProspects } = await import("@/lib/services/visits");
    const { Role } = await import("@prisma/client");
    const suffix = crypto.randomUUID().slice(0, 8);
    const rateAction = `qris-test-${suffix}`;
    const rateKey = hashValue(
      `${process.env.BETTER_AUTH_SECRET}:${rateAction}:untrusted-network`,
    );
    const existingBranch = await db.branch.findUnique({
      where: { code: "11539" },
    });
    const branch =
      existingBranch ??
      (await db.branch.create({
        data: { code: "11539", name: "Cabang Uji 11539", classCode: "B.2" },
      }));
    const officer = await db.user.create({
      data: {
        id: `public-qris-officer-${suffix}`,
        email: `public-qris-${suffix}@example.invalid`,
        name: "Petugas Samaran",
        role: Role.OUT_BRANCH,
        active: true,
        isTest: false,
        branchId: branch.id,
      },
    });
    const qr = await QRCode.toBuffer(
      "000201010212QRIS-TEST-NO-LIVE-PAYMENT-11539",
      { width: 600, type: "png" },
    );
    const session = await createQrisSession(qr, "image/png");
    const requestId = crypto.randomUUID();
    const base = {
      sessionId: session.id,
      token: session.token,
      requestId,
      contactName: "Kontak Samaran",
      businessName: `Toko Samaran ${suffix}`,
      phone: "081234567890",
      businessCategory: "Kuliner",
      address: "Area Mangga Besar Jakarta",
      latitude: -6.1447,
      longitude: 106.8182,
      locationSource: "MAP_PIN" as const,
      processingConsent: true as const,
      interestedProduct: "QRIS" as const,
      bankRelationship: "UNKNOWN" as const,
      contactWindow: null,
      needNote: null,
    };
    let prospectId: string | undefined;
    try {
      await expect(
        checkPublicRateLimit(
          new Request("http://localhost:3000/api/qris-custom/upload", {
            headers: { origin: "https://untrusted.example" },
          }),
          rateAction,
          1,
        ),
      ).rejects.toMatchObject({ code: "ORIGIN_FORBIDDEN" });
      await checkPublicRateLimit(
        new Request("http://localhost:3000/api/qris-custom/upload"),
        rateAction,
        1,
      );
      await expect(
        checkPublicRateLimit(
          new Request("http://localhost:3000/api/qris-custom/upload"),
          rateAction,
          1,
        ),
      ).rejects.toMatchObject({ code: "RATE_LIMITED" });
      expect(
        await submitPublicQrisContact({ ...base, contactConsent: false }),
      ).toEqual({ followUp: false });
      expect(
        await db.prospect.count({ where: { publicQrisRequestId: requestId } }),
      ).toBe(0);
      expect(
        await submitPublicQrisContact({ ...base, contactConsent: true }),
      ).toEqual({ followUp: true });
      const prospect = await db.prospect.findUniqueOrThrow({
        where: { publicQrisRequestId: requestId },
        include: { followUps: true },
      });
      prospectId = prospect.id;
      expect(prospect.followUps).toHaveLength(1);
      expect(prospect.publicContactConsentAt).toBeInstanceOf(Date);
      expect(prospect.latitude?.toNumber()).toBeCloseTo(-6.1447);
      expect(
        await db.outboxJob.count({
          where: { followUpId: prospect.followUps[0].id },
        }),
      ).toBe(2);
      await submitPublicQrisContact({ ...base, contactConsent: true });
      expect(
        await db.prospect.count({ where: { publicQrisRequestId: requestId } }),
      ).toBe(1);
      const actor = {
        id: officer.id,
        name: officer.name,
        email: officer.email,
        role: Role.OUT_BRANCH,
        branchId: branch.id,
      };
      expect(
        (
          await listMappingProspects(actor, {
            page: 1,
            pageSize: 100,
            search: suffix,
          })
        ).items.some((item) => item.id === prospect.id),
      ).toBe(true);
      expect(
        (
          await listMappingProspects(
            { ...actor, branchId: "other-branch" },
            { page: 1, pageSize: 100, search: suffix },
          )
        ).items.some((item) => item.id === prospect.id),
      ).toBe(false);
    } finally {
      if (prospectId) {
        await db.outboxJob.deleteMany({ where: { followUp: { prospectId } } });
        await db.notification.deleteMany({
          where: { followUp: { prospectId } },
        });
        await db.auditLog.deleteMany({
          where: { entityType: "Prospect", entityId: prospectId },
        });
        await db.prospect.delete({ where: { id: prospectId } });
      }
      await deleteQrisSession(session.id, session.token);
      await db.user.delete({ where: { id: officer.id } });
      await db.publicRateLimit.deleteMany({ where: { key: rateKey } });
      if (!existingBranch) await db.branch.delete({ where: { id: branch.id } });
    }
  });
});
