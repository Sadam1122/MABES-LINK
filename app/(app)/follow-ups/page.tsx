import { FollowUpStatus } from "@prisma/client";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { CompleteFollowUp } from "@/components/follow-up-action";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { requirePageActor } from "@/lib/session";
import { listFollowUps } from "@/lib/services/follow-ups";

export default async function FollowUpsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requirePageActor();
  const q = await searchParams;
  const due =
    typeof q.due === "string" &&
    ["overdue", "today", "upcoming"].includes(q.due)
      ? (q.due as "overdue" | "today" | "upcoming")
      : undefined;
  const search = typeof q.search === "string" ? q.search : undefined;
  const status =
    typeof q.status === "string" &&
    Object.values(FollowUpStatus).includes(q.status as FollowUpStatus)
      ? (q.status as FollowUpStatus)
      : undefined;
  const assignedToId =
    typeof q.assignedToId === "string" ? q.assignedToId : undefined;
  const held = q.held === "1";
  const [data, assignees] = await Promise.all([
    listFollowUps(actor, {
      page: 1,
      pageSize: 50,
      search,
      due,
      status,
      assignedToId,
      held,
    }),
    actor.branchId
      ? db.user.findMany({
          where: { branchId: actor.branchId, active: true },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : [],
  ]);
  return (
    <>
      <PageHeader
        eyebrow="Pekerjaan saya"
        title="Tindak Lanjut"
        description="Prioritaskan tenggat, PIC, dan pekerjaan yang memerlukan perhatian."
      />
      <form className="card mb-5 grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-[1fr_170px_170px_170px_170px_auto]">
        <input
          className="field"
          name="search"
          defaultValue={search}
          placeholder="Cari usaha, ringkasan, atau aksi…"
        />
        <select className="field" name="due" defaultValue={due ?? ""}>
          <option value="">Semua tenggat</option>
          <option value="overdue">Terlambat</option>
          <option value="today">Hari ini</option>
          <option value="upcoming">Akan datang</option>
        </select>
        <select className="field" name="status" defaultValue={status ?? ""}>
          <option value="">Semua status</option>
          <option value="PLANNED">Terjadwal</option>
          <option value="COMPLETED">Selesai</option>
          <option value="CANCELLED">Dibatalkan</option>
        </select>
        <select
          className="field"
          name="assignedToId"
          defaultValue={assignedToId ?? ""}
        >
          <option value="">Semua PIC</option>
          {assignees.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
        </select>
        <select className="field" name="held" defaultValue={held ? "1" : ""}>
          <option value="">Semua kondisi</option>
          <option value="1">Terkait handover tertahan</option>
        </select>
        <div className="flex gap-2">
          <button className={buttonVariants({ variant: "outline" })}>Terapkan</button>
          {Object.keys(q).length ? <Link href="/follow-ups" className={buttonVariants({ variant: "ghost" })}>Reset</Link> : null}
        </div>
      </form>
      {data.items.length ? (
        <div className="space-y-3">
          {data.items.map((item) => {
            const overdue =
              item.status === FollowUpStatus.PLANNED && item.dueAt < new Date();
            return (
              <article
                key={item.id}
                className={`card p-4 sm:p-5 ${overdue ? "border-red-200" : ""}`}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <StatusBadge value={item.status} />
                      {overdue ? (
                        <span className="text-xs font-bold text-red-600">
                          Terlambat
                        </span>
                      ) : null}
                    </div>
                    <Link
                      href={`/prospects/${item.prospectId}`}
                      className="font-black text-slate-950 hover:text-blue-800"
                    >
                      {item.prospect.businessAlias}
                    </Link>
                    <p className="mt-1 text-sm text-slate-600">
                      {item.summary}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      <b>Berikutnya:</b> {item.nextAction} ·{" "}
                      {item.assignedTo.name} · {formatDateTime(item.dueAt)}
                    </p>
                  </div>
                  {item.status === FollowUpStatus.PLANNED ? (
                    <CompleteFollowUp id={item.id} version={item.version} />
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="Tidak ada tindak lanjut"
          description="Tidak ada pekerjaan yang cocok dengan filter saat ini."
        />
      )}
    </>
  );
}
