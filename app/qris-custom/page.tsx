import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

import { QrisCustomEditor } from "@/components/qris-custom-editor";

export const metadata: Metadata = {
  title: "QRIS Custom",
  description:
    "Sesuaikan materi tampilan QRIS dari file QRIS resmi yang Anda miliki.",
};

export default function QrisCustomPage() {
  return (
    <main className="min-h-screen bg-[#f4f6f8] text-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5 text-base font-bold tracking-tight text-[#102b58]">
            <Image src="/app-icon.png" alt="" width={34} height={34} className="rounded-lg" />
            MABES LINK
          </Link>
          <Link
            href="/login"
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
          >
            Login petugas
          </Link>
        </div>
      </header>
      <QrisCustomEditor />
    </main>
  );
}
