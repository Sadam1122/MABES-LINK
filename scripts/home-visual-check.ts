import { mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";

const url = process.env.VISUAL_TEST_URL ?? "http://localhost:3100";
if (!/^(localhost|127\.0\.0\.1)$/.test(new URL(url).hostname))
  throw new Error("Pemeriksaan visual hanya untuk server lokal.");
const executablePath = process.env.BROWSER_PATH ??
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

async function main() {
  await mkdir(".artifacts", { recursive: true });
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    for (const width of [360, 390, 768, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 850 }, deviceScaleFactor: 1 });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(url, { waitUntil: "networkidle" });
      // Reveal every actual section before capturing a full-page image.
      for (const section of await page.locator(".scroll-reveal").all()) {
        await section.scrollIntoViewIfNeeded(); await page.waitForTimeout(150);
      }
      await page.getByRole("link", { name: /Buat desain QRIS/ }).first().waitFor();
      await page.locator("footer").scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      const result = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        brokenImages: [...document.querySelectorAll<HTMLImageElement>("img")]
          .filter((image) => image.complete && image.naturalWidth === 0)
          .map((image) => image.getAttribute("src")),
      }));
      await page.screenshot({ path: `.artifacts/home-${width}.png`, fullPage: true });
      if (result.overflow || result.brokenImages.length || errors.length)
        throw new Error(`Beranda ${width}px bermasalah: ${JSON.stringify({ ...result, errors })}`);
      console.log(`Beranda ${width}px: tanpa overflow, gambar rusak, atau pageerror.`);
      await page.close();
    }
  } finally { await browser.close(); }
}

void main().catch((error) => { console.error(error); process.exitCode = 1; });
