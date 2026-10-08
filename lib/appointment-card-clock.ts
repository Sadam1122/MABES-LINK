export type CardReminder = {
  id: string;
  runAt: string;
  expiresAt: string | null;
  snoozeMinutes: number | null;
};
export type CardAppointment = {
  appointmentAt: string | null;
  appointmentStatus: string;
  serviceStatus: string;
  accepted: boolean;
  nextReminder: CardReminder | null;
};

export function formatAppointmentRemaining(milliseconds: number) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const days = Math.floor(seconds / 86400);
  return `${days ? `${days} hari ` : ""}${String(Math.floor(seconds / 3600) % 24).padStart(2, "0")}:${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function appointmentCardClock(item: CardAppointment, now: number) {
  const state = (label: string, value: string) => ({
    label,
    value,
    nextAt: null as string | null,
    appointmentCountdown: null as string | null,
  });
  if (item.appointmentStatus === "COMPLETED")
    return state("Alarm tidak aktif", "Janji terlaksana");
  if (
    item.appointmentStatus === "CANCELLED" ||
    item.serviceStatus === "CANCELLED"
  )
    return state("Alarm tidak aktif", "Janji dibatalkan");
  if (["HANDLED", "VERIFIED", "CLOSED"].includes(item.serviceStatus))
    return state("Alarm tidak aktif", "Pekerjaan selesai");
  const at = item.appointmentAt ? Date.parse(item.appointmentAt) : NaN;
  if (!Number.isFinite(at))
    return state("Pengingat belum aktif", "Waktu janji belum diisi");
  if (!item.accepted)
    return state("Pengingat belum aktif", "Klik Terima pekerjaan");
  if (item.appointmentStatus !== "CONFIRMED")
    return state("Pengingat belum aktif", "Menunggu konfirmasi janji");
  const reminder = item.nextReminder;
  const runAt = reminder ? Date.parse(reminder.runAt) : NaN;
  const valid =
    reminder &&
    Number.isFinite(runAt) &&
    (runAt <= at || reminder.snoozeMinutes != null) &&
    (!reminder.expiresAt || Date.parse(reminder.expiresAt) > now);
  if (at <= now && !valid)
    return state("Alarm tidak aktif", "Waktu janji sudah lewat");
  const appointmentCountdown =
    at > now ? formatAppointmentRemaining(at - now) : "Waktunya janji";
  if (!valid)
    return {
      ...state("Pengingat berikutnya", "Tidak ada slot mendatang"),
      appointmentCountdown,
    };
  return {
    label: reminder.snoozeMinutes
      ? `Ingatkan lagi ${reminder.snoozeMinutes} menit`
      : runAt === at
        ? "Alarm waktu janji"
        : "Alarm berikutnya",
    value:
      runAt > now
        ? formatAppointmentRemaining(runAt - now)
        : "Menunggu proses worker",
    nextAt: reminder.runAt,
    appointmentCountdown,
  };
}
