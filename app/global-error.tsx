"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="id">
      <body className="grid min-h-screen place-items-center bg-slate-50 p-6">
        <main className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-bold uppercase tracking-widest text-blue-700">
            MABES LINK
          </p>
          <h1 className="mt-3 text-2xl font-black text-slate-950">
            Layanan sedang bermasalah
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Data tidak diubah oleh halaman ini. Coba kembali, lalu hubungi
            pengelola internal bila masalah berulang.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-6 rounded-xl bg-blue-800 px-5 py-2.5 text-sm font-bold text-white"
          >
            Coba kembali
          </button>
        </main>
      </body>
    </html>
  );
}
