import { describe, expect, it } from "vitest";
import {
  appointmentCardClock,
  formatAppointmentRemaining,
  type CardAppointment,
} from "@/lib/appointment-card-clock";
import {
  isAppointmentAlarmNotification,
  shouldCatchUpAppointmentSound,
} from "@/lib/client/notification-audio";

const now = Date.parse("2026-10-08T02:00:00Z"); // 09:00 WIB
const item: CardAppointment = {
  appointmentAt: "2026-10-08T03:00:00Z",
  accepted: true,
  appointmentStatus: "CONFIRMED",
  serviceStatus: "ACCEPTED",
  nextReminder: {
    id: "samaran",
    runAt: "2026-10-08T02:45:00Z",
    expiresAt: "2026-10-08T02:46:30Z",
    snoozeMinutes: null,
  },
};

describe("countdown kartu hanya membaca jadwal persisten", () => {
  it("menghitung alarm dan janji berbeda; berjalan setiap detik berdasarkan UTC/WIB", () => {
    expect(appointmentCardClock(item, now)).toMatchObject({
      label: "Alarm berikutnya",
      value: "00:45:00",
      appointmentCountdown: "01:00:00",
    });
    expect(appointmentCardClock(item, now + 1000).value).toBe("00:44:59");
    expect(formatAppointmentRemaining(86401_000)).toBe("1 hari 00:00:01");
  });
  it("tidak membuat alarm rekaan sebelum penerimaan/konfirmasi atau tanpa job", () => {
    expect(appointmentCardClock({ ...item, accepted: false }, now).value).toBe(
      "Klik Terima pekerjaan",
    );
    expect(
      appointmentCardClock(
        { ...item, appointmentStatus: "PENDING_CONFIRMATION" },
        now,
      ).value,
    ).toBe("Menunggu konfirmasi janji");
    expect(
      appointmentCardClock({ ...item, nextReminder: null }, now).value,
    ).toBe("Tidak ada slot mendatang");
    expect(
      appointmentCardClock({ ...item, appointmentAt: null }, now).value,
    ).toBe("Waktu janji belum diisi");
  });
  it("menunggu worker saat slot tiba, menghentikan slot kedaluwarsa dan janji terminal", () => {
    expect(
      appointmentCardClock(item, Date.parse(item.nextReminder!.runAt)).value,
    ).toBe("Menunggu proses worker");
    expect(
      appointmentCardClock(item, Date.parse(item.nextReminder!.expiresAt!))
        .value,
    ).toBe("Tidak ada slot mendatang");
    expect(
      appointmentCardClock(item, Date.parse(item.appointmentAt!)).value,
    ).toBe("Waktu janji sudah lewat");
    expect(
      appointmentCardClock({ ...item, appointmentStatus: "COMPLETED" }, now)
        .value,
    ).toBe("Janji terlaksana");
    expect(
      appointmentCardClock({ ...item, appointmentStatus: "CANCELLED" }, now)
        .value,
    ).toBe("Janji dibatalkan");
  });
  it("menampilkan snooze dari job, tanpa menghitungnya sebagai alarm otomatis berulang", () => {
    expect(
      appointmentCardClock(
        { ...item, nextReminder: { ...item.nextReminder!, snoozeMinutes: 5 } },
        now,
      ).label,
    ).toBe("Ingatkan lagi 5 menit");
  });
  it("waktu janji nol menunggu alarm worker; snooze sesudah janji tetap terlihat", () => {
    const due = {
      ...item,
      nextReminder: {
        ...item.nextReminder!,
        runAt: item.appointmentAt!,
        expiresAt: "2026-10-08T03:01:30Z",
      },
    };
    expect(
      appointmentCardClock(due, Date.parse(item.appointmentAt!)),
    ).toMatchObject({
      label: "Alarm waktu janji",
      value: "Menunggu proses worker",
      appointmentCountdown: "Waktunya janji",
    });
    expect(
      appointmentCardClock(
        {
          ...due,
          nextReminder: {
            ...due.nextReminder,
            runAt: "2026-10-08T03:05:00Z",
            expiresAt: "2026-10-08T03:06:30Z",
            snoozeMinutes: 5,
          },
        },
        Date.parse(item.appointmentAt!),
      ),
    ).toMatchObject({
      label: "Ingatkan lagi 5 menit",
      value: "00:05:00",
    });
  });
});

describe("suara otomatis hanya saat modal pengingat janji", () => {
  it.each([
    "SERVICE_STATUS",
    "SERVICE_ASSIGNMENT",
    "FOLLOW_UP_PRE_DUE",
    "FOLLOW_UP_DUE",
    "OVERDUE_DIGEST",
    "APPOINTMENT_UPDATED",
  ])("%s tidak boleh memicu audio meski preferensi lama aktif", (type) => {
    expect(isAppointmentAlarmNotification(type)).toBe(false);
    expect(
      shouldCatchUpAppointmentSound(
        type,
        null,
        new Date(now).toISOString(),
        now,
      ),
    ).toBe(false);
  });
  it("pengingat janji valid tetap dapat membuka alarm", () => {
    expect(isAppointmentAlarmNotification("APPOINTMENT_PRE_DUE")).toBe(true);
    expect(isAppointmentAlarmNotification("APPOINTMENT_ACTION_DUE")).toBe(true);
  });
});
