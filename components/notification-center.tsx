"use client";

import { Bell, BellRing, Volume2, VolumeX, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Notice = {
  id: string;
  title: string;
  message: string;
  link: string;
  readAt: string | null;
  createdAt: string;
};

export function NotificationCenter() {
  const [items, setItems] = useState<Notice[]>([]);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"SSE" | "polling">("SSE");
  const [deviceState, setDeviceState] = useState<
    "loading" | "unsupported" | "default" | "granted" | "denied"
  >("loading");
  const [deviceEnabled, setDeviceEnabled] = useState(false);
  const [deviceMessage, setDeviceMessage] = useState("");
  const seen = useRef(new Set<string>());
  const deviceEnabledRef = useRef(false);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    deviceEnabledRef.current = deviceEnabled;
  }, [deviceEnabled]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (
        !("Notification" in window) ||
        !("serviceWorker" in navigator) ||
        !window.isSecureContext
      ) {
        setDeviceState("unsupported");
        return;
      }
      setDeviceState(Notification.permission);
      const saved = localStorage.getItem("mabeslink-device-reminder") === "on";
      setDeviceEnabled(saved && Notification.permission === "granted");
      navigator.serviceWorker
        .register("/mabeslink-notifications-sw.js", { scope: "/" })
        .then((registration) => {
          registrationRef.current = registration;
        })
        .catch(() =>
          setDeviceMessage("Service worker notifikasi gagal dimuat."),
        );
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let poll: ReturnType<typeof setInterval> | undefined;
    const alertDevice = async (notice: Notice) => {
      if (!deviceEnabledRef.current || Notification.permission !== "granted")
        return;
      try {
        const registration =
          registrationRef.current ?? (await navigator.serviceWorker.ready);
        await registration.showNotification(notice.title, {
          body: notice.message,
          tag: `mabeslink-${notice.id}`,
          data: { url: notice.link },
        });
        const context = audioContextRef.current;
        if (context) {
          await context.resume();
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          oscillator.frequency.value = 880;
          gain.gain.setValueAtTime(0.12, context.currentTime);
          gain.gain.exponentialRampToValueAtTime(
            0.001,
            context.currentTime + 0.35,
          );
          oscillator.connect(gain).connect(context.destination);
          oscillator.start();
          oscillator.stop(context.currentTime + 0.35);
        }
        navigator.vibrate?.([180, 100, 180]);
      } catch {
        setDeviceMessage(
          "Notifikasi tersimpan, tetapi alarm perangkat tidak dapat ditampilkan.",
        );
      }
    };
    const merge = (incoming: Notice[], announce: boolean) =>
      setItems((old) => {
        const fresh = incoming.filter((x) => !seen.current.has(x.id));
        const next = [...fresh, ...old];
        incoming.forEach((x) => seen.current.add(x.id));
        if (announce)
          fresh
            .filter((notice) => !notice.readAt)
            .forEach((notice) => void alertDevice(notice));
        return next.slice(0, 30);
      });
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((r) => merge(r.data ?? [], false))
      .catch(() => {});
    const source = new EventSource("/api/notifications/stream");
    source.addEventListener("notification", (event) =>
      merge([JSON.parse((event as MessageEvent).data)], true),
    );
    source.onopen = () => setMode("SSE");
    source.onerror = () => {
      setMode("polling");
      if (!poll)
        poll = setInterval(
          () =>
            fetch("/api/notifications")
              .then((r) => r.json())
              .then((r) => merge(r.data ?? [], true))
              .catch(() => {}),
          5_000,
        );
    };
    return () => {
      source.close();
      if (poll) clearInterval(poll);
    };
  }, []);

  const enableDeviceReminder = async () => {
    setDeviceMessage("");
    if (
      !("Notification" in window) ||
      !("serviceWorker" in navigator) ||
      !window.isSecureContext
    ) {
      setDeviceState("unsupported");
      setDeviceMessage("Notifikasi perangkat memerlukan HTTPS atau localhost.");
      return;
    }
    const permission = await Notification.requestPermission();
    setDeviceState(permission);
    if (permission !== "granted") {
      setDeviceEnabled(false);
      localStorage.removeItem("mabeslink-device-reminder");
      setDeviceMessage("Izin notifikasi belum diberikan pada browser ini.");
      return;
    }
    if (!audioContextRef.current) audioContextRef.current = new AudioContext();
    await audioContextRef.current.resume();
    setDeviceEnabled(true);
    localStorage.setItem("mabeslink-device-reminder", "on");
    setDeviceMessage(
      "Alarm aktif. Pengingat perangkat muncul saat MABES LINK terbuka.",
    );
  };

  const disableDeviceReminder = () => {
    setDeviceEnabled(false);
    localStorage.removeItem("mabeslink-device-reminder");
    setDeviceMessage("Alarm perangkat dinonaktifkan pada browser ini.");
  };
  const unread = items.filter((item) => !item.readAt).length;
  const read = async (item: Notice) => {
    await fetch(`/api/notifications/${item.id}`, { method: "PATCH" });
    setItems((old) =>
      old.map((x) =>
        x.id === item.id ? { ...x, readAt: new Date().toISOString() } : x,
      ),
    );
    setOpen(false);
  };
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative grid size-10 place-items-center rounded-xl border bg-white text-slate-700"
        aria-label="Notifikasi"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div className="fixed inset-x-3 top-16 z-[1300] max-h-[70vh] overflow-auto rounded-2xl border bg-white p-3 shadow-xl sm:absolute sm:left-auto sm:right-0 sm:top-12 sm:w-96">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <p className="font-bold">Notifikasi internal</p>
              <p className="text-xs text-slate-500">
                Near-realtime:{" "}
                {mode === "SSE"
                  ? "SSE (poll DB 2 detik)"
                  : "polling cadangan 5 detik"}
              </p>
            </div>
            <button onClick={() => setOpen(false)}>
              <X size={18} />
            </button>
          </div>
          <div className="mb-3 rounded-xl border bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 text-sm font-bold">
                  {deviceEnabled ? (
                    <BellRing size={16} />
                  ) : (
                    <VolumeX size={16} />
                  )}
                  Alarm laptop/HP
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {deviceState === "unsupported"
                    ? "Browser/akses tidak mendukung. Gunakan HTTPS."
                    : deviceEnabled
                      ? "Aktif pada browser ini selama aplikasi terbuka."
                      : "Perlu izin browser dan tindakan pengguna."}
                </p>
              </div>
              {deviceEnabled ? (
                <button
                  type="button"
                  onClick={disableDeviceReminder}
                  className="rounded-lg border bg-white px-3 py-2 text-xs font-bold"
                >
                  Matikan
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void enableDeviceReminder()}
                  disabled={deviceState === "unsupported"}
                  className="flex items-center gap-1 rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                >
                  <Volume2 size={14} /> Aktifkan
                </button>
              )}
            </div>
            {deviceMessage && (
              <p className="mt-2 text-xs text-slate-600">{deviceMessage}</p>
            )}
          </div>
          {items.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              Belum ada notifikasi.
            </p>
          ) : (
            items.map((item) => (
              <Link
                href={item.link}
                onClick={() => void read(item)}
                key={item.id}
                className={`block border-t px-2 py-3 text-sm ${item.readAt ? "opacity-60" : "bg-blue-50"}`}
              >
                <p className="font-bold">{item.title}</p>
                <p className="text-slate-600">{item.message}</p>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
