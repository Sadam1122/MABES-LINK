import { rm } from "node:fs/promises";
import path from "node:path";

import { db } from "@/lib/db";
import { privateStorageRoot } from "@/lib/services/location-photos";

export async function cleanupExpiredQrisSessions() {
  const expired = await db.qrisDesignSession.findMany({
    where: { expiresAt: { lt: new Date() } },
    take: 50,
  });
  const root = path.resolve(privateStorageRoot(), "qris-custom-temp");
  for (const item of expired) {
    await db.qrisDesignSession.deleteMany({ where: { id: item.id } });
    if (/^[a-zA-Z0-9_-]+\.png$/.test(item.storageKey))
      await rm(path.join(root, item.storageKey), { force: true });
  }
  await db.publicRateLimit.deleteMany({
    where: { windowEnd: { lt: new Date() } },
  });
  return expired.length;
}
