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
export const NOTIFICATION_PREFERENCES_EVENT = "mabeslink:notification-preferences";

export const defaultSoundPreferences: SoundPreferences = {
  soundEnabled: false,
  muted: false,
  volume: 60,
  repeatCount: 3,
  customSoundName: null,
  reminderKinds: {
    appointments: true,
    assignments: true,
    overdue: true,
  },
};

export function normalizeVolume(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(100, Math.max(0, Math.round(number))) : 60;
}

export function isJakartaQuietTime(now: Date, quietStart: string, quietEnd: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  const toMinutes = (value: string) => {
    const [h, m] = value.split(":").map(Number);
    return h * 60 + m;
  };
  const current = hour * 60 + minute;
  const start = toMinutes(quietStart);
  const end = toMinutes(quietEnd);
  if (start === end) return false;
  return start < end ? current >= start && current < end : current >= start || current < end;
}

export function loadSoundPreferences(userId: string): SoundPreferences {
  try {
    const value = JSON.parse(localStorage.getItem(`mabeslink:sound:${userId}`) ?? "null") as Partial<SoundPreferences> | null;
    return value ? {
      soundEnabled: value.soundEnabled === true,
      muted: value.muted === true,
      volume: normalizeVolume(value.volume),
      repeatCount: [1, 3, 5, 10, 20].includes(Number(value.repeatCount)) ? Number(value.repeatCount) : 3,
      customSoundName: typeof value.customSoundName === "string" ? value.customSoundName : null,
      reminderKinds: {
        appointments: value.reminderKinds?.appointments !== false,
        assignments: value.reminderKinds?.assignments !== false,
        overdue: value.reminderKinds?.overdue !== false,
      },
    } : defaultSoundPreferences;
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
  if (type.includes("ASSIGNMENT") || type === "SERVICE_STATUS") return "assignments";
  if (type === "OVERDUE_DIGEST" || type.endsWith("_DUE")) return "overdue";
  return "appointments";
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

export function claimAudioNotice(userId: string, notificationId: string, now = Date.now()) {
  const key = `mabeslink:notice-claim:${userId}:${notificationId}`;
  try {
    const previous = Number(localStorage.getItem(key));
    if (previous && now - previous < 7 * 24 * 60 * 60_000) return false;
    localStorage.setItem(key, String(now));
    return localStorage.getItem(key) === String(now);
  } catch {
    return true;
  }
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
    if (this.master && this.context) this.master.gain.setValueAtTime(this.volume, this.context.currentTime);
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
    if (!Number.isFinite(decoded.duration) || decoded.duration <= 0 || decoded.duration > 30) {
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
      try { oscillator.stop(); } catch { /* sudah berhenti */ }
      oscillator.disconnect();
    }
    this.active = [];
  }

  play(repeatCount = 3) {
    if (!this.context || !this.master || this.context.state !== "running") return false;
    this.stop();
    const base = this.context.currentTime;
    const repeats = Math.min(20, Math.max(1, Math.round(repeatCount)));
    let totalSeconds = 0;
    if (this.customBuffer) {
      const spacing = this.customBuffer.duration + 0.35;
      for (let index = 0; index < repeats; index += 1) {
        const source = this.context.createBufferSource();
        source.buffer = this.customBuffer;
        source.connect(this.master);
        source.start(base + index * spacing);
        this.active.push(source);
      }
      totalSeconds = repeats * spacing;
    } else {
      for (let repeat = 0; repeat < repeats; repeat += 1) {
        [880, 1046, 880].forEach((frequency, index) => {
          const oscillator = this.context!.createOscillator();
          const envelope = this.context!.createGain();
          const start = base + repeat * 0.85 + index * 0.22;
          oscillator.frequency.value = frequency;
          envelope.gain.setValueAtTime(0.0001, start);
          envelope.gain.exponentialRampToValueAtTime(0.7, start + 0.025);
          envelope.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
          oscillator.connect(envelope).connect(this.master!);
          oscillator.start(start);
          oscillator.stop(start + 0.18);
          this.active.push(oscillator);
        });
      }
      totalSeconds = repeats * 0.85;
    }
    this.stopTimer = window.setTimeout(() => { this.active = []; this.stopTimer = null; }, Math.ceil(totalSeconds * 1_000) + 250);
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
      if (!request.result.objectStoreNames.contains("audio")) request.result.createObjectStore("audio");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("Penyimpanan alarm browser tidak tersedia."));
  });
}

export async function saveCustomSound(userId: string, sound: StoredSound) {
  const database = await openAudioDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction("audio", "readwrite");
    transaction.objectStore("audio").put(sound, userId);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(new Error("Alarm lokal gagal disimpan."));
  });
  database.close();
}

export async function loadCustomSound(userId: string) {
  const database = await openAudioDatabase();
  const sound = await new Promise<StoredSound | null>((resolve, reject) => {
    const request = database.transaction("audio", "readonly").objectStore("audio").get(userId);
    request.onsuccess = () => resolve((request.result as StoredSound | undefined) ?? null);
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
