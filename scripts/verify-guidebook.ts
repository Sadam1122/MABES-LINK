import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

async function main() {
  const { getDocument, OPS } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = await readFile(
    resolve("docs/MABES_LINK_Guidebook_2026-10-08.pdf"),
  );
  const loading = getDocument({
    data: new Uint8Array(data),
    useSystemFonts: true,
  });
  const pdf = await loading.promise;
  const titles = [
    "Akuisisi Nasabah",
    "Buat janji akuisisi",
    "Tracking janji",
    "Alarm janji",
    "Product Holding",
  ];
  const sections: { page: number; title: string; images: number }[] = [];
  for (let number = 2; number < pdf.numPages; number++) {
    const page = await pdf.getPage(number);
    const content = (await page.getTextContent()).items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    const title = titles.find((value) => content.startsWith(value));
    if (!title) continue;
    const operations = await page.getOperatorList();
    const images = operations.fnArray.filter((op) =>
      [
        OPS.paintImageXObject,
        OPS.paintInlineImageXObject,
        OPS.paintImageXObjectRepeat,
      ].includes(op),
    ).length;
    if (!images)
      throw new Error(`Halaman ${number} tidak mempunyai screenshot tertanam.`);
    sections.push({ page: number, title, images });
  }
  for (const title of titles)
    if (sections.filter((section) => section.title === title).length !== 2)
      throw new Error(`Screenshot desktop/HP ${title} belum lengkap.`);
  const result = {
    checkedAt: new Date().toISOString(),
    pages: pdf.numPages,
    bytes: data.length,
    sections,
  };
  await writeFile(
    resolve(".artifacts/appointment-smoke/guidebook-check.json"),
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result, null, 2));
  await loading.destroy();
}
void main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "PDF gagal diperiksa.",
  );
  process.exitCode = 1;
});
