"use client";

import dynamic from "next/dynamic";
import { ArrowUpRight, MapPin, Star } from "lucide-react";
import { MABES_BRANCH } from "@/lib/branch-location";

const BranchMap = dynamic(() => import("@/components/branch-map"), { ssr: false, loading: () => <div role="status" className="grid h-[360px] place-items-center bg-blue-50 text-sm text-blue-800 sm:h-[450px]">Memuat peta cabang…</div> });

export function HomeLocationMap({ embedUrl }: { embedUrl: string | null }) {
  return <div className="relative isolate min-w-0 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_20px_60px_rgba(8,43,96,.09)]">
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
      <span className="flex items-center gap-2 text-sm font-black text-[#082b60]"><MapPin size={18} /> {embedUrl ? "Google Maps" : "Lokasi cabang"}</span>
      <a href={MABES_BRANCH.googleMapsUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs font-bold text-blue-800">Buka Maps <ArrowUpRight size={15} /></a>
    </div>
    {embedUrl ? <iframe title="Google Maps KCP Mandiri Jakarta Mangga Besar" src={embedUrl} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen className="h-[360px] w-full border-0 sm:h-[450px]" /> : <BranchMap />}
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-white p-5">
      <div><p className="text-sm font-black text-[#082b60]">Mandiri Jakarta Mangga Besar</p><p className="mt-1 text-xs text-slate-500">Lokasari · Jakarta Barat</p></div>
      <a href={MABES_BRANCH.googleMapsUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 text-xs font-bold text-amber-950"><Star size={16} className="text-amber-600" /> Rating & ulasan di Google <ArrowUpRight size={14} /></a>
      <p className="w-full text-[11px] leading-5 text-slate-500">Rating dan jam layanan terbaru tersedia di Google Maps. Titik acuan bersumber dari direktori publik; konfirmasi sebelum berkunjung.</p>
    </div>
  </div>;
}
