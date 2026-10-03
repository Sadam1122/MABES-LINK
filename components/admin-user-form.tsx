"use client";
import { Role } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { SubmitButton } from "@/components/submit-button";
import { clientApi } from "@/lib/client-api";

export function AdminUserForm({
  branches,
}: {
  branches: { id: string; code: string; name: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      await clientApi("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          password: form.get("password"),
          role: form.get("role"),
          branchId: form.get("branchId") || null,
        }),
      });
      event.currentTarget.reset();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal membuat akun.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="card space-y-4 p-5">
      <div>
        <h2 className="font-black">Buat akun</h2>
        <p className="text-sm text-slate-500">
          Akun operasional wajib terikat cabang.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Nama</label>
          <input className="field" name="name" minLength={2} required />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="field" name="email" type="email" required />
        </div>
        <div>
          <label className="label">Role</label>
          <select className="field" name="role" required>
            {Object.values(Role).map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Cabang</label>
          <select className="field" name="branchId">
            <option value="">Tanpa cabang (khusus admin)</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.code} · {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="label">Kata sandi awal</label>
        <input
          className="field"
          name="password"
          type="password"
          minLength={12}
          required
        />
      </div>
      {error ? (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>
      ) : null}
      <SubmitButton busy={busy}>Buat akun</SubmitButton>
    </form>
  );
}
