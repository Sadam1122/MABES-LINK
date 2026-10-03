"use client";
import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { clientApi } from "@/lib/client-api";

export function ProspectForm({
  assignees,
}: {
  assignees: { id: string; name: string }[];
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
          productNeeds: String(form.get("productNeeds") || "")
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
        }),
      });
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {
        <Button onClick={() => setOpen(true)}>
          <Plus size={16} />
          Tambah prospek
        </Button>
      }
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-7">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h2 className="text-xl font-black">Prospek baru</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Gunakan alias usaha dan data samaran.
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Tutup"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="label">Nama/alias usaha</label>
                <input
                  name="businessAlias"
                  className="field"
                  minLength={2}
                  maxLength={120}
                  required
                  placeholder="Contoh: Payroll Nusantara"
                />
              </div>
              <div>
                <label className="label">
                  Referensi CAKRA{" "}
                  <span className="font-normal text-slate-400">(opsional)</span>
                </label>
                <input
                  name="cakraReference"
                  className="field"
                  maxLength={80}
                  placeholder="Referensi saja, tanpa koneksi nyata"
                />
              </div>
              <div>
                <label className="label">Kebutuhan</label>
                <textarea
                  name="need"
                  className="textarea"
                  minLength={5}
                  maxLength={500}
                  required
                  placeholder="Ringkas kebutuhan yang telah disampaikan"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">PIC pihak usaha</label>
                  <input
                    name="contactPic"
                    className="field"
                    minLength={2}
                    maxLength={100}
                    required
                    placeholder="Nama samaran"
                  />
                </div>
                <div>
                  <label className="label">PIC petugas</label>
                  <select name="assignedToId" className="field" required>
                    <option value="">Pilih petugas</option>
                    {assignees.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Area/blok</label>
                  <input
                    name="areaBlock"
                    className="field"
                    maxLength={100}
                    placeholder="Contoh: Blok A"
                  />
                </div>
                <div>
                  <label className="label">Sektor usaha</label>
                  <input
                    name="businessSector"
                    className="field"
                    maxLength={100}
                    placeholder="Contoh: perdagangan"
                  />
                </div>
              </div>
              <div>
                <label className="label">Alamat minimum yang diizinkan</label>
                <input
                  name="addressHint"
                  className="field"
                  maxLength={220}
                  placeholder="Area/patokan umum, tanpa data rahasia"
                />
              </div>
              <div>
                <label className="label">Kebutuhan produk</label>
                <input
                  name="productNeeds"
                  className="field"
                  placeholder="Payroll, tabungan, Kopra (pisahkan koma)"
                />
              </div>
              {error ? (
                <p
                  className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
                  role="alert"
                >
                  {error}
                </p>
              ) : null}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  Batal
                </Button>
                <SubmitButton busy={busy}>Simpan prospek</SubmitButton>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
