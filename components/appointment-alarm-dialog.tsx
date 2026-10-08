"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BellRing, MapPin, Users, Volume2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { clientApi } from "@/lib/client-api";
import { formatDateTime } from "@/lib/format";
import {
  getNotificationAudioManager,
  loadSoundPreferences,
  NOTIFICATION_PREFERENCES_EVENT,
  shouldPlayReminderSound,
} from "@/lib/client/notification-audio";

type AlarmData = {
  serverNow: string;
  active: boolean;
  snoozeDeadline: string | null;
  appointment: {
    code: string;
    title: string;
    appointmentAt: string;
    contact: string;
    business: string;
    location: string | null;
    controller: string;
    nextAction: string;
    link: string;
  } | null;
};
export function AppointmentAlarmDialog({
  id,
  title,
  userId,
  quietStart,
  quietEnd,
  onDone,
}: {
  id: string;
  title: string;
  userId: string;
  quietStart: string;
  quietEnd: string;
  onDone: (id: string) => void;
}) {
  const [data, setData] = useState<AlarmData | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sound, setSound] = useState("Memeriksa aktivasi suara…");
  const liveRef = useRef(false);
  const finishingRef = useRef(false);
  const play = useCallback(
    async (gesture = false) => {
      const prefs = loadSoundPreferences(userId),
        manager = getNotificationAudioManager();
      if (
        !prefs.soundEnabled ||
        prefs.muted ||
        prefs.volume === 0 ||
        !prefs.reminderKinds.appointments ||
        !shouldPlayReminderSound(
          "APPOINTMENT_PRE_DUE",
          new Date(),
          quietStart,
          quietEnd,
        )
      ) {
        setSound(
          "Suara tidak dibunyikan: pengaturan mute/volume/kategori atau jam tenang.",
        );
        return;
      }
      if (gesture) await manager.activate();
      if (manager.state !== "running") {
        setSound(
          "Browser belum mengaktifkan audio. Klik Bunyikan suara atau aktifkan melalui pengaturan.",
        );
        return;
      }
      const result = await clientApi<{ claimed: boolean }>(
        `/api/notifications/${id}/claim`,
        { method: "POST", body: JSON.stringify({ channel: "AUDIO" }) },
      );
      if (!liveRef.current || finishingRef.current) return;
      if (!result.claimed) {
        setSound(
          "Alarm sudah diklaim atau tidak lagi berlaku; suara tidak diulang otomatis.",
        );
        return;
      }
      manager.setVolume(prefs.volume);
      manager.startAlarm();
      setSound(
        "Alarm aktif sampai Matikan/Ingatkan lagi, maksimal 2 menit. Volume mengikuti pengaturan Anda.",
      );
    },
    [id, userId, quietStart, quietEnd],
  );
  useEffect(() => {
    let live = true;
    liveRef.current = true;
    finishingRef.current = false;
    const refresh = async (initial = false) => {
      try {
        const value = await clientApi<AlarmData>(
          `/api/notifications/${id}/alarm`,
        );
        if (!live) return;
        if (!value.active) {
          onDone(id);
          return;
        }
        setData(value);
        if (initial) await play();
      } catch (cause) {
        if (live)
          setError(
            cause instanceof Error
              ? cause.message
              : "Detail alarm gagal dimuat.",
          );
      }
    };
    void refresh(true);
    const poll = setInterval(() => void refresh(), 5000);
    const silence = () => {
      const prefs = loadSoundPreferences(userId);
      if (prefs.muted || !prefs.soundEnabled || prefs.volume === 0)
        getNotificationAudioManager().stop();
    };
    window.addEventListener("storage", silence);
    window.addEventListener(NOTIFICATION_PREFERENCES_EVENT, silence);
    return () => {
      live = false;
      liveRef.current = false;
      clearInterval(poll);
      getNotificationAudioManager().stop();
      window.removeEventListener("storage", silence);
      window.removeEventListener(NOTIFICATION_PREFERENCES_EVENT, silence);
    };
  }, [id, onDone, play, userId]);
  async function finish(minutes?: 1 | 5 | 10) {
    if (finishingRef.current) return;
    finishingRef.current = true;
    getNotificationAudioManager().stop();
    setBusy(true);
    setError("");
    try {
      await clientApi(`/api/notifications/${id}/alarm`, {
        method: "POST",
        body: JSON.stringify(
          minutes ? { action: "SNOOZE", minutes } : { action: "DISMISS" },
        ),
      });
      onDone(id);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Perubahan belum tersimpan. Suara sudah dihentikan; coba lagi.",
      );
    } finally {
      finishingRef.current = false;
      setBusy(false);
    }
  }
  const item = data?.appointment;
  return (
    <Dialog
      open
      onClose={() => void finish()}
      title="Alarm janji"
      description={title}
      busy={busy}
      className="max-w-2xl"
      footer={
        <div className="space-y-3">
          <Button
            data-autofocus
            variant="danger"
            className="w-full"
            disabled={busy}
            onClick={() => void finish()}
          >
            Matikan alarm
          </Button>
          <p className="text-center text-xs text-slate-500">
            Ingatkan saya lagi (tidak mengubah pengingat anggota lain)
          </p>
          <div className="grid grid-cols-3 gap-2">
            {([1, 5, 10] as const).map((minutes) => (
              <Button
                key={minutes}
                variant="outline"
                disabled={
                  busy ||
                  !item ||
                  Date.parse(data!.serverNow) + minutes * 60000 >=
                    Date.parse(data!.snoozeDeadline ?? item.appointmentAt)
                }
                onClick={() => void finish(minutes)}
              >
                {" "}
                {minutes} menit
              </Button>
            ))}
          </div>
        </div>
      }
    >
      <div className="mb-5 flex items-center gap-3 rounded-2xl bg-blue-950 p-5 text-white">
        <BellRing className="size-9 shrink-0 motion-safe:animate-pulse" />
        <div>
          <p className="text-xs text-blue-100">Waktu janji (WIB)</p>
          <p className="mt-1 text-lg font-black">
            {item ? formatDateTime(item.appointmentAt) : "Memuat jadwal…"}
          </p>
        </div>
      </div>
      {item && (
        <div className="space-y-4">
          <p className="font-mono text-xs text-blue-700">{item.code}</p>
          <h3 className="text-xl font-black text-blue-950">{item.title}</h3>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-slate-500">Janji dengan</dt>
              <dd className="font-semibold">{item.contact}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Usaha</dt>
              <dd>{item.business}</dd>
            </div>
          </dl>
          <p className="flex gap-2 text-sm">
            <MapPin size={17} />
            {item.location || "Lokasi belum dicantumkan"}
          </p>
          <p className="flex gap-2 text-sm">
            <Users size={17} />
            Kendali: {item.controller}
          </p>
          <p className="rounded-xl bg-slate-50 p-3 text-sm">
            <strong>Next action:</strong> {item.nextAction}
          </p>
          <a
            href={item.link}
            className="inline-flex min-h-11 items-center font-bold text-blue-800 underline"
            onClick={() => getNotificationAudioManager().stop()}
          >
            Buka detail janji
          </a>
        </div>
      )}
      <p className="mt-4 text-xs text-slate-500" role="status">
        {sound}
      </p>
      <Button
        className="mt-2"
        variant="outline"
        disabled={busy || !item}
        onClick={() =>
          void play(true).catch(() =>
            setSound("Audio belum diizinkan browser."),
          )
        }
      >
        <Volume2 size={16} />
        Bunyikan suara
      </Button>
      {error && (
        <p
          className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700"
          role="alert"
        >
          {error}
        </p>
      )}
    </Dialog>
  );
}
