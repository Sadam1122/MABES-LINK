"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";

import type { AppointmentMapPoint } from "@/components/appointment-spread-map";
import { MarkerGlyph } from "@/components/marker-icon-picker";
import { buttonVariants } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { useDebouncedValue } from "@/lib/client/use-debounced-value";

const AppointmentSpreadMap = dynamic(
  () => import("@/components/appointment-spread-map"),
  {
    ssr: false,
    loading: () => <div className="grid min-h-[420px] place-items-center rounded-2xl bg-slate-100 text-sm text-slate-500">Memuat sebaran janji…</div>,
  },
);

export function AppointmentSpreadWorkspace({
  points,
  referenceNow,
}: {
  points: AppointmentMapPoint[];
  referenceNow: string;
}) {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 280);
  const [status, setStatus] = useState("");
  const [pic, setPic] = useState("");
  const [time, setTime] = useState("all");
  const [markerSize, setMarkerSize] = useState(42);
  const picOptions = useMemo(
    () => Array.from(new Set(points.flatMap((item) => item.picNames))).sort(),
    [points],
  );
  const filtered = useMemo(() => {
    const term = debouncedSearch.trim().toLocaleLowerCase("id-ID");
    const now = new Date(referenceNow).getTime();
    return points.filter((item) => {
      const matchesSearch =
        !term ||
        `${item.code} ${item.label} ${item.locationLabel} ${item.picNames.join(" ")}`
          .toLocaleLowerCase("id-ID")
          .includes(term);
      const timestamp = new Date(item.appointmentAt).getTime();
      return (
        matchesSearch &&
        (!status || item.appointmentStatus === status) &&
        (!pic || item.picNames.includes(pic)) &&
        (time === "all" || (time === "upcoming" ? timestamp >= now : timestamp < now))
      );
    });
  }, [debouncedSearch, pic, points, referenceNow, status, time]);

  return (
    <div className="space-y-5">
      <section className="card grid gap-3 p-4 md:grid-cols-5">
        <label className="text-xs font-semibold text-slate-600">Cari janji
          <input className="field mt-1" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Kode, toko, lokasi, atau PIC…" />
        </label>
        <select className="field" value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter status janji">
          <option value="">Semua status</option>
          <option value="CONFIRMED">Terkonfirmasi</option>
          <option value="PENDING_CONFIRMATION">Menunggu konfirmasi</option>
          <option value="NEEDS_SCHEDULING">Perlu dijadwalkan</option>
          <option value="COMPLETED">Terlaksana</option>
        </select>
        <select className="field" value={pic} onChange={(event) => setPic(event.target.value)} aria-label="Filter PIC">
          <option value="">Semua PIC</option>
          {picOptions.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
        <select className="field" value={time} onChange={(event) => setTime(event.target.value)} aria-label="Filter waktu">
          <option value="all">Semua waktu</option>
          <option value="upcoming">Akan datang</option>
          <option value="past">Sudah lewat</option>
        </select>
        <select className="field" value={markerSize} onChange={(event) => setMarkerSize(Number(event.target.value))} aria-label="Ukuran marker">
          <option value="34">Marker kecil</option>
          <option value="42">Marker sedang</option>
          <option value="54">Marker besar</option>
        </select>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(280px,.65fr)]">
        <section className="card overflow-hidden p-2">
          <AppointmentSpreadMap points={filtered} markerSize={markerSize} />
        </section>
        <section className="card max-h-[min(68vh,680px)] overflow-y-auto p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-black">Hasil mapping janji</h2>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-800">{filtered.length} titik</span>
          </div>
          <div className="space-y-3">
            {filtered.map((item) => (
              <article key={item.id} className="rounded-2xl border p-4">
                <p className="font-mono text-xs text-blue-700">{item.code}</p>
                <h3 className="mt-1 flex items-center gap-2 font-bold"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-800"><MarkerGlyph icon={item.markerIcon} size={18} /></span>{item.label}</h3>
                <p className="mt-1 text-xs text-slate-500">{item.locationLabel}</p>
                <p className="mt-2 text-sm font-semibold">{formatDateTime(item.appointmentAt)}</p>
                <p className="mt-1 text-xs text-slate-500">PIC: {item.picNames.join(", ")}</p>
                <Link href={`/work/${item.id}`} className={buttonVariants({ variant: "outline", size: "sm", className: "mt-3 w-full" })}>Lihat detail</Link>
              </article>
            ))}
            {!filtered.length ? <p className="py-10 text-center text-sm text-slate-500">Tidak ada titik yang sesuai filter.</p> : null}
          </div>
        </section>
      </div>
      <p className="text-xs text-slate-500">Pencarian hanya memakai data lokasi yang berwenang Anda lihat. Peta tidak mengirim identitas nasabah ke penyedia tile.</p>
    </div>
  );
}
