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
  Search,
  ExternalLink,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { useDebouncedValue } from "@/lib/client/use-debounced-value";
import { Dialog } from "@/components/ui/dialog";
import { useFeedback } from "@/components/ui/feedback";
import { SearchCombobox } from "@/components/ui/search-combobox";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { isSuppliedQrisTemplate, qrisTemplates, qrisTemplateZones, type QrisDesign } from "@/lib/qris-design";
import { qrisStickerPreview, qrisStickers } from "@/lib/qris-stickers";

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
type PlaceResult = { label: string; latitude: number; longitude: number };
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
  template: "BATIK_NUSANTARA",
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
  bottomText: "",
  bottomFont: "MODERN",
  bottomFontSize: 32,
  bottomFontWeight: "BOLD",
  bottomColor: "#09345a",
  qrZoom: 1,
  qrPanX: 0,
  qrPanY: 0,
  stickers: [],
  sticker: "NONE",
  stickerDataUrl: "",
  stickerSide: "RIGHT",
  stickerX: 0.9,
  stickerY: 0.5,
  stickerSize: 58,
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
    throw new Error(publicErrorMessage(payload, "Permintaan gagal diproses."));
  return payload.data as T;
}

function publicErrorMessage(payload: { error?: { message?: string; details?: { fieldErrors?: Record<string, string[]> } } }, fallback: string) {
  const fields = payload.error?.details?.fieldErrors;
  const first = fields ? Object.entries(fields).find(([, messages]) => messages?.length) : null;
  if (first) return first[1][0];
  return payload.error?.message || fallback;
}

function preferredContactTime(value: string) {
  if (!value) return null;
  const [date, time] = value.split("T");
  return date && time ? `${date.slice(8, 10)}-${date.slice(5, 7)}-${date.slice(0, 4)} ${time} WIB` : null;
}

export function QrisCustomEditor() {
  const { toast } = useFeedback();
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
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [contactSent, setContactSent] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null);
  const [requestId] = useState(() => crypto.randomUUID());
  const [placeQuery, setPlaceQuery] = useState("");
  const debouncedPlaceQuery = useDebouncedValue(placeQuery, 500);
  const placeController = useRef<AbortController | null>(null);
  const lastPlaceQuery = useRef("");
  const [placeResults, setPlaceResults] = useState<PlaceResult[]>([]);
  const [placeBusy, setPlaceBusy] = useState(false);
  const [placeMessage, setPlaceMessage] = useState("");

  useEffect(() => {
    if (error) toast(error, error.startsWith("File QRIS sementara berhasil") ? "success" : "error");
  }, [error, toast]);

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
    setMissingFields((current) => current.filter((item) => item !== key));
    setError("");
  }
  const searchPlaces = useCallback(async (term: string, force = false) => {
    const query = term.trim();
    if (query.length < 3) {
      if (force) setPlaceMessage("Ketik sedikitnya 3 karakter nama tempat atau jalan.");
      return;
    }
    if (!force && query === lastPlaceQuery.current) return;
    placeController.current?.abort();
    const controller = new AbortController();
    placeController.current = controller;
    lastPlaceQuery.current = query;
    setPlaceBusy(true);
    setPlaceMessage("");
    setPlaceResults([]);
    try {
      const response = await fetch(`/api/location-search?q=${encodeURIComponent(query)}`, { cache: "no-store", signal: controller.signal });
      const payload = await response.json();
      if (controller.signal.aborted) return;
      if (!response.ok) throw new Error(publicErrorMessage(payload, "Pencarian tempat belum tersedia."));
      setPlaceResults(payload.data as PlaceResult[]);
      if (!payload.data.length) setPlaceMessage("Tempat tidak ditemukan. Coba kata kunci lain atau pilih pin pada peta.");
    } catch (failure) {
      if (!controller.signal.aborted) setPlaceMessage(failure instanceof Error ? failure.message : "Pencarian tempat belum tersedia.");
    } finally {
      if (!controller.signal.aborted) setPlaceBusy(false);
    }
  }, []);
  useEffect(() => {
    if (step !== 0) return;
    const timer = window.setTimeout(() => void searchPlaces(debouncedPlaceQuery), 0);
    return () => window.clearTimeout(timer);
  }, [debouncedPlaceQuery, searchPlaces, step]);
  useEffect(() => () => placeController.current?.abort(), []);
  function googlePlaceSearchUrl() {
    const url = new URL("https://www.google.com/maps/search/");
    url.searchParams.set("api", "1");
    url.searchParams.set("query", placeQuery.trim() || "Mangga Besar Jakarta");
    return url.toString();
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
    });
  }
  function automaticDesign() {
    preset("BATIK_NUSANTARA");
  }
  function addSticker(kind: QrisDesign["stickers"][number]["kind"], dataUrl = "", position = { x: 0.85, y: 0.5 }) {
    if (design.stickers.length >= 3) {
      setError("Maksimal tiga stiker agar panel bawah tetap rapi.");
      return;
    }
    const id = crypto.randomUUID();
    changeDesign({ stickers: [...design.stickers, { id, kind, dataUrl, x: position.x, y: position.y, size: 52 }] });
    setSelectedStickerId(id);
    setError("");
  }
  function selectStickerFile(chosen: File | null, position?: { x: number; y: number }) {
    if (!chosen) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(chosen.type) || chosen.size > 320 * 1024) {
      setError("Stiker harus PNG, JPG, atau WebP dengan ukuran maksimal 320 KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        addSticker("UPLOAD", reader.result, position);
        setError("");
      }
    };
    reader.onerror = () => setError("Gambar stiker tidak dapat dibaca.");
    reader.readAsDataURL(chosen);
  }
  function stickerPosition(clientX: number, clientY: number, element: HTMLElement, size = 52) {
    const rect = element.getBoundingClientRect();
    const zone = isSuppliedQrisTemplate(design.template) ? qrisTemplateZones[design.template].bottom : null;
    const scale = zone ? rect.width / zone.width : 1;
    const stickerPixels = size * scale;
    const margin = 8 * scale;
    return {
      x: Math.max(0, Math.min(1, (clientX - rect.left - margin - stickerPixels / 2) / Math.max(1, rect.width - 2 * margin - stickerPixels))),
      y: Math.max(0, Math.min(1, (clientY - rect.top - margin - stickerPixels / 2) / Math.max(1, rect.height - 2 * margin - stickerPixels))),
    };
  }
  function validateContact() {
    const missing: string[] = [];
    if (contact.businessName.trim().length < 2) missing.push("businessName");
    if (contact.contactConsent && contact.contactName.trim().length < 2) missing.push("contactName");
    if ((contact.contactConsent || contact.phone.trim()) && !/^\+?[0-9][0-9\s()-]{7,29}$/.test(contact.phone.trim())) missing.push("phone");
    if (!contact.processingConsent) missing.push("processingConsent");
    if ((contact.latitude === null) !== (contact.longitude === null)) missing.push("coordinates");
    setMissingFields(missing);
    if (missing.length) {
      const labels: Record<string, string> = {
        businessName: "nama usaha (minimal 2 huruf)",
        contactName: "nama kontak untuk dihubungi",
        phone: "nomor HP yang valid",
        processingConsent: "persetujuan pemrosesan",
        coordinates: "pasangan latitude dan longitude lengkap, atau hapus titik",
      };
      const message = `Periksa: ${missing.map((item) => labels[item]).join(", ")}.`;
      if (error === message) toast(message, "error");
      setError(message);
      document.querySelector<HTMLInputElement>(`[data-field="${missing[0]}"]`)?.focus();
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
      contactWindow: preferredContactTime(contact.contactWindow),
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
          contactWindow: preferredContactTime(contact.contactWindow),
          needNote: contact.needNote.trim() || null,
        }),
      );
      const response = await fetch("/api/qris-custom/upload", {
        method: "POST",
        body: form,
      });
      const payload = await response.json();
        if (!response.ok)
          throw new Error(publicErrorMessage(payload, "Unggah gagal."));
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
          throw new Error(publicErrorMessage(payload, "Desain tidak dapat dibuat."));
        }
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        if (download) {
          const anchor = document.createElement("a");
          anchor.href = url;
          anchor.download = `qris-${design.template.toLowerCase().replaceAll("_", "-")}.${format}`;
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

  const bottomZone = isSuppliedQrisTemplate(design.template)
    ? qrisTemplateZones[design.template].bottom
    : qrisTemplateZones.BATIK_NUSANTARA.bottom;
  const selectedSticker = design.stickers.find((item) => item.id === selectedStickerId)
    ?? design.stickers.at(-1);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-20 pt-7 sm:px-8 sm:pt-10">
      <div className="mb-8 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[.16em] text-blue-700">
            QRIS Custom
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-[-.04em] text-[#102b58] sm:text-5xl">
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
            className={`rounded-lg border px-1 py-3 text-center text-[10px] font-semibold sm:text-sm ${step === index ? "border-[#102b58] bg-[#102b58] text-white" : index < step ? "border-blue-100 bg-blue-50 text-blue-900" : "border-slate-200 bg-white text-slate-500"}`}
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
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_16px_40px_rgba(15,23,42,.04)] sm:p-8">
        {step === 0 && (
          <div className="space-y-6">
            <div className="rounded-2xl border-t-4 border-amber-400 bg-[#092c60] p-5 text-white sm:p-7">
              <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-amber-200">Langkah 1 · Informasi usaha</span>
              <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">Desain QRIS untuk usaha Anda</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100">Isi nama usaha untuk desain. Data kontak hanya diperlukan bila Anda ingin petugas menghubungi; kolom lainnya bebas dikosongkan.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm font-semibold">
                Nama kontak {contact.contactConsent ? "*" : "(opsional)"}
                <input
                  data-field="contactName"
                  aria-invalid={missingFields.includes("contactName")}
                  className={`${field} ${missingFields.includes("contactName") ? "border-red-500 bg-red-50" : ""}`}
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
                  data-field="businessName"
                  aria-invalid={missingFields.includes("businessName")}
                  className={`${field} ${missingFields.includes("businessName") ? "border-red-500 bg-red-50" : ""}`}
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
                Nomor HP {contact.contactConsent ? "*" : "(opsional)"}
                <input
                  data-field="phone"
                  aria-invalid={missingFields.includes("phone")}
                  className={`${field} ${missingFields.includes("phone") ? "border-red-500 bg-red-50" : ""}`}
                  value={contact.phone}
                  onChange={(event) =>
                    setContactValue("phone", event.target.value)
                  }
                  type="tel"
                  autoComplete="tel"
                />
              </label>
              <label className="text-sm font-semibold">
                Kategori usaha (opsional)
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
                Alamat usaha (opsional)
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
                Tanggal dan jam nyaman dihubungi (opsional, WIB)
                <input
                  className={field}
                  type="datetime-local"
                  step="60"
                  value={contact.contactWindow}
                  onChange={(event) =>
                    setContactValue("contactWindow", event.target.value)
                  }
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
            <div className={`rounded-2xl border p-4 ${missingFields.includes("coordinates") ? "border-red-500 bg-red-50" : "border-slate-200"}`}>
              <h3 className="mb-2 flex items-center gap-2 font-bold">
                <MapPin className="h-5 w-5" /> Lokasi usaha (opsional)
                <InfoTooltip label="lokasi usaha QRIS">Koordinat dan alamat tidak wajib untuk membuat desain. Cari alamat publik saja; jangan memasukkan data pribadi. Google Maps terbuka terpisah dan hanya menerima alamat publik atau koordinat.</InfoTooltip>
              </h3>
              <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="min-w-0 sm:flex-1"><SearchCombobox id="place-search" label="Cari toko atau alamat publik" placeholder="Contoh: nama toko atau Jalan Mangga Besar" minLength={3} dropdownSide="top"
                    value={placeQuery} onChange={(value) => { placeController.current?.abort(); lastPlaceQuery.current = ""; setPlaceBusy(false); setPlaceResults([]); setPlaceMessage(""); setPlaceQuery(value); }}
                    loading={placeBusy || placeQuery !== debouncedPlaceQuery} error={placeMessage.includes("dipilih") ? "" : placeMessage}
                    empty="Tidak ditemukan. Coba alamat yang lebih lengkap, gunakan pin manual, atau buka Google Maps."
                    options={placeResults.map((result, index) => ({ id: String(index), label: result.label }))}
                    onSelect={(option) => {
                      const result = placeResults[Number(option.id)]; if (!result) return;
                      setContact((current) => ({ ...current, address: result.label, latitude: result.latitude, longitude: result.longitude, locationSource: "MAP_PIN" }));
                      setPlaceResults([]); setPlaceMessage("Lokasi dipilih. Pastikan pin pada peta sudah benar.");
                    }} /></div>
                  <Button type="button" onClick={() => void searchPlaces(placeQuery, true)} disabled={placeBusy}><Search size={16} />{placeBusy ? "Mencari…" : "Cari lokasi"}</Button>
                  <a href={googlePlaceSearchUrl()} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-100"><ExternalLink size={16} />Google Maps</a>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-500">Hasil diperbarui otomatis setelah Anda berhenti mengetik 0,5 detik. Masukkan tempat/alamat publik saja. Pencarian internal memerlukan penyedia yang diizinkan; Google Maps terbuka terpisah.</p>
                {placeMessage && <p role="status" className="mt-2 text-xs font-medium text-amber-800">{placeMessage}</p>}
              </div>
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
                    data-field="coordinates"
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
            <div className={`space-y-3 rounded-2xl p-4 text-sm ${missingFields.includes("processingConsent") ? "border border-red-400 bg-red-50" : "bg-blue-50"}`}>
              <label className="flex gap-3">
                <input
                  type="checkbox"
                  data-field="processingConsent"
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
            <div className="overflow-hidden rounded-2xl border-t-4 border-amber-400 bg-[#092c60] p-6 text-white sm:p-8">
              <span className="rounded-full border border-amber-300/40 bg-amber-300/15 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-amber-200">Studio QRIS · Gratis</span>
              <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">Pilih suasana untuk usaha Anda</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100">Dua bingkai siap pakai dengan sentuhan Nusantara. Pilih satu, lalu atur ukuran QRIS, tulisan, dan stiker. Logo serta bingkai tetap utuh.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {qrisTemplates.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => preset(item.id)}
                  aria-pressed={design.template === item.id}
                  className={`group overflow-hidden rounded-2xl border-2 bg-white text-left shadow-sm transition duration-200 hover:shadow-lg ${design.template === item.id ? "border-[#d79e1b] ring-4 ring-amber-100" : "border-slate-200 hover:border-amber-400"}`}
                >
                  <div className="relative grid h-[360px] place-items-center bg-[#f4f6f8] p-5 sm:h-[420px]">
                    <span className="absolute left-4 top-4 rounded-full bg-[#092b52] px-3 py-1 text-xs font-black text-white">0{index + 1} / 02</span>
                    <span className={`absolute right-4 top-4 rounded-full px-3 py-1 text-[11px] font-black shadow ${design.template === item.id ? "bg-amber-400 text-[#092b52]" : "bg-white/95 text-blue-900"}`}>{design.template === item.id ? "✓ DESAIN DIPILIH" : "DESAIN GRATIS"}</span>
                    <img src={item.image} alt={`Template ${item.label}`} className="h-full max-w-full rounded-lg object-contain drop-shadow-2xl transition duration-300 group-hover:scale-[1.03]" />
                  </div>
                  <div className="flex items-center justify-between gap-3 p-5">
                    <div><p className="text-lg font-black text-[#092b52]">{item.label}</p><p className="mt-1 text-xs leading-5 text-slate-600">{item.id === "BATIK_NUSANTARA" ? "Klasik, hangat, dan berkarakter." : "Segar, tenang, dan bernuansa alam."}</p></div>
                    <span className={`grid size-9 shrink-0 place-items-center rounded-full ${design.template === item.id ? "bg-[#f5b72d] text-[#092b52]" : "bg-slate-100 text-slate-400"}`}><Check className="size-5" /></span>
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
                Pilih gaya huruf dan stiker seperti mini photobooth. Semua
                dekorasi tetap di panel bawah; logo dan QRIS terkunci.
              </p>
            </div>
            {isSuppliedQrisTemplate(design.template) && (
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="space-y-5 rounded-2xl border bg-white p-5">
                  <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-amber-50 p-4">
                    <p className="text-sm font-black text-[#09345a]">Posisi QRIS resmi</p>
                    <p className="mt-1 text-xs text-slate-600">QRIS selalu berada di belakang template. Zoom dan geser hanya berlaku di ruang tengah; kode harus tetap terbaca.</p>
                    <label className="mt-3 block text-sm font-semibold">Zoom QRIS: {Math.round(design.qrZoom * 100)}%
                      <input type="range" min="70" max="140" step="5" value={Math.round(design.qrZoom * 100)} onChange={(event) => changeDesign({ qrZoom: Number(event.target.value) / 100 })} className="mt-2 w-full" />
                    </label>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <label className="text-xs font-semibold">Geser horizontal
                        <input type="range" min="-100" max="100" step="5" value={Math.round(design.qrPanX * 100)} onChange={(event) => changeDesign({ qrPanX: Number(event.target.value) / 100 })} className="mt-2 w-full" />
                      </label>
                      <label className="text-xs font-semibold">Geser vertikal
                        <input type="range" min="-100" max="100" step="5" value={Math.round(design.qrPanY * 100)} onChange={(event) => changeDesign({ qrPanY: Number(event.target.value) / 100 })} className="mt-2 w-full" />
                      </label>
                    </div>
                    <button type="button" onClick={() => changeDesign({ qrZoom: 1, qrPanX: 0, qrPanY: 0 })} className="mt-2 text-xs font-bold text-blue-800 hover:underline">Kembalikan posisi QRIS</button>
                  </div>
                  <label className="block text-sm font-semibold">
                    Tulisan di panel bawah
                    <input
                      className={field}
                      maxLength={72}
                      value={design.bottomText}
                      placeholder={contact.businessName || "Contoh: Terima kasih sudah berbelanja"}
                      onChange={(event) => changeDesign({ bottomText: event.target.value })}
                    />
                    <span className="mt-1 block text-xs font-normal text-slate-500">Kosongkan untuk memakai nama usaha. Maksimal 72 karakter.</span>
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-sm font-semibold">Gaya huruf
                      <select className={field} value={design.bottomFont} onChange={(event) => changeDesign({ bottomFont: event.target.value as QrisDesign["bottomFont"] })}>
                        <option value="MODERN">Modern</option>
                        <option value="CLASSIC">Klasik elegan</option>
                        <option value="SCRIPT">Skrip elegan</option>
                        <option value="RETRO">Retro</option>
                      </select>
                    </label>
                    <label className="text-sm font-semibold">Ketebalan
                      <select className={field} value={design.bottomFontWeight} onChange={(event) => changeDesign({ bottomFontWeight: event.target.value as QrisDesign["bottomFontWeight"] })}>
                        <option value="BOLD">Tebal</option><option value="NORMAL">Normal</option>
                      </select>
                    </label>
                    <label className="text-sm font-semibold">Ukuran huruf: {design.bottomFontSize} px
                      <input type="range" min="18" max="40" value={design.bottomFontSize} onChange={(event) => changeDesign({ bottomFontSize: Number(event.target.value) })} className="mt-4 w-full" />
                    </label>
                    <label className="text-sm font-semibold">Warna tulisan
                      <input type="color" value={design.bottomColor} onChange={(event) => changeDesign({ bottomColor: event.target.value })} className="mt-2 h-10 w-full rounded-xl border border-slate-300 bg-white" />
                    </label>
                  </div>
                  <p className="text-xs text-slate-500">Tulisan panjang otomatis dikecilkan agar tetap di panel bawah.</p>
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Koleksi stiker</p>
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                      {qrisStickers.map((item) => (
                        <button key={item.id} type="button" draggable
                          onDragStart={(event) => event.dataTransfer.setData("text/sticker", item.id)}
                          onClick={() => addSticker(item.id)}
                          title={`Pilih atau seret stiker ${item.label}`}
                          className={`grid min-h-16 place-items-center rounded-xl border p-1 transition hover:-translate-y-0.5 hover:shadow ${selectedSticker?.kind === item.id ? "border-blue-700 bg-blue-50" : "border-slate-200 bg-white"}`}>
                          <img src={qrisStickerPreview(item.id)} alt="" className="h-9 w-9" />
                          <span className="text-[10px] font-medium text-slate-700">{item.label}</span>
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-slate-500">Pilih hingga 3 stiker. Klik atau seret dari koleksi; setelah ditempel, geser dengan mouse atau jari.</p>
                  </div>
                  <label className="block text-sm font-semibold">
                    Unggah stiker sendiri (opsional)
                    <input type="file" accept="image/png,image/jpeg,image/webp" className={field} onChange={(event) => selectStickerFile(event.target.files?.[0] ?? null)} />
                    <span className="mt-1 block text-xs font-normal text-slate-500">PNG/JPG/WebP, 64–2000 px per sisi, maksimal 320 KB. Gambar diperkecil tanpa metadata sebelum ditempel.</span>
                  </label>
                  {selectedSticker && (
                    <div className="space-y-3 rounded-xl bg-slate-50 p-3">
                      <p className="text-sm font-bold">Atur stiker {design.stickers.findIndex((item) => item.id === selectedSticker.id) + 1} dari {design.stickers.length}</p>
                      <label className="block text-sm font-semibold">Ukuran: {selectedSticker.size} px
                        <input type="range" min="28" max="70" value={selectedSticker.size} onChange={(event) => changeDesign({ stickers: design.stickers.map((item) => item.id === selectedSticker.id ? { ...item, size: Number(event.target.value) } : item) })} className="mt-3 w-full" />
                      </label>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => changeDesign({ stickers: design.stickers.map((item) => item.id === selectedSticker.id ? { ...item, x: 0 } : item) })} className="rounded-lg border px-3 py-1.5 text-xs font-bold">Kiri</button>
                        <button type="button" onClick={() => changeDesign({ stickers: design.stickers.map((item) => item.id === selectedSticker.id ? { ...item, x: 1 } : item) })} className="rounded-lg border px-3 py-1.5 text-xs font-bold">Kanan</button>
                        <button type="button" onClick={() => { changeDesign({ stickers: design.stickers.filter((item) => item.id !== selectedSticker.id) }); setSelectedStickerId(null); }} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-700">Hapus</button>
                      </div>
                    </div>
                  )}
                  <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">Stiker hanya dapat digeser di panel bawah. Jangan unggah foto nasabah atau dokumen pribadi.</p>
                </div>
                <div className="rounded-2xl bg-slate-100 p-4 sm:p-6">
                  <div className="relative mx-auto w-full max-w-[360px] overflow-hidden rounded-lg bg-white shadow-xl" style={{ aspectRatio: "1064 / 1478" }}>
                    {preview ? <img src={preview} alt="Pratinjau desain QRIS" className="h-full w-full object-contain" /> : <div className="grid h-full place-items-center text-sm text-slate-500">{busy ? "Menyiapkan pratinjau…" : "Pratinjau belum tersedia"}</div>}
                    <div
                      role="region"
                      aria-label="Area penempatan stiker pada panel bawah"
                      className="absolute z-10 rounded border border-dashed border-blue-500/40 hover:bg-blue-100/20"
                      style={design.template === "BATIK_NUSANTARA" ? { left: "16.7%", top: "89.2%", width: "66.5%", height: "5.9%" } : { left: "10.9%", top: "89.6%", width: "78.2%", height: "6.3%" }}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        const value = event.dataTransfer.getData("text/sticker");
                        const position = stickerPosition(event.clientX, event.clientY, event.currentTarget);
                        if (qrisStickers.some((item) => item.id === value)) addSticker(value as QrisDesign["stickers"][number]["kind"], "", position);
                        else if (event.dataTransfer.files.length) selectStickerFile(event.dataTransfer.files[0], position);
                      }}
                    >
                      {design.stickers.map((item, index) => (
                        <button key={item.id} type="button" aria-label={`Geser stiker ${index + 1}`} title={`Geser stiker ${index + 1}`}
                          className={`absolute z-20 touch-none cursor-grab rounded border-2 bg-blue-200/20 shadow-sm active:cursor-grabbing ${selectedSticker?.id === item.id ? "border-blue-600" : "border-amber-500"}`}
                          style={{
                            left: `${(8 + (bottomZone.width - 16 - item.size) * item.x) / bottomZone.width * 100}%`,
                            top: `${(8 + (bottomZone.height - 16 - item.size) * item.y) / bottomZone.height * 100}%`,
                            width: `${item.size / bottomZone.width * 100}%`,
                            height: `${item.size / bottomZone.height * 100}%`,
                          }}
                          onPointerDown={(event) => { setSelectedStickerId(item.id); event.currentTarget.setPointerCapture(event.pointerId); event.preventDefault(); }}
                          onPointerMove={(event) => {
                            if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
                            const target = event.currentTarget.parentElement;
                            if (!target) return;
                            const position = stickerPosition(event.clientX, event.clientY, target, item.size);
                            setDesign((current) => ({ ...current, stickers: current.stickers.map((entry) => entry.id === item.id ? { ...entry, ...position } : entry) }));
                          }}
                          onPointerUp={(event) => event.currentTarget.releasePointerCapture(event.pointerId)}
                          onKeyDown={(event) => {
                            const delta = event.shiftKey ? 0.1 : 0.03;
                            if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
                            event.preventDefault();
                            setDesign((current) => ({ ...current, stickers: current.stickers.map((entry) => entry.id === item.id ? {
                              ...entry,
                              x: Math.max(0, Math.min(1, entry.x + (event.key === "ArrowLeft" ? -delta : event.key === "ArrowRight" ? delta : 0))),
                              y: Math.max(0, Math.min(1, entry.y + (event.key === "ArrowUp" ? -delta : event.key === "ArrowDown" ? delta : 0))),
                            } : entry) }));
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  <p className="mt-3 text-center text-xs text-slate-600">Pratinjau mengikuti hasil PNG. Area tengah dan logo tetap terkunci.</p>
                </div>
              </div>
            )}
            {!isSuppliedQrisTemplate(design.template) && (
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
            )}
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
            {isSuppliedQrisTemplate(design.template) && (
              <Button variant="outline" disabled={busy} onClick={() => void render("png")}>
                Perbarui pratinjau
              </Button>
            )}
            {!isSuppliedQrisTemplate(design.template) && <div className="flex flex-wrap items-center gap-2">
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
            </div>}
            <div className="flex flex-wrap gap-2">
              {(isSuppliedQrisTemplate(design.template) ? ["png"] as const : ["png", "jpg", "pdf"] as const).map((format) => (
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
              Bingkai/desain QRIS gratis. Periksa hasil scan dengan aplikasi
              resmi sebelum dipasang atau dibagikan.
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
