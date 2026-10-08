"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { BellRing, Clock3 } from "lucide-react";
import {
  appointmentCardClock,
  type CardAppointment,
} from "@/lib/appointment-card-clock";
import { formatDateTime } from "@/lib/format";

const ClockContext = createContext(0);

// One clock and one status refresh for the entire list, never one poll per card.
export function AppointmentCardClockProvider({
  serverNow,
  active,
  children,
}: {
  serverNow: string;
  active: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const [tick, setTick] = useState({ base: serverNow, elapsed: 0 });
  useEffect(() => {
    if (!active) return;
    const started = Date.now();
    const interval = setInterval(
      () => setTick({ base: serverNow, elapsed: Date.now() - started }),
      1000,
    );
    return () => clearInterval(interval);
  }, [serverNow, active]);
  useEffect(() => {
    if (!active) return;
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const poll = setInterval(refresh, 15_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(poll);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [active, router]);
  const now =
    Date.parse(serverNow) + (tick.base === serverNow ? tick.elapsed : 0);
  return <ClockContext.Provider value={now}>{children}</ClockContext.Provider>;
}

export function AppointmentCardCountdown({ item }: { item: CardAppointment }) {
  const clock = appointmentCardClock(item, useContext(ClockContext));
  return (
    <div
      className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-3"
      data-testid="card-alarm-panel"
    >
      <p className="flex items-center gap-2 text-xs font-semibold text-blue-900">
        <BellRing className="size-4 shrink-0" />
        {clock.label}
      </p>
      <p
        className="mt-1 break-words text-lg font-bold tabular-nums text-blue-950"
        data-testid="card-alarm-countdown"
      >
        {clock.value}
      </p>
      {clock.nextAt && (
        <p className="mt-1 text-xs text-blue-800">
          {formatDateTime(clock.nextAt)} WIB
        </p>
      )}
      {clock.appointmentCountdown && (
        <p className="mt-2 flex flex-wrap items-center gap-1 text-xs text-slate-600">
          <Clock3 className="size-3.5" />
          Menuju janji:{" "}
          <span
            className="font-semibold tabular-nums"
            data-testid="card-appointment-countdown"
          >
            {clock.appointmentCountdown}
          </span>
        </p>
      )}
      {clock.nextAt && (
        <p className="mt-2 text-xs leading-5 text-slate-500">
          Worker memeriksa tiap 60 detik. Modal muncul saat pengingat diterima;
          suara mengikuti aktivasi dan volume browser.
        </p>
      )}
    </div>
  );
}
