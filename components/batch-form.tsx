"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose } from "@/components/ui/dialog";
import { useFeedback } from "@/components/ui/feedback";
import { clientApi } from "@/lib/client-api";

export function BatchForm({ prospects, receivers }: { prospects: { id: string; internalCode: string; businessAlias: string }[]; receivers: { id: string; name: string }[] }) {
  const router = useRouter();
  const { confirm, toast } = useFeedback();
  const [open, setOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const prospectIds = form.getAll("prospectIds").map(String);
    if (!prospectIds.length) { setError("Pilih minimal satu prospek."); return; }
    if (!(await confirm({ title: "Buat batch payroll?", description: `${prospectIds.length} prospek akan dimasukkan ke batch serah terima.`, confirmLabel: "Buat batch" }))) return;
    setBusy(true);
    setError("");
    try {
      await clientApi("/api/handovers", { method: "POST", body: JSON.stringify({ type: "PAYROLL", title: form.get("title"), receiverId: form.get("receiverId"), prospectIds }) });
      setDirty(false);
      setOpen(false);
      toast("Draf batch payroll berhasil dibuat.", "success");
      router.refresh();
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Gagal membuat batch.";
      setError(message);
      toast(message, "error");
    } finally { setBusy(false); }
  }
  return <>
    <Button onClick={() => { setDirty(false); setError(""); setOpen(true); }}><Plus size={16} />Batch payroll</Button>
    <Dialog open={open} onClose={() => setOpen(false)} title="Batch payroll" description="Pilih prospek siap handover. Subkasus dicatat hanya untuk kendala nyata." dirty={dirty} busy={busy} footer={<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><DialogClose variant="outline" disabled={busy}>Batal</DialogClose><SubmitButton busy={busy} disabled={!prospects.length} form="batch-form">Buat draf batch</SubmitButton></div>}>
      <form id="batch-form" onSubmit={submit} onChange={() => setDirty(true)} className="space-y-4">
        <label className="label">Judul batch<input data-autofocus name="title" className="field mt-1" required minLength={3} /></label>
        <label className="label">CS penerima<select name="receiverId" className="field mt-1" required><option value="">Pilih CS</option>{receivers.map((receiver) => <option key={receiver.id} value={receiver.id}>{receiver.name}</option>)}</select></label>
        <fieldset><legend className="label">Prospek payroll</legend><div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border p-2">{prospects.length ? prospects.map((prospect) => <label key={prospect.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg p-2 hover:bg-slate-50"><input type="checkbox" name="prospectIds" value={prospect.id} className="size-5" /><span><b className="block text-sm">{prospect.businessAlias}</b><span className="font-mono text-xs text-slate-400">{prospect.internalCode}</span></span></label>) : <p className="p-3 text-sm text-slate-500">Tidak ada prospek yang siap diserahterimakan.</p>}</div></fieldset>
        {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p> : null}
      </form>
    </Dialog>
  </>;
}
