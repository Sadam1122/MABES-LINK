"use client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { SubmitButton } from "@/components/submit-button";
import { clientApi } from "@/lib/client-api";
import { jakartaLocalToIso } from "@/lib/format";

export function FollowUpForm({
  prospectId,
  assignees,
  defaultAssigneeId,
}: {
  prospectId: string;
  assignees: { id: string; name: string }[];
  defaultAssigneeId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await clientApi("/api/follow-ups", {
        method: "POST",
        body: JSON.stringify({
          prospectId,
          assignedToId: form.get("assignedToId"),
          summary: form.get("summary"),
          nextAction: form.get("nextAction"),
          dueAt: jakartaLocalToIso(String(form.get("dueAt"))),
        }),
      });
      event.currentTarget.reset();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="card space-y-4 p-5">
      <div>
        <h2 className="font-black">Tambah tindak lanjut</h2>
        <p className="text-sm text-slate-500">
          Satu catatan, satu aksi berikutnya, satu tenggat.
        </p>
      </div>
      <div>
        <label className="label">Ringkasan pembicaraan</label>
        <textarea name="summary" className="textarea" minLength={3} required />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Aksi berikutnya</label>
          <input name="nextAction" className="field" minLength={3} required />
        </div>
        <div>
          <label className="label">Jatuh tempo (WIB)</label>
          <input
            name="dueAt"
            className="field"
            type="datetime-local"
            required
          />
        </div>
      </div>
      <div>
        <label className="label">PIC petugas</label>
        <select
          name="assignedToId"
          className="field"
          defaultValue={defaultAssigneeId}
        >
          {assignees.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </div>
      {error ? (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>
      ) : null}
      <SubmitButton busy={busy}>Simpan tindak lanjut</SubmitButton>
    </form>
  );
}
