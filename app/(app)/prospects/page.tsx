import { Role } from "@prisma/client";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { ProspectForm } from "@/components/prospect-form";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { requirePageActor } from "@/lib/session";
import { listProspects } from "@/lib/services/prospects";

export default async function ProspectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requirePageActor();
  const query = await searchParams;
  const search = typeof query.search === "string" ? query.search : undefined;
  const page = Math.max(1, Number(query.page) || 1);
  const data = await listProspects(actor, { page, pageSize: 20, search });
  const assignees = actor.branchId
    ? await db.user.findMany({
        where: {
          branchId: actor.branchId,
          active: true,
          isTest: false,
          role: { in: [Role.OUT_BRANCH, Role.SUPERVISOR] },
        },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : [];
  return (
    <>
      <PageHeader
        eyebrow="Pipeline"
        title="Prospek"
        description="Satu daftar untuk seluruh perjalanan prospek, tanpa membuat basis data kedua."
        actions={
          process.env.ALLOW_MANUAL_REFERENCE_ENTRY === "true" &&
          ([Role.OUT_BRANCH, Role.SUPERVISOR, Role.ADMIN] as Role[]).includes(
            actor.role,
          ) ? (
            <ProspectForm key="form" assignees={assignees} />
          ) : null
        }
      />
      <form className="mb-4 flex gap-2">
        <input
          className="field max-w-md"
          name="search"
          defaultValue={search}
          placeholder="Cari kode, alias, PIC, atau referensi CAKRA…"
        />
        <button className={buttonVariants({ variant: "outline" })}>Cari</button>
        {search ? <Link href="/prospects" className={buttonVariants({ variant: "ghost" })}>Reset</Link> : null}
      </form>
      {data.items.length ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Prospek</th>
                <th>Kebutuhan</th>
                <th>PIC</th>
                <th>Tahap</th>
                <th>Diperbarui</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <Link
                      href={`/prospects/${item.id}`}
                      className="font-bold text-blue-800 hover:underline"
                    >
                      {item.businessAlias}
                    </Link>
                    <p className="mt-1 font-mono text-xs text-slate-400">
                      {item.internalCode}
                    </p>
                    {item.cakraReference ? (
                      <p className="mt-1 text-xs text-slate-500">
                        CAKRA: {item.cakraReference}
                      </p>
                    ) : null}
                  </td>
                  <td className="max-w-sm text-slate-600">{item.need}</td>
                  <td>
                    <p className="font-semibold">{item.assignedTo.name}</p>
                    <p className="text-xs text-slate-500">
                      Kontak: {item.contactPic}
                    </p>
                  </td>
                  <td>
                    <StatusBadge value={item.opportunityStage} />
                  </td>
                  <td className="text-slate-500">
                    {formatDateTime(item.updatedAt)}
                  </td>
                  <td>
                    <Link
                      href={`/prospects/${item.id}`}
                      className={buttonVariants({
                        variant: "ghost",
                        size: "sm",
                      })}
                    >
                      Detail
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="Belum ada prospek"
          description={
            search
              ? "Tidak ada hasil yang cocok. Coba kata kunci lain."
              : "Belum ada referensi existing yang dapat ditampilkan."
          }
        />
      )}
      <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
        <span>{data.pagination.total} prospek</span>
        <div className="flex gap-2">
          {page > 1 ? (
            <Link
              href={`/prospects?page=${page - 1}${search ? `&search=${encodeURIComponent(search)}` : ""}`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Sebelumnya
            </Link>
          ) : null}
          {page < data.pagination.pages ? (
            <Link
              href={`/prospects?page=${page + 1}${search ? `&search=${encodeURIComponent(search)}` : ""}`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Berikutnya
            </Link>
          ) : null}
        </div>
      </div>
    </>
  );
}
