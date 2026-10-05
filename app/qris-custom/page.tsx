import type { Metadata } from "next";
import Link from "next/link";

import { QrisCustomEditor } from "@/components/qris-custom-editor";

export const metadata: Metadata = {
  title: "QRIS Custom",
  description:
    "Sesuaikan materi tampilan QRIS dari file QRIS resmi yang Anda miliki.",
};

export default function QrisCustomPage() {
  return (
    <main className="min-h-screen bg-[#f3f6fb] text-slate-900">
      <header className="border-b border-slate-200 bg-white/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-8">
          <Link
            href="/"
            className="text-xl font-black tracking-tight text-[#102b58]"
          >
            MABES <span className="text-[#f5b72d]">LINK</span>
          </Link>
          <Link
            href="/login"
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
          >
            Login petugas
          </Link>
        </div>
      </header>
      <QrisCustomEditor />
    </main>
  );
}
