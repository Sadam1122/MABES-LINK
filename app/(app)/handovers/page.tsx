import { OpportunityStage, Role } from "@prisma/client";
import Link from "next/link";
import { BatchForm } from "@/components/batch-form";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { prospectScope } from "@/lib/authorization";
import { requirePageActor } from "@/lib/session";
import { listHandovers } from "@/lib/services/handovers";

export default async function HandoversPage() {
  const actor = await requirePageActor();
  const data = await listHandovers(actor, { page: 1, pageSize: 50 });
  const canCreate = (
    [Role.OUT_BRANCH, Role.SUPERVISOR, Role.ADMIN] as Role[]
  ).includes(actor.role);
  const prospects = canCreate
    ? await db.prospect.findMany({
        where: {
          AND: [
            prospectScope(actor),
            {
              opportunityStage: {
                in: [
                  OpportunityStage.NEED_CONFIRMED,
                  OpportunityStage.FOLLOW_UP,
                ],
              },
              handoverItems: { none: {} },
            },
          ],
        },
        select: { id: true, internalCode: true, businessAlias: true },
        orderBy: { updatedAt: "desc" },
      })
    : [];
  const receivers = actor.branchId
    ? await db.user.findMany({
        where: { branchId: actor.branchId, role: Role.CS, active: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : [];
  return (
    <>
      <PageHeader
        eyebrow="Out-branch → CS"
        title="Serah Terima"
        description="CS mengakui penerimaan secara eksplisit; status siap tetap terpisah dari penggunaan."
        actions={
          canCreate ? (
            <BatchForm prospects={prospects} receivers={receivers} />
          ) : undefined
        }
      />
      {data.items.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.items.map((item) => (
            <Link
              href={`/handovers/${item.id}`}
              key={item.id}
              className="card block p-5 transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs text-slate-400">
                    {item.batchNumber}
                  </p>
                  <h2 className="mt-1 font-black text-slate-950">
                    {item.title}
                  </h2>
                </div>
                <StatusBadge value={item.status} />
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2 text-sm">
                <div>
                  <p className="text-xs text-slate-400">Tipe</p>
                  <p className="font-semibold">
                    {item.type === "PAYROLL" ? "Payroll" : "Tunggal"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Prospek</p>
                  <p className="font-semibold">{item.items.length}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Kendala terbuka</p>
                  <p className="font-semibold">
                    {
                      item.exceptions.filter((e) => e.status !== "RESOLVED")
                        .length
                    }
                  </p>
                </div>
              </div>
              <div className="mt-4 border-t pt-3 text-xs text-slate-500">
                <span>
                  {item.sender.name} →{" "}
                  {item.receiver?.name ?? "Belum ditentukan"}
                </span>
                <span className="float-right">
                  {formatDateTime(item.updatedAt)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Belum ada handover"
          description={
            actor.role === Role.CS
              ? "Handover yang ditugaskan kepada Anda akan muncul di sini."
              : "Buat handover dari detail prospek atau batch payroll."
          }
        />
      )}
    </>
  );
}
