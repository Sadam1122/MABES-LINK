import Image from "next/image";

import { cn } from "@/lib/utils";

export function BrandLogo({
  className,
  sizes = "180px",
  onLight = false,
}: {
  className?: string;
  sizes?: string;
  onLight?: boolean;
}) {
  return (
    <Image
      src={onLight ? "/Gambar/logo.png" : "/Gambar/logo-white.png"}
      alt="MABES LINK"
      width={2172}
      height={724}
      sizes={sizes}
      className={cn(
        onLight ? "h-auto w-full object-contain" : "h-auto w-full rounded-lg bg-brand-deep p-2 object-contain",
        className,
      )}
    />
  );
}
