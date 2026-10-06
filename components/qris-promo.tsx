import { ArrowUpRight, QrCode } from "lucide-react";
import Link from "next/link";

export function QrisPromo({ compact = false }: { compact?: boolean }) {
  return (
    <section
      aria-label="QRIS Custom"
      className={`relative overflow-hidden rounded-3xl border border-blue-300/20 bg-gradient-to-br from-[#102b58] via-[#123b75] to-[#075a8e] text-white shadow-lg shadow-blue-950/10 ${compact ? "p-5" : "p-6 sm:p-8"}`}
    >
      <div className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full border-[28px] border-white/5" />
      <div className="pointer-events-none absolute -bottom-24 right-16 size-56 rounded-full bg-[#f5b72d]/10 blur-2xl" />
      <div className={`relative flex gap-5 ${compact ? "flex-col" : "flex-col sm:flex-row sm:items-center sm:justify-between"}`}>
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-[.15em] text-[#ffe29a]">
            <QrCode size={14} /> QRIS Custom
          </span>
          <h2 className={`mt-3 font-black tracking-tight ${compact ? "text-xl" : "text-2xl sm:text-3xl"}`}>
            QRIS usahamu, gayamu.
          </h2>
          <p className="mt-2 text-sm leading-6 text-blue-100">
            Pilih Batik Nusantara atau Alam Indonesia, sesuaikan panel bawah,
            lalu unduh bingkai/desain QRIS gratis.
          </p>
          <p className="mt-2 text-xs text-blue-200">
            Editor ini tidak menerbitkan atau mengubah kode QRIS resmi.
          </p>
        </div>
        <Link
          href="/qris-custom"
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 self-start rounded-xl bg-[#f5b72d] px-5 py-3 text-sm font-black text-[#102b58] shadow-sm transition hover:bg-amber-300 sm:self-auto"
        >
          Generate desain QRIS <ArrowUpRight size={18} />
        </Link>
      </div>
    </section>
  );
}
