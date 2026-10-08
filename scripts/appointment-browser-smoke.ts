import "./load-env";
import { PrismaClient, Role } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import { randomBytes, randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, type Page, type APIResponse } from "playwright-core";
import { resolveDatabaseUrl } from "../lib/database-url";

const databaseName =
  process.env.TEST_DATABASE_NAME ?? "mabeslink_ui_test_20261008";
if (!/^mabeslink_ui_test_[0-9]+$/.test(databaseName))
  throw new Error("Smoke browser wajib memakai database UI test terpisah.");
const baseURL = process.env.VISUAL_TEST_URL ?? "http://localhost:3100";
if (!["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname))
  throw new Error("Server uji harus lokal.");
const testEnv = {
  ...process.env,
  DATABASE_PURPOSE: "testing",
  TEST_DATABASE_NAME: databaseName,
  EMAIL_ENABLED: "false",
  SMTP_DRY_RUN: "true",
  WORKER_POLL_INTERVAL_MS: "5000",
  APPOINTMENT_BRANCH_LATITUDE: "-6.14621",
  APPOINTMENT_BRANCH_LONGITUDE: "106.82421",
  APPOINTMENT_BRANCH_VERIFIED_AT: "2026-10-07T00:00:00Z",
};
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: resolveDatabaseUrl(testEnv) }),
});
const prefix = `alarm-ui-${randomUUID().slice(0, 8)}`,
  password = `${randomBytes(18).toString("hex")}!Aa`;
const folder = resolve(".artifacts/appointment-smoke");
const checks: string[] = [],
  cases: string[] = [],
  prospects: string[] = [],
  users: string[] = [];
let worker: ChildProcess | null = null;
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
  checks.push(message);
  console.log(`PASS: ${message}`);
}
async function payload(response: Pick<APIResponse, "json" | "ok" | "status">) {
  const json = await response.json();
  if (!response.ok())
    throw new Error(
      `HTTP ${response.status()}: ${json.error?.message ?? "Permintaan gagal"}`,
    );
  return json.data;
}
// A generated 0.2s WAV, not a fake browser audio API or a customer's ringtone.
function wav() {
  const length = 4410,
    buffer = Buffer.alloc(44 + length * 2);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(buffer.length - 8, 4);
  buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(22050, 24);
  buffer.writeUInt32LE(44100, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(length * 2, 40);
  for (let i = 0; i < length; i++)
    buffer.writeInt16LE(
      Math.round(Math.sin((i * 2 * Math.PI * 880) / 22050) * 8000),
      44 + i * 2,
    );
  return buffer;
}
async function activate(page: Page) {
  await page
    .getByRole("button", { name: "Aktifkan Suara", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Matikan Suara", exact: true })
    .waitFor();
  await page.locator('input[type="file"][accept^="audio/"]').setInputFiles({
    name: "alarm-uji.wav",
    mimeType: "audio/wav",
    buffer: wav(),
  });
  await page.getByText("alarm-uji.wav", { exact: true }).waitFor();
}
async function starts(page: Page) {
  return page.evaluate(
    () => (window as Window & { alarmStarts?: number }).alarmStarts ?? 0,
  );
}
async function reset(page: Page) {
  await page.evaluate(() => {
    (window as Window & { alarmStarts?: number }).alarmStarts = 0;
  });
}

async function main() {
  await mkdir(folder, { recursive: true });
  const branch = await db.branch.upsert({
    where: { code: "11539" },
    create: { code: "11539", name: "KCP Samaran Uji", classCode: "B.2" },
    update: {},
  });
  for (const role of [Role.OUT_BRANCH, Role.CS]) {
    const id = `${prefix}-${role}`;
    users.push(id);
    await db.user.create({
      data: {
        id,
        name: `Petugas Samaran ${role}`,
        email: `${id.toLowerCase()}@example.invalid`,
        role,
        branchId: branch.id,
        emailVerified: true,
        active: true,
        emailNotificationsEnabled: false,
        accounts: {
          create: {
            providerId: "credential",
            accountId: id,
            password: await hashPassword(password),
          },
        },
      },
    });
  }
  const browser = await chromium.launch({
    executablePath:
      process.env.BROWSER_PATH ??
      "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    headless: true,
    args: ["--autoplay-policy=user-gesture-required"],
  });
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: "reduce",
    });
    // Instrument real Web Audio start calls only; do not replace AudioContext/permissions.
    await context.addInitScript(() => {
      (window as Window & { alarmStarts?: number }).alarmStarts = 0;
      const original = AudioBufferSourceNode.prototype.start;
      AudioBufferSourceNode.prototype.start = function (...args) {
        const state = window as Window & { alarmStarts?: number };
        state.alarmStarts = (state.alarmStarts ?? 0) + 1;
        return original.apply(this, args);
      };
      const stop = AudioBufferSourceNode.prototype.stop;
      AudioBufferSourceNode.prototype.stop = function (...args) {
        const state = window as Window & { alarmStops?: number };
        state.alarmStops = (state.alarmStops ?? 0) + 1;
        return stop.apply(this, args);
      };
    });
    const login = await context.request.post(
      `${baseURL}/api/auth/sign-in/email`,
      {
        data: { email: `${users[0].toLowerCase()}@example.invalid`, password },
        headers: { Origin: baseURL },
      },
    );
    if (!login.ok())
      throw new Error(
        `Login fixture gagal HTTP ${login.status()}; periksa target database test pada server.`,
      );
    checks.push("Login OUT_BRANCH fixture berhasil (database test saja).");
    const pages = [await context.newPage(), await context.newPage()];
    if (!process.argv.includes("--holding-only")) {
      for (const page of pages) {
        await page.goto(`${baseURL}/notification-settings`, {
          waitUntil: "domcontentloaded",
        });
        await activate(page);
      }
      assert(
        (await pages[0]
          .getByLabel("Penugasan dan perubahan layanan", { exact: true })
          .count()) === 0,
        "Pengaturan tidak lagi menawarkan suara untuk perubahan pekerjaan.",
      );
      // Even devices with older saved preferences must remain silent for CRUD.
      await pages[0].evaluate((id) => {
        const key = `mabeslink:sound:${id}`;
        const prefs = JSON.parse(localStorage.getItem(key)!);
        prefs.reminderKinds.assignments = true;
        prefs.reminderKinds.overdue = true;
        localStorage.setItem(key, JSON.stringify(prefs));
        window.dispatchEvent(
          new CustomEvent("mabeslink:notification-preferences"),
        );
      }, users[0]);
      await pages[0]
        .getByRole("button", { name: "Tes alarm waktu janji", exact: true })
        .click();
      await pages[0].waitForFunction(
        () =>
          ((window as Window & { alarmStarts?: number }).alarmStarts ?? 0) > 0,
      );
      assert(
        (await starts(pages[0])) === 1,
        "Ringtone unggahan didecode dan dimainkan sekali setelah interaksi pengguna.",
      );
      for (const page of pages) await reset(page);
      const form = {
        acquisitionCategory: "LIVIN_MERCHANT",
        acquisitionProduct: "LIVIN_MERCHANT_QRIS",
        contactName: "Kontak Uji Samaran",
        reason: "Discovery kebutuhan pembayaran samaran",
        nextAction: "Konfirmasi agenda kunjungan",
        targetValue: null,
        realizationValue: null,
        metricUnit: null,
        latitude: -6.14621,
        longitude: 106.824,
        locationLabel: "Lokasi Uji Samaran",
        locationSource: "MANUAL_COORDINATES",
        locationVerified: true,
        companionIds: [],
        appointmentStatus: "CONFIRMED",
      };
      const create = async (leadMs = 15_000, beforeMs = 15 * 60_000) => {
        const item = await payload(
          await context.request.post(`${baseURL}/api/appointments`, {
            data: {
              ...form,
              appointmentAt: new Date(
                Date.now() + beforeMs + leadMs,
              ).toISOString(),
            },
            headers: { Origin: baseURL },
          }),
        );
        cases.push(item.id);
        prospects.push(item.prospectId);
        assert(
          (await db.outboxJob.count({ where: { serviceCaseId: item.id } })) ===
            0,
          "Janji belum diterima tidak menjadwalkan alarm.",
        );
        if (cases.length === 1) {
          await pages[0].waitForTimeout(3000);
          assert(
            (await starts(pages[0])) + (await starts(pages[1])) === 0,
            "Simpan janji tidak membunyikan alarm pada dua tab meski preferensi CRUD lama aktif.",
          );
          await pages[0].goto(`${baseURL}/work/${item.id}`, {
            waitUntil: "domcontentloaded",
          });
          assert(
            (await pages[0]
              .getByTestId("appointment-countdown")
              .innerText()) === "Menunggu penerimaan",
            "Detail janji menampilkan status menunggu penerimaan.",
          );
          assert(
            (await pages[0].getByText("Readiness", { exact: true }).count()) ===
              0,
            "Janji tidak menampilkan readiness layanan atau penggunaan produk.",
          );
          await pages[0]
            .getByRole("button", { name: "Terima pekerjaan", exact: true })
            .click();
          const accepted = pages[0].waitForResponse(
            (r) =>
              r.url().endsWith(`/api/service-cases/${item.id}`) &&
              r.request().method() === "PATCH",
          );
          await pages[0]
            .getByRole("button", { name: "Ubah status", exact: true })
            .click();
          await payload(await accepted);
          await pages[0]
            .getByRole("button", { name: "Janji terlaksana", exact: true })
            .waitFor();
          // Acceptance must leave exactly one visible countdown panel.
          await pages[0].waitForFunction(
            () =>
              Array.from(
                document.querySelectorAll('[data-testid="reminder-countdown"]'),
              ).filter(
                (node) => (node as HTMLElement).getClientRects().length > 0,
              ).length === 1,
          );
          const reminderClock = pages[0].locator(
            '[data-testid="reminder-countdown"]:visible',
          );
          assert(
            (await reminderClock.count()) === 1,
            "Penerimaan pekerjaan tidak menggandakan panel countdown.",
          );
          const before = await reminderClock.innerText();
          await pages[0].waitForTimeout(1200);
          assert(
            (await reminderClock.innerText()) !== before,
            "Countdown alarm berjalan setelah Terima pekerjaan.",
          );
          assert(
            (await starts(pages[0])) + (await starts(pages[1])) === 0,
            "Perubahan status Terima pekerjaan tetap senyap; belum ada modal alarm.",
          );
          await pages[0].screenshot({
            path: resolve(folder, "appointment-tracking.png"),
          });
          await pages[0].goto(`${baseURL}/work`, {
            waitUntil: "domcontentloaded",
          });
          const card = pages[0]
            .locator("article")
            .filter({ hasText: item.code });
          const cardClock = card.getByTestId("card-alarm-countdown");
          await cardClock.waitFor();
          const cardBefore = await cardClock.innerText();
          await pages[0].waitForTimeout(1200);
          assert(
            (await cardClock.innerText()) !== cardBefore,
            "Countdown alarm pada kartu Akuisisi Nasabah berjalan setiap detik.",
          );
          assert(
            (await card.getByTestId("card-appointment-countdown").count()) ===
              1,
            "Kartu membedakan countdown menuju janji dan alarm berikutnya.",
          );
          for (const width of [1440, 390]) {
            await pages[0].setViewportSize({ width, height: 900 });
            await pages[0].screenshot({
              path: resolve(folder, `card-countdown-${width}.png`),
              fullPage: true,
            });
            assert(
              await pages[0].evaluate(
                () => document.documentElement.scrollWidth <= innerWidth + 1,
              ),
              `Kartu countdown ${width}px tidak overflow horizontal.`,
            );
          }
          await pages[0].setViewportSize({ width: 1440, height: 900 });
          await pages[0].goto(`${baseURL}/notification-settings`, {
            waitUntil: "domcontentloaded",
          });
          // A full browser navigation creates a fresh AudioContext: activate through
          // a real user gesture again, rather than bypassing browser autoplay rules.
          await activate(pages[0]);
        } else {
          await payload(
            await context.request.patch(
              `${baseURL}/api/service-cases/${item.id}`,
              {
                data: { version: item.version, status: "ACCEPTED" },
                headers: { Origin: baseURL },
              },
            ),
          );
        }
        return item;
      };
      const item = await create(45_000);
      assert(
        item.picId === users[0],
        "HTTP create otomatis menempatkan pembuat sebagai kendali, tanpa pilihan PIC wajib.",
      );
      const jobs = await db.outboxJob.findMany({
        where: { serviceCaseId: item.id, status: "PENDING" },
      });
      assert(
        jobs.length === 2 &&
          jobs.some(
            (j) =>
              (j.payload as { minutesBefore: number }).minutesBefore === 15,
          ) &&
          jobs.some(
            (j) =>
              j.type === "APPOINTMENT_ACTION_DUE" &&
              (j.payload as { minutesBefore: number }).minutesBefore === 0,
          ),
        "Lokasi terverifikasi menghasilkan slot 15 menit dan waktu janji; slot 24 jam terlewat tidak dikejar.",
      );
      worker = spawn(
        process.execPath,
        [resolve("node_modules/tsx/dist/cli.mjs"), "worker/index.ts"],
        {
          cwd: process.cwd(),
          env: { ...testEnv, DATABASE_URL: resolveDatabaseUrl(testEnv) },
          windowsHide: true,
          stdio: "ignore",
        },
      );
      const popupChecks = pages.map((page) =>
        page
          .locator('[aria-live="polite"] [role="status"]')
          .filter({ hasText: "Pengingat janji" })
          .waitFor({ timeout: 40_000 })
          .then(() => true)
          .catch(() => false),
      );
      const popupResult = await Promise.all(popupChecks);
      assert(
        popupResult.filter(Boolean).length === 1,
        "Worker terpisah → DB → SSE menampilkan pop-up tepat di satu tab penerima.",
      );
      const alarmPage = pages[popupResult.findIndex(Boolean)];
      const alarmDialog = alarmPage.getByRole("dialog", {
        name: "Alarm janji",
        exact: true,
      });
      await alarmDialog.waitFor();
      await alarmDialog
        .getByText("Kontak Uji Samaran", { exact: true })
        .waitFor();
      const startCounts = await Promise.all(pages.map(starts));
      if (startCounts.reduce((sum, count) => sum + count, 0) !== 1) {
        console.log("Alarm diagnostic:", {
          startCounts,
          dialog: await alarmDialog.innerText(),
        });
        await alarmPage.screenshot({
          path: resolve(folder, "alarm-failure.png"),
        });
      }
      assert(
        startCounts.reduce((sum, count) => sum + count, 0) === 1,
        "Pengingat otomatis memutar ringtone sekali total di dua tab.",
      );
      const notice = await db.notification.findFirstOrThrow({
        where: { serviceCaseId: item.id, type: "APPOINTMENT_PRE_DUE" },
      });
      assert(
        Boolean(notice.audioClaimedAt && notice.popupClaimedAt),
        "Klaim audio/pop-up bertahan di PostgreSQL.",
      );
      assert(
        await alarmDialog
          .getByRole("button", { name: "Matikan alarm", exact: true })
          .isVisible(),
        "Alarm membuka modal besar dengan detail janji dan tombol Matikan.",
      );
      for (const width of [1440, 390]) {
        await alarmPage.setViewportSize({ width, height: 900 });
        await alarmPage.screenshot({
          path: resolve(folder, `alarm-modal-${width}.png`),
        });
        assert(
          await alarmPage.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
          `Modal alarm ${width}px responsif.`,
        );
      }
      await alarmPage.setViewportSize({ width: 1440, height: 900 });
      const stopsBefore = await alarmPage.evaluate(
        () => (window as Window & { alarmStops?: number }).alarmStops ?? 0,
      );
      const snoozedResponse = alarmPage.waitForResponse(
        (r) =>
          r.url().endsWith(`/api/notifications/${notice.id}/alarm`) &&
          r.request().method() === "POST",
      );
      await alarmDialog
        .getByRole("button", { name: "1 menit", exact: true })
        .click();
      const snoozed = await payload(await snoozedResponse);
      await alarmDialog.waitFor({ state: "hidden" });
      assert(
        Boolean(snoozed.snoozedUntil),
        "Ingatkan lagi 1 menit menyimpan jadwal di PostgreSQL dan menutup alarm.",
      );
      assert(
        (await alarmPage.evaluate(
          () => (window as Window & { alarmStops?: number }).alarmStops ?? 0,
        )) > stopsBefore,
        "Snooze benar-benar menghentikan sumber Web Audio yang berulang.",
      );
      for (const page of pages) await reset(page);
      const ringing = await Promise.all(
        pages.map((p) =>
          p
            .getByRole("dialog", { name: "Alarm janji", exact: true })
            .waitFor({ timeout: 80_000 })
            .then(() => true)
            .catch(() => false),
        ),
      );
      assert(
        ringing.filter(Boolean).length === 1,
        "Worker memproses snooze persisten dan membuka kembali modal hanya di satu tab.",
      );
      assert(
        (await starts(pages[0])) + (await starts(pages[1])) === 1,
        "Snooze memulai satu sumber audio looping, tidak ganda antar-tab.",
      );
      const repeatedPage = pages[ringing.findIndex(Boolean)];
      const repeatDialog = repeatedPage.getByRole("dialog", {
        name: "Alarm janji",
        exact: true,
      });
      await repeatDialog
        .getByRole("button", { name: "Matikan alarm", exact: true })
        .click();
      await repeatDialog.waitFor({ state: "hidden" });
      assert(
        (await db.notification.count({
          where: { serviceCaseId: item.id, alarmDismissedAt: { not: null } },
        })) === 2,
        "Matikan tersimpan tanpa mengubah jadwal janji.",
      );
      await pages[0].screenshot({
        path: resolve(folder, "notification-desktop.png"),
      });
      for (const page of pages) {
        await page.reload({ waitUntil: "domcontentloaded" });
        await activate(page);
        await reset(page);
      }
      await pages[0].waitForTimeout(3000);
      assert(
        (await starts(pages[0])) + (await starts(pages[1])) === 0,
        "Refresh/reconnect dan aktivasi ulang tidak mengulang ringtone reminder yang telah diklaim.",
      );
      // Exercise an actual near-term appointment, reschedule before its old deadline,
      // then wait for the real worker/SSE. No browser clock or audio mocks.
      const dueItem = await create(20_000, 0);
      const acceptedDue = await db.serviceCase.findUniqueOrThrow({
        where: { id: dueItem.id },
      });
      const extendedAt = new Date(Date.now() + 40_000);
      const extended = await payload(
        await context.request.patch(
          `${baseURL}/api/service-cases/${dueItem.id}`,
          {
            data: {
              version: acceptedDue.version,
              appointmentAt: extendedAt.toISOString(),
              appointmentStatus: "CONFIRMED",
            },
            headers: { Origin: baseURL },
          },
        ),
      );
      assert(
        (await db.outboxJob.count({
          where: {
            serviceCaseId: dueItem.id,
            scheduleVersion: acceptedDue.version,
            status: "PENDING",
          },
        })) === 0,
        "Extend waktu membatalkan alarm waktu janji versi lama.",
      );
      await pages[0].waitForTimeout(22_000);
      assert(
        (await starts(pages[0])) + (await starts(pages[1])) === 0,
        "Tidak ada suara pada waktu janji lama setelah diperpanjang; simpan tetap senyap.",
      );
      const dueDialogs = await Promise.all(
        pages.map((p) =>
          p
            .getByRole("dialog", { name: "Alarm janji", exact: true })
            .filter({ hasText: "waktunya sekarang" })
            .waitFor({ timeout: 35_000 })
            .then(() => true)
            .catch(() => false),
        ),
      );
      assert(
        dueDialogs.filter(Boolean).length === 1,
        "Countdown waktu janji selesai: worker/SSE membuka satu modal waktunya sekarang pada jadwal baru.",
      );
      const duePage = pages[dueDialogs.findIndex(Boolean)];
      await duePage.waitForFunction(
        () =>
          ((window as Window & { alarmStarts?: number }).alarmStarts ?? 0) > 0,
      );
      assert(
        (await starts(pages[0])) + (await starts(pages[1])) === 1,
        "Alarm saat waktu janji benar-benar memulai satu sumber Web Audio, tidak ganda antar-tab.",
      );
      await duePage.screenshot({ path: resolve(folder, "due-time-alarm.png") });
      const dueDialog = duePage.getByRole("dialog", {
        name: "Alarm janji",
        exact: true,
      });
      await dueDialog
        .getByRole("button", { name: "1 menit", exact: true })
        .click();
      await dueDialog.waitFor({ state: "hidden" });
      for (const p of pages) await reset(p);
      const dueRepeated = await Promise.all(
        pages.map((p) =>
          p
            .getByRole("dialog", { name: "Alarm janji", exact: true })
            .filter({ hasText: "diingatkan kembali" })
            .waitFor({ timeout: 80_000 })
            .then(() => true)
            .catch(() => false),
        ),
      );
      assert(
        dueRepeated.filter(Boolean).length === 1,
        "Snooze 1 menit setelah waktu janji membuka modal baru dari worker persisten.",
      );
      const dueRepeatedPage = pages[dueRepeated.findIndex(Boolean)];
      await dueRepeatedPage.waitForFunction(
        () =>
          ((window as Window & { alarmStarts?: number }).alarmStarts ?? 0) > 0,
      );
      assert(
        (await starts(pages[0])) + (await starts(pages[1])) === 1,
        "Snooze alarm waktu janji juga berbunyi satu kali, bukan hanya notifikasi visual.",
      );
      await dueRepeatedPage
        .getByRole("dialog", { name: "Alarm janji", exact: true })
        .getByRole("button", { name: "Matikan alarm", exact: true })
        .click();
      assert(
        (await db.serviceCase.findUniqueOrThrow({ where: { id: dueItem.id } }))
          .version === extended.version,
        "Snooze tidak mengubah waktu/versi janji yang diperpanjang.",
      );
      for (const p of pages) await reset(p);
      await pages[0].getByRole("button", { name: "Mute", exact: true }).click();
      await pages[1]
        .getByRole("button", { name: "Bunyikan", exact: true })
        .waitFor();
      const muted = await create();
      await pages[0].waitForTimeout(22_000);
      const mutedNotice = await db.notification.findFirstOrThrow({
        where: { serviceCaseId: muted.id, type: "APPOINTMENT_PRE_DUE" },
      });
      assert(
        mutedNotice.audioClaimedAt === null &&
          (await starts(pages[0])) + (await starts(pages[1])) === 0,
        "Mute tersinkron antar-tab: notifikasi persisten muncul tanpa audio dan tanpa mengambil klaim audio.",
      );
      for (const page of pages) {
        const mutedDialog = page.getByRole("dialog", {
          name: "Alarm janji",
          exact: true,
        });
        if (await mutedDialog.isVisible()) {
          await mutedDialog
            .getByRole("button", { name: "Matikan alarm", exact: true })
            .click();
          await mutedDialog.waitFor({ state: "hidden" });
        }
      }
      await pages[0]
        .getByRole("button", { name: "Bunyikan", exact: true })
        .click();
      await pages[0].getByLabel("Volume suara", { exact: true }).focus();
      await pages[0].getByLabel("Volume suara", { exact: true }).press("Home");
      await reset(pages[0]);
      await pages[0]
        .getByRole("button", { name: "Tes Suara", exact: true })
        .click();
      await pages[0]
        .getByText("Tes tidak dibunyikan karena mute atau volume nol.", {
          exact: true,
        })
        .waitFor();
      assert(
        (await starts(pages[0])) === 0,
        "Volume nol menahan tes suara (tidak hanya mengubah label).",
      );
      await pages[0].getByLabel("Volume suara", { exact: true }).press("End");
      await pages[0]
        .getByRole("button", { name: "Tes Suara", exact: true })
        .click();
      await pages[0].waitForFunction(
        () =>
          ((window as Window & { alarmStarts?: number }).alarmStarts ?? 0) > 0,
      );
      assert(
        (await starts(pages[0])) === 1,
        "Volume dikembalikan: tes suara kembali memanggil Web Audio satu kali.",
      );
      const csContext = await browser.newContext();
      await csContext.request.post(`${baseURL}/api/auth/sign-in/email`, {
        data: { email: `${users[1].toLowerCase()}@example.invalid`, password },
        headers: { Origin: baseURL },
      });
      assert(
        (
          await csContext.request.post(
            `${baseURL}/api/notifications/${notice.id}/claim`,
            { data: { channel: "AUDIO" }, headers: { Origin: baseURL } },
          )
        ).status() === 404,
        "API klaim alarm tidak dapat diakses CS yang bukan penerima.",
      );
      assert(
        (
          await csContext.request.get(`${baseURL}/api/service-cases/${item.id}`)
        ).status() === 404,
        "API janji menolak CS yang tidak ditugaskan.",
      );
      await pages[0].bringToFront();
      await pages[0].goto(`${baseURL}/work`, { waitUntil: "domcontentloaded" });
      await pages[0]
        .getByRole("button", { name: "Buat janji", exact: true })
        .click();
      await pages[0]
        .getByLabel("Kategori akuisisi", { exact: true })
        .selectOption("LIVIN_MERCHANT");
      await pages[0]
        .getByLabel("Produk akuisisi", { exact: true })
        .selectOption("LIVIN_MERCHANT_QRIS");
      assert(
        await pages[0]
          .getByRole("button", { name: "Simpan janji", exact: true })
          .isEnabled(),
        "Tombol simpan tidak mensyaratkan pendamping atau pin lokasi opsional.",
      );
      await pages[0]
        .locator('input[name="contactName"]')
        .fill("Kontak UI Samaran");
      await pages[0]
        .locator('textarea[name="reason"]')
        .fill("Discovery kebutuhan pembayaran samaran");
      await pages[0]
        .locator('input[name="nextAction"]')
        .fill("Hubungi untuk mengonfirmasi agenda");
      await pages[0]
        .getByLabel("Status janji", { exact: true })
        .selectOption("NEEDS_SCHEDULING");
      const savedResponse = pages[0].waitForResponse(
        (response) =>
          response.url().endsWith("/api/appointments") &&
          response.request().method() === "POST",
      );
      await pages[0]
        .getByRole("button", { name: "Simpan janji", exact: true })
        .click();
      const saved = await payload(await savedResponse);
      cases.push(saved.id);
      prospects.push(saved.prospectId);
      assert(
        saved.picId === users[0] &&
          saved.appointmentAt == null &&
          saved.appointmentStatus === "NEEDS_SCHEDULING",
        "Form benar-benar menyimpan janji belum dikonfirmasi tanpa pin/pendamping/waktu terpisah.",
      );
      await pages[0]
        .getByRole("dialog", { name: "Buat janji akuisisi", exact: true })
        .waitFor({ state: "hidden" });
      for (const width of [360, 390, 768, 1440]) {
        await pages[0].bringToFront();
        await pages[0].setViewportSize({ width, height: 900 });
        await pages[0].goto(`${baseURL}/work/${item.id}`, {
          waitUntil: "domcontentloaded",
        });
        await pages[0].getByTestId("appointment-countdown").waitFor();
        assert(
          await pages[0].evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
          `Tracking janji ${width}px tidak overflow horizontal.`,
        );
        await pages[0].screenshot({
          path: resolve(folder, `tracking-${width}.png`),
          fullPage: true,
        });
        await pages[0].goto(`${baseURL}/work`, {
          waitUntil: "domcontentloaded",
        });
        await pages[0]
          .getByRole("button", { name: "Buat janji", exact: true })
          .waitFor();
        if ([1440, 390].includes(width)) {
          await pages[0].screenshot({
            path: resolve(folder, `acquisition-${width}.png`),
          });
        }
        await pages[0]
          .getByRole("button", { name: "Buat janji", exact: true })
          .click();
        await pages[0]
          .getByRole("dialog", { name: "Buat janji akuisisi", exact: true })
          .waitFor();
        assert(
          (await pages[0]
            .getByLabel("Waktu janji (WIB)", { exact: true })
            .count()) === 1,
          `Form ${width}px memakai satu waktu janji WIB.`,
        );
        assert(
          (await pages[0].getByLabel(/Waktu tindak lanjut/i).count()) === 0,
          `Form ${width}px tidak memiliki waktu tindak lanjut terpisah.`,
        );
        await pages[0]
          .getByLabel("Status janji", { exact: true })
          .selectOption("CONFIRMED");
        assert(
          await pages[0]
            .getByLabel("Waktu janji (WIB)", { exact: true })
            .evaluate((e) => (e as HTMLInputElement).required),
          `Form ${width}px mewajibkan waktu saat dikonfirmasi.`,
        );
        assert(
          await pages[0].evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
          `Form ${width}px tidak overflow horizontal.`,
        );
        await pages[0]
          .getByLabel("Waktu janji (WIB)", { exact: true })
          .scrollIntoViewIfNeeded();
        await pages[0].waitForTimeout(200);
        const bounds = await pages[0]
          .getByRole("dialog", { name: "Buat janji akuisisi", exact: true })
          .boundingBox();
        assert(
          Boolean(
            bounds && bounds.x >= 0 && bounds.x + bounds.width <= width + 1,
          ),
          `Modal ${width}px berada di dalam viewport.`,
        );
        await pages[0].screenshot({
          path: resolve(folder, `appointment-${width}.png`),
        });
      }
      await csContext.close();
    }
    // Appointment-only prospects are intentionally not listed as product-user
    // mapping. Create a separate synthetic mapping fixture via the real API.
    const mapped = await payload(
      await context.request.post(`${baseURL}/api/mapping`, {
        headers: { Origin: baseURL },
        data: {
          businessAlias: "Toko Product Holding Samaran",
          assignedToId: users[0],
          latitude: null,
          longitude: null,
          locationSource: null,
          mappingMarkerIcon: "STORE",
        },
      }),
    );
    prospects.push(mapped.id);
    for (const width of [1440, 390]) {
      await pages[0].setViewportSize({ width, height: 900 });
      await pages[0].goto(`${baseURL}/mapping`, {
        waitUntil: "domcontentloaded",
      });
      await pages[0]
        .getByRole("combobox", {
          name: "Cari nama, alamat, atau PIC",
          exact: true,
        })
        .fill(mapped.internalCode);
      await pages[0].getByTestId(`mapping-item-${mapped.id}`).click();
      const holding = pages[0].getByRole("region", {
        name: "Product Holding dan cross-selling",
        exact: true,
      });
      await holding
        .getByRole("heading", { name: "Product Holding", exact: true })
        .waitFor();
      if (width === 1440)
        await holding
          .getByLabel("Sudah ditanya/dikonfirmasi", { exact: true })
          .check();
      await holding
        .getByLabel("Cari Product Holding", { exact: true })
        .fill("Kopra");
      if (width === 1440) {
        await holding
          .getByLabel("Kopra Cash Management (MCM)", { exact: true })
          .check();
        await holding
          .getByLabel("Kopra Host to Host (H2H)", { exact: true })
          .check();
        const savedHolding = pages[0].waitForResponse(
          (r) =>
            r.url().endsWith(`/api/mapping/${mapped.id}/discovery`) &&
            r.request().method() === "PATCH",
        );
        await holding
          .getByRole("button", { name: "Simpan Product Holding", exact: true })
          .click();
        await payload(await savedHolding);
      }
      assert(
        (await holding
          .getByLabel("Kopra Cash Management (MCM)", { exact: true })
          .isChecked()) &&
          (await holding
            .getByLabel("Kopra Host to Host (H2H)", { exact: true })
            .isChecked()),
        `Product Holding ${width}px menyimpan/memuat checklist MCM dan H2H.`,
      );
      // Frame the checklist deliberately, not a mostly empty space above it.
      const anchor =
        width === 1440
          ? holding.getByRole("heading", {
              name: "Product Holding",
              exact: true,
            })
          : holding.getByLabel("Cari Product Holding", { exact: true });
      await anchor.evaluate((element) =>
        window.scrollTo({
          top: window.scrollY + element.getBoundingClientRect().top - 110,
          behavior: "instant",
        }),
      );
      await pages[0].waitForTimeout(250);
      await pages[0].screenshot({
        path: resolve(folder, `product-holding-${width}.png`),
      });
      assert(
        await pages[0].evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        `Product Holding ${width}px tanpa overflow.`,
      );
    }
    await context.close();
  } finally {
    await browser.close();
  }
}
main()
  .then(async () => {
    await writeFile(
      resolve(
        folder,
        process.argv.includes("--holding-only")
          ? "holding-results.json"
          : "results.json",
      ),
      JSON.stringify(
        {
          date: "2026-10-08",
          checkedAt: new Date().toISOString(),
          databaseName,
          checks,
          limitation:
            "Headless Edge memverifikasi Web Audio dan SSE, bukan audibilitas speaker fisik atau Safari/HP/background push. SMTP tidak dikirim.",
        },
        null,
        2,
      ),
    );
    console.log(
      `${checks.length} pemeriksaan browser lulus; .artifacts/appointment-smoke/${process.argv.includes("--holding-only") ? "holding-results" : "results"}.json`,
    );
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Smoke gagal");
    process.exitCode = 1;
  })
  .finally(async () => {
    worker?.kill();
    await db.emailDelivery.deleteMany({
      where: { recipientId: { in: users } },
    });
    await db.notification.deleteMany({ where: { recipientId: { in: users } } });
    await db.outboxJob.deleteMany({ where: { recipientId: { in: users } } });
    await db.serviceCase.deleteMany({ where: { id: { in: cases } } });
    await db.prospect.deleteMany({ where: { id: { in: prospects } } });
    await db.auditLog.deleteMany({ where: { actorId: { in: users } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.$disconnect();
  });
