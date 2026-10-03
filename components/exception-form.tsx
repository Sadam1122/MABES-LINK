"use client";
import { ExceptionCategory, ExceptionStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { clientApi } from "@/lib/client-api";

export function ExceptionForm({
  batchId,
  prospects,
}: {
  batchId: string;
  prospects: { id: string; businessAlias: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !confirm(
        "Catat subkasus ini sebagai kendala nyata yang memerlukan penanganan?",
      )
    )
      return;
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      await clientApi(`/api/handovers/${batchId}/exceptions`, {
        method: "POST",
        body: JSON.stringify({
          prospectId: form.get("prospectId") || null,
          category: form.get("category"),
          title: form.get("title"),
          detail: form.get("detail"),
        }),
      });
      event.currentTarget.reset();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mencatat kendala.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="card space-y-4 border-amber-200 p-5">
      <div>
        <h2 className="font-black">Catat kendala nyata</h2>
        <p className="text-sm text-slate-500">
          Bukan checklist rutin. Gunakan hanya bila perlu penanganan khusus.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Kategori</label>
          <select name="category" className="field" required>
            <option value={ExceptionCategory.OLD_PHONE_OTP}>
              OTP nomor lama
            </option>
            <option value={ExceptionCategory.FACE_RECOGNITION}>
              Face recognition
            </option>
            <option value={ExceptionCategory.BLOCK_OR_ACTIVATION}>
              Blokir / aktivasi
            </option>
            <option value={ExceptionCategory.OTHER_REAL_BLOCKER}>
              Kendala nyata lainnya
            </option>
          </select>
        </div>
        <div>
          <label className="label">Prospek terkait</label>
          <select name="prospectId" className="field">
            <option value="">Seluruh batch</option>
            {prospects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.businessAlias}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="label">Judul</label>
        <input name="title" className="field" minLength={5} required />
      </div>
      <div>
        <label className="label">Detail penanganan yang diperlukan</label>
        <textarea name="detail" className="textarea" minLength={10} required />
      </div>
      {error ? (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>
      ) : null}
      <SubmitButton busy={busy}>Catat subkasus</SubmitButton>
    </form>
  );
}

export function ResolveException({
  batchId,
  id,
  version,
}: {
  batchId: string;
  id: string;
  version: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function run() {
    if (!confirm("Konfirmasi kendala ini telah selesai ditangani?")) return;
    setBusy(true);
    try {
      await clientApi(`/api/handovers/${batchId}/exceptions/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ version, status: ExceptionStatus.RESOLVED }),
      });
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Gagal memperbarui.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button size="sm" variant="outline" onClick={run} disabled={busy}>
      {busy ? "Menyimpan…" : "Tandai selesai"}
    </Button>
  );
}
