import "./load-env";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Role } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  chromium,
  type BrowserContext,
  type Page,
  type APIResponse,
} from "playwright-core";
import { jsPDF } from "jspdf";
import { resolveDatabaseUrl } from "../lib/database-url";

const databaseName =
  process.env.TEST_DATABASE_NAME ?? "mabeslink_ui_test_20261008";
if (!/^mabeslink_ui_test_[0-9]+$/.test(databaseName))
  throw new Error(
    "Guidebook wajib memakai database UI test terpisah, bukan operasional/regresi.",
  );
const baseURL = process.env.VISUAL_TEST_URL ?? "http://localhost:3100";
if (!/^(localhost|127\.0\.0\.1)$/.test(new URL(baseURL).hostname))
  throw new Error("Audit hanya untuk server lokal.");
const db = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: resolveDatabaseUrl({
      ...process.env,
      DATABASE_PURPOSE: "testing",
      TEST_DATABASE_NAME: databaseName,
    }),
  }),
});
const suffix = randomUUID().slice(0, 8);
const password = `${randomBytes(18).toString("hex")}!Aa`;
const output = resolve(".artifacts/audit-ui");
const pdfPath = resolve("docs/MABES_LINK_Guidebook_2026-10-08.pdf");
const checks: string[] = [];
const screenshots: {
  file: string;
  title: string;
  description: string;
  width: number;
}[] = [];

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
async function data(response: APIResponse) {
  const payload = await response.json();
  assert(
    response.ok(),
    `HTTP ${response.status()}: ${payload.error?.message ?? "Permintaan gagal"}`,
  );
  return payload.data;
}
async function login(context: BrowserContext, email: string) {
  await data(
    await context.request
      .post(`${baseURL}/api/auth/sign-in/email`, {
        data: { email, password },
        headers: { Origin: baseURL },
      })
      .then(async (response) => {
        // Better Auth does not use the application {data} envelope.
        assert(response.ok(), `Login fixture gagal (${response.status()}).`);
        return response;
      }),
  );
}
async function visit(page: Page, path: string) {
  await page.goto(`${baseURL}${path}`, { waitUntil: "domcontentloaded" });
  await page.locator("main").waitFor();
  await page.waitForTimeout(400);
}
async function capture(
  page: Page,
  name: string,
  title: string,
  description: string,
  width: number,
) {
  await page.evaluate(
    () =>
      document.activeElement instanceof HTMLElement &&
      document.activeElement.blur(),
  );
  await page.waitForTimeout(450);
  const file = `${output}/${name}-${width}.png`;
  await page.screenshot({ path: file, fullPage: false });
  screenshots.push({ file, title, description, width });
}
async function checkViewport(page: Page, label: string) {
  const result = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    brokenImages: [...document.querySelectorAll<HTMLImageElement>("img")]
      .filter((image) => image.complete && image.naturalWidth === 0)
      .map((image) => image.getAttribute("src")),
  }));
  if (result.overflow) {
    await page.screenshot({
      path: `${output}/failure-${label.replace(/[^a-z0-9]/gi, "-")}.png`,
      fullPage: false,
    });
    const offenders = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("body *")]
        .filter(
          (element) =>
            !element.closest(
              '.leaflet-container,nav[aria-label="Navigasi seluler"]',
            ),
        )
        .map((element) => ({
          tag: element.tagName,
          class: String(element.className).slice(0, 110),
          right: element.getBoundingClientRect().right,
          width: element.getBoundingClientRect().width,
        }))
        .filter(
          (element) => element.width > 0 && element.right > innerWidth + 1,
        )
        .slice(0, 20),
    );
    throw new Error(`${label}: overflow ${JSON.stringify(offenders)}`);
  }
  assert(
    result.brokenImages.length === 0,
    `${label}: gambar rusak ${JSON.stringify(result)}`,
  );
  checks.push(`${label}: tanpa overflow horizontal atau gambar rusak.`);
}

async function buildPdf() {
  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
    compress: true,
  });
  // Embed real TTF fonts when available so PDF viewers do not substitute a
  // condensed system font. No font binary or customer data is copied into Git.
  const regular = await readFile(
    process.env.GUIDEBOOK_FONT_REGULAR ?? "C:/Windows/Fonts/arial.ttf",
  ).catch(() => null);
  const bold = await readFile(
    process.env.GUIDEBOOK_FONT_BOLD ?? "C:/Windows/Fonts/arialbd.ttf",
  ).catch(() => null);
  let font = "helvetica";
  if (regular && bold) {
    pdf.addFileToVFS("Guidebook-Regular.ttf", regular.toString("base64"));
    pdf.addFont("Guidebook-Regular.ttf", "MabesGuide", "normal");
    pdf.addFileToVFS("Guidebook-Bold.ttf", bold.toString("base64"));
    pdf.addFont("Guidebook-Bold.ttf", "MabesGuide", "bold");
    font = "MabesGuide";
  }
  const navy: [number, number, number] = [9, 44, 96];
  const gold: [number, number, number] = [248, 188, 23];
  const header = (title: string, subtitle: string) => {
    pdf.setFillColor(...navy);
    pdf.rect(0, 0, 297, 29, "F");
    pdf.setFillColor(...gold);
    pdf.rect(12, 12, 3, 8, "F");
    pdf.setTextColor(255);
    pdf.setFont(font, "bold");
    pdf.setFontSize(17);
    pdf.text(title, 20, 16);
    pdf.setFont(font, "normal");
    pdf.setFontSize(9);
    pdf.text(subtitle, 20, 23);
  };
  const footer = (number: number) => {
    pdf.setDrawColor(222, 228, 235);
    pdf.line(12, 198, 285, 198);
    pdf.setTextColor(95, 112, 135);
    pdf.setFontSize(8);
    pdf.text(
      "MABES LINK | Panduan internal | 8 Oktober 2026 | Seluruh data contoh disamarkan",
      12,
      204,
    );
    pdf.text(String(number), 282, 204);
  };
  header(
    "MABES LINK / Guidebook",
    "Tampilan aktual website dan panduan kerja - bukan mockup fitur yang belum berjalan.",
  );
  pdf.setTextColor(...navy);
  pdf.setFont(font, "bold");
  pdf.setFontSize(26);
  pdf.text("Kerja cabang, lebih terarah.", 18, 55);
  pdf.setFont(font, "normal");
  pdf.setFontSize(12);
  pdf.text(
    [
      "KCP Mandiri Jakarta Mangga Besar 11539 - B.2",
      "Mapping, janji akuisisi, pengingat internal, serah terima dan penggunaan.",
      "Screenshot diambil melalui Edge/Chromium dari production build lokal.",
      "Database khusus UI test; tidak menggunakan identitas/data nasabah nyata.",
    ],
    18,
    72,
    { lineHeightFactor: 1.7 },
  );
  pdf.setFillColor(241, 246, 251);
  pdf.roundedRect(18, 112, 260, 65, 4, 4, "F");
  pdf.setFontSize(11);
  pdf.text(
    [
      "Batas pembuktian",
      "Pemeriksaan ukuran 360, 390, 768 dan 1440 px menggunakan browser desktop emulasi.",
      "Suara perangkat nyata, Chrome/Opera/Safari/iOS, SMTP inbox dan hosting internal",
      "belum dibuktikan oleh screenshot ini. Browser tidak dapat dipaksa memberi izin audio.",
      "Status siap layanan tidak sama dengan penggunaan produk. Tidak ada integrasi bank/CAKRA.",
    ],
    25,
    124,
    { lineHeightFactor: 1.65 },
  );
  footer(1);
  const picked = screenshots.filter(
    (shot) =>
      shot.width === 1440 ||
      (shot.width === 390 &&
        [
          "Mapping",
          "Akuisisi Nasabah",
          "Buat janji akuisisi",
          "Notifikasi",
          "QRIS Custom",
          "Tracking janji",
          "Alarm janji",
          "Product Holding",
        ].includes(shot.title)),
  );
  for (const shot of picked) {
    pdf.addPage();
    header(shot.title, `Screenshot aktual ${shot.width}px - data samaran`);
    const png = await readFile(shot.file);
    const props = pdf.getImageProperties(png);
    const scale = Math.min(267 / props.width, 146 / props.height);
    const w = props.width * scale;
    const h = props.height * scale;
    pdf.setFillColor(245, 248, 251);
    pdf.roundedRect(12, 35, 273, 149, 3, 3, "F");
    pdf.addImage(png, "PNG", (297 - w) / 2, 36 + (145 - h) / 2, w, h);
    pdf.setTextColor(...navy);
    pdf.setFontSize(9);
    pdf.text(pdf.splitTextToSize(shot.description, 270), 14, 190);
    footer(pdf.getNumberOfPages());
  }
  for (const [template, title] of [
    ["batik_nusantara", "Batik Nusantara"],
    ["alam_indonesia", "Alam Indonesia"],
  ]) {
    const png = await readFile(`${output}/qris-output-${template}.png`).catch(
      () => null,
    );
    if (!png) continue;
    pdf.addPage();
    header(
      `QRIS / ${title}`,
      "Hasil PNG aktual dari API lokal - QR uji sintetis, bukan kode pembayaran nyata.",
    );
    const props = pdf.getImageProperties(png);
    const scale = 152 / props.height;
    pdf.addImage(png, "PNG", 18, 36, props.width * scale, 152);
    pdf.setTextColor(...navy);
    pdf.setFont(font, "bold");
    pdf.setFontSize(16);
    pdf.text("Bingkai/desain QRIS gratis", 140, 52);
    pdf.setFont(font, "normal");
    pdf.setFontSize(11);
    pdf.text(
      pdf.splitTextToSize(
        "Unggah QRIS resmi yang diizinkan. Pilih template, atur posisi QR, tulisan dan stiker pada area yang diizinkan. Logo dan area kode terlindungi; unduh PNG/PDF setelah memeriksa pratinjau.",
        130,
      ),
      140,
      66,
      { lineHeightFactor: 1.7 },
    );
    pdf.text(
      pdf.splitTextToSize(
        "Gambar di kiri merupakan hasil render aplikasi yang diuji melalui HTTP 200 dan signature file valid. Tidak mengklaim kode uji dapat menerima pembayaran. Persetujuan kontak dimatikan sehingga pengujian tidak membuat pendaftar.",
        130,
      ),
      140,
      117,
      { lineHeightFactor: 1.7 },
    );
    footer(pdf.getNumberOfPages());
  }
  pdf.addPage();
  header(
    "Alur kerja & pemeriksaan",
    "Gunakan sesuai kewenangan cabang. Data CAKRA tetap melalui proses/referensi yang diizinkan.",
  );
  pdf.setTextColor(...navy);
  pdf.setFontSize(11);
  const lines = [
    "1. Mapping: cari usaha/PIC, gunakan filter, cek pin atau daftar jika peta tidak tersedia.",
    "2. Janji: pilih kategori > produk, pendamping, next action dan waktu WIB; Terima pekerjaan mengaktifkan pengingat.",
    "3. Pengingat: worker mengambil outbox persisten; SSE memberi notifikasi internal tanpa refresh.",
    "4. Alarm: modal berisi detail janji; Matikan atau Ingatkan lagi 1/5/10 menit, hanya untuk penerima sendiri.",
    "5. Handover: kirim ke CS; penerima mengakui, memproses dan memastikan layanan siap.",
    "6. Penggunaan: catat verifikasi penggunaan dengan tanggal dan referensi bukti non-sensitif.",
    "7. QRIS: persetujuan pemrosesan > unggah QR contoh > pilih template > desain > unduh PNG.",
    "8. Product Holding: checklist produk yang sudah dikonfirmasi; penawaran/response tetap terpisah dan sesuai izin.",
    "9. Keamanan: login wajib; role/cabang/PIC diperiksa server; ekspor tidak memuat CIF/rekening.",
    "10. Infrastruktur: FE+BE dalam Next.js, worker Node terpisah, PostgreSQL dan storage persisten.",
    "Tes HTTP/alur dan UI tersedia di .artifacts/audit-ui/results.json. Detail hasil ada di dokumentasi.",
    "PDF tidak menyatakan persetujuan produk, kebaruan inovasi, kesiapan produksi atau email masuk inbox.",
  ];
  pdf.text(pdf.splitTextToSize(lines.join("\n"), 261), 18, 47, {
    lineHeightFactor: 1.7,
  });
  footer(pdf.getNumberOfPages());
  await mkdir(resolve("docs"), { recursive: true });
  await writeFile(pdfPath, Buffer.from(pdf.output("arraybuffer")));
  console.log(
    `PDF aktual: docs/MABES_LINK_Guidebook_2026-10-08.pdf (${pdf.getNumberOfPages()} halaman).`,
  );
}

async function main() {
  await mkdir(output, { recursive: true });
  const branch = await db.branch.upsert({
    where: { code: "11539" },
    create: {
      code: "11539",
      name: "KCP Mandiri Jakarta Mangga Besar",
      classCode: "B.2",
    },
    update: {},
  });
  const roles = [Role.ADMIN, Role.OUT_BRANCH, Role.CS, Role.SUPERVISOR];
  const users = await Promise.all(
    roles.map(async (role) =>
      db.user.create({
        data: {
          id: `ui-audit-${suffix}-${role}`,
          name:
            role === Role.OUT_BRANCH
              ? "Raka Samaran"
              : role === Role.CS
                ? "Sari Samaran"
                : role === Role.SUPERVISOR
                  ? "Bima Samaran"
                  : "Admin Samaran",
          email: `ui-${suffix}-${role.toLowerCase()}@example.invalid`,
          emailVerified: true,
          active: true,
          role,
          branchId: branch.id,
          emailNotificationsEnabled: false,
          accounts: {
            create: {
              accountId: `ui-audit-${suffix}-${role}`,
              providerId: "credential",
              password: await hashPassword(password),
            },
          },
        },
      }),
    ),
  );
  const [admin, out, cs, supervisor] = users;
  for (const [index, alias] of [
    "Kedai Melati Samaran",
    "Toko Anggrek Samaran",
    "Klinik Mawar Samaran",
  ].entries()) {
    await db.prospect.create({
      data: {
        internalCode: `UI-${suffix}-${index}`,
        businessAlias: alias,
        need: "Belum dikonfirmasi",
        contactPic: "Tidak dicantumkan",
        branchId: branch.id,
        assignedToId: out.id,
        createdById: out.id,
        businessSector: index === 2 ? "Kesehatan" : "Kuliner",
        areaBlock: "Lokasari",
        addressHint: "Titik samaran untuk pemeriksaan antarmuka",
        locationLabel: alias,
        latitude: -6.145 + index * 0.001,
        longitude: 106.818 + index * 0.001,
        locationSource: "MANUAL_COORDINATES",
        mappingMarkerIcon: index === 2 ? "HEALTH" : "CAFE",
        mappingImportedAt: new Date(),
        mappingDiscovery: {
          create: {
            segments: ["PEMBISNIS"],
            opportunityTags: [index === 2 ? "HEALTHCARE" : "CULINARY"],
            sourceNeedHint: "Catatan samaran, bukan kebutuhan terkonfirmasi",
          },
        },
      },
    });
  }
  const browser = await chromium.launch({
    executablePath:
      process.env.BROWSER_PATH ??
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    headless: true,
  });
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: "reduce",
    });
    await context.addInitScript(() => {
      const target = window as typeof window & {
        __auditSseReceived: Record<string, number>;
        __auditToasts: string[];
      };
      target.__auditSseReceived = {};
      target.__auditToasts = [];
      const observed = new WeakSet<Element>();
      new MutationObserver(() => {
        for (const item of document.querySelectorAll('[role="status"]')) {
          const text = item.textContent ?? "";
          if (
            text.includes("Pengingat audit samaran:") &&
            !observed.has(item)
          ) {
            observed.add(item);
            target.__auditToasts.push(text);
          }
        }
      }).observe(document, {
        childList: true,
        subtree: true,
        characterData: true,
      });
      const Original = window.EventSource;
      window.EventSource = class extends Original {
        constructor(...args: ConstructorParameters<typeof EventSource>) {
          super(...args);
          this.addEventListener("notification", (event) => {
            try {
              target.__auditSseReceived[
                JSON.parse((event as MessageEvent).data).id
              ] = Date.now();
            } catch {}
          });
        }
      };
    });
    await login(context, out.email);
    const csrf = await context.request.patch(`${baseURL}/api/notifications`, {
      headers: { Origin: "https://evil.example.invalid" },
    });
    assert(csrf.status() === 403, "CSRF cross-origin harus ditolak.");
    checks.push("Mutasi cross-origin ditolak HTTP 403.");
    const invalidCursor = await context.request.get(
      `${baseURL}/api/notifications?cursor=abc`,
    );
    assert(
      invalidCursor.status() === 422,
      "Cursor salah harus 422, bukan 500.",
    );
    const guest = await browser.newContext();
    assert(
      (
        await guest.request.get(`${baseURL}/api/notifications/stream`)
      ).status() === 401,
      "SSE tanpa login harus 401.",
    );
    await guest.close();
    const cases = await data(
      await context.request.post(`${baseURL}/api/appointments`, {
        data: {
          acquisitionCategory: "LIVIN_MERCHANT",
          acquisitionProduct: "LIVIN_MERCHANT_QRIS",
          contactName: "Kontak Samaran",
          businessAlias: "Warung Kenanga Samaran",
          appointmentStatus: "NEEDS_SCHEDULING",
          reason: "Discovery kebutuhan pembayaran non-tunai usaha samaran",
          nextAction: "Konfirmasi agenda kunjungan",
          companionIds: [cs.id],
          appointmentAt: new Date(Date.now() + 35 * 3600_000).toISOString(),
          targetValue: null,
          realizationValue: null,
          metricUnit: null,
          locationLabel: "Warung Kenanga Samaran",
          latitude: -6.1456,
          longitude: 106.819,
          locationSource: "MANUAL_COORDINATES",
          mappingMarkerIcon: "FOOD",
        },
      }),
    );
    const page = await context.newPage();
    assert(
      cases.appointmentAt !== null &&
        cases.appointmentStatus === "NEEDS_SCHEDULING" &&
        !cases.acceptedAt,
      "Perlu membuat janji tidak boleh otomatis terkonfirmasi.",
    );
    await visit(page, "/mapping");
    const second = await context.newPage();
    await visit(second, "/mapping");
    const notice = await db.notification.create({
      data: {
        recipientId: out.id,
        branchId: branch.id,
        // General SSE fixture; real appointment jobs/alarms are exercised by
        // appointment-browser-smoke, not fabricated here without an outbox job.
        type: "SERVICE_STATUS",
        title: "Pengingat audit samaran",
        message: `${cases.code}: konfirmasi janji pada waktu yang tercatat.`,
        link: `/work/${cases.id}`,
        dedupKey: `ui-live-${suffix}`,
        serviceCaseId: cases.id,
      },
    });
    const storedAt = Date.now();
    await Promise.all(
      [page, second].map((tab) =>
        tab.waitForFunction(
          (id) =>
            (
              window as typeof window & {
                __auditSseReceived: Record<string, number>;
              }
            ).__auditSseReceived[id],
          notice.id.toString(),
          { timeout: 5_000 },
        ),
      ),
    );
    const arrivalTimes = await Promise.all(
      [page, second].map((tab) =>
        tab.evaluate(
          (id) =>
            (
              window as typeof window & {
                __auditSseReceived: Record<string, number>;
              }
            ).__auditSseReceived[id],
          notice.id.toString(),
        ),
      ),
    );
    const maxDelay = Math.max(...arrivalTimes.map((time) => time - storedAt));
    assert(
      maxDelay <= 5_000,
      `Target SSE 5 detik belum terpenuhi: ${maxDelay}ms.`,
    );
    console.log(
      `SSE dua tab: ${maxDelay}ms dari penyimpanan; memeriksa dropdown dan deduplikasi.`,
    );
    for (const tab of [page, second]) {
      await tab.getByRole("button", { name: /^Notifikasi/ }).click();
      await tab
        .getByRole("menuitem")
        .filter({ hasText: "Pengingat audit samaran" })
        .waitFor({ timeout: 5_000 });
    }
    const toastCount = await Promise.all(
      [page, second].map((tab) =>
        tab.evaluate(
          (code) =>
            (
              window as typeof window & { __auditToasts: string[] }
            ).__auditToasts.filter((text) => text.includes(code)).length,
          cases.code,
        ),
      ),
    );
    assert(
      toastCount.reduce((sum, count) => sum + count, 0) === 1,
      `Notifikasi antar-tab harus memiliki satu toast: ${JSON.stringify(toastCount)}.`,
    );
    checks.push(
      "SSE muncul pada dua tab dalam <=5 detik; hanya satu toast global per notifikasi.",
    );
    await page
      .getByRole("menuitem")
      .filter({ hasText: "Pengingat audit samaran" })
      .getByRole("button", { name: "Lihat detail" })
      .click();
    await page
      .getByRole("dialog", { name: "Pengingat audit samaran" })
      .waitFor();
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    await second.close();
    assert(
      (await context.request.get(`${baseURL}/api/admin/users`)).status() ===
        403,
      "OUT_BRANCH tidak boleh mengakses akun admin.",
    );
    const csContext = await browser.newContext();
    await login(csContext, cs.email);
    const adminContext = await browser.newContext();
    await login(adminContext, admin.email);
    let version = cases.version;
    const patchCase = async (
      ctx: BrowserContext,
      patch: Record<string, unknown>,
    ) => {
      const updated = await data(
        await ctx.request.patch(`${baseURL}/api/service-cases/${cases.id}`, {
          data: { version, ...patch },
        }),
      );
      version = updated.version;
      return updated;
    };
    await patchCase(context, { status: "ACCEPTED" });
    await patchCase(context, {
      appointmentStatus: "CONFIRMED",
      appointmentAt: new Date(Date.now() + 36 * 3600_000).toISOString(),
    });
    const staleCount = await db.outboxJob.count({
      where: {
        serviceCaseId: cases.id,
        scheduleVersion: version - 1,
        status: "CANCELLED",
      },
    });
    assert(
      staleCount > 0,
      "Konfirmasi/reschedule belum membatalkan reminder versi lama.",
    );
    await patchCase(csContext, { takeControl: true });
    await patchCase(csContext, { status: "IN_PROGRESS" });
    await patchCase(csContext, { status: "HANDLED" });
    await patchCase(adminContext, { status: "VERIFIED" });
    await patchCase(adminContext, { status: "CLOSED" });
    assert(
      (await db.usageVerification.count({
        where: { prospectId: cases.prospectId },
      })) === 0,
      "Selesai layanan bukan penggunaan otomatis.",
    );
    // Existing handover workflow is tested over HTTP, without intercepted/mock responses.
    let prospect = await db.prospect.findUniqueOrThrow({
      where: { id: cases.prospectId },
    });
    prospect = await data(
      await context.request.patch(`${baseURL}/api/prospects/${prospect.id}`, {
        data: { version: prospect.version, opportunityStage: "NEED_CONFIRMED" },
      }),
    );
    let handover = await data(
      await context.request.post(`${baseURL}/api/handovers`, {
        data: {
          type: "SINGLE",
          title: "Handover Kenanga Samaran",
          receiverId: cs.id,
          prospectIds: [prospect.id],
        },
      }),
    );
    for (const [status, ctx] of [
      ["SUBMITTED", context],
      ["ACCEPTED", csContext],
      ["PROCESSING", csContext],
      ["READY", csContext],
    ] as const) {
      handover = await data(
        await ctx.request.patch(`${baseURL}/api/handovers/${handover.id}`, {
          data: { version: handover.version, status },
        }),
      );
    }
    assert(
      (await db.usageVerification.count({
        where: { prospectId: prospect.id },
      })) === 0,
      "Siap bukan penggunaan otomatis.",
    );
    await data(
      await csContext.request.post(`${baseURL}/api/usage-verifications`, {
        data: {
          prospectId: prospect.id,
          usedAt: new Date().toISOString(),
          evidenceReference: `UI-BUKTI-${suffix}`,
          note: "Referensi uji non-sensitif",
        },
      }),
    );
    checks.push(
      "HTTP nyata: lokasi/janji -> reschedule membatalkan versi lama -> diterima PIC -> selesai/verifikasi/tutup -> handover CS -> siap -> penggunaan terpisah.",
    );
    const adminPage = await adminContext.newPage();
    for (const width of [1440, 390]) {
      await adminPage.setViewportSize({ width, height: 900 });
      const pages = [
        ["/admin", "Manajemen pengguna"],
        ["/qris-registrations", "Pendaftar QRIS"],
        ...(width === 1440
          ? [
              [`/work/${cases.id}`, "Detail pekerjaan"],
              [`/handovers/${handover.id}`, "Detail handover"],
              [`/prospects/${prospect.id}`, "Detail referensi kerja"],
            ]
          : []),
      ];
      for (const [path, title] of pages) {
        await visit(adminPage, path);
        await checkViewport(adminPage, `${title} ${width}px`);
        await capture(
          adminPage,
          title.toLowerCase().replace(/\s/g, "-"),
          title,
          "Halaman berotorisasi aktual menggunakan data samaran pada database UI test terpisah.",
          width,
        );
      }
    }
    await adminPage.close();
    const publicPage = await browser.newPage({
      viewport: { width: 1440, height: 900 },
      reducedMotion: "reduce",
    });
    await publicPage.goto(baseURL, { waitUntil: "domcontentloaded" });
    await publicPage
      .getByRole("link", { name: /Buat desain QRIS/ })
      .first()
      .waitFor();
    await capture(
      publicPage,
      "home",
      "Home",
      "Promosi, QRIS gratis, FAQ, lokasi cabang dan footer. Rating tetap melalui Google Maps, bukan angka rekaan.",
      1440,
    );
    await publicPage.goto(`${baseURL}/login`, {
      waitUntil: "domcontentloaded",
    });
    await capture(
      publicPage,
      "login",
      "Login",
      "Login menggunakan akun internal; logo dan tombol kembali mengarah ke Home.",
      1440,
    );
    await publicPage.close();
    // Check all principal pages at each requested breakpoint.
    for (const width of [360, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: width < 600 ? 844 : 900 });
      for (const [path, title] of [
        ["/dashboard", "Beranda internal"],
        ["/work", "Akuisisi Nasabah"],
        ["/mapping", "Mapping"],
        ["/appointment-map", "Mapping Janji"],
        ["/notifications", "Notifikasi"],
        ["/notification-settings", "Pengaturan alarm"],
        ["/follow-ups", "Tindak lanjut"],
        ["/handovers", "Handover"],
        ["/results", "Ringkasan Hasil"],
        ["/qris-custom", "QRIS Custom"],
      ]) {
        const pageErrors: string[] = [];
        const handleError = (error: Error) => pageErrors.push(error.message);
        page.on("pageerror", handleError);
        await visit(page, path);
        await checkViewport(page, `${title} ${width}px`);
        if (path === "/mapping") {
          await page.locator(".leaflet-container").first().waitFor();
          await page
            .locator(".leaflet-container")
            .first()
            .scrollIntoViewIfNeeded();
        }
        assert(!pageErrors.length, `${title}: ${pageErrors.join(" | ")}`);
        page.off("pageerror", handleError);
        await capture(
          page,
          path.slice(1),
          title,
          title === "Mapping"
            ? "Peta lebar, pencarian debounce, filter PIC/sektor dan kepadatan titik. Titik pada gambar adalah data samaran."
            : "Tampilan aktual pada ukuran layar yang tercantum; seluruh nama dan kode kerja merupakan fixture pengujian.",
          width,
        );
        if (path === "/dashboard" && width < 1024) {
          await page
            .getByRole("button", { name: "Lainnya", exact: true })
            .click();
          await page.getByRole("dialog", { name: "Menu kerja" }).waitFor();
          await page.keyboard.press("Escape");
          await page.getByRole("dialog").waitFor({ state: "hidden" });
        }
        if (path === "/notification-settings") {
          const help = page.getByRole("button", {
            name: "Informasi pengulangan alarm",
            exact: true,
          });
          await help.click();
          await page
            .getByRole("tooltip")
            .filter({ hasText: "Jumlah putaran suara" })
            .waitFor();
          await help.press("Escape");
          await page.getByRole("tooltip").waitFor({ state: "hidden" });
        }
        if (path === "/mapping") {
          const search = page.getByRole("combobox", {
            name: "Cari nama, alamat, atau PIC",
          });
          await search.fill("Melati");
          await page
            .getByRole("option", { name: /Kedai Melati/ })
            .first()
            .waitFor();
          assert(
            (await search.getAttribute("placeholder")) ===
              "Cari lokasi atau nama usaha…",
            "Placeholder pencarian berubah.",
          );
          await search.press("ArrowDown");
          await search.press("Enter");
          await search.fill("Tidak-ada-lokasi-xyz");
          await page
            .getByRole("status")
            .filter({ hasText: "Tidak ada lokasi sesuai" })
            .waitFor();
          await search.fill("");
          await search.press("Escape");
          // Clear debounce and focus the current results before inspecting actual pixels.
          await page
            .getByRole("button", { name: "Fokus hasil filter" })
            .click();
          await page
            .getByRole("button", { name: "Heatmap", exact: true })
            .click();
          await page
            .locator(".leaflet-container canvas[aria-hidden='true']")
            .waitFor();
          await page.waitForFunction(
            () => {
              const canvas = document.querySelector<HTMLCanvasElement>(
                ".leaflet-container canvas[aria-hidden='true']",
              );
              if (!canvas?.width || !canvas.height) return false;
              return [
                ...canvas
                  .getContext("2d")!
                  .getImageData(0, 0, canvas.width, canvas.height).data,
              ].some((value, index) => index % 4 === 3 && value > 0);
            },
            undefined,
            { timeout: 5_000 },
          );
          await page.getByRole("button", { name: "Perbesar peta" }).click();
          await page
            .getByRole("button", { name: "Tampilkan daftar" })
            .waitFor();
          await page.getByRole("button", { name: "Tampilkan daftar" }).click();
          if (width === 1440)
            await capture(
              page,
              "heatmap",
              "Heatmap",
              "Kepadatan titik nyata pada canvas dari fixture samaran; bukan skor kredit atau potensi dana.",
              width,
            );
          await page
            .getByRole("button", { name: "Penanda", exact: true })
            .click();
          await page
            .getByRole("button", { name: "Tambah lokasi", exact: true })
            .click();
          const form = page.getByRole("dialog", {
            name: "Tambah lokasi mapping",
          });
          await form.getByLabel("Nama toko/usaha").fill("Uji Modal Samaran");
          await form
            .getByRole("button", { name: "Simpan lokasi mapping", exact: true })
            .click();
          const nested = page.getByRole("dialog", {
            name: "Tambahkan lokasi mapping?",
          });
          await nested.waitFor();
          assert(
            await form.evaluate((element) => (element as HTMLElement).inert),
            "Form induk tidak inert saat konfirmasi.",
          );
          await page.keyboard.press("Escape");
          await nested.waitFor({ state: "hidden" });
          assert(await form.isVisible(), "Escape menutup dua modal sekaligus.");
          assert(
            await page.evaluate(
              () => document.body.style.overflow === "hidden",
            ),
            "Scroll lock hilang saat form masih terbuka.",
          );
          await form.getByLabel("Nama toko/usaha").click();
          assert(await form.isVisible(), "Klik di dalam menutup modal.");
          await page.keyboard.press("Escape");
          await page
            .getByRole("button", { name: "Buang perubahan", exact: true })
            .click();
          await form.waitFor({ state: "hidden" });
        }
        if (path === "/work") {
          await page
            .getByRole("button", { name: "Buat janji", exact: true })
            .click();
          const dialog = page.getByRole("dialog", {
            name: "Buat janji akuisisi",
          });
          await dialog.waitFor();
          await dialog
            .getByRole("combobox", { name: "Cari produk akuisisi" })
            .fill("QRIS");
          await dialog.getByRole("option").first().waitFor();
          await page.keyboard.press("ArrowDown");
          await page.keyboard.press("Enter");
          await capture(
            page,
            "appointment-modal",
            "Buat janji akuisisi",
            "Kategori dan produk bertingkat; waktu janji WIB, kendali pembuat, pendamping serta pin/koordinat tujuan. Perlu membuat janji tidak berarti janji terkonfirmasi.",
            width,
          );
          await page.keyboard.press("Escape");
          await page
            .getByRole("button", { name: "Buang perubahan", exact: true })
            .click();
        }
      }
    }
    await page.close();
    // Every role keeps server-side restrictions and can view permitted mapping.
    for (const user of [admin, cs, supervisor, out]) {
      const roleContext =
        user === admin
          ? adminContext
          : user === cs
            ? csContext
            : user === out
              ? context
              : await browser.newContext();
      if (user === supervisor) await login(roleContext, user.email);
      assert(
        (await roleContext.request.get(`${baseURL}/api/mapping`)).ok(),
        `${user.role}: mapping gagal.`,
      );
      const adminStatus = (
        await roleContext.request.get(`${baseURL}/api/admin/users`)
      ).status();
      assert(
        adminStatus === (user.role === "ADMIN" ? 200 : 403),
        `${user.role}: API admin tidak sesuai.`,
      );
      if (user === supervisor) await roleContext.close();
      checks.push(
        `${user.role}: mapping sesuai izin; API akun dibatasi server.`,
      );
    }
    await Promise.all([
      context.close(),
      csContext.close(),
      adminContext.close(),
    ]);
    assert(
      (await db.notification.findUniqueOrThrow({ where: { id: notice.id } }))
        .recipientId === out.id,
      "Notifikasi salah penerima.",
    );
    await writeFile(
      `${output}/results.json`,
      JSON.stringify(
        {
          checkedAt: new Date().toISOString(),
          database: databaseName,
          browser: "Edge/Chromium headless",
          checks,
          screenshots,
        },
        null,
        2,
      ),
    );
    await buildPdf();
    console.log(
      `${checks.length} pemeriksaan UI/HTTP selesai; ${screenshots.length} screenshot aktual.`,
    );
  } finally {
    await browser.close();
    await db.$disconnect();
  }
}

async function entry() {
  if (process.argv.includes("--refresh-final")) {
    const existing = JSON.parse(
      await readFile(`${output}/results.json`, "utf8"),
    );
    const latestFolder = resolve(".artifacts/appointment-smoke");
    const latest = JSON.parse(
      await readFile(`${latestFolder}/results.json`, "utf8"),
    );
    assert(
      existing.database === databaseName &&
        latest.databaseName === databaseName &&
        latest.checks?.length >= 45 &&
        latest.checks.some((line: string) =>
          line.startsWith("Product Holding 390px"),
        ) &&
        latest.checks.some((line: string) =>
          line.startsWith("Worker memproses snooze persisten"),
        ),
      "Bukti browser terisolasi terbaru diperlukan.",
    );
    // Keep actual screenshots of unchanged pages; replace acquisition screenshots
    // and add the newly tested alarm and holding UI, never fabricate a mockup.
    screenshots.push(
      ...existing.screenshots.filter(
        (s: { title: string }) =>
          ![
            "Akuisisi Nasabah",
            "Buat janji akuisisi",
            "Detail pekerjaan",
          ].includes(s.title),
      ),
    );
    for (const width of [1440, 390]) {
      for (const [file, title, description] of [
        [
          "acquisition",
          "Akuisisi Nasabah",
          "Daftar janji dengan countdown alarm dan waktu janji terpisah. Kendali dan pendamping mengikuti akses cabang/penugasan. Simpan/perubahan pekerjaan senyap; suara otomatis hanya saat modal alarm muncul.",
        ],
        [
          "tracking",
          "Tracking janji",
          "Waktu WIB, kendali pembuat, pendamping dan countdown dari jadwal PostgreSQL. Readiness layanan tidak ditampilkan untuk janji.",
        ],
        [
          "appointment",
          "Buat janji akuisisi",
          "Kategori/produk, waktu janji WIB dan pendamping opsional. Terima pekerjaan mengonfirmasi jadwal dan mengaktifkan slot pengingat mendatang.",
        ],
        [
          "alarm-modal",
          "Alarm janji",
          "Modal alarm aktual dari worker dan SSE. Matikan atau Ingatkan lagi 1/5/10 menit; snooze tersimpan PostgreSQL per penerima, bukan hanya timer browser.",
        ],
        [
          "product-holding",
          "Product Holding",
          "Checklist produk/kanal yang digunakan dan dikonfirmasi, pencarian dan kategori. Kopra Cash Management (MCM)/H2H dicatat tanpa mengasumsikan kelayakan; penawaran sesuai whitelist internal.",
        ],
      ])
        screenshots.push({
          file: `${latestFolder}/${file}-${width}.png`,
          title,
          description,
          width,
        });
    }
    await buildPdf();
    await db.$disconnect();
  } else if (process.argv.includes("--pdf-only")) {
    const results = JSON.parse(
      await readFile(`${output}/results.json`, "utf8"),
    );
    assert(
      results.database === databaseName && results.checks?.length >= 40,
      "Bukti audit UI lengkap diperlukan untuk membangun PDF.",
    );
    screenshots.push(...results.screenshots);
    await buildPdf();
    await db.$disconnect();
  } else await main();
}
void entry().catch((error) => {
  console.error(error instanceof Error ? error.message : "Audit gagal.");
  process.exitCode = 1;
});
