import "./load-env";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Role } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import { randomBytes, randomUUID } from "node:crypto";
import { chromium, type BrowserContext, type Page } from "playwright-core";
import { resolveDatabaseUrl } from "../lib/database-url";
import { appointmentCreateSchema } from "../lib/validation";

const executablePath =
  process.env.BROWSER_PATH ??
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const baseURL = process.env.VISUAL_TEST_URL ?? "http://localhost:3100";
if (!new URL(baseURL).hostname.match(/^(localhost|127\.0\.0\.1)$/))
  throw new Error("Visual check hanya boleh menuju server lokal.");
const connectionString = resolveDatabaseUrl({
  ...process.env,
  DATABASE_PURPOSE: "testing",
  TEST_DATABASE_NAME: process.env.TEST_DATABASE_NAME ?? "mabeslink_test",
});
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});
const suffix = randomUUID().slice(0, 8);
const email = `visual-${suffix}@example.invalid`;
const password = `${randomBytes(18).toString("base64url")}Aa1!`;
const userId = `visual-${suffix}`;
const officerId = `visual-officer-${suffix}`;
const mappingProspectId = `visual-mapping-${suffix}`;

function createTestWav() {
  const sampleRate = 8_000;
  const sampleCount = 800;
  const output = Buffer.alloc(44 + sampleCount * 2);
  output.write("RIFF", 0);
  output.writeUInt32LE(output.length - 8, 4);
  output.write("WAVEfmt ", 8);
  output.writeUInt32LE(16, 16);
  output.writeUInt16LE(1, 20);
  output.writeUInt16LE(1, 22);
  output.writeUInt32LE(sampleRate, 24);
  output.writeUInt32LE(sampleRate * 2, 28);
  output.writeUInt16LE(2, 32);
  output.writeUInt16LE(16, 34);
  output.write("data", 36);
  output.writeUInt32LE(sampleCount * 2, 40);
  for (let index = 0; index < sampleCount; index += 1)
    output.writeInt16LE(
      Math.round(Math.sin(index / 8) * 8_000),
      44 + index * 2,
    );
  return output;
}

async function checkDialogsAndAudio(page: Page) {
  const dismissActivation = page.getByRole("button", { name: "Nanti" });
  if (await dismissActivation.isVisible()) await dismissActivation.click();
  const bell = page.getByRole("button", { name: /^Notifikasi/ });
  await bell.click();
  const notificationDropdown = page.getByRole("menu", {
    name: "Dropdown notifikasi",
  });
  await notificationDropdown.waitFor();
  if (
    await notificationDropdown
      .getByRole("button", { name: "Aktifkan Suara" })
      .count()
  )
    throw new Error(
      "Pengaturan audio tidak boleh berada di dropdown notifikasi.",
    );
  const visualItem = notificationDropdown
    .getByRole("menuitem")
    .filter({ hasText: "Pengingat visual" });
  await visualItem.getByRole("button", { name: "Lihat detail" }).click();
  await notificationDropdown.waitFor({ state: "hidden" });
  const detailDialog = page.getByRole("dialog", { name: "Pengingat visual" });
  await detailDialog
    .getByRole("button", { name: "Tandai sudah dibaca" })
    .click();
  await detailDialog
    .getByRole("button", { name: "Tutup", exact: true })
    .click();
  await detailDialog.waitFor({ state: "hidden" });
  if (!(await bell.evaluate((node) => node === document.activeElement)))
    throw new Error("Fokus tidak kembali ke pemicu notifikasi.");

  await page.goto(`${baseURL}/notification-settings`, {
    waitUntil: "networkidle",
  });
  await page.getByRole("heading", { name: "Pengaturan Notifikasi" }).waitFor();
  await page.getByRole("button", { name: "Aktifkan Suara" }).click();
  const volume = page.getByLabel("Volume suara");
  for (const value of ["0", "50", "100"]) {
    await volume.fill(value);
    await page.getByRole("button", { name: "Tes Suara" }).click();
  }
  await page.getByRole("button", { name: "Tes alarm waktu janji" }).click();
  await page.getByRole("button", { name: "Hentikan suara" }).click();
  if (await page.getByLabel("Pengulangan alarm", { exact: true }).count())
    throw new Error(
      "Kontrol suara pembaruan pekerjaan seharusnya sudah dihapus.",
    );
  await page.locator('input[type="file"]').setInputFiles({
    name: "alarm-test.wav",
    mimeType: "audio/wav",
    buffer: createTestWav(),
  });
  await page.getByText("alarm-test.wav", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Mute", exact: true }).click();

  await page.goto(`${baseURL}/handovers`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Batch payroll" }).click();
  const batchDialog = page.getByRole("dialog", { name: "Batch payroll" });
  await batchDialog
    .getByLabel("Judul batch")
    .fill("Uji perubahan belum disimpan");
  await page.keyboard.press("Escape");
  const discard = page.getByRole("alertdialog", { name: "Buang perubahan" });
  await discard.waitFor();
  await page.keyboard.press("Escape");
  await discard.waitFor({ state: "hidden" });
  if (!(await batchDialog.isVisible()))
    throw new Error("Escape pada konfirmasi seharusnya membatalkan penutupan.");
  await page.waitForTimeout(100);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Buang perubahan" }).click();
  await batchDialog.waitFor({ state: "hidden" });

  await page.getByRole("button", { name: "Batch payroll" }).click();
  const box = await batchDialog.boundingBox();
  if (!box) throw new Error("Dialog batch tidak memiliki bounding box.");
  await page.mouse.click(2, 2);
  await batchDialog.waitFor({ state: "hidden" });
}

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
  await page.goto(`${baseURL}/work`, { waitUntil: "networkidle" });
  await page
    .getByRole("heading", { name: "Akuisisi Nasabah", exact: true })
    .waitFor();
  if (await page.getByRole("button", { name: "Nanti" }).count())
    throw new Error(`${name}: prompt aktivasi audio otomatis masih tampil.`);
  if (name === "desktop-1440") {
    await page.getByRole("button", { name: "Buat janji", exact: true }).click();
    const appointmentDialog = page.getByRole("dialog", {
      name: "Buat janji akuisisi",
    });
    await appointmentDialog
      .getByRole("combobox", { name: "Kategori akuisisi" })
      .selectOption("LIVIN_MERCHANT");
    await appointmentDialog
      .getByRole("combobox", { name: "Produk akuisisi", exact: true })
      .selectOption("LIVIN_MERCHANT_QRIS");
    await appointmentDialog
      .getByLabel("Janji dengan siapa")
      .fill("Kontak Samaran");
    await appointmentDialog.getByLabel("Nomor HP").fill("123");
    await appointmentDialog
      .getByLabel("Alasan dan tujuan janji")
      .fill("Membahas kebutuhan transaksi QRIS usaha samaran");
    await appointmentDialog
      .getByLabel("Next action")
      .fill("Konfirmasi agenda kunjungan");
    await appointmentDialog
      .getByLabel("Tanggal follow up / waktu janji (WIB)")
      .fill(new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 16));
    await appointmentDialog
      .getByRole("checkbox", { name: /Petugas Mapping Visual/ })
      .check();
    await appointmentDialog.getByLabel("Latitude").fill("-6.1450000");
    await appointmentDialog.getByLabel("Longitude").fill("106.8180000");
    await appointmentDialog
      .getByRole("button", { name: "Terapkan koordinat" })
      .click();
    await appointmentDialog
      .getByLabel("Label/alamat singkat lokasi")
      .fill("Ruko samaran");
    await appointmentDialog
      .getByRole("button", { name: "Gunakan ikon Menara" })
      .click();
    await appointmentDialog
      .getByRole("button", { name: "Simpan janji" })
      .click();
    await appointmentDialog
      .getByText(/Nomor HP: Nomor HP tidak valid/i)
      .waitFor();
    if (
      errors.some((message) => !message.includes("422 (Unprocessable Entity)"))
    )
      throw new Error(
        `${name}: console error tak terduga pada validasi: ${errors.join(" | ")}`,
      );
    errors.length = 0;
    await appointmentDialog.getByLabel("Nomor HP").fill("081234567890");
    let capturedAppointment: unknown;
    await page.route("**/api/appointments", async (route) => {
      capturedAppointment = route.request().postDataJSON();
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          data: { id: "visual-synthetic", prospectId: "visual-synthetic" },
        }),
      });
    });
    await appointmentDialog
      .getByRole("button", { name: "Simpan janji" })
      .click();
    await page.waitForURL("**/work/visual-synthetic");
    const serialized = appointmentCreateSchema.safeParse(capturedAppointment);
    if (!serialized.success || serialized.data.mappingMarkerIcon !== "TOWER")
      throw new Error(
        `Form janji tidak mengirim payload valid dan ikon Menara: ${serialized.success ? "ikon berbeda" : serialized.error.message}`,
      );
    await page.unroute("**/api/appointments");
  }
  await page.goto(`${baseURL}/mapping`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Mapping" }).waitFor();
  await page
    .getByRole("heading", { name: "Discovery & peluang relevan" })
    .waitFor();
  await page
    .getByText("Catatan awal dari Excel · belum dikonfirmasi")
    .waitFor();
  const discoveryPanel = page.getByRole("region", {
    name: "Discovery dan peluang cross-selling",
  });
  if (
    await discoveryPanel.evaluate(
      (node) => node.scrollWidth > node.clientWidth + 1,
    )
  )
    throw new Error(`${name}: panel discovery memiliki overflow horizontal.`);
  await page.getByRole("link", { name: "Template Excel" }).waitFor();
  await page.getByRole("link", { name: "Ekspor Excel" }).waitFor();
  await page.getByRole("button", { name: "Impor Excel" }).click();
  const excelDialog = page.getByRole("dialog", {
    name: "Impor lokasi dari Excel",
  });
  await excelDialog.waitFor();
  await page.waitForTimeout(250);
  if (
    await excelDialog.evaluate(
      (node) => node.scrollWidth > node.clientWidth + 1,
    )
  )
    throw new Error(
      `${name}: dialog impor Excel memiliki overflow horizontal.`,
    );
  await page.screenshot({ path: `.artifacts/mapping-excel-${name}.png` });
  await page.keyboard.press("Escape");
  await excelDialog.waitFor({ state: "hidden" });
  await page.locator(".leaflet-container").waitFor({ timeout: 15_000 });
  await page.getByLabel("Cari nama, alamat, atau PIC").fill("uji filter");
  await page.getByText("Filter lanjutan").click();
  await page.getByLabel("Status akuisisi").selectOption("FOLLOW_UP");
  await page.getByLabel("Jadwal follow-up").selectOption("today");
  await page
    .getByRole("button", { name: "Reset filter" })
    .evaluate((node) => node.scrollIntoView({ block: "center" }));
  await page.getByRole("button", { name: "Reset filter" }).click();
  await page
    .getByRole("button", { name: "Heatmap" })
    .evaluate((node) => node.scrollIntoView({ block: "center" }));
  await page.getByRole("button", { name: "Heatmap" }).click();
  await page.getByLabel("Titik heatmap").selectOption("verified");
  await page.locator(".leaflet-container canvas[aria-hidden='true']").waitFor();
  await page
    .getByRole("button", { name: "Penanda" })
    .evaluate((node) => node.scrollIntoView({ block: "center" }));
  await page.getByRole("button", { name: "Penanda" }).click();
  await page
    .getByRole("button", { name: "Tambah lokasi" })
    .evaluate((node) => node.scrollIntoView({ block: "center" }));
  await page.getByRole("button", { name: "Tambah lokasi" }).click();
  const mappingDialog = page.getByRole("dialog", {
    name: "Tambah lokasi mapping",
  });
  await mappingDialog.waitFor();
  if (name !== "mobile-360") {
    await mappingDialog
      .getByRole("button", { name: "Gunakan ikon Kuliner" })
      .evaluate((node) => node.scrollIntoView({ block: "center" }));
    await mappingDialog
      .getByRole("button", { name: "Gunakan ikon Kuliner" })
      .click();
    await mappingDialog.getByLabel("Latitude").fill("-6.1447000");
    await mappingDialog.getByLabel("Longitude").fill("106.8182500");
    await mappingDialog
      .getByRole("button", { name: "Terapkan koordinat" })
      .evaluate((node) => node.scrollIntoView({ block: "center" }));
    await mappingDialog
      .getByRole("button", { name: "Terapkan koordinat" })
      .click();
    await mappingDialog.getByText(/di dalam referensi batas/i).waitFor();
  }
  const dialogOverflow = await mappingDialog.evaluate(
    (node) => node.scrollWidth > node.clientWidth + 1,
  );
  if (dialogOverflow)
    throw new Error(
      `${name}: dialog tambah lokasi memiliki overflow horizontal.`,
    );
  await page.keyboard.press("Escape");
  if (name !== "mobile-360")
    await page.getByRole("button", { name: "Buang perubahan" }).click();
  await mappingDialog.waitFor({ state: "hidden" });
  if (name.startsWith("mobile"))
    await page.getByRole("navigation", { name: "Navigasi seluler" }).waitFor();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  await page.screenshot({
    path: `.artifacts/mapping-${name}.png`,
    fullPage: name.startsWith("desktop"),
  });
  if (overflow) {
    const offenders = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>("body *"))
        .filter(
          (node) =>
            !node.closest(
              'nav[aria-label="Navigasi seluler"],.leaflet-container',
            ),
        )
        .map((node) => ({
          tag: node.tagName,
          className: String(node.className).slice(0, 120),
          right: Math.round(node.getBoundingClientRect().right),
          width: Math.round(node.getBoundingClientRect().width),
        }))
        .filter((item) => item.right > innerWidth + 1 && item.width > 0)
        .slice(0, 20),
    );
    const widths = await page.evaluate(() => ({
      html: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
      viewport: innerWidth,
    }));
    throw new Error(
      `${name}: halaman memiliki overflow horizontal: ${JSON.stringify({ widths, offenders })}`,
    );
  }
  if (errors.length)
    throw new Error(`${name}: console error: ${errors.join(" | ")}`);
  const forbidden = await page
    .locator("body")
    .innerText()
    .then((text) =>
      /tahap [123]|prototype|dummy|tombol seed|kredensial demo/i.test(text),
    );
  if (forbidden) throw new Error(`${name}: label pengembangan masih terlihat.`);
  await page.goto(`${baseURL}/appointment-map`, { waitUntil: "networkidle" });
  await page
    .getByRole("heading", { name: "Mapping Janji", exact: true })
    .waitFor();
  await page.locator(".leaflet-container").waitFor({ timeout: 15_000 });
  if (await page.getByRole("button", { name: "Nanti" }).count())
    throw new Error(`${name}: prompt aktivasi audio otomatis masih tampil.`);
  if (name === "desktop-1440") await checkDialogsAndAudio(page);
  console.log(
    `${name}: mapping penggunaan dan mapping janji tampil tanpa overflow/console error.`,
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
  await db.user.create({
    data: {
      id: officerId,
      name: "Petugas Mapping Visual",
      email: `visual-officer-${suffix}@example.invalid`,
      emailVerified: true,
      active: true,
      isTest: false,
      role: Role.OUT_BRANCH,
      branchId: branch.id,
    },
  });
  await db.prospect.create({
    data: {
      id: mappingProspectId,
      internalCode: `VIS-${suffix}`,
      businessAlias: "Usaha Visual Samaran",
      need: "Belum dikonfirmasi",
      contactPic: "Belum dicatat",
      branchId: branch.id,
      assignedToId: officerId,
      createdById: userId,
      latitude: -6.145,
      longitude: 106.818,
      locationLabel: "Lokasi visual samaran",
      mappingImportedAt: new Date(),
      mappingDiscovery: {
        create: {
          segments: ["PEMBISNIS"],
          opportunityTags: ["LIVIN_MERCHANT_QRIS"],
          sourceNeedHint: "QRIS hanya hipotesis",
        },
      },
    },
  });
  await db.notification.create({
    data: {
      recipientId: userId,
      branchId: branch.id,
      type: "APPOINTMENT_ACTION_DUE",
      title: "Pengingat visual",
      message: "Sudah waktunya membuat atau mengonfirmasi janji follow-up.",
      link: "/mapping",
      dedupKey: `visual-notification-${suffix}`,
    },
  });
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    browser = await chromium.launch({ executablePath, headless: true });
    for (const [index, viewport] of [
      { width: 1440, height: 900, name: "desktop-1440" },
      { width: 768, height: 1024, name: "tablet-768" },
      { width: 390, height: 844, name: "mobile-390" },
      { width: 360, height: 800, name: "mobile-360" },
    ].entries()) {
      if (process.env.VISUAL_ONLY && viewport.name !== process.env.VISUAL_ONLY)
        continue;
      if (index === 3)
        await new Promise((resolve) => setTimeout(resolve, 10_500));
      await check(
        await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          isMobile: viewport.width < 600,
          hasTouch: viewport.width < 800,
        }),
        viewport.name,
      );
    }
  } finally {
    await browser?.close();
    await db.prospect.deleteMany({ where: { id: mappingProspectId } });
    await db.user.deleteMany({ where: { id: { in: [userId, officerId] } } });
    await db.$disconnect();
  }
}

void main();
