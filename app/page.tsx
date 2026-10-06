import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getActor } from "@/lib/session";

export default async function HomePage() {
  if (await getActor()) redirect("/dashboard");
  return (
    <main className="flex min-h-screen flex-col bg-[#102b58] text-white">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <span className="text-xl font-black">
          MABES <span className="text-[#f5b72d]">LINK</span>
        </span>
        <Link
          href="/login"
          className="rounded-full border border-white/40 px-5 py-2 text-sm font-bold hover:bg-white/10"
        >
          Login petugas
        </Link>
      </header>
      <section className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-6 py-16 lg:grid-cols-2">
        <div>
          <p className="text-xs font-black uppercase tracking-[.25em] text-[#f5b72d]">
            KCP Mandiri Jakarta Mangga Besar · 11539
          </p>
          <h1 className="mt-5 text-5xl font-black leading-tight sm:text-6xl">
            QRIS usahamu, <span className="text-[#f5b72d]">gayamu.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-blue-100">
            Unggah QRIS resmi, pilih Batik Nusantara atau Alam Indonesia,
            tambahkan tulisan dan stiker di panel bawah, lalu unduh PNG.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              href="/qris-custom"
              className="rounded-xl bg-[#f5b72d] px-6 py-3 font-black text-[#102b58] hover:bg-amber-300"
            >
              Buat QRIS Custom Gratis
            </Link>
            <Link
              href="/login"
              className="rounded-xl border border-white/50 px-6 py-3 font-bold hover:bg-white/10"
            >
              Area petugas
            </Link>
          </div>
          <p className="mt-5 max-w-xl text-xs text-blue-100">
            Fitur ini hanya mengubah desain tampilan di sekitar QRIS. QRIS resmi
            tidak dibuat ulang dan tidak dimodifikasi.
          </p>
        </div>
        <div className="rounded-[2rem] border border-white/20 bg-white/10 p-6 shadow-2xl">
          <div className="grid grid-cols-2 gap-4">
            <Image src="/qris-template/template-batik-nusantara.png" alt="Pilihan desain Batik Nusantara" width={1064} height={1478} className="w-full rounded-xl bg-white shadow-lg" />
            <Image src="/qris-template/template-alam-indonesia.png" alt="Pilihan desain Alam Indonesia" width={1064} height={1478} className="w-full rounded-xl bg-white shadow-lg" />
          </div>
          <p className="mt-4 text-center text-xs text-blue-100">
            Bingkai/desain QRIS gratis. QRIS tidak diterbitkan melalui halaman ini.
          </p>
        </div>
      </section>
    </main>
  );
}
