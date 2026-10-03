"use client";

import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { clientApi } from "@/lib/client-api";
import { jakartaLocalToIso } from "@/lib/format";

export function ServiceCaseForm({
  prospects,
  officers,
}: {
  prospects: {
    id: string;
    internalCode: string;
    cakraReference: string | null;
    businessAlias: string;
  }[];
  officers: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await clientApi("/api/service-cases", {
        method: "POST",
        body: JSON.stringify({
          prospectId: form.get("prospectId"),
          origin: form.get("origin"),
          title: form.get("title"),
          description: form.get("description"),
          picId: form.get("picId"),
          nextAction: form.get("nextAction"),
          dueAt: jakartaLocalToIso(String(form.get("dueAt"))),
          appointmentStatus: "NEEDS_SCHEDULING",
        }),
      });
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Pekerjaan gagal disimpan.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={!prospects.length}>
        <Plus size={16} />
        Buat pekerjaan
      </Button>
      {open && (
        <div className="fixed inset-0 z-[1400] grid place-items-end bg-slate-950/40 sm:place-items-center">
          <form
            onSubmit={submit}
            className="max-h-[92vh] w-full max-w-xl space-y-4 overflow-auto rounded-t-3xl bg-white p-6 sm:rounded-3xl"
          >
            <div className="flex justify-between">
              <div>
                <h2 className="text-xl font-black">Pekerjaan baru</h2>
                <p className="text-sm text-slate-500">
                  Gunakan referensi existing; data identitas tidak diminta
                  ulang.
                </p>
              </div>
              <button type="button" onClick={() => setOpen(false)}>
                <X />
              </button>
            </div>
            <label className="label">
              Referensi existing
              <select name="prospectId" className="field mt-1" required>
                <option value="">Pilih referensi</option>
                {prospects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.internalCode}
                    {p.cakraReference
                      ? ` · CAKRA ${p.cakraReference}`
                      : ""} · {p.businessAlias}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="label">
                Asal layanan
                <select name="origin" className="field mt-1">
                  <option value="IN_BRANCH">In-branch</option>
                  <option value="OUT_BRANCH">Out-branch</option>
                </select>
              </label>
              <label className="label">
                PIC
                <select name="picId" className="field mt-1" required>
                  <option value="">Pilih PIC</option>
                  {officers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="label">
              Judul
              <input
                name="title"
                className="field mt-1"
                required
                minLength={3}
              />
            </label>
            <label className="label">
              Ringkasan kebutuhan layanan
              <textarea
                name="description"
                className="textarea mt-1"
                required
                minLength={5}
              />
            </label>
            <label className="label">
              Next action
              <input
                name="nextAction"
                className="field mt-1"
                required
                minLength={3}
              />
            </label>
            <label className="label">
              Waktu tindak lanjut
              <input
                name="dueAt"
                type="datetime-local"
                className="field mt-1"
                required
              />
            </label>
            {error && (
              <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Batal
              </Button>
              <Button disabled={busy}>
                {busy ? "Menyimpan…" : "Simpan pekerjaan"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
