"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export type HomeBannerView = { id: string; title: string; description: string | null; width: number; height: number };

export function HomeBannerCarousel({ banners }: { banners: HomeBannerView[] }) {
  const [active, setActive] = useState(0);
  useEffect(() => {
    if (banners.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setActive((value) => (value + 1) % banners.length), 6500);
    return () => window.clearInterval(timer);
  }, [banners.length]);
  if (!banners.length) return null;
  const current = banners[active] ?? banners[0];
  return <section aria-label="Informasi dan promosi cabang" className="relative overflow-hidden rounded-[2rem] bg-[#092b60] shadow-xl shadow-blue-950/10">
    <div className="relative aspect-[8/5] min-h-[250px] sm:aspect-[16/6]">
      {banners.map((banner, index) => <Image key={banner.id} src={`/api/home-banners/${banner.id}/image`} alt={banner.title} width={banner.width} height={banner.height}
        unoptimized className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${index === active ? "opacity-100" : "opacity-0"}`} aria-hidden={index !== active} />)}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#061a3b]/90 via-[#061a3b]/50 to-transparent px-5 pb-6 pt-20 text-white sm:px-8">
        <p className="text-[10px] font-black uppercase tracking-[.2em] text-amber-200">Kabar dari Mangga Besar</p>
        <h2 className="mt-2 max-w-2xl text-xl font-black sm:text-3xl">{current.title}</h2>
        {current.description && <p className="mt-2 max-w-2xl text-sm text-blue-100">{current.description}</p>}
      </div>
    </div>
    {banners.length > 1 && <div className="absolute right-4 top-4 flex gap-1.5 rounded-full bg-[#061a3b]/60 p-2 backdrop-blur">
      {banners.map((banner, index) => <button key={banner.id} type="button" aria-label={`Tampilkan banner ${index + 1}: ${banner.title}`} aria-current={index === active}
        onClick={() => setActive(index)} className={`h-2.5 rounded-full transition-all ${index === active ? "w-7 bg-amber-300" : "w-2.5 bg-white/70 hover:bg-white"}`} />)}
    </div>}
  </section>;
}
