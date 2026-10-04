import "./load-env";

import { readFile } from "node:fs/promises";
import { chromium } from "playwright-core";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { verifyPassword } from "better-auth/crypto";
import { resolveDatabaseUrl } from "../lib/database-url";

const baseURL = process.env.ROLE_TEST_URL ?? "http://localhost:3100";
const executablePath = process.env.BROWSER_PATH ?? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

async function main() {
  if (!new URL(baseURL).hostname.match(/^(localhost|127\.0\.0\.1)$/)) throw new Error("ROLE access check hanya boleh menuju server lokal.");
  const markdown = await readFile("role.md", "utf8");
  const credentials = Array.from(markdown.matchAll(/^\| (ADMIN|CS|SUPERVISOR|OUT_BRANCH) \| ([^| ]+) \| `([^`]+)` \|/gm)).map((match) => ({ role: match[1], email: match[2], password: match[3] }));
  if (credentials.length !== 4) throw new Error("role.md tidak memuat tepat empat kredensial seeder.");
  const connectionString = resolveDatabaseUrl({ ...process.env, DATABASE_PURPOSE: "testing", TEST_DATABASE_NAME: process.env.TEST_DATABASE_NAME ?? "mabeslink_test" });
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  for (const credential of credentials) {
    const account = await db.account.findFirst({ where: { user: { email: credential.email }, providerId: "credential" }, select: { password: true } });
    if (!account?.password || !(await verifyPassword({ hash: account.password, password: credential.password }))) throw new Error(`${credential.role}: password role.md tidak cocok dengan hash database.`);
  }
  await db.$disconnect();
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    for (const [index, credential] of credentials.entries()) {
      // Better Auth membatasi endpoint sign-in tiga kali per 10 detik secara default.
      if (index === 3) await new Promise((resolve) => setTimeout(resolve, 10_500));
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      const page = await context.newPage();
      await page.goto(`${baseURL}/login`, { waitUntil: "networkidle" });
      await page.getByLabel("Email dinas").fill(credential.email);
      await page.locator("#password").fill(credential.password);
      await page.getByRole("button", { name: /masuk/i }).click();
      const outcome = await Promise.race([
        page.waitForURL("**/dashboard", { timeout: 12_000 }).then(() => "dashboard" as const),
        page.locator('form p[role="alert"]').waitFor({ timeout: 12_000 }).then(() => "error" as const),
      ]);
      if (outcome === "error") throw new Error(`${credential.role}: login UI ditolak — ${await page.locator('form p[role="alert"]').innerText()}`);
      const adminApi = await page.request.get(`${baseURL}/api/admin/users`);
      const mappingApi = await page.request.get(`${baseURL}/api/mapping`);
      if (mappingApi.status() !== 200) throw new Error(`${credential.role}: API mapping menghasilkan ${mappingApi.status()}.`);
      if (credential.role === "ADMIN" && adminApi.status() !== 200) throw new Error("ADMIN tidak dapat mengakses API admin.");
      if (credential.role !== "ADMIN" && adminApi.status() !== 403) throw new Error(`${credential.role}: API admin seharusnya 403, aktual ${adminApi.status()}.`);
      const settingsVisible = await page.locator('a[href="/admin"]').count();
      if ((credential.role === "ADMIN") !== (settingsVisible > 0)) throw new Error(`${credential.role}: visibilitas Pengaturan tidak sesuai.`);
      await page.goto(`${baseURL}/admin`, { waitUntil: "networkidle" });
      if (credential.role !== "ADMIN" && !page.url().endsWith("/dashboard")) throw new Error(`${credential.role}: route admin langsung tidak dialihkan.`);
      console.log(`${credential.role}: login, navigasi role, API admin, dan API mapping sesuai.`);
      await context.close();
    }
  } finally { await browser.close(); }
}

void main();
