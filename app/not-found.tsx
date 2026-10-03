import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-6">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-bold uppercase tracking-widest text-blue-700">
          MABES LINK
        </p>
        <h1 className="mt-3 text-2xl font-black text-slate-950">
          Halaman tidak ditemukan
        </h1>
        <p className="mt-3 text-sm text-slate-600">
          Tautan tidak tersedia atau Anda tidak mempunyai akses.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex rounded-xl bg-blue-800 px-5 py-2.5 text-sm font-bold text-white"
        >
          Kembali ke beranda
        </Link>
      </section>
    </main>
  );
}
