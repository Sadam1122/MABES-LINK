import { OpportunityStage, Role } from "@prisma/client";
import Link from "next/link";
import { ConfirmNeedButton } from "@/components/prospect-actions";
import { FollowUpForm } from "@/components/follow-up-form";
import { HandoverForm } from "@/components/handover-form";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { requirePageActor } from "@/lib/session";
import { getProspect } from "@/lib/services/prospects";

export default async function ProspectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requirePageActor();
  const { id } = await params;
  const item = await getProspect(actor, id);
  const staff = await db.user.findMany({
    where: { branchId: item.branchId, active: true },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });
  const operational = staff.filter((u) =>
    ([Role.OUT_BRANCH, Role.SUPERVISOR] as Role[]).includes(u.role),
  );
  const receivers = staff.filter((u) => u.role === Role.CS);
  const canWork = (
    [Role.OUT_BRANCH, Role.SUPERVISOR, Role.ADMIN] as Role[]
  ).includes(actor.role);
  return (
    <>
      <PageHeader
        eyebrow={item.internalCode}
        title={item.businessAlias}
        description={`PIC pihak usaha: ${item.contactPic}`}
        actions={
          <>
            <StatusBadge value={item.opportunityStage} />
            <Link
              href="/prospects"
              className={buttonVariants({ variant: "outline" })}
            >
              Kembali
            </Link>
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
        <div className="space-y-6">
          <section className="card p-5 sm:p-6">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  Kebutuhan
                </p>
                <p className="mt-2 leading-7 text-slate-800">{item.need}</p>
              </div>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-slate-500">Referensi CAKRA</span>
                  <p className="font-semibold">
                    {item.cakraReference ?? "Tidak ada"}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">PIC petugas</span>
                  <p className="font-semibold">{item.assignedTo.name}</p>
                </div>
                <div>
                  <span className="text-slate-500">Diperbarui</span>
                  <p className="font-semibold">
                    {formatDateTime(item.updatedAt)}
                  </p>
                </div>
              </div>
            </div>
            {item.opportunityStage === OpportunityStage.NEW && canWork ? (
              <div className="mt-5 border-t pt-5">
                <ConfirmNeedButton id={item.id} version={item.version} />
              </div>
            ) : null}
          </section>
          <section>
            <h2 className="mb-3 text-lg font-black">Riwayat tindak lanjut</h2>
            {item.followUps.length ? (
              <div className="space-y-3">
                {item.followUps.map((f) => (
                  <div key={f.id} className="card p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <StatusBadge value={f.status} />
                      <span className="text-xs text-slate-500">
                        Jatuh tempo {formatDateTime(f.dueAt)}
                      </span>
                    </div>
                    <p className="mt-3 font-semibold">{f.summary}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Berikutnya: {f.nextAction} · {f.assignedTo.name}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-slate-500">
                Belum ada tindak lanjut.
              </div>
            )}
          </section>
        </div>
        <aside className="space-y-5">
          {canWork &&
          (
            [
              OpportunityStage.NEED_CONFIRMED,
              OpportunityStage.FOLLOW_UP,
            ] as OpportunityStage[]
          ).includes(item.opportunityStage) ? (
            <FollowUpForm
              prospectId={item.id}
              assignees={operational}
              defaultAssigneeId={item.assignedToId}
            />
          ) : null}
          {canWork &&
          (
            [
              OpportunityStage.NEED_CONFIRMED,
              OpportunityStage.FOLLOW_UP,
            ] as OpportunityStage[]
          ).includes(item.opportunityStage) &&
          !item.handoverItems.length ? (
            <HandoverForm prospectId={item.id} receivers={receivers} />
          ) : null}
          {item.handoverItems.length ? (
            <div className="card p-5">
              <h2 className="font-black">Handover terkait</h2>
              {item.handoverItems.map(({ batch }) => (
                <Link
                  key={batch.id}
                  href={`/handovers/${batch.id}`}
                  className="mt-3 block rounded-xl bg-slate-50 p-3 hover:bg-slate-100"
                >
                  <div className="flex justify-between gap-2">
                    <b className="text-sm">{batch.title}</b>
                    <StatusBadge value={batch.status} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {batch.batchNumber} · {batch.receiver?.name}
                  </p>
                </Link>
              ))}
            </div>
          ) : null}
        </aside>
      </div>
    </>
  );
}
