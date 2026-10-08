export type SoundPreferences = {
  soundEnabled: boolean;
  muted: boolean;
  volume: number;
  repeatCount: number;
  customSoundName: string | null;
  reminderKinds: {
    appointments: boolean;
    assignments: boolean;
    overdue: boolean;
  };
};

export type ReminderSoundKind = keyof SoundPreferences["reminderKinds"];
export type ReminderAlarmUrgency = "standard" | "appointment-due";
export const NOTIFICATION_PREFERENCES_EVENT =
  "mabeslink:notification-preferences";

export const defaultSoundPreferences: SoundPreferences = {
  soundEnabled: false,
  muted: false,
  volume: 100,
  repeatCount: 3,
  customSoundName: null,
  reminderKinds: {
    appointments: true,
    assignments: false,
    overdue: false,
  },
};

export function normalizeVolume(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.min(100, Math.max(0, Math.round(number)))
    : 60;
}

export function isJakartaQuietTime(
  now: Date,
  quietStart: string,
  quietEnd: string,
) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(
    parts.find((part) => part.type === "minute")?.value ?? 0,
  );
  const toMinutes = (value: string) => {
    const [h, m] = value.split(":").map(Number);
    return h * 60 + m;
  };
  const current = hour * 60 + minute;
  const start = toMinutes(quietStart);
  const end = toMinutes(quietEnd);
  if (start === end) return false;
  return start < end
    ? current >= start && current < end
    : current >= start || current < end;
}

export function loadSoundPreferences(userId: string): SoundPreferences {
  try {
    const value = JSON.parse(
      localStorage.getItem(`mabeslink:sound:${userId}`) ?? "null",
    ) as Partial<SoundPreferences> | null;
    return value
      ? {
          soundEnabled: value.soundEnabled === true,
          muted: value.muted === true,
          volume: normalizeVolume(value.volume),
          repeatCount: [1, 3, 5, 10, 20].includes(Number(value.repeatCount))
            ? Number(value.repeatCount)
            : 3,
          customSoundName:
            typeof value.customSoundName === "string"
              ? value.customSoundName
              : null,
          reminderKinds: {
            appointments: value.reminderKinds?.appointments !== false,
            assignments: value.reminderKinds?.assignments !== false,
            overdue: value.reminderKinds?.overdue !== false,
          },
        }
      : defaultSoundPreferences;
  } catch {
    return defaultSoundPreferences;
  }
}

export function saveSoundPreferences(userId: string, value: SoundPreferences) {
  localStorage.setItem(`mabeslink:sound:${userId}`, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent(NOTIFICATION_PREFERENCES_EVENT));
}

export function reminderSoundKind(type: string): ReminderSoundKind {
  if (type.startsWith("APPOINTMENT_") || type.startsWith("FOLLOW_UP_"))
    return "appointments";
  if (type.includes("ASSIGNMENT") || type === "SERVICE_STATUS")
    return "assignments";
  if (type === "OVERDUE_DIGEST" || type.endsWith("_DUE")) return "overdue";
  return "appointments";
}

export function reminderAlarmUrgency(type: string): ReminderAlarmUrgency {
  return type === "APPOINTMENT_ACTION_DUE" ? "appointment-due" : "standard";
}

export function shouldPlayReminderDuringQuietHours(type: string) {
  return type.startsWith("APPOINTMENT_");
}

export function shouldPlayReminderSound(
  type: string,
  now: Date,
  quietStart: string,
  quietEnd: string,
) {
  return (
    shouldPlayReminderDuringQuietHours(type) ||
    !isJakartaQuietTime(now, quietStart, quietEnd)
  );
}

export function shouldCatchUpAppointmentSound(
  type: string,
  readAt: string | null,
  createdAt: string,
  now = Date.now(),
) {
  if (readAt || !isAppointmentAlarmNotification(type)) return false;
  const created = new Date(createdAt).getTime();
  return Number.isFinite(created) && created <= now && now - created <= 90_000;
}

// Saved legacy preferences must never make CRUD/follow-up events play audio.
export function isAppointmentAlarmNotification(type: string) {
  return type === "APPOINTMENT_PRE_DUE" || type === "APPOINTMENT_ACTION_DUE";
}

const fallbackClaims = new Map<string, number>();
export function claimAudioNotice(
  userId: string,
  notificationId: string,
  now = Date.now(),
) {
  const key = `mabeslink:notice-claim:${userId}:${notificationId}`;
  try {
    const previous = Number(localStorage.getItem(key));
    if (previous && now - previous < 7 * 24 * 60 * 60_000) return false;
    localStorage.setItem(key, String(now));
    return localStorage.getItem(key) === String(now);
  } catch {
    const previous = fallbackClaims.get(key);
    if (previous != null && now - previous < 7 * 24 * 60 * 60_000) return false;
    fallbackClaims.set(key, now);
    if (fallbackClaims.size > 500)
      fallbackClaims.delete(fallbackClaims.keys().next().value!);
    return true;
  }
}

/** Serializes claim across same-origin tabs. Without Web Locks, dedup is best-effort. */
export async function claimAudioNoticeOnce(
  userId: string,
  notificationId: string,
) {
  if (typeof navigator !== "undefined" && navigator.locks) {
    return navigator.locks.request(
      `mabeslink-notice:${userId}:${notificationId}`,
      () => claimAudioNotice(userId, notificationId),
    );
  }
  return claimAudioNotice(userId, notificationId);
}

class NotificationAudioManager {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private active: AudioScheduledSourceNode[] = [];
  private stopTimer: number | null = null;
  private volume = 0.6;
  private customBuffer: AudioBuffer | null = null;

  get state() {
    return this.context?.state ?? "uninitialized";
  }

  setVolume(value: number) {
    this.volume = normalizeVolume(value) / 100;
    if (this.volume === 0) this.stop();
    if (this.master && this.context)
      this.master.gain.setValueAtTime(this.volume, this.context.currentTime);
  }

  async activate() {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.context.destination);
    }
    await this.context.resume();
    return this.context.state === "running";
  }

  async setCustomSound(data: ArrayBuffer) {
    await this.activate();
    const decoded = await this.context!.decodeAudioData(data.slice(0));
    if (
      !Number.isFinite(decoded.duration) ||
      decoded.duration <= 0 ||
      decoded.duration > 30
    ) {
      throw new Error("Durasi alarm harus antara 0 dan 30 detik.");
    }
    this.customBuffer = decoded;
    return decoded.duration;
  }

  clearCustomSound() {
    this.stop();
    this.customBuffer = null;
  }

  stop() {
    if (this.stopTimer != null) window.clearTimeout(this.stopTimer);
    this.stopTimer = null;
    for (const oscillator of this.active) {
      try {
        oscillator.stop();
      } catch {
        /* sudah berhenti */
      }
      oscillator.disconnect();
    }
    this.active = [];
  }

  /** One looping source for one acknowledged alarm, bounded to protect users. */
  startAlarm(maxSeconds = 120) {
    if (
      !this.context ||
      !this.master ||
      this.context.state !== "running" ||
      this.volume === 0
    )
      return false;
    this.stop();
    let buffer = this.customBuffer;
    if (!buffer) {
      const rate = this.context.sampleRate;
      buffer = this.context.createBuffer(1, Math.ceil(rate * 2.4), rate);
      const samples = buffer.getChannelData(0);
      for (let i = 0; i < samples.length; i++) {
        const t = i / rate,
          slot = Math.floor(t / 0.3),
          within = t % 0.3;
        if (slot < 6 && within < 0.2) {
          const envelope = Math.min(1, within / 0.02, (0.2 - within) / 0.03);
          samples[i] =
            Math.sin(2 * Math.PI * (slot % 2 ? 1046 : 880) * t) *
            Math.max(0, envelope) *
            0.7;
        }
      }
    }
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(this.master);
    source.start();
    this.active.push(source);
    this.stopTimer = window.setTimeout(
      () => this.stop(),
      Math.min(120, Math.max(1, maxSeconds)) * 1000,
    );
    return true;
  }

  play(repeatCount = 3, urgency: ReminderAlarmUrgency = "standard") {
    if (
      !this.context ||
      !this.master ||
      this.context.state !== "running" ||
      this.volume === 0
    )
      return false;
    this.stop();
    const base = this.context.currentTime;
    const configuredRepeats = Math.min(
      20,
      Math.max(1, Math.round(repeatCount)),
    );
    const repeats =
      urgency === "appointment-due"
        ? Math.max(5, configuredRepeats)
        : configuredRepeats;
    let totalSeconds = 0;
    if (this.customBuffer) {
      const spacing =
        this.customBuffer.duration +
        (urgency === "appointment-due" ? 0.12 : 0.35);
      for (let index = 0; index < repeats; index += 1) {
        const source = this.context.createBufferSource();
        source.buffer = this.customBuffer;
        source.connect(this.master);
        source.start(base + index * spacing);
        this.active.push(source);
      }
      totalSeconds = repeats * spacing;
    } else {
      const frequencies =
        urgency === "appointment-due"
          ? [988, 1318, 988, 1480]
          : [880, 1046, 880];
      const repeatSpacing = urgency === "appointment-due" ? 0.82 : 0.85;
      const toneSpacing = urgency === "appointment-due" ? 0.16 : 0.22;
      const toneDuration = urgency === "appointment-due" ? 0.14 : 0.16;
      const peakGain = urgency === "appointment-due" ? 0.95 : 0.7;
      for (let repeat = 0; repeat < repeats; repeat += 1) {
        frequencies.forEach((frequency, index) => {
          const oscillator = this.context!.createOscillator();
          const envelope = this.context!.createGain();
          const start = base + repeat * repeatSpacing + index * toneSpacing;
          oscillator.type = urgency === "appointment-due" ? "square" : "sine";
          oscillator.frequency.value = frequency;
          envelope.gain.setValueAtTime(0.0001, start);
          envelope.gain.exponentialRampToValueAtTime(peakGain, start + 0.025);
          envelope.gain.exponentialRampToValueAtTime(
            0.0001,
            start + toneDuration,
          );
          oscillator.connect(envelope).connect(this.master!);
          oscillator.onended = () => {
            oscillator.disconnect();
            envelope.disconnect();
          };
          oscillator.start(start);
          oscillator.stop(start + toneDuration + 0.02);
          this.active.push(oscillator);
        });
      }
      totalSeconds = repeats * repeatSpacing;
    }
    this.stopTimer = window.setTimeout(
      () => {
        this.active = [];
        this.stopTimer = null;
      },
      Math.ceil(totalSeconds * 1_000) + 250,
    );
    return true;
  }
}

let singleton: NotificationAudioManager | null = null;
export function getNotificationAudioManager() {
  singleton ??= new NotificationAudioManager();
  return singleton;
}

export type StoredSound = { name: string; type: string; data: ArrayBuffer };

function openAudioDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("mabeslink-device-settings", 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("audio"))
        request.result.createObjectStore("audio");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(new Error("Penyimpanan alarm browser tidak tersedia."));
  });
}

export async function saveCustomSound(userId: string, sound: StoredSound) {
  const database = await openAudioDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction("audio", "readwrite");
    transaction.objectStore("audio").put(sound, userId);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(new Error("Alarm lokal gagal disimpan."));
  });
  database.close();
}

export async function loadCustomSound(userId: string) {
  const database = await openAudioDatabase();
  const sound = await new Promise<StoredSound | null>((resolve, reject) => {
    const request = database
      .transaction("audio", "readonly")
      .objectStore("audio")
      .get(userId);
    request.onsuccess = () =>
      resolve((request.result as StoredSound | undefined) ?? null);
    request.onerror = () => reject(new Error("Alarm lokal gagal dibaca."));
  });
  database.close();
  return sound;
}

export async function deleteCustomSound(userId: string) {
  const database = await openAudioDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction("audio", "readwrite");
    transaction.objectStore("audio").delete(userId);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(new Error("Alarm lokal gagal dihapus."));
  });
  database.close();
}
