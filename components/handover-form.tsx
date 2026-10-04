"use client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { SubmitButton } from "@/components/submit-button";
import { clientApi } from "@/lib/client-api";

export function HandoverForm({
  prospectId,
  receivers,
}: {
  prospectId: string;
  receivers: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      await clientApi("/api/handovers", {
        method: "POST",
        body: JSON.stringify({
          type: "SINGLE",
          title: form.get("title"),
          receiverId: form.get("receiverId"),
          prospectIds: [prospectId],
        }),
      });
      router.push("/handovers");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal membuat handover.");
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="card space-y-4 p-5">
      <div>
        <h2 className="font-black">Siapkan handover</h2>
        <p className="text-sm text-slate-500">
          Data prospek otomatis dibawa; tidak perlu input ulang.
        </p>
      </div>
      <div>
        <label className="label">Judul handover</label>
        <input
          name="title"
          className="field"
          minLength={3}
          required
          placeholder="Contoh: Onboarding rekening operasional"
        />
      </div>
      <div>
        <label className="label">CS penerima</label>
        <select name="receiverId" className="field" required>
          <option value="">Pilih CS</option>
          {receivers.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </div>
      {error ? (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>
      ) : null}
      <SubmitButton busy={busy}>Buat draf handover</SubmitButton>
    </form>
  );
}
