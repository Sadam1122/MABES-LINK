"use client";

import {
  Bell,
  BellRing,
  Info,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent } from "react";

import { Button } from "@/components/ui/button";
import { useFeedback } from "@/components/ui/feedback";
import {
  deleteCustomSound,
  defaultSoundPreferences,
  getNotificationAudioManager,
  loadCustomSound,
  loadSoundPreferences,
  normalizeVolume,
  NOTIFICATION_PREFERENCES_EVENT,
  type ReminderAlarmUrgency,
  saveCustomSound,
  saveSoundPreferences,
  type ReminderSoundKind,
  type SoundPreferences,
  type StoredSound,
} from "@/lib/client/notification-audio";

const kinds: { key: ReminderSoundKind; label: string }[] = [
  { key: "appointments", label: "Alarm janji (modal pengingat)" },
];

export function NotificationAudioSettings({
  userId,
  quietStart,
  quietEnd,
}: {
  userId: string;
  quietStart: string;
  quietEnd: string;
}) {
  const { confirm, toast } = useFeedback();
  const [preferences, setPreferences] = useState<SoundPreferences>(
    defaultSoundPreferences,
  );
  const [audioReady, setAudioReady] = useState(false);
  const [audioMessage, setAudioMessage] = useState(
    "Suara perlu diaktifkan melalui tombol pada perangkat ini.",
  );
  const [permission, setPermission] = useState<
    NotificationPermission | "unsupported"
  >("default");
  const [browserEnabled, setBrowserEnabled] = useState(false);
  const customSoundRef = useRef<StoredSound | null>(null);

  useEffect(() => {
    const syncPreferences = () => {
      const stored = loadSoundPreferences(userId);
      setPreferences(stored);
      getNotificationAudioManager().setVolume(
        stored.muted || !stored.soundEnabled ? 0 : stored.volume,
      );
      setAudioReady(getNotificationAudioManager().state === "running");
    };
    window.addEventListener("storage", syncPreferences);
    window.addEventListener(NOTIFICATION_PREFERENCES_EVENT, syncPreferences);
    const timer = window.setTimeout(() => {
      const stored = loadSoundPreferences(userId);
      setPreferences(stored);
      getNotificationAudioManager().setVolume(stored.muted ? 0 : stored.volume);
      setAudioReady(getNotificationAudioManager().state === "running");
      void loadCustomSound(userId)
        .then((sound) => {
          customSoundRef.current = sound;
        })
        .catch(() => {
          if (stored.customSoundName)
            setAudioMessage(
              "File alarm tersimpan tidak dapat dibaca. Pilih ulang file alarm.",
            );
        });
      const supported =
        "Notification" in window &&
        "serviceWorker" in navigator &&
        window.isSecureContext;
      if (!supported) setPermission("unsupported");
      else {
        setPermission(Notification.permission);
        setBrowserEnabled(
          localStorage.getItem(`mabeslink:browser-notice:${userId}`) === "on" &&
            Notification.permission === "granted",
        );
      }
    }, 0);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("storage", syncPreferences);
      window.removeEventListener(
        NOTIFICATION_PREFERENCES_EVENT,
        syncPreferences,
      );
    };
  }, [userId]);

  const updatePreferences = (next: SoundPreferences) => {
    setPreferences(next);
    try {
      saveSoundPreferences(userId, next);
    } catch {
      toast(
        "Pengaturan berlaku di tab ini, tetapi penyimpanan browser diblokir.",
        "error",
      );
    }
    getNotificationAudioManager().setVolume(
      next.muted || !next.soundEnabled ? 0 : next.volume,
    );
  };

  const activateSound = async () => {
    const manager = getNotificationAudioManager();
    manager.setVolume(preferences.muted ? 0 : preferences.volume);
    try {
      const ready = await manager.activate();
      if (customSoundRef.current)
        await manager.setCustomSound(customSoundRef.current.data);
      setAudioReady(ready);
      updatePreferences({ ...preferences, soundEnabled: true });
      setAudioMessage(
        ready
          ? "Suara aktif pada tab ini."
          : "Browser belum mengizinkan suara.",
      );
      return ready;
    } catch {
      setAudioReady(false);
      setAudioMessage(
        "Suara dibatasi browser atau perangkat. Periksa izin situs dan volume perangkat.",
      );
      return false;
    }
  };

  const testSound = async (urgency: ReminderAlarmUrgency = "standard") => {
    getNotificationAudioManager().stop();
    const ready = await activateSound();
    const played = ready && getNotificationAudioManager().play(1, "standard");
    setAudioMessage(
      preferences.muted || preferences.volume === 0
        ? "Tes tidak dibunyikan karena mute atau volume nol."
        : !played
          ? "Tes belum berbunyi. Periksa izin audio dan volume perangkat."
          : urgency === "appointment-due"
            ? "Alarm pengingat janji diputar satu kali."
            : "Nada pengingat awal diputar satu kali pada tab ini.",
    );
  };

  const deactivateSound = () => {
    getNotificationAudioManager().stop();
    updatePreferences({ ...preferences, soundEnabled: false });
    setAudioReady(false);
    setAudioMessage("Suara pengingat dimatikan pada perangkat ini.");
  };

  const selectCustomSound = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const supported = [
      "audio/mpeg",
      "audio/wav",
      "audio/x-wav",
      "audio/ogg",
      "audio/mp4",
      "audio/webm",
    ];
    if (!supported.includes(file.type) || file.size > 5 * 1024 * 1024) {
      toast("Pilih MP3, WAV, OGG, M4A, atau WebM maksimal 5 MB.", "error");
      return;
    }
    try {
      const data = await file.arrayBuffer();
      const duration = await getNotificationAudioManager().setCustomSound(data);
      const sound = { name: file.name.slice(0, 120), type: file.type, data };
      await saveCustomSound(userId, sound);
      customSoundRef.current = sound;
      updatePreferences({
        ...preferences,
        soundEnabled: true,
        customSoundName: sound.name,
      });
      setAudioReady(true);
      setAudioMessage(
        `Alarm lokal siap (${duration.toFixed(1)} detik per putaran).`,
      );
      toast("File alarm tersimpan pada browser ini.", "success");
    } catch (reason) {
      toast(
        reason instanceof Error
          ? reason.message
          : "File audio tidak dapat diproses browser.",
        "error",
      );
    }
  };

  const removeCustomSound = async () => {
    if (
      !(await confirm({
        title: "Hapus ringtone pilihan?",
        description:
          "File alarm lokal akan dihapus dari browser ini dan alarm bawaan akan digunakan.",
        confirmLabel: "Hapus ringtone",
        tone: "danger",
      }))
    )
      return;
    try {
      await deleteCustomSound(userId);
      customSoundRef.current = null;
      getNotificationAudioManager().clearCustomSound();
      updatePreferences({ ...preferences, customSoundName: null });
      setAudioMessage("Alarm bawaan digunakan.");
      toast("File alarm lokal dihapus.", "success");
    } catch (reason) {
      toast(
        reason instanceof Error ? reason.message : "Alarm lokal gagal dihapus.",
        "error",
      );
    }
  };

  const toggleBrowserNotification = async () => {
    if (permission === "unsupported") return;
    if (browserEnabled) {
      localStorage.removeItem(`mabeslink:browser-notice:${userId}`);
      window.dispatchEvent(new CustomEvent(NOTIFICATION_PREFERENCES_EVENT));
      setBrowserEnabled(false);
      return;
    }
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === "granted") {
      localStorage.setItem(`mabeslink:browser-notice:${userId}`, "on");
      window.dispatchEvent(new CustomEvent(NOTIFICATION_PREFERENCES_EVENT));
      setBrowserEnabled(true);
      await navigator.serviceWorker
        .register("/mabeslink-notifications-sw.js", { scope: "/" })
        .catch(() => undefined);
    }
  };

  const soundStatus = !preferences.soundEnabled
    ? "Perlu aktivasi"
    : preferences.muted
      ? "Mute"
      : preferences.volume === 0
        ? "Volume nol"
        : audioReady
          ? "Aktif"
          : "Perlu aktivasi ulang";

  return (
    <div className="space-y-5">
      <section className="card space-y-5 p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-black">
              {preferences.muted ? (
                <VolumeX size={20} />
              ) : (
                <Volume2 size={20} />
              )}
              Suara pengingat
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Status perangkat: {soundStatus}.
            </p>
          </div>
          {preferences.soundEnabled && audioReady ? (
            <Button variant="danger" onClick={deactivateSound}>
              Matikan Suara
            </Button>
          ) : (
            <Button variant="success" onClick={() => void activateSound()}>
              Aktifkan Suara
            </Button>
          )}
        </div>

        <div
          className="rounded-xl bg-blue-50 p-3 text-sm text-blue-900"
          title="Alarm berbunyi jika browser mengizinkan audio dan halaman aplikasi masih aktif."
        >
          <p className="flex items-start gap-2">
            <Info className="mt-0.5 shrink-0" size={17} />
            Janji terkonfirmasi diingatkan 24 jam sebelumnya, lalu 15 menit
            (jarak maksimal 1 km) atau 1 jam sebelumnya. Lokasi belum
            terverifikasi memakai cadangan 1 jam. Saat waktu janji tiba, alarm
            juga berbunyi. Ingatkan lagi 1/5/10 menit memunculkan alarm baru.
            Setiap pengingat membuka satu modal alarm; tidak diulang otomatis
            setelah refresh. Browser harus tetap membuka MABES LINK dan audio
            harus pernah diaktifkan pada perangkat ini.
          </p>
        </div>

        <label className="block text-sm font-bold">
          Volume: {preferences.volume}%
          <input
            aria-label="Volume suara"
            type="range"
            min="0"
            max="100"
            step="1"
            value={preferences.volume}
            onChange={(event) =>
              updatePreferences({
                ...preferences,
                volume: normalizeVolume(event.target.value),
              })
            }
            className="mt-2 h-11 w-full accent-blue-800"
          />
        </label>
        <p className="rounded-xl bg-blue-50 p-3 text-sm text-blue-950">
          Simpan, edit, hapus dan perubahan pekerjaan hanya menampilkan
          notifikasi tanpa suara. Suara otomatis hanya saat modal Alarm janji
          muncul; Matikan atau Ingatkan lagi 1/5/10 menit dari modal. Bunyi
          maksimal 2 menit.
        </p>

        <fieldset className="space-y-2">
          <legend className="text-sm font-bold">Bunyikan untuk</legend>
          {kinds.map(({ key, label }) => (
            <label
              key={key}
              className="flex min-h-11 items-center gap-3 rounded-xl border px-3 text-sm"
            >
              <input
                type="checkbox"
                checked={preferences.reminderKinds[key]}
                onChange={(event) =>
                  updatePreferences({
                    ...preferences,
                    reminderKinds: {
                      ...preferences.reminderKinds,
                      [key]: event.target.checked,
                    },
                  })
                }
              />
              {label}
            </label>
          ))}
        </fieldset>

        <div className="rounded-xl border border-dashed bg-slate-50 p-4">
          <p className="text-sm font-bold">Alarm pilihan sendiri</p>
          <p className="mt-1 text-xs text-slate-500">
            Tersimpan hanya pada browser/perangkat ini. Maksimal 5 MB dan 30
            detik per putaran.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border bg-white px-3 text-sm font-bold hover:bg-slate-50">
              <Upload size={16} />
              Pilih file
              <input
                type="file"
                accept="audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/webm"
                className="sr-only"
                onChange={(event) => void selectCustomSound(event)}
              />
            </label>
            {preferences.customSoundName ? (
              <Button variant="danger" onClick={() => void removeCustomSound()}>
                <Trash2 size={16} />
                Hapus
              </Button>
            ) : null}
          </div>
          <p className="mt-2 break-all text-xs font-semibold text-slate-600">
            {preferences.customSoundName ?? "Alarm bawaan MABES LINK"}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void testSound()}>
            Tes Suara
          </Button>
          <Button
            variant="outline"
            onClick={() => void testSound("appointment-due")}
          >
            Tes alarm waktu janji
          </Button>
          <Button
            variant="outline"
            aria-pressed={preferences.muted}
            onClick={() => {
              getNotificationAudioManager().stop();
              updatePreferences({ ...preferences, muted: !preferences.muted });
            }}
          >
            {preferences.muted ? "Bunyikan" : "Mute"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => getNotificationAudioManager().stop()}
          >
            Hentikan suara
          </Button>
        </div>
        <p className="text-sm text-slate-600" role="status">
          {audioMessage}
        </p>
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="text-lg font-black">Notifikasi sistem laptop/HP</h2>
        <p className="mt-1 text-sm text-slate-500">
          Izin browser terpisah dari audio. Notifikasi tidak dijanjikan ketika
          browser atau aplikasi ditutup.
        </p>
        <Button
          className="mt-4"
          variant={browserEnabled ? "danger" : "success"}
          disabled={permission === "unsupported" || permission === "denied"}
          onClick={() => void toggleBrowserNotification()}
        >
          {browserEnabled ? <BellRing size={16} /> : <Bell size={16} />}
          {browserEnabled
            ? "Nonaktifkan notifikasi sistem"
            : permission === "unsupported"
              ? "Perlu HTTPS/localhost"
              : permission === "denied"
                ? "Izin ditolak browser"
                : "Aktifkan notifikasi sistem"}
        </Button>
        <p className="mt-4 text-xs text-slate-500">
          Jam senyap aplikasi: {quietStart}–{quietEnd} WIB untuk pengingat umum.
          Janji terkonfirmasi tetap berbunyi sesuai jadwal. Pengaturan ini
          adalah konfigurasi internal, bukan penetapan SOP bank.
        </p>
      </section>
    </div>
  );
}
