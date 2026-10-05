import "./load-env";

import { mkdir, readFile } from "node:fs/promises";
import { chromium } from "playwright-core";
import QRCode from "qrcode";

const baseURL = process.env.VISUAL_TEST_URL ?? "http://localhost:3100";
if (!new URL(baseURL).hostname.match(/^(localhost|127\.0\.0\.1)$/))
  throw new Error("Pemeriksaan visual hanya untuk server lokal.");
const executablePath =
  process.env.BROWSER_PATH ??
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

async function main() {
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    await mkdir(".artifacts", { recursive: true });
    for (const width of [360, 390, 768, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 850 } });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(baseURL, { waitUntil: "domcontentloaded" });
      await page.getByRole("link", { name: "Buat QRIS Custom Gratis" }).click();
      await page
        .getByRole("heading", { name: "QRIS Usahamu, Gayamu." })
        .waitFor();
      await page.locator(".leaflet-container").waitFor();
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth + 1,
      );
      if (overflow)
        throw new Error(`Halaman publik overflow pada lebar ${width}px.`);
      await page.screenshot({
        path: `.artifacts/qris-${width}.png`,
        fullPage: true,
      });
      if (errors.length)
        throw new Error(`Error browser ${width}px: ${errors.join(" | ")}`);
      if (width !== 390) {
        await page.close();
        continue;
      }
      await page.getByText("Lanjutkan", { exact: false }).last().click();
      await page
        .getByRole("alert")
        .getByText(/lengkapi/i)
        .waitFor();
      await page
        .getByText("Nama kontak *")
        .locator("input")
        .fill("Kontak Samaran");
      await page
        .getByText("Nama usaha *")
        .locator("input")
        .fill("Toko Samaran");
      await page.getByText("Nomor HP *").locator("input").fill("081234567890");
      await page.getByText("Kategori usaha *").locator("input").fill("Kuliner");
      await page
        .getByText("Alamat usaha minimum *")
        .locator("input")
        .fill("Area Mangga Besar Jakarta");
      await page
        .getByText(/Saya setuju informasi/)
        .locator("..")
        .locator("input")
        .check();
      await page.getByRole("button", { name: /Lanjutkan/ }).click();
      const qr = await QRCode.toBuffer(
        "000201010212QRIS-TEST-NO-LIVE-PAYMENT-11539",
        { width: 600, type: "png" },
      );
      await page.locator('input[type="file"]').first().setInputFiles({
        name: "qris-test.png",
        mimeType: "image/png",
        buffer: qr,
      });
      await page
        .getByRole("button", { name: /Validasi dan lanjutkan/ })
        .click();
      await page.getByRole("heading", { name: "Pilih template" }).waitFor();
      await page
        .getByRole("button", { name: /Mandiri Heritage Indonesia/ })
        .click();
      await page.getByRole("button", { name: /Kustomisasi/ }).click();
      await page
        .getByAltText("Pratinjau hasil desain")
        .waitFor({ timeout: 30000 });
      await page.screenshot({
        path: ".artifacts/qris-editor-390.png",
        fullPage: true,
      });
      await page.getByRole("button", { name: /Lihat hasil/ }).click();
      const downloadEvent = page.waitForEvent("download");
      await page.getByRole("button", { name: "Unduh PDF" }).click();
      const download = await downloadEvent;
      const filePath = await download.path();
      const pdfHeader = filePath
        ? (await readFile(filePath)).subarray(0, 5).toString()
        : "no-path";
      if (pdfHeader !== "%PDF-")
        throw new Error(
          `Unduhan PDF tidak valid: ${download.suggestedFilename()} (${pdfHeader}, ${await download.failure()})`,
        );
      await page
        .getByRole("button", { name: "Hapus file sementara sekarang" })
        .click();
      await page
        .getByRole("dialog", { name: "Hapus file QRIS sementara?" })
        .getByRole("button", { name: "Ya, hapus file" })
        .click();
      await page.close();
    }
    console.log(
      `QRIS public visual & PDF: lolos (360, 390, 768, 1440px) pada ${baseURL}`,
    );
  } finally {
    await browser.close();
  }
}

void main();
