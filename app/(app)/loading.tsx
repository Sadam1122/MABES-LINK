import { BrandLogo } from "@/components/brand-logo";

export default function Loading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Memuat MABES LINK">
      <BrandLogo className="max-w-[220px] animate-pulse" sizes="220px" />
      <div className="h-9 w-64 animate-pulse rounded-lg bg-slate-200" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            className="h-32 animate-pulse rounded-2xl bg-slate-200"
          />
        ))}
      </div>
    </div>
  );
}
