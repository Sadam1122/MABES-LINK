import { ExceptionStatus, HandoverStatus, Role } from "@prisma/client";
import Link from "next/link";
import { ExceptionForm, ResolveException } from "@/components/exception-form";
import { HandoverActions } from "@/components/handover-actions";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { UsageForm } from "@/components/usage-form";
import { buttonVariants } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { requirePageActor } from "@/lib/session";
import { getHandover } from "@/lib/services/handovers";

const categoryLabel = {
  OLD_PHONE_OTP: "OTP nomor lama",
  FACE_RECOGNITION: "Face recognition",
  BLOCK_OR_ACTIVATION: "Blokir / aktivasi",
  OTHER_REAL_BLOCKER: "Kendala nyata lain",
};

export default async function HandoverDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requirePageActor();
  const { id } = await params;
  const item = await getHandover(actor, id);
  const canHandle = ([Role.CS, Role.SUPERVISOR, Role.ADMIN] as Role[]).includes(
    actor.role,
  );
  return (
    <>
      <PageHeader
        eyebrow={item.batchNumber}
        title={item.title}
        description={`${item.type === "PAYROLL" ? "Batch payroll" : "Handover tunggal"} · ${item.sender.name} → ${item.receiver?.name ?? "—"}`}
        actions={
          <>
            <StatusBadge value={item.status} />
            <Link
              href="/handovers"
              className={buttonVariants({ variant: "outline" })}
            >
              Kembali
            </Link>
          </>
        }
      />
      <section className="card mb-6 p-5">
        <div className="grid gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-slate-400">Dibuat</p>
            <p className="mt-1 text-sm font-semibold">
              {formatDateTime(item.createdAt)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Dikirim</p>
            <p className="mt-1 text-sm font-semibold">
              {formatDateTime(item.submittedAt)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Diterima CS</p>
            <p className="mt-1 text-sm font-semibold">
              {formatDateTime(item.acceptedAt)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Siap</p>
            <p className="mt-1 text-sm font-semibold">
              {formatDateTime(item.readyAt)}
            </p>
          </div>
        </div>
        <div className="mt-5 border-t pt-5">
          <HandoverActions
            id={item.id}
            version={item.version}
            status={item.status}
            role={actor.role}
          />
        </div>
      </section>
      <div className="grid gap-6 xl:grid-cols-[1.05fr_.95fr]">
        <div className="space-y-6">
          <section>
            <h2 className="mb-3 text-lg font-black">Prospek dalam batch</h2>
            <div className="space-y-3">
              {item.items.map(({ prospect }) => (
                <div key={prospect.id} className="card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <Link
                        href={`/prospects/${prospect.id}`}
                        className="font-black text-blue-800 hover:underline"
                      >
                        {prospect.businessAlias}
                      </Link>
                      <p className="font-mono text-xs text-slate-400">
                        {prospect.internalCode}
                      </p>
                      <p className="mt-2 text-sm text-slate-600">
                        {prospect.need}
                      </p>
                    </div>
                    <div className="text-right">
                      <StatusBadge value={prospect.opportunityStage} />
                      {prospect.usageVerifications.length ? (
                        <p className="mt-2 text-xs font-bold text-emerald-700">
                          Penggunaan terverifikasi
                        </p>
                      ) : (
                        <p className="mt-2 text-xs text-slate-400">
                          Belum ada penggunaan
                        </p>
                      )}
                    </div>
                  </div>
                  {item.status === HandoverStatus.READY &&
                  canHandle &&
                  !prospect.usageVerifications.length ? (
                    <details className="mt-4 border-t pt-4">
                      <summary className="cursor-pointer text-sm font-bold text-blue-800">
                        Catat penggunaan nyata
                      </summary>
                      <div className="mt-4">
                        <UsageForm prospectId={prospect.id} />
                      </div>
                    </details>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
          <section>
            <h2 className="mb-3 text-lg font-black">Subkasus kendala</h2>
            {item.exceptions.length ? (
              <div className="space-y-3">
                {item.exceptions.map((exception) => (
                  <article key={exception.id} className="card p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <StatusBadge value={exception.status} />
                        <span className="text-xs font-bold text-slate-500">
                          {categoryLabel[exception.category]}
                        </span>
                      </div>
                      {canHandle &&
                      exception.status !== ExceptionStatus.RESOLVED ? (
                        <ResolveException
                          batchId={item.id}
                          id={exception.id}
                          version={exception.version}
                        />
                      ) : null}
                    </div>
                    <h3 className="mt-3 font-bold">{exception.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      {exception.detail}
                    </p>
                    <p className="mt-2 text-xs text-slate-400">
                      {exception.prospect?.businessAlias ?? "Seluruh batch"} ·{" "}
                      {exception.assignedTo?.name ?? "Belum ditugaskan"}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-slate-500">
                Tidak ada kendala nyata yang dicatat.
              </div>
            )}
          </section>
        </div>
        <aside>
          {canHandle && item.status !== HandoverStatus.READY ? (
            <ExceptionForm
              batchId={item.id}
              prospects={item.items.map(({ prospect }) => ({
                id: prospect.id,
                businessAlias: prospect.businessAlias,
              }))}
            />
          ) : (
            <div className="card p-5">
              <h2 className="font-black">Catatan status</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Layanan siap bukan bukti penggunaan. Verifikasi penggunaan
                dilakukan terpisah dengan tanggal dan referensi bukti.
              </p>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
