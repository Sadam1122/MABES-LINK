import "./load-env";

import QRCode from "qrcode";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";

async function main() {
  if (process.env.DATABASE_PURPOSE !== "testing")
    throw new Error("Wajib database testing.");
  const baseURL = process.env.VISUAL_TEST_URL ?? "http://localhost:3100";
  if (!/^(localhost|127\.0\.0\.1)$/.test(new URL(baseURL).hostname))
    throw new Error("Smoke QRIS hanya untuk server testing lokal.");
  const qr = await QRCode.toBuffer(
    "000201010212QRIS-TEST-NO-LIVE-PAYMENT-11539",
    { width: 600, type: "png" },
  );
  const form = new FormData();
  form.set(
    "file",
    new Blob([new Uint8Array(qr)], { type: "image/png" }),
    "qris-samaran.png",
  );
  form.set(
    "intake",
    JSON.stringify({
      requestId: randomUUID(),
      businessName: "Toko Samaran",
      contactName: "",
      phone: "",
      businessCategory: "",
      address: "",
      latitude: null,
      longitude: null,
      locationSource: "MANUAL_ADDRESS",
      processingConsent: true,
      contactConsent: false,
      interestedProduct: "QRIS",
      bankRelationship: "UNKNOWN",
      contactWindow: null,
      needNote: null,
    }),
  );
  const upload = await fetch(`${baseURL}/api/qris-custom/upload`, {
    method: "POST",
    headers: { origin: baseURL },
    body: form,
  });
  if (!upload.ok)
    throw new Error(`Upload QRIS samaran gagal (${upload.status}).`);
  const { data: session } = await upload.json();
  if (session.contactSaved)
    throw new Error("QR uji tidak boleh membuat data pendaftar.");
  await mkdir(".artifacts/audit-ui", { recursive: true });
  try {
    for (const template of [
      "BATIK_NUSANTARA",
      "ALAM_INDONESIA",
      "SIGNATURE",
    ] as const) {
      for (const format of ["png", "pdf"] as const) {
        const response = await fetch(`${baseURL}/api/qris-custom/render`, {
          method: "POST",
          headers: { "content-type": "application/json", origin: baseURL },
          body: JSON.stringify({
            sessionId: session.id,
            token: session.token,
            design: {
              template,
              size: "A5",
              businessName: "Toko Samaran",
              tagline: "Bayar mudah",
              bottomText: "Bayar praktis dengan QRIS",
              social: "",
              address: "",
              primary: "#0b2248",
              secondary: "#c9a64b",
              pattern: "WAVES",
              frame: "ROUND",
              ornament: "STAR",
              inkSaver: false,
            },
            format,
            download: true,
          }),
        });
        const bytes = Buffer.from(await response.arrayBuffer());
        if (response.status !== 200 || !bytes.length)
          throw new Error(`Respons ${format} kosong.`);
        const validSignature =
          format === "png"
            ? bytes
                .subarray(0, 8)
                .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
            : bytes.subarray(0, 5).toString() === "%PDF-";
        if (!validSignature)
          throw new Error(`Signature ${format} tidak valid.`);
        console.log(
          `${template}: ${format} HTTP 200, signature valid (${bytes.length} byte).`,
        );
        if (format === "png")
          await writeFile(
            `.artifacts/audit-ui/qris-output-${template.toLowerCase()}.png`,
            bytes,
          );
      }
    }
  } finally {
    const deleted = await fetch(`${baseURL}/api/qris-custom/session`, {
      method: "DELETE",
      headers: { "content-type": "application/json", origin: baseURL },
      body: JSON.stringify({ sessionId: session.id, token: session.token }),
    });
    if (!deleted.ok)
      throw new Error(`Pembersihan sesi QR uji gagal (${deleted.status}).`);
  }
}

void main().catch(() => {
  console.error(
    "Smoke QRIS gagal. Periksa server testing dan status respons; tidak ada data nasabah pada tes ini.",
  );
  process.exitCode = 1;
});
