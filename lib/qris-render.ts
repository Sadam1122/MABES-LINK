import jsPDF from "jspdf";
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { isSuppliedQrisTemplate, qrisDesignSchema, qrisTemplateZones, type QrisDesign } from "@/lib/qris-design";
import { decodeQris, hashValue } from "@/lib/qris-custom";
import { AppError } from "@/lib/errors";

function escapeXml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[character]!,
  );
}

function shorten(value: string, length: number) {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}

export function qrisProtectedRect(size: "A5" | "A6") {
  const width = size === "A5" ? 1748 : 1240;
  const height = size === "A5" ? 2480 : 1748;
  return {
    width,
    height,
    x: Math.round(width * 0.105),
    y: Math.round(height * 0.245),
    protectedWidth: Math.round(width * 0.79),
    protectedHeight: Math.round(height * 0.56),
  };
}

function patternSvg(design: QrisDesign, width: number, height: number) {
  if (design.pattern === "NONE") return "";
  const stroke = design.inkSaver ? "#d6dae1" : design.secondary;
  if (design.pattern === "LINES")
    return Array.from(
      { length: 13 },
      (_, index) =>
        `<path d="M${index * 120 - 250} 0L${index * 120 + 300} ${height}" stroke="${stroke}" opacity=".13" stroke-width="3"/>`,
    ).join("");
  if (design.pattern === "TOPOGRAPHY")
    return Array.from(
      { length: 9 },
      (_, index) =>
        `<ellipse cx="${width * 0.86}" cy="${height * 0.12}" rx="${130 + index * 53}" ry="${55 + index * 38}" fill="none" stroke="${stroke}" opacity=".16" stroke-width="3"/>`,
    ).join("");
  return Array.from(
    { length: 6 },
    (_, index) =>
      `<path d="M-60 ${height * 0.83 + index * 24} Q${width * 0.3} ${height * 0.76 + index * 24} ${width * 0.62} ${height * 0.84 + index * 24}T${width + 80} ${height * 0.8 + index * 24}" fill="none" stroke="${stroke}" opacity=".18" stroke-width="3"/>`,
  ).join("");
}

function ornamentSvg(design: QrisDesign, width: number, height: number) {
  if (design.ornament === "NONE") return "";
  const symbol =
    design.ornament === "STAR" ? "✦" : design.ornament === "LEAF" ? "❧" : "✧";
  return `<text x="${width * 0.12}" y="${height * 0.12}" fill="${design.secondary}" opacity=".65" font-size="${width * 0.1}">${symbol}</text><text x="${width * 0.81}" y="${height * 0.91}" fill="${design.secondary}" opacity=".65" font-size="${width * 0.08}">${symbol}</text>`;
}

function templateMotifSvg(design: QrisDesign, width: number, height: number) {
  const color = design.inkSaver ? "#b7beca" : design.secondary;
  const x = width * 0.2;
  const y = height * 0.188;
  const scale = width / 1450;
  if (design.template === "SIGNATURE")
    return `<g transform="translate(${x} ${y}) scale(${scale})" fill="${color}" opacity=".33">
      <path d="M12 14 Q90 -4 132 36 L122 66 Q78 56 46 86 L25 62Z"/>
      <path d="M156 82 Q250 65 362 79 L420 94 L345 100 Q235 94 157 98Z"/>
      <path d="M420 23 Q495 -5 566 14 L592 58 L556 91 L477 75Z"/>
      <path d="M605 25 L633 8 L647 39 L680 28 L668 55 L696 80 L660 72 L640 99 L630 62Z"/>
      <path d="M725 48 Q785 28 822 56 L890 38 L923 73 L861 85 L801 74Z"/>
      <ellipse cx="367" cy="121" rx="15" ry="4"/><ellipse cx="403" cy="122" rx="8" ry="3"/><ellipse cx="702" cy="112" rx="15" ry="4"/>
    </g>`;
  if (design.template === "HERITAGE")
    return `<g fill="none" stroke="${color}" stroke-width="6" opacity=".42">
      <path d="M0 ${height * 0.21} L${width * 0.18} ${height * 0.17} L${width * 0.32} ${height * 0.21} L${width * 0.49} ${height * 0.16} L${width * 0.7} ${height * 0.21} L${width} ${height * 0.17}"/>
      <path d="M${width * 0.06} ${height * 0.92} Q${width * 0.1} ${height * 0.84} ${width * 0.14} ${height * 0.92} M${width * 0.86} ${height * 0.92} Q${width * 0.9} ${height * 0.84} ${width * 0.94} ${height * 0.92}"/>
    </g>`;
  return `<g fill="none" stroke="${color}" stroke-width="4" opacity=".38">
    <path d="M${width * 0.06} ${height * 0.2} H${width * 0.29} L${width * 0.34} ${height * 0.175} H${width * 0.48}"/>
    <path d="M${width * 0.52} ${height * 0.19} H${width * 0.75} L${width * 0.81} ${height * 0.21} H${width * 0.94}"/>
    <circle cx="${width * 0.29}" cy="${height * 0.2}" r="9" fill="${color}"/>
    <circle cx="${width * 0.75}" cy="${height * 0.19}" r="9" fill="${color}"/>
  </g>`;
}

async function prepareBusinessLogo(dataUrl: string) {
  if (!dataUrl) return null;
  const match =
    /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match)
    throw new AppError(
      "Logo usaha harus JPG, PNG, atau WebP.",
      422,
      "INVALID_LOGO",
    );
  const input = Buffer.from(match[2], "base64");
  if (!input.length || input.length > 512 * 1024)
    throw new AppError("Logo usaha maksimal 512 KB.", 422, "LOGO_TOO_LARGE");
  let metadata;
  try {
    metadata = await sharp(input, {
      failOn: "error",
      limitInputPixels: 4_000_000,
    }).metadata();
  } catch {
    throw new AppError("Isi logo tidak valid.", 422, "INVALID_LOGO");
  }
  const expected =
    match[1] === "image/jpeg"
      ? "jpeg"
      : match[1] === "image/png"
        ? "png"
        : "webp";
  if (
    metadata.format !== expected ||
    !metadata.width ||
    !metadata.height ||
    metadata.width > 2000 ||
    metadata.height > 2000
  )
    throw new AppError(
      "Tipe atau dimensi logo tidak valid.",
      422,
      "INVALID_LOGO",
    );
  return sharp(input)
    .rotate()
    .resize(220, 160, { fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();
}

async function prepareSticker(design: QrisDesign) {
  if (design.sticker === "NONE") return null;
  if (design.sticker !== "UPLOAD") {
    const symbol = design.sticker === "FLOWER"
      ? `<g fill="#d6a044">${Array.from({ length: 8 }, (_, index) => `<ellipse cx="32" cy="16" rx="8" ry="14" transform="rotate(${index * 45} 32 32)"/>`).join("")}<circle cx="32" cy="32" r="9" fill="#0b3655"/></g>`
      : design.sticker === "STAR"
        ? `<polygon points="32,3 40,23 61,23 44,37 50,59 32,46 14,59 20,37 3,23 24,23" fill="#d6a044" stroke="#0b3655" stroke-width="2"/>`
        : `<path d="M32 2 L39 25 L62 32 L39 39 L32 62 L25 39 L2 32 L25 25Z" fill="#d6a044" stroke="#0b3655" stroke-width="2"/>`;
    return sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">${symbol}</svg>`)).png().toBuffer();
  }
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(design.stickerDataUrl);
  if (!match) throw new AppError("Stiker harus PNG, JPG, atau WebP.", 422, "INVALID_STICKER");
  const input = Buffer.from(match[2], "base64");
  if (!input.length || input.length > 320 * 1024)
    throw new AppError("Stiker maksimal 320 KB.", 422, "STICKER_TOO_LARGE");
  let meta;
  try {
    meta = await sharp(input, { failOn: "error", limitInputPixels: 4_000_000 }).metadata();
  } catch {
    throw new AppError("Gambar stiker tidak valid.", 422, "INVALID_STICKER");
  }
  const format = match[1] === "image/jpeg" ? "jpeg" : match[1] === "image/png" ? "png" : "webp";
  if (meta.format !== format || !meta.width || !meta.height || meta.width < 64 || meta.height < 64 || meta.width > 2000 || meta.height > 2000)
    throw new AppError("Tipe atau dimensi stiker tidak valid.", 422, "INVALID_STICKER");
  return sharp(input).rotate().resize(64, 64, { fit: "contain", withoutEnlargement: true }).png().toBuffer();
}

async function renderSuppliedTemplate(officialPng: Buffer, design: QrisDesign, expectedDigest: string) {
  if (!isSuppliedQrisTemplate(design.template)) throw new Error("Template tidak dikenal.");
  const zone = qrisTemplateZones[design.template];
  const width = 1064;
  const height = 1478;
  // Nama file tetap di server; input pengguna tidak pernah menjadi path.
  const template = await readFile(path.join(process.cwd(), "public", "qris-template", zone.file));
  const templateInfo = await sharp(template).metadata();
  if (templateInfo.format !== "png" || templateInfo.width !== width || templateInfo.height !== height || !templateInfo.hasAlpha)
    throw new AppError("Berkas template tidak sesuai ukuran atau format yang diperlukan.", 500, "TEMPLATE_INVALID");
  const qr = await sharp(officialPng).resize(zone.qr.width - 32, zone.qr.height - 32, {
    fit: "inside", withoutEnlargement: true, kernel: "nearest",
  }).png().toBuffer();
  const qrInfo = await sharp(qr).metadata();
  const qrLeft = zone.qr.x + Math.floor((zone.qr.width - (qrInfo.width ?? 0)) / 2);
  const qrTop = zone.qr.y + Math.floor((zone.qr.height - (qrInfo.height ?? 0)) / 2);
  const bottom = zone.bottom;
  const sticker = await prepareSticker(design);
  const stickerSize = 64;
  const stickerTop = bottom.y + Math.round((bottom.height - stickerSize) * design.stickerY);
  const stickerLeft = design.stickerSide === "LEFT" ? bottom.x + 13 : bottom.x + bottom.width - stickerSize - 13;
  const words = (design.bottomText || design.businessName).trim();
  const preferredSplit = words.lastIndexOf(" ", Math.ceil(words.length / 2));
  const splitAt = words.length > 34 ? (preferredSplit >= words.length - 40 ? preferredSplit : Math.ceil(words.length / 2)) : words.length;
  const lines = splitAt < words.length ? [words.slice(0, splitAt), words.slice(splitAt).trim()] : [words];
  const longest = Math.max(...lines.map((line) => line.length), 1);
  const fontSize = Math.max(17, Math.min(35, Math.floor((bottom.width - 180) / (longest * .6))));
  const firstY = bottom.y + bottom.height / 2 + (lines.length === 1 ? fontSize * .34 : -3);
  const textSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><text x="${bottom.x + bottom.width / 2}" y="${firstY}" text-anchor="middle" font-family="Arial,sans-serif" font-size="${fontSize}" font-weight="700" fill="#092c4a">${lines.map((line, index) => `<tspan x="${bottom.x + bottom.width / 2}" dy="${index ? fontSize * 1.1 : 0}">${escapeXml(line)}</tspan>`).join("")}</text></svg>`);
  const png = await sharp({ create: { width, height, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 0 } } })
    .composite([
      { input: qr, left: qrLeft, top: qrTop },
      { input: template, left: 0, top: 0 },
      { input: textSvg, left: 0, top: 0 },
      ...(sticker ? [{ input: sticker, left: stickerLeft, top: stickerTop }] : []),
    ])
    .png().toBuffer();
  const decoded = await decodeQris(png);
  if (!decoded || hashValue(decoded) !== expectedDigest)
    throw new AppError("QR pada hasil desain tidak terbaca. Coba unggah QRIS resmi dengan resolusi lebih tinggi.", 422, "QR_OUTPUT_INVALID");
  return { png, design, bounds: { width, height, x: zone.qr.x, y: zone.qr.y, protectedWidth: zone.qr.width, protectedHeight: zone.qr.height } };
}

export async function renderQrisDesign(
  officialPng: Buffer,
  rawDesign: unknown,
  expectedDigest: string,
) {
  const design = qrisDesignSchema.parse(rawDesign);
  const sourceDecoded = await decodeQris(officialPng);
  if (!sourceDecoded || hashValue(sourceDecoded) !== expectedDigest)
    throw new AppError(
      "QR sumber tidak lagi terbaca.",
      422,
      "QR_SOURCE_INVALID",
    );
  if (isSuppliedQrisTemplate(design.template))
    return renderSuppliedTemplate(officialPng, design, expectedDigest);
  const bounds = qrisProtectedRect(design.size);
  const { width, height, x, y, protectedWidth, protectedHeight } = bounds;
  const inset = Math.round(width * 0.025);
  const imageWidth = protectedWidth - 2 * inset;
  const imageHeight = protectedHeight - 2 * inset;
  const resized = await sharp(officialPng)
    .resize(imageWidth, imageHeight, {
      fit: "inside",
      withoutEnlargement: true,
      kernel: "nearest",
    })
    .png()
    .toBuffer();
  const info = await sharp(resized).metadata();
  const left = x + Math.floor((protectedWidth - (info.width ?? 0)) / 2);
  const top = y + Math.floor((protectedHeight - (info.height ?? 0)) / 2);
  const background = design.inkSaver ? "#ffffff" : design.primary;
  const foreground =
    design.inkSaver || design.template === "HERITAGE" ? "#0b2248" : "#ffffff";
  const rectRadius =
    design.frame === "ROUND" ? 36 : design.frame === "CLASSIC" ? 4 : 0;
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="${background}"/>
    ${patternSvg(design, width, height)}
    ${templateMotifSvg(design, width, height)}
    ${ornamentSvg(design, width, height)}
    <text x="50%" y="${Math.round(height * 0.105)}" text-anchor="middle" fill="${foreground}" font-family="Arial, sans-serif" font-size="${Math.round(width * 0.052)}" font-weight="700">${escapeXml(shorten(design.businessName, 34))}</text>
    <text x="50%" y="${Math.round(height * 0.155)}" text-anchor="middle" fill="${design.inkSaver ? "#646b79" : design.secondary}" font-family="Arial, sans-serif" font-size="${Math.round(width * 0.027)}">${escapeXml(shorten(design.tagline, 58))}</text>
    <rect x="${x - 9}" y="${y - 9}" width="${protectedWidth + 18}" height="${protectedHeight + 18}" rx="${rectRadius}" fill="#ffffff" stroke="${design.secondary}" stroke-width="8"/>
    <text x="50%" y="${Math.round(height * 0.855)}" text-anchor="middle" fill="${foreground}" font-family="Arial, sans-serif" font-size="${Math.round(width * 0.025)}">${escapeXml(shorten(design.social, 60))}</text>
    <text x="50%" y="${Math.round(height * 0.895)}" text-anchor="middle" fill="${foreground}" font-family="Arial, sans-serif" font-size="${Math.round(width * 0.023)}">${escapeXml(shorten(design.address, 68))}</text>
    <text x="50%" y="${Math.round(height * 0.95)}" text-anchor="middle" fill="${foreground}" font-family="Arial, sans-serif" font-size="${Math.round(width * 0.018)}" opacity=".75">QRIS Usahamu, Gayamu.</text>
  </svg>`;
  const logo = await prepareBusinessLogo(design.logoDataUrl);
  const png = await sharp(Buffer.from(svg))
    .composite([
      { input: resized, left, top },
      ...(logo
        ? [
            {
              input: logo,
              left: Math.round(width * 0.12),
              top: Math.round(height * 0.175),
            },
          ]
        : []),
    ])
    .png()
    .toBuffer();
  const finalDecoded = await decodeQris(png);
  if (!finalDecoded || hashValue(finalDecoded) !== expectedDigest)
    throw new AppError(
      "QR tidak terbaca pada hasil desain. Ganti sumber atau ukuran.",
      422,
      "QR_OUTPUT_INVALID",
    );
  return { png, design, bounds };
}

export async function qrisOutput(
  png: Buffer,
  format: "png" | "jpg" | "pdf",
  size: "A5" | "A6",
) {
  if (format === "png")
    return { data: png, mimeType: "image/png", extension: "png" };
  if (format === "jpg")
    return {
      data: await sharp(png).jpeg({ quality: 95 }).toBuffer(),
      mimeType: "image/jpeg",
      extension: "jpg",
    };
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: size.toLowerCase(),
    compress: true,
  });
  const widthMm = size === "A5" ? 148 : 105;
  const heightMm = size === "A5" ? 210 : 148;
  pdf.addImage(png, "PNG", 0, 0, widthMm, heightMm);
  return {
    data: Buffer.from(pdf.output("arraybuffer")),
    mimeType: "application/pdf",
    extension: "pdf",
  };
}
