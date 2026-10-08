"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BellRing, Clock3 } from "lucide-react";
import { useEffect, useState } from "react";
import { formatDateTime } from "@/lib/format";

type Reminder = {
  id: string;
  runAt: string;
  status: string;
  minutesBefore: number;
  snoozeMinutes?: number;
  expiresAt: string | null;
};

function reminderLabel(job: Reminder) {
  if (job.snoozeMinutes) return `Ingatkan lagi ${job.snoozeMinutes} menit`;
  if (job.minutesBefore === 0) return "Alarm saat waktu janji";
  return `${job.minutesBefore === 1440 ? "24 jam" : `${job.minutesBefore} menit`} sebelum janji`;
}

function remaining(milliseconds: number) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const days = Math.floor(seconds / 86400);
  return `${days ? `${days} hari ` : ""}${String(Math.floor(seconds / 3600) % 24).padStart(2, "0")}:${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function AppointmentCountdown({
  appointmentAt,
  accepted,
  appointmentStatus,
  reminders,
  serverNow,
  description,
}: {
  appointmentAt: string | null;
  accepted: boolean;
  appointmentStatus: string;
  reminders: Reminder[];
  serverNow: string;
  description: string;
}) {
  const router = useRouter();
  const [tickState, setTickState] = useState({ base: serverNow, elapsed: 0 });
  const terminal = ["COMPLETED", "CANCELLED"].includes(appointmentStatus);
  useEffect(() => {
    const started = Date.now();
    const tick = setInterval(
      () => setTickState({ base: serverNow, elapsed: Date.now() - started }),
      1000,
    );
    return () => clearInterval(tick);
  }, [serverNow]);
  // Only refresh persistent status; this component never schedules or plays alarms.
  useEffect(() => {
    if (!accepted || terminal || !appointmentAt) return;
    const poll = setInterval(() => router.refresh(), 15_000);
    return () => clearInterval(poll);
  }, [accepted, terminal, appointmentAt, router]);
  const now =
    new Date(serverNow).getTime() +
    (tickState.base === serverNow ? tickState.elapsed : 0);
  const time = appointmentAt ? new Date(appointmentAt).getTime() : null;
  const active = accepted && appointmentStatus === "CONFIRMED" && time != null;
  const next = active
    ? reminders
        .filter(
          (job) =>
            ["PENDING", "PROCESSING"].includes(job.status) &&
            (!job.expiresAt || new Date(job.expiresAt).getTime() > now),
        )
        .sort((a, b) => Date.parse(a.runAt) - Date.parse(b.runAt))[0]
    : null;
  return (
    <section
      className="card overflow-hidden p-5"
      aria-labelledby="appointment-tracking-title"
    >
      <div className="flex items-center gap-2">
        <Clock3 className="h-5 w-5 text-blue-800" />
        <h2 id="appointment-tracking-title" className="font-black">
          Tracking janji
        </h2>
      </div>
      <p className="mt-2 text-sm text-slate-600">
        {appointmentAt
          ? formatDateTime(appointmentAt)
          : "Waktu janji belum diisi"}
      </p>
      <div className="mt-4 rounded-2xl bg-blue-950 p-4 text-white">
        <p className="text-xs text-blue-100">
          {active ? "Menuju waktu janji" : "Status jadwal"}
        </p>
        <p
          data-testid="appointment-countdown"
          className="mt-1 break-words text-2xl font-bold tabular-nums"
        >
          {terminal
            ? appointmentStatus === "COMPLETED"
              ? "Janji terlaksana"
              : "Janji dibatalkan"
            : !accepted
              ? "Menunggu penerimaan"
              : !time
                ? "Lengkapi waktu janji"
                : time <= now
                  ? next
                    ? "Waktunya janji"
                    : "Waktu janji sudah lewat"
                  : appointmentStatus !== "CONFIRMED"
                    ? "Menunggu konfirmasi"
                    : remaining(time - now)}
        </p>
      </div>
      {!accepted && !terminal && (
        <p className="mt-3 text-sm text-amber-800">
          Simpan waktu janji, lalu klik <strong>Terima pekerjaan</strong> untuk
          mengonfirmasi jadwal dan mengaktifkan pengingat.
        </p>
      )}
      <div className="mt-4 flex items-center gap-2 text-sm font-bold">
        <BellRing className="h-4 w-4" />
        Pengingat berikutnya
      </div>
      <p
        data-testid="reminder-countdown"
        className="mt-2 text-lg font-bold tabular-nums text-blue-900"
      >
        {next
          ? Date.parse(next.runAt) > now
            ? remaining(Date.parse(next.runAt) - now)
            : "Menunggu proses worker"
          : active
            ? "Tidak ada slot pengingat mendatang"
            : "Tidak aktif"}
      </p>
      {next && (
        <p className="mt-1 text-sm text-slate-600">
          {reminderLabel(next)} · {formatDateTime(next.runAt)}
        </p>
      )}
      {reminders.length > 0 && (
        <ul
          className="mt-3 space-y-2 border-t pt-3 text-xs text-slate-600"
          aria-label="Status pengingat tersimpan"
        >
          {reminders.map((job) => (
            <li
              key={job.id}
              className="flex flex-wrap items-center justify-between gap-1"
            >
              <span>
                {reminderLabel(job)} · {formatDateTime(job.runAt)}
              </span>
              <span className="font-semibold">
                {["PENDING", "PROCESSING"].includes(job.status) &&
                job.expiresAt &&
                Date.parse(job.expiresAt) <= now
                  ? "Slot terlewat"
                  : ((
                      {
                        PENDING: "Terjadwal",
                        PROCESSING: "Diproses",
                        SUCCEEDED: "Notifikasi dibuat",
                        FAILED: "Gagal diproses",
                        UNKNOWN: "Perlu diperiksa",
                        CANCELLED: "Dibatalkan",
                      } as Record<string, string>
                    )[job.status] ?? job.status)}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-sm text-slate-600">{description}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">
        24 jam sebelumnya + satu pengingat berdasarkan jarak + alarm saat waktu
        janji tiba. Setiap pengingat membuka satu alarm jika suara aktif, dengan
        pilihan Matikan atau Ingatkan lagi 1/5/10 menit. Slot yang sudah lewat
        tidak dikirim ulang. Worker memeriksa setiap 60 detik; countdown bukan
        pemicu suara. Tab harus aktif dan browser harus mengizinkan audio. Alarm
        saat janji dapat diingatkan lagi 1/5/10 menit hingga 1 jam setelah
        jadwal; mengubah waktu janji menjadwalkan ulang seluruh alarm.
      </p>
      <Link
        href="/notification-settings"
        className="mt-3 inline-flex min-h-11 items-center text-sm font-bold text-blue-800 underline underline-offset-4"
      >
        Aktivasi & tes suara
      </Link>
    </section>
  );
}
