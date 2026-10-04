import { afterEach, describe, expect, it } from "vitest";
import { claimAudioNotice, isJakartaQuietTime, loadSoundPreferences, normalizeVolume, reminderSoundKind, shouldPlayReminderSound } from "../lib/client/notification-audio";
import { assertRoleSeedEnvironment } from "../lib/role-seed-guard";

describe("pengaturan suara", () => {
  afterEach(() => Reflect.deleteProperty(globalThis, "localStorage"));
  it("membatasi volume pada rentang 0 sampai 100", () => {
    expect(normalizeVolume(-20)).toBe(0);
    expect(normalizeVolume(50.4)).toBe(50);
    expect(normalizeVolume(140)).toBe(100);
  });

  it("menghormati jam senyap lintas tengah malam dalam WIB", () => {
    expect(isJakartaQuietTime(new Date("2026-10-04T14:00:00Z"), "20:00", "07:00")).toBe(true);
    expect(isJakartaQuietTime(new Date("2026-10-04T03:00:00Z"), "20:00", "07:00")).toBe(false);
  });

  it("mengategorikan reminder janji dengan benar dan tetap membunyikannya pada waktu janji", () => {
    const quietTime = new Date("2026-10-04T18:00:00Z");
    expect(reminderSoundKind("APPOINTMENT_PRE_DUE")).toBe("appointments");
    expect(reminderSoundKind("APPOINTMENT_ACTION_DUE")).toBe("appointments");
    expect(
      shouldPlayReminderSound(
        "APPOINTMENT_ACTION_DUE",
        quietTime,
        "20:00",
        "07:00",
      ),
    ).toBe(true);
    expect(
      shouldPlayReminderSound(
        "OVERDUE_DIGEST",
        quietTime,
        "20:00",
        "07:00",
      ),
    ).toBe(false);
  });

  it("mendeduplikasi notifikasi yang sama antar-tab melalui claim persisten", () => {
    const values = new Map<string, string>();
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) } });
    expect(claimAudioNotice("user-1", "notice-1", 1_000)).toBe(true);
    expect(claimAudioNotice("user-1", "notice-1", 1_001)).toBe(false);
  });

  it("memuat volume, pengulangan panjang, dan nama alarm per pengguna", () => {
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: () => JSON.stringify({ soundEnabled: true, muted: false, volume: 75, repeatCount: 20, customSoundName: "alarm-tim.mp3" }) } });
    expect(loadSoundPreferences("user-1")).toMatchObject({ volume: 75, repeatCount: 20, customSoundName: "alarm-tim.mp3" });
  });
});

describe("pengaman seeder role", () => {
  const valid = {
    DATABASE_URL: "postgresql://local:local@localhost:5432/mabeslink_test",
    DATABASE_PURPOSE: "testing",
    ROLE_SEED_ENABLED: "true",
    ROLE_SEED_CONFIRM: "MABESLINK_TEST_ONLY",
    NODE_ENV: "development",
  } as NodeJS.ProcessEnv;

  it("menerima database testing terpisah dengan konfirmasi eksplisit", () => {
    expect(() => assertRoleSeedEnvironment(valid)).not.toThrow();
  });

  it("menolak production dan database tanpa penanda test", () => {
    expect(() => assertRoleSeedEnvironment({ ...valid, NODE_ENV: "production" })).toThrow(/production/);
    expect(() => assertRoleSeedEnvironment({ ...valid, DATABASE_URL: "postgresql://local:local@localhost:5432/mabeslink" })).toThrow(/mengandung 'test'/);
  });
});
