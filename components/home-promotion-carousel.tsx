"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play, QrCode, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { mandiriAnniversaryPromotion, mandiriPromotions } from "@/lib/mandiri-promotions";

export function HomePromotionCarousel({ showAnniversary }: { showAnniversary: boolean }) {
  const slides = showAnniversary ? [...mandiriPromotions, mandiriAnniversaryPromotion] : mandiriPromotions;
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (paused || hovered || focused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setActive((index) => (index + 1) % slides.length), 7000);
    return () => window.clearInterval(timer);
  }, [paused, hovered, focused, slides.length]);
  const slide = slides[active] ?? slides[0];
  const external = slide.href.startsWith("https://");
  return <section aria-label="Inspirasi merchant dan informasi Mandiri" aria-roledescription="carousel" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocusCapture={() => setFocused(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }} className="relative isolate overflow-hidden rounded-[2rem] border border-white/10 bg-[#092b60] text-white shadow-[0_20px_55px_rgba(8,43,96,.15)]">
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 opacity-[.10]">
      <svg viewBox="0 0 1600 520" preserveAspectRatio="none" fill="none" className="h-full w-full" focusable="false">
        <path d="M-100 340C180 340 240 90 520 90S820 350 1080 350 1390 150 1700 150" stroke="#ffc341" strokeWidth="48" strokeLinecap="round" />
        <path d="M-100 412C180 412 240 162 520 162S820 422 1080 422 1390 222 1700 222" stroke="#ffc341" strokeWidth="32" strokeLinecap="round" />
        <path d="M-100 475C180 475 240 225 520 225S820 485 1080 485 1390 285 1700 285" stroke="#ffc341" strokeWidth="18" strokeLinecap="round" />
      </svg>
    </div>
    <div className="relative z-10 grid gap-7 px-6 pb-7 pt-8 sm:px-10 sm:pt-10 lg:grid-cols-[1.05fr_.95fr] lg:items-center">
      <div key={slide.id} className="home-reveal">
        <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.18em] text-amber-300"><Sparkles size={15} />{slide.eyebrow}</p>
        <h2 className="mt-4 max-w-xl text-3xl font-black leading-tight tracking-tight sm:text-4xl">{slide.title}</h2>
        <p className="mt-4 max-w-lg text-sm leading-7 text-blue-100">{slide.description}</p>
        <div className="mt-4 flex flex-wrap gap-2">{slide.products.map((product) => <span key={product} className="rounded-full border border-white/15 bg-[#071f46]/60 px-3 py-1.5 text-[11px] font-medium text-blue-50">{product}</span>)}</div>
        <Link href={slide.href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined} className="mt-6 inline-flex min-h-11 items-center gap-3 rounded-xl bg-[#ffc341] px-5 py-3 text-sm font-black text-[#082b60] hover:bg-amber-200">{slide.cta}<ArrowRight size={17} /></Link>
      </div>
      <div className={`relative min-h-56 overflow-hidden rounded-2xl border border-white/10 ${slide.contain ? "bg-white p-8 sm:p-12" : "bg-white/5"}`}>
        <Image src={slide.image} alt={slide.alt} width={1536} height={1024} unoptimized={slide.image.endsWith(".svg")} className={`h-56 w-full sm:h-64 ${slide.contain ? "object-contain" : "object-cover"}`} />
        {!slide.contain && <span className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full bg-[#071f46]/85 px-3 py-2 text-[10px] text-white"><QrCode size={13} />QR contoh, bukan untuk pembayaran</span>}
      </div>
    </div>
    <div role="group" aria-label="Pilih kelompok produk Mandiri" className="relative z-10 mx-6 flex gap-2 overflow-x-auto pb-3 sm:mx-10">
      {slides.map((item, index) => <button key={item.id} type="button" aria-pressed={active === index} onClick={() => setActive(index)} className={`min-h-10 shrink-0 rounded-full border px-4 text-xs font-bold transition-colors ${active === index ? "border-amber-300 bg-amber-300 text-[#082b60]" : "border-white/20 bg-[#071f46]/65 text-blue-100 hover:bg-white/10"}`}>{item.label}</button>)}
    </div>
    <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-6 py-4 sm:px-10">
      <span className="text-xs font-semibold text-blue-200">{active + 1} / {slides.length} <span className="mx-1 text-white/30">·</span> {slide.label}</span>
      <div className="flex gap-1"><button type="button" aria-label={paused ? "Putar banner" : "Jeda banner"} onClick={() => setPaused((value) => !value)} className="grid size-10 place-items-center rounded-full bg-white/10 hover:bg-white/20">{paused ? <Play size={15} /> : <Pause size={15} />}</button><button type="button" aria-label="Banner sebelumnya" onClick={() => setActive((value) => (value - 1 + slides.length) % slides.length)} className="grid size-10 place-items-center rounded-full bg-white/10 hover:bg-white/20"><ChevronLeft size={19} /></button><button type="button" aria-label="Banner berikutnya" onClick={() => setActive((value) => (value + 1) % slides.length)} className="grid size-10 place-items-center rounded-full bg-white/10 hover:bg-white/20"><ChevronRight size={19} /></button></div>
    </div>
    <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-[#061c40]/80 px-6 py-4 sm:px-10">
      <p className="max-w-xl text-[11px] leading-5 text-blue-200">Informasi pengenalan produk. Biaya, risiko, ketersediaan, dan syarat mengikuti ketentuan resmi Bank Mandiri atau penyedia produk terkait.</p>
      <a href="https://www.bankmandiri.co.id/site-map" target="_blank" rel="noreferrer" className="inline-flex min-h-10 shrink-0 items-center gap-2 text-xs font-bold text-amber-300 hover:text-amber-200">Jelajahi seluruh produk Mandiri <ArrowRight size={15} /></a>
    </div>
  </section>;
}
