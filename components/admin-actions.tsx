"use client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { useFeedback } from "@/components/ui/feedback";
import { clientApi } from "@/lib/client-api";

export function UserStatusButton({
  id,
  active,
}: {
  id: string;
  active: boolean;
}) {
  const router = useRouter();
  const { confirm, toast } = useFeedback();
  const [busy, setBusy] = useState(false);
  async function run() {
    if (!(await confirm({ title: active ? "Nonaktifkan akun?" : "Aktifkan akun?", description: active ? "Semua sesi aktif akun ini akan dicabut." : "Akun akan dapat masuk kembali.", confirmLabel: active ? "Nonaktifkan" : "Aktifkan", tone: active ? "danger" : "default" }))) return;
    setBusy(true);
    try {
      await clientApi(`/api/admin/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !active }),
      });
      router.refresh();
      toast("Status akun berhasil diperbarui.", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Gagal memperbarui akun.", "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button size="sm" variant="outline" onClick={run} disabled={busy}>
      {busy ? "Menyimpan…" : active ? "Nonaktifkan" : "Aktifkan"}
    </Button>
  );
}

export function EmailStatusButton({
  id,
  enabled,
}: {
  id: string;
  enabled: boolean;
}) {
  const router = useRouter();
  const { toast } = useFeedback();
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    try {
      await clientApi(`/api/admin/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ emailNotificationsEnabled: !enabled }),
      });
      router.refresh();
      toast("Izin email berhasil diperbarui.", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Gagal memperbarui izin email.", "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button size="sm" variant="outline" onClick={run} disabled={busy}>
      {busy ? "Menyimpan…" : enabled ? "Matikan email" : "Izinkan email"}
    </Button>
  );
}

export function UserAccessForm({
  id,
  role,
  branchId,
  branches,
}: {
  id: string;
  role: "ADMIN" | "CS" | "SUPERVISOR" | "OUT_BRANCH";
  branchId: string | null;
  branches: { id: string; code: string; name: string }[];
}) {
  const router = useRouter();
  const { toast } = useFeedback();
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      await clientApi(`/api/admin/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          role: form.get("role"),
          branchId: form.get("branchId") || null,
        }),
      });
      router.refresh();
      toast("Role dan cabang berhasil diperbarui.", "success");
    } catch (reason) {
      toast(reason instanceof Error ? reason.message : "Akses pengguna gagal diperbarui.", "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="mt-3 grid gap-2 sm:grid-cols-[minmax(130px,.7fr)_minmax(180px,1fr)_auto]">
      <select name="role" className="field" defaultValue={role} aria-label="Role pengguna">
        <option value="ADMIN">ADMIN</option>
        <option value="CS">CS</option>
        <option value="SUPERVISOR">SUPERVISOR</option>
        <option value="OUT_BRANCH">OUTBRANCH</option>
      </select>
      <select name="branchId" className="field" defaultValue={branchId ?? ""} aria-label="Cabang pengguna">
        <option value="">Tanpa cabang (khusus ADMIN)</option>
        {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.code} · {branch.name}</option>)}
      </select>
      <Button type="submit" size="sm" variant="outline" disabled={busy}>{busy ? "Menyimpan…" : "Simpan akses"}</Button>
    </form>
  );
}

export function PilotConfigForm({
  days,
  startedAt,
}: {
  days: number;
  startedAt: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      await clientApi("/api/admin/config", {
        method: "PATCH",
        body: JSON.stringify({
          days: Number(form.get("days")),
          startedAt: form.get("startedAt"),
        }),
      });
      setMessage("Konfigurasi tersimpan.");
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="card space-y-4 p-5">
      <div>
        <h2 className="font-black">Periode operasional</h2>
        <p className="text-sm text-slate-500">
          Atur periode evaluasi internal.
        </p>
      </div>
      <div>
        <label className="label">Durasi (hari)</label>
        <input
          className="field"
          name="days"
          type="number"
          min="1"
          max="90"
          defaultValue={days}
          required
        />
      </div>
      <div>
        <label className="label">Tanggal mulai</label>
        <input
          className="field"
          name="startedAt"
          type="date"
          defaultValue={startedAt}
          required
        />
      </div>
      {message ? <p className="text-sm text-slate-600">{message}</p> : null}
      <SubmitButton busy={busy}>Simpan konfigurasi</SubmitButton>
    </form>
  );
}

export function NotificationConfigForm({
  config,
}: {
  config: {
    reminderMinutesBefore: number;
    digestTime: string;
    quietStart: string;
    quietEnd: string;
  };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      await clientApi("/api/admin/notification-config", {
        method: "PATCH",
        body: JSON.stringify({
          reminderMinutesBefore: Number(form.get("reminderMinutesBefore")),
          digestTime: form.get("digestTime"),
          quietStart: form.get("quietStart"),
          quietEnd: form.get("quietEnd"),
          timezone: "Asia/Jakarta",
        }),
      });
      setMessage("Jadwal reminder tersimpan.");
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="card space-y-4 p-5">
      <div>
        <h2 className="font-black">Jadwal reminder</h2>
        <p className="text-sm text-slate-500">
          Jadwal lokal aplikasi, bukan penetapan SOP bank. Zona waktu
          Asia/Jakarta. Isian menit di bawah hanya untuk follow-up umum;
          janji terkonfirmasi memakai 24 jam dan 15 menit/1 jam sesuai jarak.
        </p>
      </div>
      <label className="label">
        Follow-up umum: menit sebelum jatuh tempo
        <input
          className="field mt-1"
          name="reminderMinutesBefore"
          type="number"
          min="0"
          max="1440"
          defaultValue={config.reminderMinutesBefore}
        />
      </label>
      <label className="label">
        Ringkasan overdue
        <input
          className="field mt-1"
          name="digestTime"
          type="time"
          defaultValue={config.digestTime}
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="label">
          Quiet hours mulai
          <input
            className="field mt-1"
            name="quietStart"
            type="time"
            defaultValue={config.quietStart}
          />
        </label>
        <label className="label">
          Quiet hours selesai
          <input
            className="field mt-1"
            name="quietEnd"
            type="time"
            defaultValue={config.quietEnd}
          />
        </label>
      </div>
      {message && <p className="text-sm text-slate-600">{message}</p>}
      <SubmitButton busy={busy}>Simpan jadwal</SubmitButton>
    </form>
  );
}
