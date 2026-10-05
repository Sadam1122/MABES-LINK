import "./load-env";

import QRCode from "qrcode";
import { createQrisSession, deleteQrisSession } from "../lib/qris-custom";

async function main() {
  if (process.env.DATABASE_PURPOSE !== "testing") throw new Error("Wajib database testing.");
  const qr = await QRCode.toBuffer("000201010212QRIS-TEST-NO-LIVE-PAYMENT-11539", { width: 600, type: "png" });
  const session = await createQrisSession(qr, "image/png");
  try {
    for (const format of ["png", "pdf"] as const) {
      const response = await fetch("http://localhost:3100/api/qris-custom/render", {
        method: "POST", headers: { "content-type": "application/json", origin: "http://localhost:3100" },
        body: JSON.stringify({ sessionId: session.id, token: session.token, design: { template: "SIGNATURE", size: "A5", businessName: "Toko Samaran", tagline: "Bayar mudah", social: "", address: "", primary: "#0b2248", secondary: "#c9a64b", pattern: "WAVES", frame: "ROUND", ornament: "STAR", inkSaver: false }, format, download: true }),
      });
      const bytes = Buffer.from(await response.arrayBuffer());
      console.log(format, response.status, response.headers.get("content-type"), bytes.length, bytes.subarray(0, 5).toString());
      if (response.status !== 200 || !bytes.length) throw new Error(`Respons ${format} kosong.`);
    }
  } finally { await deleteQrisSession(session.id, session.token); }
}

void main();
