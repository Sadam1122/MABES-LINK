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
      await page.getByRole("link", { name: /Buat desain QRIS/i }).first().click();
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
        .getByText(/Periksa:/i)
        .first()
        .waitFor();
      await page
        .getByText("Nama usaha *")
        .locator("input")
        .fill("Toko Samaran");
      await page.getByRole("combobox", { name: "Cari toko atau alamat publik" }).fill("Mangga Besar");
      await page.getByRole("button", { name: "Cari lokasi" }).click();
      await page.getByText(/Pencarian tempat belum dikonfigurasi/).waitFor();
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
      await page.getByRole("heading", { name: "Pilih suasana untuk usaha Anda" }).waitFor();
      await page.getByRole("button", { name: /Alam Indonesia/ }).click();
      await page.getByRole("button", { name: /Kustomisasi/ }).click();
      await page
        .getByAltText("Pratinjau desain QRIS")
        .waitFor({ timeout: 30000 })
        .catch(async (error) => {
          await page.screenshot({ path: ".artifacts/qris-editor-error-390.png", fullPage: true });
          throw new Error(`${String(error)}; alerts: ${await page.getByRole("alert").allTextContents()}`);
        });
      await page.screenshot({
        path: ".artifacts/qris-editor-390.png",
        fullPage: true,
      });
      await page.getByRole("button", { name: /Lihat hasil/ }).click();
      const downloadEvent = page.waitForEvent("download");
      await page.getByRole("button", { name: "Unduh PNG" }).click();
      const download = await downloadEvent;
      const filePath = await download.path();
      const pngHeader = filePath
        ? (await readFile(filePath)).subarray(0, 8).toString("hex")
        : "no-path";
      if (pngHeader !== "89504e470d0a1a0a")
        throw new Error(
          `Unduhan PNG tidak valid: ${download.suggestedFilename()} (${pngHeader}, ${await download.failure()})`,
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
      `QRIS public visual & PNG: lolos (360, 390, 768, 1440px) pada ${baseURL}`,
    );
  } finally {
    await browser.close();
  }
}

void main();
