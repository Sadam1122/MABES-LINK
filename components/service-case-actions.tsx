"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogClose } from "@/components/ui/dialog";
import { useFeedback } from "@/components/ui/feedback";
import { clientApi } from "@/lib/client-api";
import { isoToJakartaLocalInput, jakartaLocalToIso } from "@/lib/format";
import { ServiceCaseDeleteButton } from "@/components/service-case-delete-button";

type Action = { label: string; to: string };

export function ServiceCaseActions({
  id,
  version,
  status,
  appointmentStatus,
  dueAt,
  appointmentAt,
  acquisitionStatus,
  targetValue,
  realizationValue,
  metricUnit,
  canVerify,
  canDelete,
}: {
  id: string;
  version: number;
  status: string;
  appointmentStatus: string;
  dueAt: string;
  appointmentAt: string | null;
  acquisitionStatus: string;
  targetValue: number | null;
  realizationValue: number | null;
  metricUnit: string | null;
  canVerify: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const { confirm, toast } = useFeedback();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reasonFor, setReasonFor] = useState<string | null>(null);
  const [reasonDirty, setReasonDirty] = useState(false);

  async function patch(data: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      await clientApi(`/api/service-cases/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ version, ...data }),
      });
      router.refresh();
      toast("Pekerjaan berhasil diperbarui.", "success");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Perubahan gagal.";
      setError(message);
      toast(message, "error");
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

  async function executeTransition(to: string, reason?: string) {
    const data: Record<string, unknown> = { status: to };
    if (to === "WAITING_CUSTOMER" || to === "WAITING_SYSTEM") data.waitReason = reason;
    if (to === "ESCALATED") data.escalationReason = reason;
    if (!(await confirm({ title: "Ubah status pekerjaan?", description: `Status akan diubah menjadi ${to.replaceAll("_", " ")}.`, confirmLabel: "Ubah status" }))) return;
    await patch(data);
  }

  async function transition(to: string) {
    if (["WAITING_CUSTOMER", "WAITING_SYSTEM", "ESCALATED"].includes(to)) {
      setReasonDirty(false);
      setReasonFor(to);
      return;
    }
    await executeTransition(to);
  }

  async function submitReason(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reasonFor) return;
    const reason = String(new FormData(event.currentTarget).get("reason") ?? "").trim();
    if (reason.length < 3) return;
    const target = reasonFor;
    setReasonDirty(false);
    setReasonFor(null);
    await executeTransition(target, reason);
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
      acquisitionStatus: form.get("acquisitionStatus"),
      targetValue:
        String(form.get("targetValue") ?? "").trim() === ""
          ? null
          : Number(form.get("targetValue")),
      realizationValue:
        String(form.get("realizationValue") ?? "").trim() === ""
          ? null
          : Number(form.get("realizationValue")),
      metricUnit: form.get("metricUnit") || null,
    });
  }

  async function cancelAppointment() {
    if (
      !(await confirm({
        title: "Batalkan janji?",
        description:
          "Seluruh reminder aktif untuk jadwal ini akan dibatalkan. Riwayat janji tetap tersimpan pada audit.",
        confirmLabel: "Batalkan janji",
        tone: "danger",
      }))
    )
      return;
    await patch({ appointmentStatus: "CANCELLED", appointmentAt: null });
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
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="label">
            Status akuisisi
            <select className="field mt-1" name="acquisitionStatus" defaultValue={acquisitionStatus}>
              <option value="PROSPECT">Prospek</option>
              <option value="FOLLOW_UP">Follow Up</option>
              <option value="PROCESS">Proses</option>
              <option value="SUCCESS">Berhasil</option>
              <option value="UNSUCCESSFUL">Tidak Berhasil</option>
            </select>
          </label>
          <label className="label">
            Satuan target
            <select className="field mt-1" name="metricUnit" defaultValue={metricUnit ?? "CUSTOMER"}>
              <option value="CUSTOMER">Nasabah</option>
              <option value="ACCOUNT">Rekening</option>
              <option value="MERCHANT">Merchant</option>
              <option value="IDR">Rupiah</option>
            </select>
          </label>
          <label className="label">
            Target
            <input className="field mt-1" name="targetValue" type="number" min="0" step="0.01" defaultValue={targetValue ?? ""} />
          </label>
          <label className="label">
            Realisasi
            <input className="field mt-1" name="realizationValue" type="number" min="0" step="0.01" defaultValue={realizationValue ?? ""} />
          </label>
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
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy}>{busy ? "Menyimpan…" : "Simpan jadwal"}</Button>
          {!['COMPLETED', 'CANCELLED'].includes(appointmentStatus) ? (
            <Button
              type="button"
              variant="danger"
              disabled={busy}
              onClick={() => void cancelAppointment()}
            >
              Batalkan janji
            </Button>
          ) : null}
        </div>
      </form>
      <Dialog
        open={Boolean(reasonFor)}
        onClose={() => setReasonFor(null)}
        title={reasonFor === "ESCALATED" ? "Alasan eskalasi" : "Alasan menunggu"}
        description="Catatan ini masuk ke audit pekerjaan dan harus ringkas serta faktual."
        dirty={reasonDirty}
        busy={busy}
        footer={<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><DialogClose variant="outline">Batal</DialogClose><Button type="submit" form="case-reason-form">Lanjutkan</Button></div>}
      >
        <form id="case-reason-form" onSubmit={submitReason} onChange={() => setReasonDirty(true)}>
          <label className="label">Alasan<textarea data-autofocus className="textarea mt-1" name="reason" minLength={3} maxLength={500} required /></label>
        </form>
      </Dialog>
      {canDelete ? (
        <div className="card border-red-200 p-5">
          <h2 className="font-black text-red-800">Hapus dari daftar</h2>
          <p className="mt-1 text-sm text-slate-500">Reminder dibatalkan dan kartu disembunyikan, tetapi audit tetap dipertahankan.</p>
          <div className="mt-3"><ServiceCaseDeleteButton id={id} version={version} redirectAfter /></div>
        </div>
      ) : null}
    </div>
  );
}
