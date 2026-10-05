"use client";

/* eslint-disable @next/next/no-img-element -- preview berasal dari blob lokal hasil render sesi privat */

import dynamic from "next/dynamic";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Download,
  ImageUp,
  LockKeyhole,
  MapPin,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { qrisTemplates, type QrisDesign } from "@/lib/qris-design";

const LocationMap = dynamic(
  () => import("@/components/appointment-location-map"),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-[300px] place-items-center rounded-2xl bg-slate-100 text-slate-500">
        Memuat peta…
      </div>
    ),
  },
);
type Session = { id: string; token: string; expiresAt: string };
type Contact = {
  contactName: string;
  businessName: string;
  phone: string;
  businessCategory: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  locationSource: "MAP_PIN" | "DEVICE_GEOLOCATION" | "MANUAL_ADDRESS";
  processingConsent: boolean;
  contactConsent: boolean;
  interestedProduct:
    | "QRIS"
    | "LIVIN_MERCHANT"
    | "EDC"
    | "LIVIN_TABUNGAN"
    | "KOPRA"
    | "OTHER";
  bankRelationship: "CUSTOMER" | "UNKNOWN" | "NOT_CUSTOMER";
  contactWindow: string;
  needNote: string;
};
const initialContact: Contact = {
  contactName: "",
  businessName: "",
  phone: "",
  businessCategory: "",
  address: "",
  latitude: null,
  longitude: null,
  locationSource: "MANUAL_ADDRESS",
  processingConsent: false,
  contactConsent: false,
  interestedProduct: "QRIS",
  bankRelationship: "UNKNOWN",
  contactWindow: "",
  needNote: "",
};
const initialDesign: QrisDesign = {
  template: "SIGNATURE",
  size: "A5",
  businessName: "",
  tagline: "Terima pembayaran dengan mudah",
  social: "",
  address: "",
  logoDataUrl: "",
  primary: "#0b2248",
  secondary: "#c9a64b",
  pattern: "WAVES",
  frame: "ROUND",
  ornament: "STAR",
  inkSaver: false,
};
const steps = ["Informasi", "QRIS Resmi", "Template", "Kustomisasi", "Hasil"];
const field =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100";

async function apiJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(payload?.error?.message || "Permintaan gagal diproses.");
  return payload.data as T;
}

export function QrisCustomEditor() {
  const [step, setStep] = useState(0);
  const [contact, setContact] = useState<Contact>(initialContact);
  const [file, setFile] = useState<File | null>(null);
  const [sourcePreview, setSourcePreview] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [design, setDesign] = useState<QrisDesign>(initialDesign);
  const [history, setHistory] = useState<QrisDesign[]>([]);
  const [future, setFuture] = useState<QrisDesign[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<
    "DESKTOP" | "HP" | "CETAK" | "MEJA"
  >("DESKTOP");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [contactSent, setContactSent] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [requestId] = useState(() => crypto.randomUUID());

  useEffect(
    () => () => {
      if (sourcePreview) URL.revokeObjectURL(sourcePreview);
    },
    [sourcePreview],
  );
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  const point = useMemo(
    () =>
      contact.latitude === null || contact.longitude === null
        ? null
        : { latitude: contact.latitude, longitude: contact.longitude },
    [contact.latitude, contact.longitude],
  );
  function setContactValue<K extends keyof Contact>(key: K, value: Contact[K]) {
    setContact((current) => ({ ...current, [key]: value }));
  }
  function selectFile(chosen: File | null) {
    setFile(chosen);
    setSourcePreview(
      chosen && chosen.type !== "application/pdf"
        ? URL.createObjectURL(chosen)
        : null,
    );
    setSession(null);
  }
  function changeDesign(patch: Partial<QrisDesign>) {
    setHistory((current) => [...current.slice(-19), design]);
    setFuture([]);
    setDesign({ ...design, ...patch });
  }
  function preset(template: QrisDesign["template"]) {
    const item = qrisTemplates.find((entry) => entry.id === template)!;
    changeDesign({
      template,
      primary: item.primary,
      secondary: item.secondary,
      pattern:
        template === "FUTURE"
          ? "TOPOGRAPHY"
          : template === "HERITAGE"
            ? "LINES"
            : "WAVES",
      ornament: template === "HERITAGE" ? "LEAF" : "STAR",
    });
  }
  function automaticDesign() {
    const name = contact.businessName.toLowerCase();
    preset(
      /kopi|makan|resto|kuliner|cafe/.test(name)
        ? "HERITAGE"
        : /digital|tech|studio/.test(name)
          ? "FUTURE"
          : "SIGNATURE",
    );
    setError(
      "Rekomendasi dipilih dari kategori/nama usaha. Silakan tinjau sebelum mengunduh.",
    );
  }
  function validateContact() {
    if (
      !contact.contactName.trim() ||
      !contact.businessName.trim() ||
      !/^\+?[0-9][0-9\s()-]{7,29}$/.test(contact.phone) ||
      !contact.businessCategory.trim() ||
      contact.address.trim().length < 3 ||
      !contact.processingConsent
    ) {
      setError(
        "Lengkapi nama kontak, usaha, nomor HP, kategori, alamat, dan persetujuan pemrosesan.",
      );
      return false;
    }
    setError("");
    return true;
  }
  async function saveContact(created: Session) {
    if (!contact.contactConsent || contactSent) return;
    await apiJson("/api/qris-custom/contact", {
      ...contact,
      contactName: contact.contactName.trim(),
      businessName: contact.businessName.trim(),
      businessCategory: contact.businessCategory.trim(),
      address: contact.address.trim(),
      contactWindow: contact.contactWindow.trim() || null,
      needNote: contact.needNote.trim() || null,
      sessionId: created.id,
      token: created.token,
      requestId,
    });
    setContactSent(true);
  }
  async function upload() {
    if (!file) {
      setError("Pilih file QRIS resmi terlebih dahulu.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.set("file", file);
      form.set(
        "intake",
        JSON.stringify({
          ...contact,
          requestId,
          contactName: contact.contactName.trim(),
          businessName: contact.businessName.trim(),
          businessCategory: contact.businessCategory.trim(),
          address: contact.address.trim(),
          contactWindow: contact.contactWindow.trim() || null,
          needNote: contact.needNote.trim() || null,
        }),
      );
      const response = await fetch("/api/qris-custom/upload", {
        method: "POST",
        body: form,
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload?.error?.message || "Unggah gagal.");
      const created = {
        id: payload.data.id,
        token: payload.data.token,
        expiresAt: payload.data.expiresAt,
      } as Session;
      setSession(created);
      setContactSent(Boolean(payload.data.contactSaved));
      setStep(2);
      if (payload.data.contactError)
        setError(
          "Desain tetap bisa dibuat, tetapi permintaan untuk dihubungi belum tersimpan. Gunakan tombol coba lagi pada langkah ini.",
        );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unggah gagal.");
    } finally {
      setBusy(false);
    }
  }
  const render = useCallback(
    async (format: "png" | "jpg" | "pdf", download = false) => {
      if (!session) return;
      setBusy(true);
      setError("");
      try {
        const response = await fetch("/api/qris-custom/render", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: session.id,
            token: session.token,
            design,
            format,
            download,
          }),
        });
        if (!response.ok) {
          const payload = await response.json();
          throw new Error(
            payload?.error?.message || "Desain tidak dapat dibuat.",
          );
        }
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        if (download) {
          const anchor = document.createElement("a");
          anchor.href = url;
          anchor.download = `qris-custom-${design.size.toLowerCase()}.${format}`;
          anchor.click();
          setTimeout(() => URL.revokeObjectURL(url), 30_000);
        } else {
          setPreview(url);
        }
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : "Desain gagal dibuat.",
        );
      } finally {
        setBusy(false);
      }
    },
    [session, design],
  );
  useEffect(() => {
    if (!session || step < 3) return;
    const timer = window.setTimeout(() => void render("png"), 850);
    return () => window.clearTimeout(timer);
  }, [session, step, render]);
  async function share() {
    if (!session) return;
    try {
      const response = await fetch("/api/qris-custom/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          token: session.token,
          design,
          format: "png",
          download: false,
        }),
      });
      if (!response.ok) throw new Error("Preview belum dapat dibagikan.");
      const shareFile = new File([await response.blob()], "qris-custom.png", {
        type: "image/png",
      });
      if (!navigator.canShare?.({ files: [shareFile] }))
        throw new Error(
          "Browser belum mendukung berbagi gambar langsung. Unduh PNG lalu bagikan manual.",
        );
      await navigator.share({ files: [shareFile], title: "QRIS Custom" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Berbagi gagal.");
    }
  }
  async function discardSession() {
    if (!session) return;
    try {
      const response = await fetch("/api/qris-custom/session", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id, token: session.token }),
      });
      if (!response.ok) throw new Error("File sementara belum dapat dihapus.");
      setSession(null);
      setFile(null);
      setSourcePreview(null);
      setPreview(null);
      setStep(1);
      setDeleteOpen(false);
      setError(
        "File QRIS sementara berhasil dihapus. Anda dapat memilih file baru bila ingin melanjutkan.",
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Penghapusan gagal.");
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pb-20 pt-8 sm:px-8">
      <div className="mb-8 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[.25em] text-blue-700">
            QRIS Custom
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-[#102b58] sm:text-5xl">
            QRIS Usahamu, Gayamu.
          </h1>
          <p className="mt-3 max-w-2xl text-slate-600">
            Unggah QRIS resmi Anda, pilih tampilan, dan unduh desain siap cetak.
            Kode QR tidak dibuat ulang atau diubah.
          </p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          Layanan desain visual, bukan penerbitan QRIS.
          <br />
          Jangan unggah dokumen atau data nasabah.
        </div>
      </div>
      <nav
        aria-label="Tahapan desain"
        className="mb-6 grid grid-cols-5 gap-1 sm:gap-2"
      >
        {steps.map((name, index) => (
          <div
            key={name}
            className={`rounded-xl px-1 py-3 text-center text-[10px] font-bold sm:text-sm ${step === index ? "bg-[#102b58] text-white" : index < step ? "bg-blue-100 text-blue-900" : "bg-white text-slate-500"}`}
          >
            {index < step ? "✓" : index + 1}.{" "}
            <span className="hidden sm:inline">{name}</span>
            <span className="sm:hidden">
              {name === "Kustomisasi"
                ? "Desain"
                : name === "QRIS Resmi"
                  ? "QRIS"
                  : name}
            </span>
          </div>
        ))}
      </nav>
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"
        >
          {error}
        </div>
      )}
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/50 sm:p-8">
        {step === 0 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-black">Kenali usaha Anda</h2>
              <p className="mt-1 text-sm text-slate-500">
                Informasi lokasi membantu menempatkan kebutuhan Anda ke petugas
                yang tepat hanya jika Anda setuju dihubungi.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm font-semibold">
                Nama kontak *
                <input
                  className={field}
                  value={contact.contactName}
                  onChange={(event) =>
                    setContactValue("contactName", event.target.value)
                  }
                  autoComplete="name"
                />
              </label>
              <label className="text-sm font-semibold">
                Nama usaha *
                <input
                  className={field}
                  value={contact.businessName}
                  onChange={(event) => {
                    setContactValue("businessName", event.target.value);
                    setDesign((current) => ({
                      ...current,
                      businessName: event.target.value,
                    }));
                  }}
                />
              </label>
              <label className="text-sm font-semibold">
                Nomor HP *
                <input
                  className={field}
                  value={contact.phone}
                  onChange={(event) =>
                    setContactValue("phone", event.target.value)
                  }
                  type="tel"
                  autoComplete="tel"
                />
              </label>
              <label className="text-sm font-semibold">
                Kategori usaha *
                <input
                  className={field}
                  value={contact.businessCategory}
                  onChange={(event) =>
                    setContactValue("businessCategory", event.target.value)
                  }
                  placeholder="Contoh: kuliner, toko kelontong"
                />
              </label>
              <label className="text-sm font-semibold md:col-span-2">
                Alamat usaha minimum *
                <input
                  className={field}
                  value={contact.address}
                  onChange={(event) =>
                    setContactValue("address", event.target.value)
                  }
                  placeholder="Nama jalan/area dan kota; tidak perlu alamat rumah"
                />
              </label>
              <label className="text-sm font-semibold">
                Produk yang diminati
                <select
                  className={field}
                  value={contact.interestedProduct}
                  onChange={(event) =>
                    setContactValue(
                      "interestedProduct",
                      event.target.value as Contact["interestedProduct"],
                    )
                  }
                >
                  <option value="QRIS">QRIS</option>
                  <option value="LIVIN_MERCHANT">Livin’ Merchant</option>
                  <option value="EDC">EDC</option>
                  <option value="LIVIN_TABUNGAN">Livin’ Tabungan</option>
                  <option value="KOPRA">Kopra</option>
                  <option value="OTHER">Lainnya</option>
                </select>
              </label>
              <label className="text-sm font-semibold">
                Hubungan dengan Mandiri
                <select
                  className={field}
                  value={contact.bankRelationship}
                  onChange={(event) =>
                    setContactValue(
                      "bankRelationship",
                      event.target.value as Contact["bankRelationship"],
                    )
                  }
                >
                  <option value="UNKNOWN">Belum ingin menyebutkan</option>
                  <option value="CUSTOMER">Sudah menjadi nasabah</option>
                  <option value="NOT_CUSTOMER">Belum menjadi nasabah</option>
                </select>
              </label>
              <label className="text-sm font-semibold">
                Waktu nyaman dihubungi (opsional)
                <input
                  className={field}
                  value={contact.contactWindow}
                  onChange={(event) =>
                    setContactValue("contactWindow", event.target.value)
                  }
                  placeholder="Contoh: hari kerja, 09.00–12.00"
                />
              </label>
              <label className="text-sm font-semibold">
                Catatan kebutuhan (opsional)
                <input
                  className={field}
                  value={contact.needNote}
                  onChange={(event) =>
                    setContactValue("needNote", event.target.value)
                  }
                />
              </label>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4">
              <h3 className="mb-2 flex items-center gap-2 font-bold">
                <MapPin className="h-5 w-5" /> Lokasi usaha (opsional)
              </h3>
              <p className="mb-3 text-xs text-slate-500">
                Klik peta untuk titik usaha. Koordinat tidak wajib untuk membuat
                desain. Peta memakai tile OpenStreetMap; IP dan permintaan tile
                dapat diproses penyedia peta.
              </p>
              <LocationMap
                point={point}
                onPick={(latitude, longitude) =>
                  setContact((current) => ({
                    ...current,
                    latitude,
                    longitude,
                    locationSource: "MAP_PIN",
                  }))
                }
                pointLabel="Lokasi usaha"
              />
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <label className="text-xs">
                  Latitude
                  <input
                    className={field}
                    type="number"
                    step="any"
                    min={-90}
                    max={90}
                    value={contact.latitude ?? ""}
                    onChange={(event) =>
                      setContact((current) => ({
                        ...current,
                        latitude:
                          event.target.value === ""
                            ? null
                            : Number(event.target.value),
                        locationSource: "MAP_PIN",
                      }))
                    }
                  />
                </label>
                <label className="text-xs">
                  Longitude
                  <input
                    className={field}
                    type="number"
                    step="any"
                    min={-180}
                    max={180}
                    value={contact.longitude ?? ""}
                    onChange={(event) =>
                      setContact((current) => ({
                        ...current,
                        longitude:
                          event.target.value === ""
                            ? null
                            : Number(event.target.value),
                        locationSource: "MAP_PIN",
                      }))
                    }
                  />
                </label>
                <Button
                  variant="outline"
                  onClick={() =>
                    navigator.geolocation?.getCurrentPosition(
                      (position) =>
                        setContact((current) => ({
                          ...current,
                          latitude: position.coords.latitude,
                          longitude: position.coords.longitude,
                          locationSource: "DEVICE_GEOLOCATION",
                        })),
                      () =>
                        setError(
                          "Lokasi perangkat tidak tersedia atau izin ditolak. Anda tetap dapat memakai alamat manual.",
                        ),
                      { timeout: 10000 },
                    )
                  }
                >
                  Gunakan lokasi saya
                </Button>
                <Button
                  variant="ghost"
                  onClick={() =>
                    setContact((current) => ({
                      ...current,
                      latitude: null,
                      longitude: null,
                      locationSource: "MANUAL_ADDRESS",
                    }))
                  }
                >
                  Hapus titik
                </Button>
              </div>
            </div>
            <div className="space-y-3 rounded-2xl bg-blue-50 p-4 text-sm">
              <label className="flex gap-3">
                <input
                  type="checkbox"
                  checked={contact.processingConsent}
                  onChange={(event) =>
                    setContactValue("processingConsent", event.target.checked)
                  }
                />
                <span>
                  Saya setuju informasi yang saya isi diproses untuk membuat
                  desain QRIS Custom ini. File QRIS disimpan sementara maksimal
                  24 jam lalu dihapus. *
                </span>
              </label>
              <label className="flex gap-3">
                <input
                  type="checkbox"
                  checked={contact.contactConsent}
                  onChange={(event) =>
                    setContactValue("contactConsent", event.target.checked)
                  }
                />
                <span>
                  Saya setuju dihubungi petugas KCP Mandiri Jakarta Mangga Besar
                  terkait kebutuhan yang saya pilih. Opsional; tanpa persetujuan
                  ini, data kontak tidak masuk daftar follow-up petugas.
                </span>
              </label>
            </div>
            <div className="flex justify-end">
              <Button
                onClick={() => {
                  if (validateContact()) setStep(1);
                }}
              >
                Lanjutkan <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-black">Unggah QRIS resmi</h2>
              <p className="mt-1 text-sm text-slate-500">
                JPG, PNG, atau PDF satu halaman; maksimum 8 MB. Kode QR harus
                dapat dibaca. Sistem tidak menerbitkan QRIS baru.
              </p>
            </div>
            <label
              className="flex min-h-56 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-blue-300 bg-blue-50/50 p-6 text-center hover:bg-blue-50"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                selectFile(event.dataTransfer.files[0] || null);
              }}
            >
              <ImageUp className="h-10 w-10 text-blue-700" />
              <span className="font-bold">Pilih atau ambil gambar QRIS</span>
              <span className="text-xs text-slate-500">
                File hanya tersimpan sementara di penyimpanan privat.
              </span>
              <input
                type="file"
                accept="image/png,image/jpeg,application/pdf"
                className="max-w-full text-sm"
                onChange={(event) => {
                  selectFile(event.target.files?.[0] || null);
                }}
              />
            </label>
            <label className="inline-flex min-h-11 cursor-pointer items-center rounded-xl border border-slate-300 px-4 text-sm font-semibold hover:bg-slate-50">
              Ambil foto dari kamera HP
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={(event) =>
                  selectFile(event.target.files?.[0] || null)
                }
              />
            </label>
            {sourcePreview && (
              <div className="mx-auto max-w-xs rounded-xl border p-3">
                <img
                  src={sourcePreview}
                  alt="Pratinjau file QRIS sumber"
                  className="max-h-56 w-full object-contain"
                />
              </div>
            )}
            {file?.type === "application/pdf" && (
              <p className="text-sm">
                PDF dipilih: {file.name}. Validasi dilakukan oleh server.
              </p>
            )}
            <p className="flex items-center gap-2 text-xs text-slate-500">
              <LockKeyhole className="h-4 w-4" /> Area QR dan data pembayaran
              pada file sumber tidak dapat diedit di sini.
            </p>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(0)}>
                <ArrowLeft className="h-4 w-4" /> Kembali
              </Button>
              <Button disabled={busy} onClick={upload}>
                {busy ? "Memvalidasi…" : "Validasi dan lanjutkan"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="space-y-6">
            {contact.contactConsent && !contactSent && session && (
              <Button
                variant="outline"
                onClick={() =>
                  void saveContact(session).catch((cause) =>
                    setError(
                      cause instanceof Error
                        ? cause.message
                        : "Tindak lanjut gagal disimpan.",
                    ),
                  )
                }
              >
                Coba simpan permintaan dihubungi
              </Button>
            )}
            {contactSent && (
              <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
                Permintaan untuk dihubungi telah diterima. Petugas akan
                menindaklanjuti sesuai ketersediaan.
              </p>
            )}
            <div>
              <h2 className="text-xl font-black">Pilih template</h2>
              <p className="mt-1 text-sm text-slate-500">
                Tiga gaya visual untuk menampilkan QRIS resmi Anda. Pilih yang
                paling cocok dengan karakter usaha.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {qrisTemplates.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => preset(item.id)}
                  className={`overflow-hidden rounded-2xl border-2 text-left transition hover:-translate-y-1 hover:shadow-lg ${design.template === item.id ? "border-blue-700" : "border-slate-200"}`}
                >
                  <div
                    className="relative h-52 p-5"
                    style={{ background: item.primary }}
                  >
                    <div
                      className="text-lg font-black"
                      style={{
                        color: item.id === "HERITAGE" ? "#122b52" : "#fff",
                      }}
                    >
                      {contact.businessName || "Nama Usaha"}
                    </div>
                    <div className="absolute inset-x-8 top-20 grid h-24 place-items-center rounded-xl border-4 border-white bg-white text-sm font-bold text-slate-500">
                      AREA QRIS TERKUNCI
                    </div>
                    <div
                      className="absolute bottom-4 left-5 text-xs font-bold"
                      style={{ color: item.secondary }}
                    >
                      QRIS Usahamu, Gayamu.
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-4 font-bold">
                    {item.label}
                    {design.template === item.id && (
                      <Check className="h-5 w-5 text-blue-700" />
                    )}
                  </div>
                </button>
              ))}
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="h-4 w-4" /> Kembali
              </Button>
              <Button onClick={() => setStep(3)}>
                Kustomisasi <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-black">Kustomisasi tampilan</h2>
              <p className="mt-1 text-sm text-slate-500">
                Anda dapat mengubah elemen di luar area QRIS. Hasil akhir
                diperiksa agar kode tetap terbaca.
              </p>
            </div>
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-semibold sm:col-span-2">
                  Nama usaha
                  <input
                    className={field}
                    maxLength={80}
                    value={design.businessName}
                    onChange={(event) =>
                      changeDesign({ businessName: event.target.value })
                    }
                  />
                </label>
                <label className="text-sm font-semibold sm:col-span-2">
                  Tagline
                  <input
                    className={field}
                    maxLength={100}
                    value={design.tagline}
                    onChange={(event) =>
                      changeDesign({ tagline: event.target.value })
                    }
                  />
                </label>
                <div className="space-y-2 text-sm font-semibold sm:col-span-2">
                  <label htmlFor="business-logo">
                    Logo usaha (opsional, JPG/PNG/WebP, maks. 512 KB)
                  </label>
                  <input
                    id="business-logo"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className={field}
                    onChange={async (event) => {
                      const chosen = event.target.files?.[0];
                      if (!chosen) return;
                      if (
                        !["image/jpeg", "image/png", "image/webp"].includes(
                          chosen.type,
                        ) ||
                        chosen.size > 512 * 1024
                      ) {
                        setError(
                          "Logo usaha harus JPG/PNG/WebP dan maksimal 512 KB.",
                        );
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = () => {
                        if (typeof reader.result === "string") {
                          changeDesign({ logoDataUrl: reader.result });
                          setError("");
                        }
                      };
                      reader.onerror = () =>
                        setError("Logo usaha tidak dapat dibaca.");
                      reader.readAsDataURL(chosen);
                    }}
                  />
                  {design.logoDataUrl && (
                    <div className="flex items-center gap-3">
                      <img
                        src={design.logoDataUrl}
                        alt="Pratinjau logo usaha"
                        className="h-12 w-12 object-contain"
                      />
                      <Button
                        variant="ghost"
                        onClick={() => changeDesign({ logoDataUrl: "" })}
                      >
                        Hapus logo
                      </Button>
                    </div>
                  )}
                </div>
                <label className="text-sm font-semibold">
                  Sosial media (opsional)
                  <input
                    className={field}
                    maxLength={90}
                    value={design.social}
                    onChange={(event) =>
                      changeDesign({ social: event.target.value })
                    }
                  />
                </label>
                <label className="text-sm font-semibold">
                  Alamat tampil (opsional)
                  <input
                    className={field}
                    maxLength={100}
                    value={design.address}
                    onChange={(event) =>
                      changeDesign({ address: event.target.value })
                    }
                  />
                </label>
                <label className="text-sm font-semibold">
                  Warna utama
                  <input
                    type="color"
                    className="mt-2 h-11 w-full rounded-xl border"
                    value={design.primary}
                    onChange={(event) =>
                      changeDesign({ primary: event.target.value })
                    }
                  />
                </label>
                <label className="text-sm font-semibold">
                  Warna aksen
                  <input
                    type="color"
                    className="mt-2 h-11 w-full rounded-xl border"
                    value={design.secondary}
                    onChange={(event) =>
                      changeDesign({ secondary: event.target.value })
                    }
                  />
                </label>
                <label className="text-sm font-semibold">
                  Pola
                  <select
                    className={field}
                    value={design.pattern}
                    onChange={(event) =>
                      changeDesign({
                        pattern: event.target.value as QrisDesign["pattern"],
                      })
                    }
                  >
                    <option value="WAVES">Gelombang</option>
                    <option value="TOPOGRAPHY">Topografi</option>
                    <option value="LINES">Garis</option>
                    <option value="NONE">Tanpa pola</option>
                  </select>
                </label>
                <label className="text-sm font-semibold">
                  Bingkai
                  <select
                    className={field}
                    value={design.frame}
                    onChange={(event) =>
                      changeDesign({
                        frame: event.target.value as QrisDesign["frame"],
                      })
                    }
                  >
                    <option value="ROUND">Membulat</option>
                    <option value="CLASSIC">Klasik</option>
                    <option value="NONE">Minimal</option>
                  </select>
                </label>
                <label className="text-sm font-semibold">
                  Ornamen
                  <select
                    className={field}
                    value={design.ornament}
                    onChange={(event) =>
                      changeDesign({
                        ornament: event.target.value as QrisDesign["ornament"],
                      })
                    }
                  >
                    <option value="STAR">Bintang</option>
                    <option value="LEAF">Daun</option>
                    <option value="SPARK">Kilau</option>
                    <option value="NONE">Tanpa ornamen</option>
                  </select>
                </label>
                <label className="text-sm font-semibold">
                  Ukuran cetak
                  <select
                    className={field}
                    value={design.size}
                    onChange={(event) =>
                      changeDesign({
                        size: event.target.value as QrisDesign["size"],
                      })
                    }
                  >
                    <option value="A5">A5</option>
                    <option value="A6">A6</option>
                  </select>
                </label>
              </div>
              <div className="space-y-4 rounded-2xl bg-slate-50 p-5">
                <div className="relative mx-auto aspect-[148/210] max-h-[480px] max-w-xs overflow-hidden rounded-xl bg-slate-200 shadow-inner">
                  {preview ? (
                    <img
                      src={preview}
                      alt="Pratinjau hasil desain"
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <div className="grid h-full place-items-center text-sm text-slate-500">
                      {busy ? "Memvalidasi QR…" : "Menyiapkan pratinjau…"}
                    </div>
                  )}
                  <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-lg bg-white/95 px-2 py-1 text-[10px] font-bold text-slate-800">
                    <LockKeyhole className="h-3 w-3" /> Area QRIS terkunci
                  </span>
                </div>
                <div
                  className="hidden aspect-[148/210] max-h-[380px] overflow-hidden rounded-xl p-6 shadow-inner"
                  style={{
                    background: design.inkSaver ? "#fff" : design.primary,
                  }}
                >
                  <div
                    className="text-center text-xl font-black"
                    style={{
                      color:
                        design.inkSaver || design.template === "HERITAGE"
                          ? "#102b58"
                          : "#fff",
                    }}
                  >
                    {design.businessName || "Nama Usaha"}
                  </div>
                  <p
                    className="mt-2 text-center text-xs"
                    style={{ color: design.secondary }}
                  >
                    {design.tagline}
                  </p>
                  <div className="mt-9 grid h-36 place-items-center rounded-xl border-4 border-white bg-white text-center text-xs font-bold text-slate-500">
                    <LockKeyhole className="h-5 w-5" /> QRIS RESMI · TERKUNCI
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  Pratinjau memakai hasil render yang sama dengan unduhan.
                  Perubahan muncul setelah validasi QR selesai.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={automaticDesign}>
                    <Sparkles className="h-4 w-4" /> Buatkan desain
                  </Button>
                  <Button
                    variant="outline"
                    disabled={!history.length}
                    onClick={() => {
                      const previous = history.at(-1)!;
                      setHistory(history.slice(0, -1));
                      setFuture([design, ...future]);
                      setDesign(previous);
                    }}
                  >
                    Undo
                  </Button>
                  <Button
                    variant="outline"
                    disabled={!future.length}
                    onClick={() => {
                      const next = future[0];
                      setFuture(future.slice(1));
                      setHistory([...history, design]);
                      setDesign(next);
                    }}
                  >
                    Redo
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() =>
                      changeDesign({
                        ...initialDesign,
                        businessName: contact.businessName,
                      })
                    }
                  >
                    <RotateCcw className="h-4 w-4" /> Reset
                  </Button>
                </div>
              </div>
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ArrowLeft className="h-4 w-4" /> Kembali
              </Button>
              <Button onClick={() => setStep(4)}>
                Lihat hasil <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
        {step === 4 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-black">Pratinjau & unduh</h2>
              <p className="mt-1 text-sm text-slate-500">
                Ini adalah file yang dihasilkan server. QR diverifikasi ulang
                agar sama dengan sumber; tetap uji scan dengan aplikasi resmi
                sebelum dicetak/distribusikan.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(["DESKTOP", "HP", "CETAK", "MEJA"] as const).map((mode) => (
                <Button
                  key={mode}
                  variant={previewMode === mode ? "default" : "outline"}
                  onClick={() => setPreviewMode(mode)}
                >
                  {mode === "HP"
                    ? "Mobile"
                    : mode === "MEJA"
                      ? "Mockup meja"
                      : mode === "CETAK"
                        ? "Cetak"
                        : "Desktop"}
                </Button>
              ))}
            </div>
            <div
              className={`mx-auto grid min-h-96 place-items-center rounded-2xl p-6 ${previewMode === "MEJA" ? "bg-[#d3c5b1]" : "bg-slate-100"}`}
            >
              <div
                className={`bg-white shadow-2xl ${previewMode === "HP" ? "w-[220px] rounded-3xl border-[10px] border-slate-900" : previewMode === "MEJA" ? "w-[300px] rotate-[-4deg] rounded-lg border-8 border-white" : "w-full max-w-md"}`}
              >
                {preview ? (
                  <img
                    src={preview}
                    alt="Hasil desain QRIS Custom"
                    className="h-auto w-full"
                  />
                ) : (
                  <div className="grid aspect-[148/210] place-items-center text-sm text-slate-500">
                    {busy
                      ? "Memeriksa dan membuat desain…"
                      : "Klik Perbarui pratinjau"}
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 rounded-xl border p-3 text-sm">
                <input
                  type="checkbox"
                  checked={design.inkSaver}
                  onChange={(event) =>
                    changeDesign({ inkSaver: event.target.checked })
                  }
                />{" "}
                Hemat tinta
              </label>
              <label className="flex items-center gap-2 rounded-xl border p-3 text-sm">
                Ukuran
                <select
                  value={design.size}
                  onChange={(event) =>
                    changeDesign({
                      size: event.target.value as QrisDesign["size"],
                    })
                  }
                >
                  <option>A5</option>
                  <option>A6</option>
                </select>
              </label>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void render("png")}
              >
                Perbarui pratinjau
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {(["png", "jpg", "pdf"] as const).map((format) => (
                <Button
                  key={format}
                  disabled={busy}
                  onClick={() => void render(format, true)}
                >
                  <Download className="h-4 w-4" /> Unduh {format.toUpperCase()}
                </Button>
              ))}
              <Button variant="outline" onClick={() => void share()}>
                Bagikan gambar
              </Button>
            </div>
            <div className="rounded-xl bg-amber-50 p-4 text-xs text-amber-900">
              File sumber dan sesi desain terhapus otomatis setelah 24 jam oleh
              worker. Unduhan tersimpan di perangkat Anda sesuai pengaturan
              browser. Tidak ada tautan publik permanen; berbagi dilakukan oleh
              Anda dari perangkat sendiri.
            </div>
            <p className="text-xs text-slate-500">
              Untuk cetak hemat biaya, gunakan kertas Art Paper/Ivory lalu
              laminasi glossy atau doff; akrilik tidak wajib. Cek hasil scan
              sebelum dipasang.
            </p>
            <Button variant="outline" onClick={() => setDeleteOpen(true)}>
              Hapus file sementara sekarang
            </Button>
            <Button variant="outline" onClick={() => setStep(3)}>
              <ArrowLeft className="h-4 w-4" /> Edit lagi
            </Button>
          </div>
        )}
      </div>
      <p className="mt-6 text-center text-xs text-slate-500">
        MABES LINK · KCP Mandiri Jakarta Mangga Besar 11539 · QRIS diterbitkan
        melalui jalur resmi, bukan dari editor ini.
      </p>
      <Dialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Hapus file QRIS sementara?"
        description="File sumber dan sesi desain di server akan dihapus. File yang sudah Anda unduh di perangkat tidak ikut terhapus."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Batal
            </Button>
            <Button variant="danger" onClick={() => void discardSession()}>
              Ya, hapus file
            </Button>
          </div>
        }
      >
        <p className="text-sm text-slate-600">
          Untuk membuat desain lagi, Anda perlu mengunggah ulang QRIS resmi.
        </p>
      </Dialog>
    </div>
  );
}
