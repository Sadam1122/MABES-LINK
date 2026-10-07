import {
  Activity,
  BadgeCheck,
  CheckCheck,
  Clock3,
  Handshake,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { PageHeader } from "@/components/page-header";
import { QrisPromo } from "@/components/qris-promo";
import { HomeBannerCarousel } from "@/components/home-banner-carousel";
import { HomeBannerManager } from "@/components/home-banner-manager";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { requirePageActor } from "@/lib/session";
import { getDashboard } from "@/lib/services/dashboard";
import { listHomeBanners } from "@/lib/services/home-banners";
import { db } from "@/lib/db";

export default async function DashboardPage() {
  const actor = await requirePageActor();
  const data = await getDashboard(actor);
  const banners = await listHomeBanners();
  const branch = actor.branchId ? await db.branch.findUnique({ where: { id: actor.branchId }, select: { code: true } }) : null;
  const cards = [
    {
      label: "Prospek",
      value: data.metrics.prospects,
      icon: UsersRound,
      tone: "bg-blue-50 text-blue-700",
    },
    {
      label: "Follow-up selesai",
      value: data.metrics.followUpsCompleted,
      icon: CheckCheck,
      tone: "bg-emerald-50 text-emerald-700",
    },
    {
      label: "Tugas terlambat",
      value: data.metrics.followUpsOverdue,
      icon: Clock3,
      tone: "bg-red-50 text-red-700",
    },
    {
      label: "Handover diterima",
      value: data.metrics.handoversAccepted,
      icon: Handshake,
      tone: "bg-violet-50 text-violet-700",
    },
    {
      label: "Layanan siap",
      value: data.metrics.servicesReady,
      icon: BadgeCheck,
      tone: "bg-amber-50 text-amber-700",
    },
    {
      label: "Penggunaan terverifikasi",
      value: data.metrics.usageVerified,
      icon: Activity,
      tone: "bg-cyan-50 text-cyan-700",
    },
  ];
  return (
    <>
      <PageHeader
        eyebrow="Ringkasan operasional"
        title={`Selamat bekerja, ${actor.name.split(" ")[0]}`}
        description="Pantau alur dari pipeline hingga penggunaan nyata. Angka realisasi dipisahkan dari simulasi."
        actions={
          <Link
            href="/prospects"
            className={buttonVariants({ variant: "default" })}
          >
            Buka prospek
          </Link>
        }
      />
      <div className="mb-6">
        <QrisPromo />
      </div>
      {banners.length > 0 && <div className="mb-6"><HomeBannerCarousel banners={banners} /></div>}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(({ label, value, icon: Icon, tone }) => (
          <div className="card flex items-center gap-4 p-5" key={label}>
            <div
              className={`grid size-11 shrink-0 place-items-center rounded-2xl ${tone}`}
            >
              <Icon size={21} />
            </div>
            <div>
              <p className="text-2xl font-black text-slate-950">{value}</p>
              <p className="text-sm font-semibold text-slate-500">{label}</p>
            </div>
          </div>
        ))}
      </section>
      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-black">Business enabler</h2>
              <p className="text-sm text-slate-500">
                Mapping membantu tindak lanjut; pembeda tetap konversi sampai
                penggunaan.
              </p>
            </div>
            <Badge tone="blue">Alur</Badge>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-center">
            <div className="rounded-xl bg-blue-50 p-3">
              <b className="text-2xl">{data.metrics.mappedProspects}</b>
              <p className="text-xs">Prospek bertitik</p>
            </div>
            <div className="rounded-xl bg-blue-50 p-3">
              <b className="text-2xl">{data.metrics.visits}</b>
              <p className="text-xs">Visit tercatat</p>
            </div>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-black">Risk management</h2>
              <p className="text-sm text-slate-500">
                PIC, audit, akses server-side, dan validitas reminder.
              </p>
            </div>
            <Badge tone="green">Kontrol</Badge>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-center">
            <div className="rounded-xl bg-emerald-50 p-3">
              <b className="text-2xl">{data.metrics.reminderSucceeded}</b>
              <p className="text-xs">Job berhasil</p>
            </div>
            <div className="rounded-xl bg-red-50 p-3">
              <b className="text-2xl">{data.metrics.reminderFailed}</b>
              <p className="text-xs">Gagal/ambigu</p>
            </div>
          </div>
        </div>
      </section>
      <section className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
        <div className="card p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black">Pipeline aktif</h2>
              <p className="text-sm text-slate-500">
                Posisi prospek saat ini, bukan realisasi.
              </p>
            </div>
            <Badge tone="blue">Pipeline</Badge>
          </div>
          <div className="space-y-4">
            {Object.entries({
              Baru: data.pipeline.new,
              "Kebutuhan terkonfirmasi": data.pipeline.needConfirmed,
              "Tindak lanjut": data.pipeline.followUp,
              Handover: data.pipeline.handover,
              Diproses: data.pipeline.processing,
            }).map(([label, value]) => (
              <div key={label}>
                <div className="mb-1.5 flex justify-between text-sm">
                  <span className="font-semibold">{label}</span>
                  <b>{value}</b>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-blue-700"
                    style={{
                      width: `${data.metrics.prospects ? Math.max(4, (value / data.metrics.prospects) * 100) : 0}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="card p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black">Realisasi</h2>
              <p className="text-sm text-slate-500">
                Siap dan digunakan dihitung terpisah.
              </p>
            </div>
            <Badge tone="green">Realisasi</Badge>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-amber-50 p-4">
              <p className="text-3xl font-black text-amber-800">
                {data.realization.servicesReady}
              </p>
              <p className="mt-1 text-sm font-semibold text-amber-900">
                Layanan siap
              </p>
            </div>
            <div className="rounded-2xl bg-emerald-50 p-4">
              <p className="text-3xl font-black text-emerald-800">
                {data.realization.usageVerified}
              </p>
              <p className="mt-1 text-sm font-semibold text-emerald-900">
                Sudah digunakan
              </p>
            </div>
          </div>
          <p className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs leading-5 text-blue-800">
            Status siap tidak otomatis menjadi penggunaan. Bukti penggunaan
            dicatat secara eksplisit oleh petugas berwenang.
          </p>
        </div>
      </section>
      <section className="card mt-6 overflow-hidden">
        <div className="border-b px-5 py-4">
          <h2 className="font-black">Aktivitas terbaru cabang</h2>
        </div>
        {data.recent.length ? (
          <div className="divide-y">
            {data.recent.map((log) => (
              <div
                key={log.id}
                className="flex items-start justify-between gap-4 px-5 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    {log.action.replaceAll("_", " ")}
                  </p>
                  <p className="text-xs text-slate-500">
                    {log.actor?.name ?? "Sistem"} · {log.entityType}
                  </p>
                </div>
                <time className="shrink-0 text-xs text-slate-400">
                  {formatDateTime(log.createdAt)}
                </time>
              </div>
            ))}
          </div>
        ) : (
          <p className="p-6 text-sm text-slate-500">Belum ada aktivitas.</p>
        )}
      </section>
      <section className="mt-6 grid gap-4 overflow-hidden rounded-3xl border border-blue-100 bg-[#edf4fb] p-4 sm:p-6 lg:grid-cols-[1fr_.9fr] lg:items-center" aria-label="Promosi QRIS">
        <div>
          <p className="text-xs font-black uppercase tracking-[.16em] text-blue-700">Untuk merchant yang membutuhkan</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-[#102b58] sm:text-3xl">Bantu tampilkan QRIS dengan desain yang rapi.</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">Batik Nusantara atau Alam Indonesia dapat dipersonalisasi. Bingkai/desain digital tersedia gratis; penerbitan QRIS tetap melalui proses resmi.</p>
          <Link href="/qris-custom" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-[#123d78] px-5 py-3 text-sm font-bold text-white hover:bg-[#0a2c5c]">Buka desain QRIS</Link>
          <details className="mt-5 max-w-xl rounded-xl border border-blue-100 bg-white p-3 text-sm"><summary className="cursor-pointer font-bold text-[#102b58]">FAQ singkat: apakah desain ini menerbitkan QRIS?</summary><p className="mt-2 text-slate-600">Tidak. Gunakan QRIS resmi merchant; editor hanya menata bingkai visual dan tidak mengubah kode pembayaran.</p></details>
        </div>
        <Image src="/Gambar/QRIS%20Sign%20Mockups_%20Batik%20and%20Alam.png" alt="Mockup desain QRIS Batik dan Alam" width={1536} height={1024} className="h-auto w-full rounded-2xl border border-white object-cover shadow-lg" />
      </section>
      {branch?.code === "11539" && <HomeBannerManager initialBanners={banners.map((banner) => ({
        id: banner.id, title: banner.title, description: banner.description, width: banner.width, height: banner.height,
        canDelete: banner.createdById === actor.id || actor.role === "ADMIN" || actor.role === "SUPERVISOR",
      }))} />}
      <footer className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pb-4 pt-5 text-xs text-slate-500">
        <span>MABES LINK · KCP Mandiri Jakarta Mangga Besar 11539</span>
        <div className="flex flex-wrap items-center gap-3">
          <Image src="/Gambar/logo.png" alt="MABES LINK" width={120} height={40} className="h-auto w-24 object-contain" />
          <Image src="/Gambar/01-Mandiri%20Master%20Brand%20Logo.png" alt="Mandiri" width={100} height={34} className="h-auto w-20 object-contain" />
          <Image src="/Gambar/Livin%2001-Master%20Brand%20Logo.png" alt="Livin' by Mandiri" width={100} height={34} className="h-auto w-20 object-contain" />
          <Image src="/Gambar/Kopra%2001-Master%20Brand%20Logo.png" alt="Kopra by Mandiri" width={100} height={34} className="h-auto w-20 object-contain" />
          <Image src="/Gambar/livin%20merchant.jpeg" alt="Livin' Merchant" width={100} height={34} className="h-auto w-20 object-contain" />
          <Image src="/Gambar/main-danantara-indonesia-horizontal-logo.png" alt="Danantara Indonesia" width={110} height={30} className="h-auto w-24 object-contain" />
        </div>
      </footer>
    </>
  );
}
