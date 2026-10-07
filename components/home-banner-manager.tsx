"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { ImagePlus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useFeedback } from "@/components/ui/feedback";
import type { HomeBannerView } from "@/components/home-banner-carousel";

type ManagedBanner = HomeBannerView & { canDelete: boolean };

export function HomeBannerManager({ initialBanners }: { initialBanners: ManagedBanner[] }) {
  const router = useRouter();
  const { confirm, toast } = useFeedback();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    return () => { if (preview) URL.revokeObjectURL(preview); };
  }, [preview]);

  function chooseFile(next: File | null) {
    setFile(next);
    setPreview(next ? URL.createObjectURL(next) : null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) { toast("Pilih gambar banner terlebih dahulu.", "error"); return; }
    if (!(await confirm({ title: "Tampilkan banner di beranda publik?", description: "Gambar akan langsung terlihat oleh pengunjung. Pastikan tidak ada data nasabah, dokumen, atau materi yang belum diizinkan.", confirmLabel: "Unggah dan tampilkan" }))) return;
    setBusy(true);
    try {
      const body = new FormData();
      body.set("title", title);
      body.set("description", description);
      body.set("file", file);
      const response = await fetch("/api/home-banners", { method: "POST", body });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "Banner gagal diunggah.");
      toast("Banner tampil di beranda.", "success");
      setTitle(""); setDescription(""); chooseFile(null); setOpen(false);
      router.refresh();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Banner gagal diunggah.", "error");
    } finally { setBusy(false); }
  }

  async function remove(item: ManagedBanner) {
    if (!(await confirm({ title: `Hapus banner “${item.title}”?`, description: "Banner akan hilang dari beranda publik. Perubahan ini dicatat dalam audit.", confirmLabel: "Ya, hapus", tone: "danger" }))) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/home-banners/${item.id}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "Banner gagal dihapus.");
      toast("Banner dihapus.", "success");
      router.refresh();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Banner gagal dihapus.", "error");
    } finally { setBusy(false); }
  }

  return <section className="card mt-6 p-5 sm:p-6" aria-label="Kelola banner beranda">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-black">Banner beranda</h2>
      <p className="mt-1 text-sm text-slate-600">Petugas cabang dapat mengunggah informasi visual yang sudah boleh dipublikasikan.</p></div>
      <Button variant="outline" onClick={() => setOpen((value) => !value)}><ImagePlus size={18} /> {open ? "Tutup form" : "Tambah banner"}</Button></div>
    <p className="mt-3 rounded-xl bg-blue-50 p-3 text-xs leading-5 text-blue-900">Ukuran disarankan <b>1600 × 600 px</b> (landscape). Minimal 800 × 280 px, rasio 1,6:1–4:1, JPEG/PNG/WebP, maksimal 5 MB. Maksimal 6 banner aktif. Gambar diproses ulang dan metadata foto dihapus. Jangan unggah identitas nasabah atau materi tanpa izin.</p>
    {open && <form onSubmit={(event) => void submit(event)} className="mt-4 grid gap-3 rounded-2xl border border-blue-100 bg-slate-50 p-4 sm:grid-cols-2">
      <label className="label">Judul banner<input className="field mt-1" value={title} onChange={(event) => setTitle(event.target.value)} minLength={3} maxLength={120} required placeholder="Contoh: Desain QRIS untuk usaha Anda" /></label>
      <label className="label">Deskripsi singkat (opsional)<input className="field mt-1" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={240} placeholder="Pesan utama banner" /></label>
      <label className="label sm:col-span-2">Gambar banner<input className="field mt-1 block pt-2" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => chooseFile(event.target.files?.[0] ?? null)} required /></label>
      {preview && <div className="sm:col-span-2"><Image src={preview} alt="Pratinjau banner" width={640} height={240} unoptimized className="h-auto max-h-60 w-full rounded-xl object-cover" /></div>}
      <div className="sm:col-span-2"><Button type="submit" disabled={busy}>{busy ? "Mengunggah…" : "Unggah dan tampilkan"}</Button></div>
    </form>}
    {initialBanners.length > 0 && <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {initialBanners.map((item) => <div key={item.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <Image src={`/api/home-banners/${item.id}/image`} alt={item.title} width={item.width} height={item.height} unoptimized className="aspect-[16/6] w-full object-cover" />
        <div className="flex items-start justify-between gap-2 p-3"><div><p className="text-sm font-bold">{item.title}</p><p className="mt-1 text-xs text-slate-500">{item.description || "Tanpa deskripsi"}</p></div>
          {item.canDelete && <button type="button" aria-label={`Hapus banner ${item.title}`} disabled={busy} onClick={() => void remove(item)} className="rounded-lg p-2 text-red-600 hover:bg-red-50"><Trash2 size={17} /></button>}
        </div>
      </div>)}
    </div>}
  </section>;
}
