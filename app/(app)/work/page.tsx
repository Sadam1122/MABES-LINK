import { AppointmentStatus, Role, ServiceCaseStatus } from "@prisma/client";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { ServiceCaseForm } from "@/components/service-case-form";
import { StatusBadge, statusLabel } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { prospectScope } from "@/lib/authorization";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { requirePageActor } from "@/lib/session";
import { listServiceCases } from "@/lib/services/service-cases";

export default async function WorkPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requirePageActor();
  const query = await searchParams;
  const value = (key: string) =>
    typeof query[key] === "string" ? (query[key] as string) : undefined;
  const status = Object.values(ServiceCaseStatus).includes(
    value("status") as ServiceCaseStatus,
  )
    ? (value("status") as ServiceCaseStatus)
    : undefined;
  const appointmentStatus = Object.values(AppointmentStatus).includes(
    value("appointmentStatus") as AppointmentStatus,
  )
    ? (value("appointmentStatus") as AppointmentStatus)
    : undefined;
  const [data, prospectRows, officers] = await Promise.all([
    listServiceCases(actor, {
      page: Math.max(1, Number(value("page")) || 1),
      pageSize: 30,
      search: value("search"),
      status,
      appointmentStatus,
      overdue: value("overdue") === "1",
    }),
    db.prospect.findMany({
      where: prospectScope(actor),
      select: {
        id: true,
        internalCode: true,
        cakraReference: true,
        businessAlias: true,
        contactPic: true,
        branchId: true,
        version: true,
        locationLabel: true,
        latitude: true,
        longitude: true,
        locationSource: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
    actor.branchId || actor.role === Role.ADMIN
      ? db.user.findMany({
          where: {
            ...(actor.role === Role.ADMIN
              ? { branchId: { not: null } }
              : { branchId: actor.branchId }),
            active: true,
            isTest: false,
            ...(actor.role !== Role.SUPERVISOR && actor.role !== Role.ADMIN
              ? { id: actor.id }
              : {}),
          },
          select: { id: true, name: true, branchId: true },
          orderBy: { name: "asc" },
        })
      : [],
  ]);
  const prospects = prospectRows.map((prospect) => ({
    ...prospect,
    latitude:
      prospect.latitude == null ? null : Number(prospect.latitude),
    longitude:
      prospect.longitude == null ? null : Number(prospect.longitude),
  }));
  return (
    <>
      <PageHeader
        eyebrow="Kendali layanan"
        title="Akuisisi Nasabah"
        description="Buat janji dari referensi existing, tentukan orang yang ditemui, lokasi, dan waktu agar PIC menerima reminder internal."
        actions={
          actor.role === Role.OUT_BRANCH ||
          actor.role === Role.SUPERVISOR ||
          actor.role === Role.ADMIN ? (
            <ServiceCaseForm prospects={prospects} officers={officers} />
          ) : undefined
        }
      />
      <form className="card mb-5 grid gap-3 p-4 md:grid-cols-4">
        <input
          name="search"
          className="field"
          defaultValue={value("search")}
          placeholder="Cari kode atau referensi…"
        />
        <select name="status" className="field" defaultValue={status ?? ""}>
          <option value="">Semua status</option>
          {Object.values(ServiceCaseStatus).map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </select>
        <select
          name="appointmentStatus"
          className="field"
          defaultValue={appointmentStatus ?? ""}
        >
          <option value="">Semua status janji</option>
          <option value="NEEDS_SCHEDULING">Perlu membuat janji</option>
          <option value="PENDING_CONFIRMATION">Menunggu konfirmasi</option>
          <option value="CONFIRMED">Terkonfirmasi</option>
          <option value="COMPLETED">Terlaksana</option>
          <option value="CANCELLED">Dibatalkan</option>
        </select>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="overdue"
              value="1"
              defaultChecked={value("overdue") === "1"}
            />{" "}
            Terlambat
          </label>
          <button className={buttonVariants({ variant: "outline" })}>
            Filter
          </button>
          {Object.keys(query).length ? (
            <Link href="/work" className={buttonVariants({ variant: "ghost" })}>
              Reset
            </Link>
          ) : null}
        </div>
      </form>
      {data.items.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.items.map((item) => (
            <Link
              key={item.id}
              href={`/work/${item.id}`}
              className="card p-5 transition hover:shadow-lg"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs text-blue-700">{item.code}</p>
                  <h2 className="mt-1 font-black">{item.title}</h2>
                </div>
                <StatusBadge value={item.status} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-slate-400">PIC</p>
                  <p className="font-semibold">{item.pic.name}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Tindak lanjut</p>
                  <p className="font-semibold">{formatDateTime(item.dueAt)}</p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between border-t pt-3">
                <StatusBadge value={item.appointmentStatus} />
                <span className="text-xs text-slate-500">
                  {item.origin === "IN_BRANCH" ? "In-branch" : "Out-branch"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Belum ada pekerjaan"
          description={
            prospects.length
              ? "Buat janji akuisisi dari referensi existing yang berwenang Anda akses."
              : "Belum ada referensi existing yang dapat digunakan. Hubungi pengelola sumber data resmi."
          }
        />
      )}
    </>
  );
}
