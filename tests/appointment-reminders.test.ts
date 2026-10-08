import { describe, expect, it } from "vitest";
import {
  appointmentDistancePolicy,
  appointmentReminderPlan,
  verifiedAppointmentBranch,
  appointmentAlarmDeadline,
  REMINDER_GRACE_MS,
} from "@/lib/appointment-reminders";
import { jakartaLocalToIso } from "@/lib/format";
import { appointmentCreateSchema } from "@/lib/validation";

const now = new Date("2026-10-08T01:00:00Z");
const verifiedAt = new Date("2026-10-07T00:00:00Z");
const branch = { latitude: 0, longitude: 0, verifiedAt };
const near = {
  latitude: 0,
  longitude: 0.001,
  locationVerifiedAt: verifiedAt,
  locationUpdatedAt: verifiedAt,
};

describe("jadwal janji WIB dan jarak terverifikasi", () => {
  it("24 jam dan 15 menit untuk jarak <=1km; 1 jam untuk >1km", () => {
    const at = new Date(jakartaLocalToIso("2026-10-10T09:30"));
    const plan = appointmentReminderPlan(at, true, near, branch, now);
    expect(at.toISOString()).toBe("2026-10-10T02:30:00.000Z");
    expect(plan.reminders.map((r) => r.minutesBefore)).toEqual([1440, 15, 0]);
    expect(plan.reminders[2].runAt).toEqual(at);
    expect(plan.reminders[2].expiresAt.getTime()).toBe(
      at.getTime() + REMINDER_GRACE_MS,
    );
    expect(plan.reminders[0].runAt.toISOString()).toBe(
      "2026-10-09T02:30:00.000Z",
    );
    expect(plan.reminders[1].runAt.toISOString()).toBe(
      "2026-10-10T02:15:00.000Z",
    );
    expect(
      appointmentDistancePolicy({ ...near, longitude: 0.02 }, branch)
        .minutesBefore,
    ).toBe(60);
    // Boundary around 1 km, with no rounding before comparison.
    expect(
      appointmentDistancePolicy({ ...near, longitude: 0.00899 }, branch)
        .minutesBefore,
    ).toBe(15);
    expect(
      appointmentDistancePolicy({ ...near, longitude: 0.009 }, branch)
        .minutesBefore,
    ).toBe(60);
  });
  it("koordinat nol sah; lokasi/titik KCP belum terverifikasi memakai cadangan", () => {
    expect(
      appointmentDistancePolicy({ ...near, longitude: 0 }, branch)
        .distanceMeters,
    ).toBe(0);
    expect(
      appointmentDistancePolicy({ latitude: null, longitude: null }, branch)
        .status,
    ).toBe("LOCATION_MISSING");
    expect(
      appointmentDistancePolicy({ ...near, locationVerifiedAt: null }, branch)
        .minutesBefore,
    ).toBe(60);
    expect(
      appointmentDistancePolicy({ ...near, locationUpdatedAt: now }, branch)
        .status,
    ).toBe("LOCATION_UNVERIFIED");
    expect(appointmentDistancePolicy(near, null).status).toBe(
      "BRANCH_UNVERIFIED",
    );
    expect(verifiedAppointmentBranch({ NODE_ENV: "test" })).toBeNull();
    expect(
      verifiedAppointmentBranch({
        NODE_ENV: "test",
        APPOINTMENT_BRANCH_LATITUDE: "0",
        APPOINTMENT_BRANCH_LONGITUDE: "0",
        APPOINTMENT_BRANCH_VERIFIED_AT: verifiedAt.toISOString(),
      })?.latitude,
    ).toBe(0);
    expect(
      verifiedAppointmentBranch({
        NODE_ENV: "test",
        APPOINTMENT_BRANCH_LATITUDE: "91",
        APPOINTMENT_BRANCH_LONGITUDE: "0",
        APPOINTMENT_BRANCH_VERIFIED_AT: verifiedAt.toISOString(),
      }),
    ).toBeNull();
  });
  it("tidak mengejar slot terlewat, janji terlalu dekat/lewat/belum dikonfirmasi", () => {
    expect(
      appointmentReminderPlan(
        new Date(now.getTime() + 2 * 3600_000),
        true,
        near,
        branch,
        now,
      ).reminders.map((r) => r.minutesBefore),
    ).toEqual([15, 0]);
    expect(
      appointmentReminderPlan(
        new Date(now.getTime() + 10 * 60_000),
        true,
        near,
        branch,
        now,
      ).reminders.map((r) => r.minutesBefore),
    ).toEqual([0]);
    expect(
      appointmentReminderPlan(now, true, near, branch, now).reminders,
    ).toEqual([]);
    expect(
      appointmentReminderPlan(null, false, near, branch, now).reminders,
    ).toEqual([]);
    expect(
      appointmentReminderPlan(
        new Date(now.getTime() + 15 * 60_000),
        true,
        near,
        branch,
        now,
      ).reminders.map((r) => r.minutesBefore),
    ).toEqual([0]);
  });
  it("alarm waktu janji memiliki batas snooze sendiri, pengingat awal tetap sebelum janji", () => {
    expect(appointmentAlarmDeadline(now, "APPOINTMENT_PRE_DUE")).toEqual(now);
    expect(
      appointmentAlarmDeadline(now, "APPOINTMENT_ACTION_DUE").getTime(),
    ).toBe(now.getTime() + 3600_000);
  });
  it("satu waktu wajib hanya saat dikonfirmasi, pendamping/lokasi boleh kosong", () => {
    const form = {
      acquisitionCategory: "LIVIN_MERCHANT",
      acquisitionProduct: "LIVIN_MERCHANT_QRIS",
      contactName: "Kontak Samaran",
      businessAlias: null,
      reason: "Discovery kebutuhan pembayaran",
      nextAction: "Konfirmasi agenda",
      targetValue: null,
      realizationValue: null,
      metricUnit: null,
      latitude: null,
      longitude: null,
      locationLabel: "",
      locationSource: "MAP_PIN",
    };
    expect(
      appointmentCreateSchema.safeParse({
        ...form,
        appointmentStatus: "NEEDS_SCHEDULING",
      }).success,
    ).toBe(true);
    expect(
      appointmentCreateSchema.safeParse({
        ...form,
        appointmentStatus: "CONFIRMED",
      }).success,
    ).toBe(false);
    expect(
      appointmentCreateSchema.safeParse({
        ...form,
        appointmentStatus: "CONFIRMED",
        appointmentAt: new Date(now.getTime() + 3600_000),
      }).success,
    ).toBe(true);
    expect(
      appointmentCreateSchema.safeParse({
        ...form,
        appointmentStatus: "NEEDS_SCHEDULING",
        companionIds: ["a", "a"],
      }).success,
    ).toBe(false);
    expect(
      appointmentCreateSchema.safeParse({
        ...form,
        appointmentStatus: "NEEDS_SCHEDULING",
        locationVerified: true,
      }).success,
    ).toBe(false);
  });
});
