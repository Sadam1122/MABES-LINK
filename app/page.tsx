import { ArrowRight, BadgeCheck, Compass, MapPin, MapPinned, QrCode, ShieldCheck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getActor } from "@/lib/session";
import { HomeBannerCarousel } from "@/components/home-banner-carousel";
import { HomePromotionCarousel } from "@/components/home-promotion-carousel";
import { HomeLocationMap } from "@/components/home-location-map";
import { ScrollReveal } from "@/components/scroll-reveal";
import { MABES_BRANCH } from "@/lib/branch-location";
import { listHomeBanners } from "@/lib/services/home-banners";

const branchAddress = "Jl. Mangga Besar Raya. 81, Komp THR. Lokasari Blok B. 1, 2, 3, 4, 5, RT.6/RW.7, Tangki, Kec. Taman Sari, Kota Jakarta Barat, Daerah Khusus Ibukota Jakarta 11170";

const questions = [
  ["Apakah halaman ini menerbitkan QRIS baru?", "Tidak. Editor hanya menata bingkai promosi untuk gambar QRIS resmi yang sudah dimiliki merchant. Penerbitan dan aktivasi mengikuti proses resmi Bank Mandiri."],
  ["Apa yang tersedia tanpa biaya?", "Pilihan desain dan unduhan PNG bingkai QRIS. Material cetak, akrilik, atau pemasangan fisik tidak termasuk dalam penawaran ini."],
  ["Apakah data mapping terlihat publik?", "Tidak. Peta, tugas, dan data operasional hanya dapat diakses petugas setelah login, sesuai izin akun."],
  ["Bagaimana agar QRIS tetap dapat dipindai?", "Unggah gambar QRIS resmi yang jelas, jangan menutup atau mengubah kode QR, lalu uji hasil unduhan sebelum digunakan."],
];

export default async function HomePage() {
  if (await getActor()) redirect("/dashboard");
  const banners = await listHomeBanners();
  const mapsKey = process.env.GOOGLE_MAPS_EMBED_KEY?.trim();
  // A URL copied from Google Maps > Share > Embed is also supported without
  // guessing a key or constructing Google's opaque `pb` parameter.
  let sharedEmbed: string | null = null;
  try {
    const url = new URL(process.env.GOOGLE_MAPS_EMBED_URL?.trim() || "");
    if (url.protocol === "https:" && url.hostname === "www.google.com" && url.pathname === "/maps/embed" && url.searchParams.has("pb") && !url.username && !url.password) sharedEmbed = url.toString();
  } catch { /* No valid shared embed; use the public branch map instead. */ }
  const embedUrl = sharedEmbed ?? (mapsKey ? `https://www.google.com/maps/embed/v1/place?${new URLSearchParams({ key: mapsKey, q: `${MABES_BRANCH.name}, ${MABES_BRANCH.address}`, center: `${MABES_BRANCH.latitude},${MABES_BRANCH.longitude}`, zoom: "16", language: "id" })}` : null);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const showAnniversary = today >= "2026-10-01" && today <= "2026-10-31";
  return <main className="min-h-screen overflow-hidden bg-[#f7f9fc] text-[#102b58]">
    <div className="bg-[#092b60] px-4 py-2 text-center text-[11px] font-semibold tracking-wide text-white sm:text-xs">MABES LINK · KCP Mandiri Jakarta Mangga Besar 11539</div>
    <header className="sticky top-0 z-30 border-b border-blue-950/10 bg-white/95 shadow-[0_8px_28px_rgba(8,33,69,.04)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <Link href="/" aria-label="MABES LINK, beranda" className="flex min-w-0 items-center gap-3">
          <Image src="/Gambar/logo.png" alt="MABES LINK" width={2172} height={724} className="h-auto w-32 object-contain sm:w-44" priority />
          <span className="hidden h-8 w-px bg-slate-200 sm:block" />
          <Image src="/Gambar/01-Mandiri%20Master%20Brand%20Logo.png" alt="Mandiri" width={146} height={50} className="hidden h-auto w-28 object-contain sm:block" />
        </Link>
        <nav aria-label="Navigasi beranda" className="hidden items-center gap-7 text-sm font-semibold text-slate-600 md:flex">
          <a href="#qris" className="hover:text-blue-800">Desain QRIS</a><a href="#manfaat" className="hover:text-blue-800">Layanan</a><a href="#lokasi" className="hover:text-blue-800">Lokasi</a><a href="#faq" className="hover:text-blue-800">FAQ</a>
        </nav>
        <Link href="/login" className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#183d76] px-4 py-2 text-xs font-bold text-[#12376b] hover:bg-blue-50 sm:text-sm">Login petugas <ArrowRight size={16} /></Link>
      </div>
    </header>

    <section className="relative isolate bg-[#071f46] text-white">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_78%_30%,rgba(41,126,195,.3),transparent_38%),radial-gradient(circle_at_15%_80%,rgba(245,183,45,.13),transparent_30%)]" />
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-16 sm:px-8 md:py-24 lg:grid-cols-[.95fr_1.05fr]">
        <div className="home-reveal">
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/10 px-4 py-2 text-[11px] font-black uppercase tracking-[.16em] text-amber-200"><BadgeCheck size={15} /> Inisiatif layanan cabang</span>
          <h1 className="mt-6 max-w-2xl text-[clamp(2.6rem,6vw,5.2rem)] font-black leading-[1.05] tracking-[-.055em]">Dekat dengan usaha. <span className="text-[#ffc341]">Terhubung dalam satu langkah.</span></h1>
          <p className="mt-6 max-w-xl text-base leading-8 text-blue-100 sm:text-lg">MABES LINK menghubungkan pemetaan lokasi dan tindak lanjut petugas. Untuk merchant, tersedia editor desain QRIS dengan pilihan Batik Nusantara dan Alam Indonesia.</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/qris-custom" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#ffc341] px-6 py-3 font-black text-[#082c5b] shadow-lg shadow-black/15 hover:bg-amber-300">Buat desain QRIS <ArrowRight size={19} /></Link>
            <a href="#lokasi" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/30 px-6 py-3 font-bold text-white hover:bg-white/10">Temukan cabang</a>
          </div>
          <p className="mt-5 max-w-lg text-xs leading-5 text-blue-200">Bingkai/desain digital gratis. QRIS resmi tidak diterbitkan atau diubah melalui editor ini.</p>
          <div className="mt-8 flex flex-wrap gap-2 text-[11px] font-bold text-blue-100">
            <span className="rounded-full border border-white/20 bg-white/5 px-3 py-2">Peta kerja berizin</span>
            <span className="rounded-full border border-white/20 bg-white/5 px-3 py-2">Tindak lanjut terpantau</span>
            <span className="rounded-full border border-white/20 bg-white/5 px-3 py-2">QRIS Custom digital</span>
          </div>
        </div>
        <div className="home-reveal-delayed relative overflow-hidden rounded-[2rem] border border-white/15 bg-white/10 p-2 shadow-[0_30px_90px_rgba(0,0,0,.3)] sm:p-3">
          <Image src="/Gambar/QRIS%20Sign%20Mockups_%20Batik%20and%20Alam.png" alt="Contoh visual desain QRIS Batik Nusantara dan Alam Indonesia" width={1536} height={1024} className="h-auto w-full rounded-[1.45rem] object-cover" priority />
          <div className="absolute bottom-4 left-4 right-4 rounded-xl bg-[#071f46]/85 px-4 py-2 text-xs font-medium text-white backdrop-blur-md sm:bottom-6 sm:left-6 sm:right-auto">Mockup visual · QR contoh tidak untuk pembayaran</div>
        </div>
      </div>
    </section>

    <section className="relative z-10 mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
      <ScrollReveal><HomePromotionCarousel showAnniversary={showAnniversary} /></ScrollReveal>
    </section>

    {banners.length > 0 && <section className="mx-auto max-w-7xl px-5 pb-10 sm:px-8"><ScrollReveal><HomeBannerCarousel banners={banners} /></ScrollReveal></section>}

    <section aria-label="Ekosistem layanan" className="border-b border-slate-200 bg-white px-5 py-8 sm:px-8">
      <ScrollReveal className="mx-auto max-w-7xl"><p className="mb-5 text-center text-xs font-bold uppercase tracking-[.18em] text-slate-500">Kenali layanan digital Mandiri</p>
        <div className="grid grid-cols-3 items-center gap-3 sm:gap-8">
          {[
            ["/Gambar/Livin%2001-Master%20Brand%20Logo.png", "Livin' by Mandiri"],
            ["/Gambar/Kopra%2001-Master%20Brand%20Logo.png", "Kopra by Mandiri"],
            ["/Gambar/livin%20merchant.jpeg", "Livin' Merchant"],
          ].map(([src, alt]) => <div key={src} className="flex min-h-16 items-center justify-center rounded-2xl border border-slate-100 bg-white px-2 py-3 sm:min-h-20 sm:px-6"><Image src={src} alt={alt} width={230} height={76} className="max-h-12 w-auto max-w-full object-contain sm:max-h-16" /></div>)}
        </div>
      </ScrollReveal>
    </section>

    <section id="qris" className="scroll-mt-20 px-5 py-16 sm:px-8 md:py-24">
      <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[.8fr_1.2fr]">
        <ScrollReveal direction="left"><span className="text-xs font-black uppercase tracking-[.18em] text-blue-700">Desain yang dapat dipersonalisasi</span>
          <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Bingkai yang terasa dekat dengan usaha Anda.</h2>
          <p className="mt-5 max-w-lg leading-7 text-slate-600">Pilih gaya, tulis ajakan singkat, lalu tempatkan dekorasi di area yang aman. Area QRIS dan logo template tetap terlindungi.</p>
          <div className="mt-7 space-y-3 text-sm font-semibold text-slate-700">
            <p className="flex items-center gap-3"><QrCode className="text-blue-700" size={20} /> Gunakan gambar QRIS resmi milik merchant</p>
            <p className="flex items-center gap-3"><Compass className="text-blue-700" size={20} /> Pilih Batik Nusantara atau Alam Indonesia</p>
            <p className="flex items-center gap-3"><ShieldCheck className="text-blue-700" size={20} /> Pratinjau dan unduh desain PNG</p>
          </div>
          <Link href="/qris-custom" className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#123d78] px-6 py-3 font-bold text-white hover:bg-[#0a2c5c]">Mulai desain <ArrowRight size={18} /></Link>
        </ScrollReveal>
        <ScrollReveal direction="right" delay={100} className="grid grid-cols-2 gap-3 rounded-[2rem] bg-[#eaf2f9] p-3 sm:gap-5 sm:p-6">
          <div className="home-floating"><Image src="/qris-template/template-batik-nusantara.png" alt="Template Batik Nusantara" width={1064} height={1478} className="w-full rounded-2xl bg-white shadow-xl shadow-blue-950/10" /><p className="mt-3 text-center text-xs font-bold text-blue-950">Batik Nusantara</p></div>
          <div className="home-floating" style={{ animationDelay: "-4s" }}><Image src="/qris-template/template-alam-indonesia.png" alt="Template Alam Indonesia" width={1064} height={1478} className="w-full rounded-2xl bg-white shadow-xl shadow-blue-950/10" /><p className="mt-3 text-center text-xs font-bold text-blue-950">Alam Indonesia</p></div>
        </ScrollReveal>
      </div>
    </section>

    <section id="manfaat" className="scroll-mt-20 bg-[#edf4fb] px-5 py-16 sm:px-8"><ScrollReveal className="mx-auto max-w-7xl">
      <p className="text-xs font-black uppercase tracking-[.18em] text-blue-700">MABES LINK</p><h2 className="mt-3 max-w-2xl text-3xl font-black tracking-tight sm:text-4xl">Dari lokasi hingga tindak lanjut, tetap satu alur kerja.</h2>
      <p className="mt-4 max-w-2xl text-slate-600">Untuk petugas berwenang, pekerjaan cabang dicatat dan dipantau dalam area login. Halaman publik ini tidak menampilkan data prospek.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          [MapPinned, "Mapping", "Catat lokasi, sumber, dan titiknya; periksa koordinat sebelum digunakan untuk kunjungan."],
          [Compass, "Tindak lanjut", "PIC, jadwal, dan langkah berikutnya terlihat jelas sesuai akses."],
          [BadgeCheck, "Hasil nyata", "Layanan selesai dan penggunaan produk dicatat sebagai hasil yang berbeda."],
        ].map(([Icon, title, text]) => {
          const Symbol = Icon as typeof MapPinned;
          return <div key={title as string} className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm transition-transform duration-300 hover:-translate-y-1 hover:shadow-lg"><div className="grid size-11 place-items-center rounded-2xl bg-blue-50 text-blue-800"><Symbol size={22} /></div><h3 className="mt-5 text-lg font-black">{title as string}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{text as string}</p></div>;
        })}
      </div>
    </ScrollReveal></section>

    <section id="lokasi" className="scroll-mt-20 px-5 py-16 sm:px-8 md:py-20"><div className="mx-auto grid max-w-7xl items-stretch gap-6 lg:grid-cols-[.8fr_1.2fr]">
      <ScrollReveal direction="left" className="rounded-[2rem] bg-[#082b60] p-7 text-white sm:p-10"><p className="text-xs font-black uppercase tracking-[.18em] text-amber-300">Temukan kami</p>
        <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">KCP Mandiri Jakarta Mangga Besar</h2>
        <p className="mt-2 text-sm font-semibold text-blue-200">Kode cabang 11539 · B.2</p>
        <address className="mt-8 flex gap-3 text-sm not-italic leading-7 text-blue-50"><MapPin className="mt-1 shrink-0 text-amber-300" size={20} />{branchAddress}</address>
        <a href={MABES_BRANCH.googleMapsUrl} target="_blank" rel="noreferrer" className="mt-8 inline-flex min-h-11 items-center gap-2 rounded-xl bg-amber-300 px-5 py-3 text-sm font-black text-[#082b60] hover:bg-amber-200">Buka di Google Maps <ArrowRight size={18} /></a>
        <p className="mt-4 text-xs leading-5 text-blue-200">Periksa lokasi dan jam layanan pada kanal resmi sebelum berkunjung. Alamat di halaman ini mengikuti informasi yang diberikan pengelola.</p>
      </ScrollReveal>
      <ScrollReveal direction="right" delay={100} className="min-w-0"><HomeLocationMap embedUrl={embedUrl} /></ScrollReveal>
    </div></section>

    <section id="faq" className="scroll-mt-20 px-5 py-16 sm:px-8 md:py-20"><div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[.7fr_1.3fr]">
      <ScrollReveal direction="left"><p className="text-xs font-black uppercase tracking-[.18em] text-blue-700">Pertanyaan umum</p><h2 className="mt-3 text-3xl font-black tracking-tight">Yang perlu diketahui sebelum mulai.</h2></ScrollReveal>
      <ScrollReveal delay={100} className="space-y-3">{questions.map(([question, answer]) => <details key={question} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><summary className="cursor-pointer list-none pr-5 font-bold marker:hidden">{question}<span className="float-right text-blue-700 group-open:rotate-45">+</span></summary><p className="mt-3 text-sm leading-6 text-slate-600">{answer}</p></details>)}</ScrollReveal>
    </div></section>
    <footer className="bg-[#071f46] px-5 py-10 text-white sm:px-8"><div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-[1fr_auto] md:items-end">
      <div><div className="flex items-center gap-4"><Link href="/" aria-label="MABES LINK, kembali ke atas"><Image src="/Gambar/logo-white.png" alt="MABES LINK" width={2172} height={724} className="h-auto w-36 object-contain" /></Link><span className="h-7 w-px bg-white/30" /><Image src="/Gambar/02-Mandiri%20Master%20Brand%20Inverse%20Logo.png" alt="Mandiri" width={126} height={44} className="h-auto w-28 object-contain" /></div>
        <p className="mt-4 max-w-xl text-sm leading-6 text-blue-200">KCP Mandiri Jakarta Mangga Besar · Kode 11539. Fitur operasional memerlukan akun petugas dan kewenangan yang sesuai.</p><p className="mt-4 text-xs text-blue-300">© {new Date().getFullYear()} MABES LINK. Mockup QRIS hanya ilustrasi; QR demo tidak untuk pembayaran.</p></div>
      <div className="flex flex-col items-start gap-4 md:items-end"><div className="flex flex-wrap items-center gap-2">
        {[
          ["/Gambar/Livin%2001-Master%20Brand%20Logo.png", "Livin' by Mandiri"],
          ["/Gambar/Kopra%2001-Master%20Brand%20Logo.png", "Kopra by Mandiri"],
          ["/Gambar/livin%20merchant.jpeg", "Livin' Merchant"],
          ["/Gambar/main-danantara-indonesia-horizontal-logo.png", "Danantara Indonesia"],
        ].map(([src, alt]) => <div key={src} className="grid h-12 w-24 place-items-center rounded-lg bg-white p-2"><Image src={src} alt={alt} width={110} height={32} className="max-h-9 max-w-full object-contain" /></div>)}</div><Link href="/login" className="text-sm font-semibold text-amber-300 hover:text-white">Masuk area petugas →</Link></div>
    </div></footer>
  </main>;
}
