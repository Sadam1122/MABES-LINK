"use client";

import { Search } from "lucide-react";
import { useId, useMemo, useState } from "react";

import { useDebouncedValue } from "@/lib/client/use-debounced-value";
import {
  mappingMarkerGlyphs,
  mappingMarkerIconOptions,
  type MappingMarkerIconValue,
  type MarkerGroup,
} from "@/lib/mapping-icons";

export function MarkerGlyph({ icon, size = 21 }: { icon: MappingMarkerIconValue; size?: number }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: mappingMarkerGlyphs[icon] }} />;
}

export function MarkerIconPicker({ value, onChange, label = "Ikon penanda" }: {
  value: MappingMarkerIconValue;
  onChange: (value: MappingMarkerIconValue) => void;
  label?: string;
}) {
  const searchId = useId();
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<MarkerGroup | "Semua">("Semua");
  const debouncedQuery = useDebouncedValue(query, 220);
  const selected = mappingMarkerIconOptions.find((item) => item.value === value);
  const visible = useMemo(() => mappingMarkerIconOptions.filter((item) =>
    (group === "Semua" || item.group === group) &&
    `${item.label} ${item.description}`.toLocaleLowerCase("id-ID").includes(debouncedQuery.trim().toLocaleLowerCase("id-ID")),
  ), [debouncedQuery, group]);
  return <fieldset className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
    <legend className="px-1 text-sm font-bold text-slate-800">{label}</legend>
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-blue-50 px-3 py-2 text-sm text-blue-900">
      <span className="flex items-center gap-2"><MarkerGlyph icon={value} /> Terpilih: <strong>{selected?.label}</strong></span>
      <span className="text-xs">{mappingMarkerIconOptions.length} pilihan</span>
    </div>
    <div className="grid gap-2 sm:grid-cols-[1fr_160px]">
      <label htmlFor={searchId} className="relative block text-xs font-semibold text-slate-600">Cari ikon
        <Search size={16} className="pointer-events-none absolute bottom-3 left-3 text-slate-400" />
        <input id={searchId} className="field mt-1 pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Contoh: menara, toko, kafe…" autoComplete="off" />
      </label>
      <label className="block text-xs font-semibold text-slate-600">Kategori ikon
        <select className="field mt-1" value={group} onChange={(event) => setGroup(event.target.value as typeof group)}>
          <option>Semua</option><option>Usaha</option><option>Fasilitas</option><option>Lokasi</option>
        </select>
      </label>
    </div>
    <div className="grid max-h-52 grid-cols-2 gap-2 overflow-y-auto rounded-xl border border-slate-100 p-1.5 sm:grid-cols-3 lg:grid-cols-4">
      {visible.map((option) => <button key={option.value} type="button" aria-label={`Gunakan ikon ${option.label}`} aria-pressed={value === option.value} title={option.description} onClick={() => onChange(option.value)} className={`flex min-h-12 items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs font-semibold transition ${value === option.value ? "border-blue-700 bg-blue-700 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-blue-400 hover:bg-blue-50"}`}>
        <MarkerGlyph icon={option.value} size={19} /><span className="truncate">{option.label}</span>
      </button>)}
      {!visible.length && <p className="col-span-full p-4 text-center text-xs text-slate-500">Ikon tidak ditemukan. Coba kata lain.</p>}
    </div>
  </fieldset>;
}
