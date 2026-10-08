import "../scripts/load-env";
import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  listNotifications,
  markNotificationRead,
} from "@/lib/services/notifications";
import type { Actor } from "@/lib/session";

describe("otorisasi perubahan notifikasi", () => {
  it("menolak penerima lain, cabang lama, dan notifikasi data test pada API operasional", async () => {
    const prefix = `notice-acl-${crypto.randomUUID().slice(0, 8)}`;
    const ids = [`${prefix}-a`, `${prefix}-b`];
    const actor: Actor = {
      id: prefix,
      name: "Petugas Samaran",
      email: `${prefix}@example.invalid`,
      role: "OUT_BRANCH",
      branchId: ids[0],
    };
    await db.branch.createMany({
      data: ids.map((id, index) => ({
        id,
        code: `${prefix.slice(-8)}${index}`,
        name: "Cabang Samaran",
        classCode: "B.2",
      })),
    });
    try {
      await db.user.create({ data: actor });
      const hidden = await db.notification.create({
        data: {
          recipientId: actor.id,
          branchId: ids[1],
          type: "PIC_ASSIGNMENT",
          title: "Cabang lain",
          message: "Kode saja",
          link: "/work",
          dedupKey: `${prefix}-branch`,
        },
      });
      const test = await db.notification.create({
        data: {
          recipientId: actor.id,
          branchId: ids[0],
          isTest: true,
          type: "PIC_ASSIGNMENT",
          title: "Uji",
          message: "Kode saja",
          link: "/work",
          dedupKey: `${prefix}-test`,
        },
      });
      expect(await listNotifications(actor)).toEqual([]);
      await expect(
        markNotificationRead(actor, hidden.id),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(markNotificationRead(actor, test.id)).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      await expect(
        markNotificationRead({ ...actor, id: `${prefix}-other` }, hidden.id),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(
        (await db.notification.findUniqueOrThrow({ where: { id: hidden.id } }))
          .readAt,
      ).toBeNull();
    } finally {
      await db.user.deleteMany({ where: { id: prefix } });
      await db.branch.deleteMany({ where: { id: { in: ids } } });
    }
  });
});
