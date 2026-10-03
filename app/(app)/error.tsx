"use client";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="card flex min-h-80 flex-col items-center justify-center p-8 text-center">
      <AlertTriangle className="mb-3 text-red-600" size={32} />
      <h1 className="text-xl font-black">Data belum dapat dimuat</h1>
      <p className="mt-2 mb-5 text-sm text-slate-500">
        Periksa koneksi database atau coba muat ulang.
      </p>
      <Button onClick={reset}>Coba lagi</Button>
    </div>
  );
}
