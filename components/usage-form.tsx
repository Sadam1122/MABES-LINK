"use client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { SubmitButton } from "@/components/submit-button";
import { useFeedback } from "@/components/ui/feedback";
import { clientApi } from "@/lib/client-api";
import { jakartaLocalToIso } from "@/lib/format";

export function UsageForm({ prospectId }: { prospectId: string }) {
  const router = useRouter();
  const { confirm, toast } = useFeedback();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!(await confirm({ title: "Verifikasi penggunaan?", description: "Pastikan layanan benar-benar telah digunakan dan referensi bukti internal sudah benar.", confirmLabel: "Verifikasi" }))) return;
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      await clientApi("/api/usage-verifications", {
        method: "POST",
        body: JSON.stringify({
          prospectId,
          status: "VERIFIED",
          usedAt: jakartaLocalToIso(String(form.get("usedAt"))),
          evidenceReference: form.get("evidenceReference"),
          note: form.get("note") || null,
        }),
      });
      event.currentTarget.reset();
      router.refresh();
      toast("Penggunaan berhasil diverifikasi.", "success");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Gagal memverifikasi.";
      setError(message);
      toast(message, "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="label">Tanggal penggunaan (WIB)</label>
        <input type="datetime-local" name="usedAt" className="field" required />
      </div>
      <div>
        <label className="label">Referensi bukti</label>
        <input
          name="evidenceReference"
          className="field"
          minLength={4}
          required
          placeholder="Contoh: referensi verifikasi internal (tanpa unggah dokumen)"
        />
      </div>
      <div>
        <label className="label">
          Catatan <span className="font-normal text-slate-400">(opsional)</span>
        </label>
        <textarea name="note" className="textarea min-h-20" maxLength={500} />
      </div>
      {error ? (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>
      ) : null}
      <SubmitButton busy={busy}>Verifikasi penggunaan</SubmitButton>
    </form>
  );
}
