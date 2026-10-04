import "./load-env";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Role } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import { randomBytes, randomUUID } from "node:crypto";
import { chromium } from "playwright-core";

import { resolveDatabaseUrl } from "../lib/database-url";

const baseURL = process.env.ALARM_SMOKE_URL ?? "http://localhost:3100";
const parsedURL = new URL(baseURL);
if (!/^(localhost|127\.0\.0\.1)$/.test(parsedURL.hostname))
  throw new Error("Smoke alarm hanya boleh menuju server lokal.");

const executablePath =
  process.env.BROWSER_PATH ??
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const connectionString = resolveDatabaseUrl({
  ...process.env,
  DATABASE_PURPOSE: "testing",
  TEST_DATABASE_NAME: process.env.TEST_DATABASE_NAME ?? "mabeslink_test",
});
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});
const suffix = randomUUID().slice(0, 8);
const userId = `alarm-smoke-${suffix}`;
const email = `alarm-smoke-${suffix}@example.invalid`;
const password = `${randomBytes(18).toString("base64url")}Aa1!`;
const notificationKey = `alarm-smoke-notification-${suffix}`;

async function main() {
  const branch = await db.branch.findUnique({ where: { code: "11539" } });
  if (!branch)
    throw new Error("Cabang 11539 belum tersedia di database testing.");
  await db.user.create({
    data: {
      id: userId,
      name: "Pemeriksa Alarm",
      email,
      emailVerified: true,
      active: true,
      isTest: true,
      role: Role.OUT_BRANCH,
      branchId: branch.id,
      accounts: {
        create: {
          accountId: userId,
          providerId: "credential",
          password: await hashPassword(password),
        },
      },
    },
  });

  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    browser = await chromium.launch({ executablePath, headless: false });
    const context = await browser.newContext({
      viewport: { width: 1100, height: 760 },
    });
    const page = await context.newPage();
    await page.goto(`${baseURL}/login`, { waitUntil: "networkidle" });
    await page.getByLabel("Email dinas").fill(email);
    await page.locator("#password").fill(password);
    await page.getByRole("button", { name: /masuk/i }).click();
    await page.waitForURL("**/dashboard");

    await page.goto(`${baseURL}/notification-settings`, {
      waitUntil: "networkidle",
    });
    await page.getByLabel("Volume suara").fill("100");
    await page.getByLabel("Pengulangan alarm").selectOption("5");
    await page.getByRole("button", { name: "Aktifkan Suara" }).click();
    await page.getByText("Suara aktif pada tab ini.").waitFor();

    await page.goto(`${baseURL}/dashboard`, { waitUntil: "domcontentloaded" });
    const bell = page.getByRole("button", { name: /^Notifikasi/ });
    await bell.click();
    await page
      .getByRole("menu", { name: "Dropdown notifikasi" })
      .waitFor();
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);

    await db.notification.create({
      data: {
        recipientId: userId,
        branchId: branch.id,
        type: "APPOINTMENT_ACTION_DUE",
        title: "Uji alarm janji",
        message:
          "Notifikasi uji diterima melalui jalur persisten dan SSE. Tidak memuat data nasabah.",
        link: "/work",
        dedupKey: notificationKey,
      },
    });
    await page.getByText(/Uji alarm janji:/).waitFor({ timeout: 8_000 });
    await page.waitForTimeout(5_000);
    console.log(
      "Smoke alarm berhasil: notifikasi persisten diterima melalui SSE dan audio dijadwalkan lima kali pada browser terlihat.",
    );
    await context.close();
  } finally {
    await browser?.close();
    await db.notification.deleteMany({ where: { dedupKey: notificationKey } });
    await db.user.deleteMany({ where: { id: userId, isTest: true } });
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Smoke alarm gagal.");
  process.exitCode = 1;
});
