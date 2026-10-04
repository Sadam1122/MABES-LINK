"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose } from "@/components/ui/dialog";
import { useFeedback } from "@/components/ui/feedback";
import { clientApi } from "@/lib/client-api";

export function ProspectForm({ assignees }: { assignees: { id: string; name: string }[] }) {
  const router = useRouter();
  const { toast } = useFeedback();
  const [open, setOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await clientApi("/api/prospects", {
        method: "POST",
        body: JSON.stringify({
          businessAlias: form.get("businessAlias"),
          cakraReference: form.get("cakraReference") || null,
          need: form.get("need"),
          contactPic: form.get("contactPic"),
          assignedToId: form.get("assignedToId") || undefined,
          areaBlock: form.get("areaBlock") || null,
          businessSector: form.get("businessSector") || null,
          addressHint: form.get("addressHint") || null,
          productNeeds: String(form.get("productNeeds") || "").split(",").map((item) => item.trim()).filter(Boolean),
        }),
      });
      setDirty(false);
      setOpen(false);
      toast("Prospek berhasil disimpan.", "success");
      router.refresh();
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Gagal menyimpan prospek.";
      setError(message);
      toast(message, "error");
    } finally {
      setBusy(false);
    }
  }

  return <>
    <Button onClick={() => { setError(""); setDirty(false); setOpen(true); }}><Plus size={16} />Tambah prospek</Button>
    <Dialog open={open} onClose={() => setOpen(false)} title="Prospek baru" description="Gunakan referensi yang diizinkan dan informasi minimum." dirty={dirty} busy={busy} footer={<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><DialogClose variant="outline" disabled={busy}>Batal</DialogClose><SubmitButton busy={busy} form="prospect-form">Simpan prospek</SubmitButton></div>}>
      <form id="prospect-form" onSubmit={submit} onChange={() => setDirty(true)} className="space-y-4">
        <label className="label">Nama/alias usaha<input data-autofocus name="businessAlias" className="field mt-1" minLength={2} maxLength={120} required /></label>
        <label className="label">Referensi CAKRA <span className="font-normal text-slate-400">(opsional)</span><input name="cakraReference" className="field mt-1" maxLength={80} /></label>
        <label className="label">Kebutuhan<textarea name="need" className="textarea mt-1" minLength={5} maxLength={500} required /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="label">PIC pihak usaha<input name="contactPic" className="field mt-1" minLength={2} maxLength={100} required /></label>
          <label className="label">PIC petugas<select name="assignedToId" className="field mt-1" required><option value="">Pilih petugas</option>{assignees.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="label">Area/blok<input name="areaBlock" className="field mt-1" maxLength={100} /></label>
          <label className="label">Sektor usaha<input name="businessSector" className="field mt-1" maxLength={100} /></label>
        </div>
        <label className="label">Alamat minimum yang diizinkan<input name="addressHint" className="field mt-1" maxLength={220} /></label>
        <label className="label">Kebutuhan produk<input name="productNeeds" className="field mt-1" placeholder="Payroll, tabungan, Kopra (pisahkan koma)" /></label>
        {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3" role="alert"><p className="text-sm text-red-700">{error}</p><Button type="submit" variant="outline" className="mt-3" disabled={busy}>Coba lagi</Button></div> : null}
      </form>
    </Dialog>
  </>;
}
