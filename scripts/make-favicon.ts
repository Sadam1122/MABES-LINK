import { writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

// Ikon ringkas MABES LINK agar tetap terbaca pada tab 16 px.
const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <rect width="256" height="256" rx="48" fill="#092c60"/>
  <path d="M40 183V72h22l66 74 66-74h22v111h-27v-70l-61 66-61-66v70Z" fill="#fff"/>
  <path d="M81 121c20 0 26 31 47 31s27-31 47-31" fill="none" stroke="#f8bc17" stroke-width="10" stroke-linecap="round"/>
  <circle cx="81" cy="121" r="7" fill="#f8bc17"/><circle cx="175" cy="121" r="7" fill="#f8bc17"/>
</svg>`);

async function main() {
  const sizes = [16, 32, 48, 64, 128, 256];
  const images = await Promise.all(sizes.map((size) => sharp(svg).resize(size, size).png().toBuffer()));
  const header = Buffer.alloc(6 + sizes.length * 16);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);
  let offset = header.length;
  for (let index = 0; index < sizes.length; index++) {
    const entry = 6 + index * 16;
    header.writeUInt8(sizes[index] === 256 ? 0 : sizes[index], entry);
    header.writeUInt8(sizes[index] === 256 ? 0 : sizes[index], entry + 1);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(images[index].length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += images[index].length;
  }
  await writeFile(path.join(process.cwd(), "app", "favicon.ico"), Buffer.concat([header, ...images]));
  await writeFile(path.join(process.cwd(), "public", "app-icon.png"), images.at(-1)!);
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
