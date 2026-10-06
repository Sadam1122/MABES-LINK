import {
  Activity,
  BadgeCheck,
  CheckCheck,
  Clock3,
  Handshake,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { QrisPromo } from "@/components/qris-promo";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { requirePageActor } from "@/lib/session";
import { getDashboard } from "@/lib/services/dashboard";

export default async function DashboardPage() {
  const actor = await requirePageActor();
  const data = await getDashboard(actor);
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
    </>
  );
}
