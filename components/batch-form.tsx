"use client";
import { BatchType } from "@prisma/client";
import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { clientApi } from "@/lib/client-api";

export function BatchForm({
  prospects,
  receivers,
}: {
  prospects: { id: string; internalCode: string; businessAlias: string }[];
  receivers: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const prospectIds = form.getAll("prospectIds").map(String);
    if (!prospectIds.length) {
      setError("Pilih minimal satu prospek.");
      return;
    }
    if (!confirm(`Buat batch payroll dengan ${prospectIds.length} prospek?`))
      return;
    setBusy(true);
    try {
      await clientApi("/api/handovers", {
        method: "POST",
        body: JSON.stringify({
          type: BatchType.PAYROLL,
          title: form.get("title"),
          receiverId: form.get("receiverId"),
          prospectIds,
        }),
      });
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal membuat batch.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus size={16} />
        Batch payroll
      </Button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-7">
            <div className="mb-5 flex justify-between">
              <div>
                <h2 className="text-xl font-black">Batch payroll</h2>
                <p className="text-sm text-slate-500">
                  Pilih prospek siap handover. Subkasus dicatat hanya bila ada
                  kendala nyata.
                </p>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Tutup">
                <X />
              </button>
            </div>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="label">Judul batch</label>
                <input name="title" className="field" required minLength={3} />
              </div>
              <div>
                <label className="label">CS penerima</label>
                <select name="receiverId" className="field" required>
                  <option value="">Pilih CS</option>
                  {receivers.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
              <fieldset>
                <legend className="label">Prospek payroll</legend>
                <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border p-2">
                  {prospects.length ? (
                    prospects.map((p) => (
                      <label
                        key={p.id}
                        className="flex cursor-pointer items-center gap-3 rounded-lg p-2 hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          name="prospectIds"
                          value={p.id}
                          className="size-4"
                        />
                        <span>
                          <b className="block text-sm">{p.businessAlias}</b>
                          <span className="font-mono text-xs text-slate-400">
                            {p.internalCode}
                          </span>
                        </span>
                      </label>
                    ))
                  ) : (
                    <p className="p-3 text-sm text-slate-500">
                      Tidak ada prospek yang siap diserahterimakan.
                    </p>
                  )}
                </div>
              </fieldset>
              {error ? (
                <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </p>
              ) : null}
              <SubmitButton busy={busy} disabled={!prospects.length}>
                Buat draf batch
              </SubmitButton>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
