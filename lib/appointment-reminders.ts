import { haversineMeters, type Coordinate } from "./geo";

export const REMINDER_GRACE_MS = 90_000; // One 60s worker tick + bounded dispatch jitter.
export const APPOINTMENT_SNOOZE_WINDOW_MS = 60 * 60_000;

/** Due-time alarms may be explicitly snoozed, never automatically repeated. */
export function appointmentAlarmDeadline(appointmentAt: Date, type: string) {
  return new Date(
    appointmentAt.getTime() +
      (type === "APPOINTMENT_ACTION_DUE" ? APPOINTMENT_SNOOZE_WINDOW_MS : 0),
  );
}
export type AppointmentLocation = {
  latitude: number | null;
  longitude: number | null;
  locationVerifiedAt?: Date | null;
  locationUpdatedAt?: Date | null;
};
export type VerifiedBranch = Coordinate & { verifiedAt: Date };

/** No public-directory coordinate is silently treated as a surveyed bank point. */
export function verifiedAppointmentBranch(
  env: NodeJS.ProcessEnv = process.env,
): VerifiedBranch | null {
  if (
    !env.APPOINTMENT_BRANCH_LATITUDE?.trim() ||
    !env.APPOINTMENT_BRANCH_LONGITUDE?.trim() ||
    !env.APPOINTMENT_BRANCH_VERIFIED_AT?.trim()
  )
    return null;
  const latitude = Number(env.APPOINTMENT_BRANCH_LATITUDE),
    longitude = Number(env.APPOINTMENT_BRANCH_LONGITUDE);
  const verifiedAt = new Date(env.APPOINTMENT_BRANCH_VERIFIED_AT);
  if (
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180 ||
    !Number.isFinite(verifiedAt.getTime()) ||
    verifiedAt.getTime() > Date.now()
  )
    return null;
  return { latitude, longitude, verifiedAt };
}

export function appointmentDistancePolicy(
  location: AppointmentLocation,
  branch: VerifiedBranch | null,
) {
  const coordinatesPresent =
    location.latitude != null && location.longitude != null;
  const verified =
    location.locationVerifiedAt &&
    (!location.locationUpdatedAt ||
      location.locationVerifiedAt >= location.locationUpdatedAt);
  if (!coordinatesPresent)
    return {
      minutesBefore: 60,
      distanceMeters: null,
      status: "LOCATION_MISSING",
      description: "Lokasi belum tersedia — cadangan 1 jam sebelum janji.",
    } as const;
  if (!verified)
    return {
      minutesBefore: 60,
      distanceMeters: null,
      status: "LOCATION_UNVERIFIED",
      description:
        "Koordinat usaha belum diverifikasi — cadangan 1 jam sebelum janji.",
    } as const;
  if (!branch)
    return {
      minutesBefore: 60,
      distanceMeters: null,
      status: "BRANCH_UNVERIFIED",
      description:
        "Titik KCP belum dikonfirmasi pengelola — cadangan 1 jam sebelum janji.",
    } as const;
  const distanceMeters = haversineMeters(branch, {
    latitude: location.latitude!,
    longitude: location.longitude!,
  });
  return {
    minutesBefore: distanceMeters <= 1000 ? 15 : 60,
    distanceMeters,
    status: "VERIFIED",
    description: `Jarak garis lurus ${Math.round(distanceMeters)} m — pengingat ${distanceMeters <= 1000 ? "15 menit" : "1 jam"} sebelum janji. Bukan jarak/waktu tempuh jalan.`,
  } as const;
}

export function appointmentReminderPlan(
  appointmentAt: Date | null,
  confirmed: boolean,
  location: AppointmentLocation,
  branch: VerifiedBranch | null,
  now = new Date(),
) {
  const distance = appointmentDistancePolicy(location, branch);
  if (!confirmed || !appointmentAt)
    return {
      ...distance,
      reminders: [],
      skipped: "Janji belum dikonfirmasi; pengingat belum dijadwalkan.",
    };
  if (appointmentAt <= now)
    return {
      ...distance,
      reminders: [],
      skipped: "Waktu janji sudah lewat; pengingat tidak dikirim.",
    };
  const reminders = [1440, distance.minutesBefore, 0]
    .map((minutesBefore) => {
      const runAt = new Date(appointmentAt.getTime() - minutesBefore * 60_000);
      return {
        minutesBefore,
        runAt,
        expiresAt: new Date(
          Math.min(
            runAt.getTime() + REMINDER_GRACE_MS,
            minutesBefore === 0
              ? runAt.getTime() + REMINDER_GRACE_MS
              : appointmentAt.getTime(),
          ),
        ),
      };
    })
    .filter((job) => job.runAt > now);
  return {
    ...distance,
    reminders,
    skipped:
      reminders.length < 3
        ? "Waktu pengingat yang sudah terlewat tidak dikejar. Hanya jadwal yang masih akan datang dibuat."
        : null,
  };
}
