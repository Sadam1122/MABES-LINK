import Image from "next/image";

import { cn } from "@/lib/utils";

export function BrandLogo({
  className,
  sizes = "180px",
}: {
  className?: string;
  sizes?: string;
}) {
  return (
    <Image
      src="/Gambar/logo.png"
      alt="MABES LINK"
      width={2172}
      height={724}
      sizes={sizes}
      className={cn("h-auto w-full object-contain", className)}
    />
  );
}
