import { UsageStatus } from "@prisma/client";
import Link from "next/link";
import { FundingCalculator } from "@/components/funding-calculator";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { prospectScope } from "@/lib/authorization";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { requirePageActor } from "@/lib/session";

export default async function ResultsPage() {
  const actor = await requirePageActor();
  const prospects = await db.prospect.findMany({
    where: prospectScope(actor),
    include: {
      usageVerifications: {
        where: { status: UsageStatus.VERIFIED },
        orderBy: { usedAt: "desc" },
      },
      handoverItems: { include: { batch: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  const ready = prospects.filter((p) =>
    p.handoverItems.some((i) => i.batch.status === "READY"),
  );
  const used = prospects.filter((p) => p.usageVerifications.length);
  return (
    <>
      <PageHeader
        eyebrow="Ringkasan hasil"
        title="Pipeline, Realisasi & Simulasi"
        description="Tiga lapisan ini sengaja dipisahkan agar angka tidak disalahartikan."
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <Badge tone="blue">Pipeline</Badge>
          <p className="mt-3 text-3xl font-black">{prospects.length}</p>
          <p className="text-sm text-slate-500">
            Prospek yang dapat Anda akses
          </p>
        </div>
        <div className="card p-5">
          <Badge tone="amber">Realisasi siap</Badge>
          <p className="mt-3 text-3xl font-black">{ready.length}</p>
          <p className="text-sm text-slate-500">
            Onboarding selesai, belum tentu digunakan
          </p>
        </div>
        <div className="card p-5">
          <Badge tone="green">Realisasi penggunaan</Badge>
          <p className="mt-3 text-3xl font-black">{used.length}</p>
          <p className="text-sm text-slate-500">
            Memiliki referensi bukti penggunaan
          </p>
        </div>
      </div>
      <section className="card mb-6 overflow-hidden">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h2 className="font-black">Realisasi layanan</h2>
            <p className="text-sm text-slate-500">
              Daftar layanan siap dan status pemakaian nyata.
            </p>
          </div>
        </div>
        {ready.length ? (
          <div className="divide-y">
            {ready.map((p) => (
              <div
                key={p.id}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <Link
                    href={`/prospects/${p.id}`}
                    className="font-bold text-blue-800 hover:underline"
                  >
                    {p.businessAlias}
                  </Link>
                  <p className="font-mono text-xs text-slate-400">
                    {p.internalCode}
                  </p>
                </div>
                <div className="sm:text-right">
                  {p.usageVerifications[0] ? (
                    <>
                      <StatusBadge value="VERIFIED" />
                      <p className="mt-1 text-xs text-slate-500">
                        {formatDateTime(p.usageVerifications[0].usedAt)} ·{" "}
                        {p.usageVerifications[0].evidenceReference}
                      </p>
                    </>
                  ) : (
                    <>
                      <StatusBadge value="READY" />
                      <p className="mt-1 text-xs text-slate-400">
                        Belum ada verifikasi penggunaan
                      </p>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="p-6 text-sm text-slate-500">
            Belum ada layanan berstatus siap.
          </p>
        )}
      </section>
      <div>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-lg font-black">Simulasi</h2>
          <Badge tone="purple">Bukan realisasi</Badge>
        </div>
        <FundingCalculator />
      </div>
    </>
  );
}
