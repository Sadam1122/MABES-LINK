"use client";

import { Bell, CheckCheck, Radio } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppointmentAlarmDialog } from "@/components/appointment-alarm-dialog";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useFeedback } from "@/components/ui/feedback";
import {
  defaultSoundPreferences,
  getNotificationAudioManager,
  isAppointmentAlarmNotification,
  loadCustomSound,
  loadSoundPreferences,
  NOTIFICATION_PREFERENCES_EVENT,
  shouldCatchUpAppointmentSound,
  type SoundPreferences,
} from "@/lib/client/notification-audio";

type Notice = {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string;
  readAt: string | null;
  createdAt: string;
  reminderExpiresAt?: string | null;
};
type ConnectionMode = "menghubungkan" | "SSE" | "polling" | "terputus";

const formatWib = (value: string) => {
  const formatted = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(value));
  return /\bWIB\b/i.test(formatted) ? formatted : `${formatted} WIB`;
};

export function NotificationCenter({
  userId,
  quietStart,
  quietEnd,
}: {
  userId: string;
  quietStart: string;
  quietEnd: string;
}) {
  const { toast } = useFeedback();
  const [items, setItems] = useState<Notice[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Notice | null>(null);
  const [mode, setMode] = useState<ConnectionMode>("menghubungkan");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [alarms, setAlarms] = useState<Notice[]>([]);
  const closeAlarm = useCallback((id: string) => {
    getNotificationAudioManager().stop();
    setAlarms((current) => current.filter((row) => row.id !== id));
    setItems((current) =>
      current.map((row) =>
        row.id === id ? { ...row, readAt: new Date().toISOString() } : row,
      ),
    );
  }, []);
  const preferencesRef = useRef<SoundPreferences>(defaultSoundPreferences);
  const browserEnabledRef = useRef(false);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const seen = useRef(new Set<string>());
  const dropdownRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !dropdownRef.current?.contains(event.target)
      )
        setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        bellRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  useEffect(() => {
    let disposed = false;
    let arming = false;
    const armSavedSound = async () => {
      const preferences = preferencesRef.current;
      if (
        arming ||
        !preferences.soundEnabled ||
        preferences.muted ||
        preferences.volume === 0
      )
        return;
      arming = true;
      try {
        const manager = getNotificationAudioManager();
        manager.setVolume(preferences.volume);
        const ready = await manager.activate();
        const customSound = await loadCustomSound(userId).catch(() => null);
        if (disposed) return;
        if (customSound) await manager.setCustomSound(customSound.data);
        if (ready && !disposed) {
          window.removeEventListener("pointerdown", armFromGesture, true);
          window.removeEventListener("keydown", armFromGesture, true);
        }
      } catch {
        // Browser dapat tetap meminta aktivasi manual melalui halaman pengaturan.
      } finally {
        arming = false;
      }
    };
    const armFromGesture = () => void armSavedSound();
    const syncPreferences = () => {
      const stored = loadSoundPreferences(userId);
      preferencesRef.current = stored;
      getNotificationAudioManager().setVolume(
        stored.muted || !stored.soundEnabled ? 0 : stored.volume,
      );
      try {
        browserEnabledRef.current =
          "Notification" in window &&
          Notification.permission === "granted" &&
          localStorage.getItem(`mabeslink:browser-notice:${userId}`) === "on";
      } catch {
        browserEnabledRef.current = false;
      }
    };
    syncPreferences();
    window.addEventListener("pointerdown", armFromGesture, true);
    window.addEventListener("keydown", armFromGesture, true);
    window.addEventListener(NOTIFICATION_PREFERENCES_EVENT, syncPreferences);
    window.addEventListener("storage", syncPreferences);
    if ("serviceWorker" in navigator && window.isSecureContext) {
      void navigator.serviceWorker
        .register("/mabeslink-notifications-sw.js", { scope: "/" })
        .then((registration) => {
          registrationRef.current = registration;
        })
        .catch(() => undefined);
    }
    return () => {
      disposed = true;
      getNotificationAudioManager().clearCustomSound();
      registrationRef.current = null;
      window.removeEventListener("pointerdown", armFromGesture, true);
      window.removeEventListener("keydown", armFromGesture, true);
      window.removeEventListener(
        NOTIFICATION_PREFERENCES_EVENT,
        syncPreferences,
      );
      window.removeEventListener("storage", syncPreferences);
    };
  }, [userId]);

  useEffect(() => {
    let source: EventSource | null = null;
    let poll: number | null = null;
    let cancelled = false;
    const controller = new AbortController();
    let requesting = false;
    seen.current.clear();

    const announce = async (notice: Notice) => {
      const fresh =
        Date.now() - new Date(notice.createdAt).getTime() < 90_000 &&
        (!notice.reminderExpiresAt ||
          new Date(notice.reminderExpiresAt).getTime() > Date.now());
      if (!fresh || notice.readAt) return;
      const claim = async (channel: "AUDIO" | "POPUP") => {
        const response = await fetch(`/api/notifications/${notice.id}/claim`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ channel }),
        });
        return response.ok && (await response.json()).data?.claimed === true;
      };
      const display = await claim("POPUP").catch(() => false);
      if (cancelled) return;
      if (display) toast(`${notice.title}: ${notice.message}`, "info");
      if (
        display &&
        browserEnabledRef.current &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        // OS notification must never hold up the audio path.
        const registration = registrationRef.current;
        if (registration?.active) {
          void registration
            .showNotification(notice.title, {
              body: notice.message,
              tag: `mabeslink-${notice.id}`,
              silent: true, // Sound is owned by the appointment modal, never the OS toast.
              data: { url: notice.link },
            })
            .catch(() => undefined);
        }
      }
      if (isAppointmentAlarmNotification(notice.type)) {
        if (display)
          setAlarms((current) =>
            current.some((row) => row.id === notice.id)
              ? current
              : [...current, notice].slice(0, 10),
          );
        return; // The modal owner alone claims/loops audio for this recipient.
      }
      // Saving, edits, assignments and follow-ups remain visual-only. Only
      // AppointmentAlarmDialog may claim audio and start an automatic alarm.
    };

    const merge = (incoming: Notice[], shouldAnnounce: boolean) => {
      if (cancelled) return;
      const fresh = incoming.filter((notice) => !seen.current.has(notice.id));
      incoming.forEach((notice) => seen.current.add(notice.id));
      setItems((current) => {
        const merged = [
          ...incoming,
          ...current.filter(
            (row) => !incoming.some((notice) => notice.id === row.id),
          ),
        ];
        return Array.from(new Map(merged.map((row) => [row.id, row])).values())
          .sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? 1 : -1))
          .slice(0, 30);
      });
      if (shouldAnnounce)
        fresh
          .filter((notice) => !notice.readAt)
          .forEach((notice) => void announce(notice));
    };

    const requestItems = async (announceNew: boolean) => {
      const response = await fetch("/api/notifications", {
        cache: "no-store",
        signal: controller.signal,
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.error?.message ?? "Notifikasi gagal dimuat.");
      merge((payload.data ?? []) as Notice[], announceNew);
      return (payload.data ?? []) as Notice[];
    };

    const pollNow = () => {
      if (requesting || cancelled) return;
      requesting = true;
      void requestItems(true)
        .then(() => {
          if (!cancelled) {
            setError("");
            setMode("polling");
          }
        })
        .catch(() => {
          if (cancelled) return;
          setMode("terputus");
          setError(
            "Pembaruan notifikasi sedang terputus. Sistem akan mencoba lagi.",
          );
        })
        .finally(() => {
          requesting = false;
        });
    };

    void requestItems(false)
      .then((initial) => {
        if (cancelled) return;
        setLoading(false);
        const catchup = initial
          .filter((notice) =>
            shouldCatchUpAppointmentSound(
              notice.type,
              notice.readAt,
              notice.createdAt,
            ),
          )
          .sort(
            (left, right) =>
              new Date(right.createdAt).getTime() -
              new Date(left.createdAt).getTime(),
          )
          .slice(0, 1);
        // Show a fresh reminder immediately, even if audio is not activated.
        // Never defer it to an unrelated Save/Edit click later on.
        catchup.forEach((notice) => void announce(notice));
        const cursor = initial.reduce(
          (maximum, item) =>
            BigInt(item.id) > maximum ? BigInt(item.id) : maximum,
          BigInt(0),
        );
        source = new EventSource(`/api/notifications/stream?cursor=${cursor}`);
        source.addEventListener("notification", (event) => {
          try {
            const notice = JSON.parse((event as MessageEvent).data) as Notice;
            if (!/^\d+$/.test(notice.id)) return;
            merge([notice], true);
            setError("");
          } catch {
            setError(
              "Pesan realtime belum dapat dibaca. Mencoba polling cadangan.",
            );
            pollNow();
          }
        });
        source.onopen = () => {
          setMode("SSE");
          if (poll != null) window.clearInterval(poll);
          poll = null;
        };
        source.onerror = () => {
          setMode("polling");
          if (poll == null) poll = window.setInterval(pollNow, 5_000);
        };
      })
      .catch((reason) => {
        if (cancelled) return;
        setLoading(false);
        setError(
          reason instanceof Error ? reason.message : "Notifikasi gagal dimuat.",
        );
        setMode("polling");
        poll = window.setInterval(pollNow, 5_000);
      });

    return () => {
      cancelled = true;
      controller.abort();
      source?.close();
      if (poll != null) window.clearInterval(poll);
    };
  }, [quietEnd, quietStart, toast, userId]);

  const unread = items.filter((item) => !item.readAt).length;
  const closeDetail = () => {
    setSelected(null);
    window.setTimeout(() => bellRef.current?.focus(), 0);
  };
  const markRead = async (item: Notice) => {
    if (item.readAt) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/notifications/${item.id}`, {
        method: "PATCH",
      });
      if (!response.ok) throw new Error();
      const readAt = new Date().toISOString();
      setItems((current) =>
        current.map((row) => (row.id === item.id ? { ...row, readAt } : row)),
      );
      setSelected((current) =>
        current?.id === item.id ? { ...current, readAt } : current,
      );
    } catch {
      toast("Notifikasi belum dapat ditandai dibaca.", "error");
    } finally {
      setBusy(false);
    }
  };

  const markAllRead = async () => {
    if (!unread) return;
    setBusy(true);
    try {
      const response = await fetch("/api/notifications", { method: "PATCH" });
      if (!response.ok) throw new Error();
      const readAt = new Date().toISOString();
      setItems((current) =>
        current.map((row) => ({ ...row, readAt: row.readAt ?? readAt })),
      );
      setSelected((current) =>
        current ? { ...current, readAt: current.readAt ?? readAt } : current,
      );
      toast("Semua notifikasi ditandai sudah dibaca.", "success");
    } catch {
      toast("Semua notifikasi belum dapat ditandai dibaca.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {alarms[0] && (
        <AppointmentAlarmDialog
          key={alarms[0].id}
          id={alarms[0].id}
          title={alarms[0].title}
          userId={userId}
          quietStart={quietStart}
          quietEnd={quietEnd}
          onDone={closeAlarm}
        />
      )}
      <div ref={dropdownRef} className="relative">
        <button
          ref={bellRef}
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="relative grid size-11 place-items-center rounded-xl border bg-white text-slate-700 transition hover:bg-slate-50 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={`Notifikasi${unread ? `, ${unread} belum dibaca` : ""}`}
        >
          <Bell size={19} />
          {unread > 0 ? (
            <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
              {unread > 99 ? "99+" : unread}
            </span>
          ) : null}
        </button>

        {open ? (
          <section
            role="menu"
            aria-label="Dropdown notifikasi"
            className="absolute right-0 top-14 z-[4500] w-[min(26rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border bg-white shadow-2xl"
          >
            <div className="border-b p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-black">Notifikasi</h2>
                  <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                    <Radio
                      size={13}
                      className={
                        mode === "SSE" ? "text-emerald-600" : "text-amber-600"
                      }
                    />
                    {mode === "SSE"
                      ? "Tersambung near-realtime"
                      : mode === "polling"
                        ? "Polling cadangan 5 detik"
                        : mode}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy || unread === 0}
                  onClick={() => void markAllRead()}
                >
                  <CheckCheck size={15} /> Semua dibaca
                </Button>
              </div>
            </div>
            {error ? (
              <p
                className="m-3 rounded-xl bg-red-50 p-3 text-sm text-red-700"
                role="alert"
              >
                {error}
              </p>
            ) : null}
            {loading ? (
              <div className="space-y-2 p-3" aria-busy="true">
                {[1, 2, 3].map((value) => (
                  <div
                    key={value}
                    className="h-20 animate-pulse rounded-xl bg-slate-100"
                  />
                ))}
              </div>
            ) : items.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-500">
                Belum ada notifikasi.
              </p>
            ) : (
              <div className="max-h-[min(60vh,32rem)] divide-y overflow-y-auto">
                {items.map((item) => (
                  <article
                    key={item.id}
                    className={item.readAt ? "p-4" : "bg-blue-50 p-4"}
                    role="menuitem"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-bold">{item.title}</p>
                      {!item.readAt ? (
                        <span
                          className="mt-1 size-2 shrink-0 rounded-full bg-blue-700"
                          aria-label="Belum dibaca"
                        />
                      ) : null}
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">
                      {item.message}
                    </p>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <time className="text-[11px] text-slate-400">
                        {formatWib(item.createdAt)}
                      </time>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setOpen(false);
                          setSelected(item);
                        }}
                      >
                        Lihat detail
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            )}
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="block min-h-11 border-t px-4 py-3 text-center text-sm font-bold text-blue-800 hover:bg-slate-50"
            >
              Lihat semua notifikasi
            </Link>
          </section>
        ) : null}
      </div>

      <Dialog
        open={selected !== null}
        onClose={closeDetail}
        title={selected?.title ?? "Detail notifikasi"}
        description="Detail pengingat internal"
        className="max-w-3xl"
      >
        {selected ? (
          <div className="space-y-5">
            <div className="rounded-2xl border bg-slate-50 p-5">
              <p className="whitespace-pre-wrap text-base leading-7 text-slate-700">
                {selected.message}
              </p>
              <time className="mt-4 block text-sm font-semibold text-slate-500">
                {formatWib(selected.createdAt)}
              </time>
              <p className="mt-2 text-xs text-slate-400">
                {selected.readAt ? "Sudah dibaca" : "Belum dibaca"}
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              {!selected.readAt ? (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => void markRead(selected)}
                >
                  Tandai sudah dibaca
                </Button>
              ) : null}
              <Button variant="ghost" onClick={closeDetail}>
                Tutup
              </Button>
              <Link
                href={selected.link}
                onClick={() => void markRead(selected)}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-800 px-4 text-sm font-bold text-white hover:bg-blue-900"
              >
                Buka pekerjaan
              </Link>
            </div>
          </div>
        ) : null}
      </Dialog>
    </>
  );
}
