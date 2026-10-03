import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Role } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import { randomBytes, randomUUID } from "node:crypto";
import { chromium, type BrowserContext } from "playwright-core";

const executablePath =
  process.env.BROWSER_PATH ??
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const baseURL = process.env.APP_URL ?? "http://localhost:3000";
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL tidak tersedia.");
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});
const suffix = randomUUID().slice(0, 8);
const email = `visual-${suffix}@example.invalid`;
const password = `${randomBytes(18).toString("base64url")}Aa1!`;
const userId = `visual-${suffix}`;

async function check(context: BrowserContext, name: string) {
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto(`${baseURL}/login`, { waitUntil: "networkidle" });
  await page.getByLabel("Email dinas").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: /masuk/i }).click();
  await page.waitForURL("**/dashboard");
  await page.goto(`${baseURL}/mapping`, { waitUntil: "networkidle" });
  await page
    .getByRole("heading", { name: "Peta lokasi & kunjungan" })
    .waitFor();
  await page.locator(".leaflet-container").waitFor({ timeout: 15_000 });
  if (name === "mobile")
    await page.getByRole("navigation", { name: "Navigasi seluler" }).waitFor();
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth + 1,
  );
  await page.screenshot({
    path: `.artifacts/mapping-${name}.png`,
    fullPage: name === "desktop",
  });
  if (overflow)
    throw new Error(`${name}: halaman memiliki overflow horizontal.`);
  if (errors.length)
    throw new Error(`${name}: console error: ${errors.join(" | ")}`);
  const forbidden = await page
    .locator("body")
    .innerText()
    .then((text) =>
      /tahap [123]|prototype|dummy|tombol seed|kredensial demo/i.test(text),
    );
  if (forbidden) throw new Error(`${name}: label pengembangan masih terlihat.`);
  console.log(
    `${name}: mapping tampil, peta tersedia, tanpa overflow horizontal/console error.`,
  );
  await page.close();
}

async function main() {
  const branch = await db.branch.findUnique({ where: { code: "11539" } });
  if (!branch) throw new Error("Cabang 11539 belum tersedia.");
  await db.user.create({
    data: {
      id: userId,
      name: "Pemeriksa UI",
      email,
      emailVerified: true,
      active: true,
      isTest: true,
      role: Role.ADMIN,
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
    browser = await chromium.launch({ executablePath, headless: true });
    await check(
      await browser.newContext({ viewport: { width: 1440, height: 900 } }),
      "desktop",
    );
    await check(
      await browser.newContext({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      }),
      "mobile",
    );
  } finally {
    await browser?.close();
    await db.user.deleteMany({ where: { id: userId, isTest: true } });
    await db.$disconnect();
  }
}

void main();
