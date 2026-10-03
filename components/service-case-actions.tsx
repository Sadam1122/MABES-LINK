"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { clientApi } from "@/lib/client-api";
import { isoToJakartaLocalInput, jakartaLocalToIso } from "@/lib/format";

type Action = { label: string; to: string };

export function ServiceCaseActions({
  id,
  version,
  status,
  appointmentStatus,
  dueAt,
  appointmentAt,
  canVerify,
}: {
  id: string;
  version: number;
  status: string;
  appointmentStatus: string;
  dueAt: string;
  appointmentAt: string | null;
  canVerify: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function patch(data: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      await clientApi(`/api/service-cases/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ version, ...data }),
      });
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Perubahan gagal.");
    } finally {
      setBusy(false);
    }
  }

  const transitions: Record<string, Action[]> = {
    ASSIGNED: [{ label: "Terima pekerjaan", to: "ACCEPTED" }],
    ACCEPTED: [{ label: "Mulai proses", to: "IN_PROGRESS" }],
    IN_PROGRESS: [{ label: "Selesai ditangani", to: "HANDLED" }],
    HANDLED: canVerify
      ? [
          { label: "Verifikasi", to: "VERIFIED" },
          { label: "Buka kembali", to: "REOPENED" },
        ]
      : [{ label: "Buka kembali", to: "REOPENED" }],
    VERIFIED: canVerify
      ? [
          { label: "Tutup pekerjaan", to: "CLOSED" },
          { label: "Buka kembali", to: "REOPENED" },
        ]
      : [],
    REOPENED: [{ label: "Proses kembali", to: "IN_PROGRESS" }],
  };

  async function transition(to: string) {
    const data: Record<string, unknown> = { status: to };
    if (to === "WAITING_CUSTOMER" || to === "WAITING_SYSTEM") {
      const reason = prompt("Catat alasan menunggu:");
      if (!reason) return;
      data.waitReason = reason;
    }
    if (to === "ESCALATED") {
      const reason = prompt("Catat alasan eskalasi:");
      if (!reason) return;
      data.escalationReason = reason;
    }
    if (!confirm(`Ubah status menjadi ${to.replaceAll("_", " ")}?`)) return;
    await patch(data);
  }

  async function schedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await patch({
      nextAction: form.get("nextAction"),
      dueAt: jakartaLocalToIso(String(form.get("dueAt"))),
      appointmentStatus: form.get("appointmentStatus"),
      appointmentAt: form.get("appointmentAt")
        ? jakartaLocalToIso(String(form.get("appointmentAt")))
        : null,
    });
  }

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <h2 className="font-black">Kendali layanan</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {(transitions[status] ?? []).map((transitionItem) => (
            <Button
              key={transitionItem.to}
              disabled={busy}
              onClick={() => void transition(transitionItem.to)}
            >
              {transitionItem.label}
            </Button>
          ))}
          {["ACCEPTED", "IN_PROGRESS", "REOPENED"].includes(status) && (
            <>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void transition("WAITING_CUSTOMER")}
              >
                Menunggu nasabah
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void transition("WAITING_SYSTEM")}
              >
                Menunggu sistem
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void transition("ESCALATED")}
              >
                Eskalasi
              </Button>
            </>
          )}
        </div>
        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      </div>
      <form onSubmit={schedule} className="card space-y-3 p-5">
        <div>
          <h2 className="font-black">Janji & tindak lanjut</h2>
          <p className="text-sm text-slate-500">
            Perlu membuat janji tidak berarti janji sudah terkonfirmasi.
          </p>
        </div>
        <label className="label">
          Next action
          <input
            className="field mt-1"
            name="nextAction"
            required
            defaultValue="Hubungi dan konfirmasi jadwal"
          />
        </label>
        <label className="label">
          Waktu tindak lanjut (WIB)
          <input
            className="field mt-1"
            type="datetime-local"
            name="dueAt"
            required
            defaultValue={isoToJakartaLocalInput(dueAt)}
          />
        </label>
        <label className="label">
          Status janji
          <select
            className="field mt-1"
            name="appointmentStatus"
            defaultValue={appointmentStatus}
          >
            <option value="NEEDS_SCHEDULING">Perlu membuat janji</option>
            <option value="PENDING_CONFIRMATION">
              Menunggu konfirmasi janji
            </option>
            <option value="CONFIRMED">Janji terkonfirmasi</option>
            <option value="COMPLETED">Janji terlaksana</option>
            <option value="CANCELLED">Janji dibatalkan</option>
          </select>
        </label>
        <label className="label">
          Waktu janji (WIB, wajib bila terkonfirmasi)
          <input
            className="field mt-1"
            type="datetime-local"
            name="appointmentAt"
            defaultValue={
              appointmentAt ? isoToJakartaLocalInput(appointmentAt) : ""
            }
          />
        </label>
        <Button disabled={busy}>{busy ? "Menyimpan…" : "Simpan jadwal"}</Button>
      </form>
    </div>
  );
}
