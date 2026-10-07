"use client";

import { Download, FileSpreadsheet, UploadCloud } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useFeedback } from "@/components/ui/feedback";

type Preview = {
  summary: { total: number; create: number; update: number; invalid: number };
  errors: { row: number; message: string }[];
  rows: { row: number; action: string; businessAlias: string; latitude: number | null; longitude: number | null; outsideReference: boolean }[];
};

export function MappingExcelTools() {
  const { toast, confirm } = useFeedback();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function request(mode: "preview" | "commit") {
    if (!file) { setError("Pilih file XLSX terlebih dahulu."); return; }
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch(`/api/mapping/excel?mode=${mode}`, { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || "Impor gagal diproses.");
      if (mode === "preview") setPreview(result.data as Preview);
      else {
        toast(`${result.data.create} lokasi ditambah, ${result.data.update} diperbarui.`, "success");
        setOpen(false);
        window.location.reload();
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Impor gagal diproses.";
      setError(message);
      toast(message, "error");
    } finally { setBusy(false); }
  }

  async function commit() {
    if (!preview || preview.summary.invalid || !preview.summary.total) return;
    if (!(await confirm({ title: "Simpan hasil impor?", description:
      `${preview.summary.create} lokasi baru dan ${preview.summary.update} lokasi lama akan disimpan. Impor tidak memverifikasi penggunaan produk.`,
      confirmLabel: "Simpan lokasi" }))) return;
    await request("commit");
  }

  return <>
    <div className="flex flex-wrap gap-2">
      <a href="/api/mapping/excel?mode=template" download className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"><FileSpreadsheet size={17} className="text-emerald-700" /> Template Excel</a>
      <a href="/api/mapping/excel?mode=export" download className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Download size={17} className="text-emerald-700" /> Ekspor Excel</a>
      <Button variant="outline" onClick={() => setOpen(true)}><UploadCloud size={17} className="mr-2 text-emerald-700" /> Impor Excel</Button>
    </div>
    <Dialog open={open} onClose={() => { setOpen(false); setFile(null); setPreview(null); setError(""); }} title="Impor lokasi dari Excel" description="Unduh template atau ekspor data saat ini. Periksa baris sebelum menyimpan; status penggunaan tidak berubah." className="max-w-2xl" busy={busy}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <a href="/api/mapping/excel?mode=template" download className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-sm font-bold text-emerald-800 hover:bg-emerald-100"><FileSpreadsheet size={17} /> Unduh template</a>
          <a href="/api/mapping/excel?mode=export" download className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-700 hover:bg-slate-50"><Download size={17} /> Ekspor data saat ini</a>
        </div>
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-3 text-sm text-slate-700">
          <p className="font-bold">Hijau: wajib · biru: opsional · kuning: kondisional.</p>
          <p>Untuk lokasi baru, hanya nama usaha yang selalu wajib. Latitude dan longitude boleh sama-sama kosong; jika diisi, wajib berpasangan. Tanpa koordinat, lokasi masuk daftar tetapi belum punya pin peta. Contoh data samaran dan pilihan ikon ada di sheet terpisah, tidak ikut diimpor.</p>
          <p className="mt-2">Kode internal + versi diperlukan untuk memperbarui. Kolom opsional kosong mempertahankan nilai lama; PIC existing tidak diubah lewat Excel. Jika PIC lokasi baru kosong, akun Anda dipakai bila satu cabang. ADMIN lintas cabang perlu kode cabang dan PIC.</p>
        </div>
        <label className="block text-sm font-semibold text-slate-700">Pilih XLSX (maks. 1,5 MB / 250 baris)
          <input className="field mt-2" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setPreview(null); setError(""); }} />
        </label>
        <Button disabled={!file || busy} onClick={() => void request("preview")}>{busy ? "Memeriksa…" : "Periksa data"}</Button>
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
        {preview && <>
          <div className="grid grid-cols-3 gap-2 text-center text-sm"><div className="rounded-xl bg-emerald-50 p-3"><strong className="block text-lg">{preview.summary.create}</strong>Tambah</div><div className="rounded-xl bg-blue-50 p-3"><strong className="block text-lg">{preview.summary.update}</strong>Perbarui</div><div className="rounded-xl bg-amber-50 p-3"><strong className="block text-lg">{preview.summary.invalid}</strong>Perlu diperbaiki</div></div>
          {preview.errors.length > 0 && <div className="max-h-40 overflow-auto rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm"><p className="font-bold">Perbaiki file lalu periksa ulang</p>{preview.errors.map((item, index) => <p key={`${item.row}-${index}`}>Baris {item.row}: {item.message}</p>)}</div>}
          {preview.rows.length > 0 && <div className="max-h-48 overflow-auto rounded-xl border p-3 text-xs"><p className="mb-2 font-bold">Pratinjau {preview.rows.length} baris pertama yang valid</p>{preview.rows.map((item) => <p key={item.row} className="border-t py-1">{item.row}. {item.action} · {item.businessAlias || "Nama lama dipertahankan"} · {item.latitude == null ? item.action === "Tambah" ? "Tanpa pin; koordinat dapat ditambahkan nanti" : "Koordinat lama dipertahankan" : `${item.latitude}, ${item.longitude}`} {item.outsideReference && <span className="font-bold text-amber-700">· Di luar referensi batas Mangga Besar</span>}</p>)}</div>}
          <Button disabled={busy || preview.summary.invalid > 0 || preview.summary.total === 0} onClick={() => void commit()}>Simpan {preview.summary.create + preview.summary.update} lokasi</Button>
        </>}
        <p className="text-xs text-slate-500">Jangan masukkan CIF, nomor rekening/telepon, saldo, dokumen, atau informasi rahasia dalam file. Impor lokasi baru tidak menjadi bukti penggunaan produk.</p>
      </div>
    </Dialog>
  </>;
}
