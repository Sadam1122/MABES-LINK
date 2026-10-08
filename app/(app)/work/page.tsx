import {
  AcquisitionStatus,
  AppointmentStatus,
  Role,
  ServiceCaseStatus,
} from "@prisma/client";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { ServiceCaseForm } from "@/components/service-case-form";
import { ServiceCaseDeleteButton } from "@/components/service-case-delete-button";
import {
  AppointmentCardClockProvider,
  AppointmentCardCountdown,
} from "@/components/appointment-card-countdown";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { mappingProspectScope } from "@/lib/authorization";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { requirePageActor } from "@/lib/session";
import { listServiceCases } from "@/lib/services/service-cases";
import {
  acquisitionCatalog,
  getAcquisitionCategory,
  getAcquisitionProduct,
} from "@/lib/acquisition-products";

const acquisitionStatusLabel: Record<AcquisitionStatus, string> = {
  PROSPECT: "Prospek",
  FOLLOW_UP: "Follow Up",
  PROCESS: "Proses",
  SUCCESS: "Berhasil",
  UNSUCCESSFUL: "Tidak Berhasil",
};

function formatMetric(value: unknown, unit: string | null) {
  if (value == null) return "—";
  const number = Number(value);
  if (unit === "IDR")
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(number);
  const label =
    unit === "ACCOUNT"
      ? "rekening"
      : unit === "MERCHANT"
        ? "merchant"
        : "nasabah";
  return `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(number)} ${label}`;
}

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
  const acquisitionStatus = Object.values(AcquisitionStatus).includes(
    value("acquisitionStatus") as AcquisitionStatus,
  )
    ? (value("acquisitionStatus") as AcquisitionStatus)
    : undefined;
  const acquisitionCategory = acquisitionCatalog.some(
    (category) => category.id === value("acquisitionCategory"),
  )
    ? value("acquisitionCategory")
    : undefined;
  const data = await listServiceCases(actor, {
    page: Math.max(1, Number(value("page")) || 1),
    pageSize: 30,
    search: value("search"),
    status,
    appointmentStatus,
    acquisitionStatus,
    acquisitionCategory,
    overdue: value("overdue") === "1",
  });
  const officers =
    actor.branchId || actor.role === Role.ADMIN
      ? await db.user.findMany({
          where: {
            ...(actor.role === Role.ADMIN
              ? { branchId: { not: null } }
              : { branchId: actor.branchId }),
            active: true,
            isTest: false,
            role: { in: [Role.OUT_BRANCH, Role.CS] },
          },
          select: {
            id: true,
            name: true,
            role: true,
            branchId: true,
            branch: { select: { code: true } },
          },
          orderBy: { name: "asc" },
        })
      : [];
  const savedLocationRows = await db.prospect.findMany({
    where: {
      AND: [
        mappingProspectScope(actor),
        { latitude: { not: null }, longitude: { not: null } },
      ],
    },
    select: {
      id: true,
      businessAlias: true,
      locationLabel: true,
      latitude: true,
      longitude: true,
      mappingMarkerIcon: true,
    },
    orderBy: { locationUpdatedAt: "desc" },
    take: 100,
  });
  const savedLocations = savedLocationRows.flatMap((location) =>
    location.latitude != null && location.longitude != null
      ? [
          {
            id: location.id,
            label: location.locationLabel || location.businessAlias,
            detail: location.businessAlias,
            latitude: Number(location.latitude),
            longitude: Number(location.longitude),
            mappingMarkerIcon: location.mappingMarkerIcon,
          },
        ]
      : [],
  );
  return (
    <>
      <PageHeader
        eyebrow="Kendali layanan"
        title="Akuisisi Nasabah"
        description="Pembuat janji memegang kendali layanan. Tambahkan pendamping, waktu janji WIB, dan lokasi bila tersedia."
        actions={
          <ServiceCaseForm
            officers={officers.map((officer) => ({
              id: officer.id,
              name: officer.name,
              role: officer.role as "CS" | "OUT_BRANCH",
              branchId: officer.branchId,
              branchCode: officer.branch?.code ?? null,
            }))}
            savedLocations={savedLocations}
            currentUserId={actor.id}
            currentBranchId={actor.branchId}
          />
        }
      />
      <form className="card mb-5 grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-5">
        <input
          name="search"
          className="field"
          defaultValue={value("search")}
          placeholder="Cari kode, nasabah, toko, atau produk…"
        />
        <select
          name="acquisitionCategory"
          className="field"
          defaultValue={acquisitionCategory ?? ""}
        >
          <option value="">Semua kategori</option>
          {acquisitionCatalog.map((category) => (
            <option key={category.id} value={category.id}>
              {category.label}
            </option>
          ))}
        </select>
        <select
          name="acquisitionStatus"
          className="field"
          defaultValue={acquisitionStatus ?? ""}
        >
          <option value="">Semua status akuisisi</option>
          {Object.values(AcquisitionStatus).map((item) => (
            <option key={item} value={item}>
              {acquisitionStatusLabel[item]}
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
        <AppointmentCardClockProvider
          serverNow={data.serverNow}
          active={data.items.some(
            (item) =>
              item.appointmentAt &&
              item.appointmentAt > new Date() &&
              item.appointmentStatus === "CONFIRMED" &&
              (item.sourceSystem !== "MABES_LINK" || item.acceptedAt) &&
              !["HANDLED", "VERIFIED", "CLOSED", "CANCELLED"].includes(
                item.status,
              ),
          )}
        >
          <div className="grid gap-4 lg:grid-cols-2">
            {data.items.map((item) => (
              <article
                key={item.id}
                className="card p-5 transition hover:shadow-lg"
              >
                <Link
                  href={`/work/${item.id}`}
                  className="block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-xs text-blue-700">
                        {item.code}
                      </p>
                      <h2 className="mt-1 font-black">{item.title}</h2>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        Akuisisi Nasabah &gt;{" "}
                        {getAcquisitionCategory(item.acquisitionCategory)
                          ?.label ?? "Belum dikategorikan"}{" "}
                        &gt;{" "}
                        {getAcquisitionProduct(
                          item.acquisitionCategory,
                          item.acquisitionProduct,
                        )?.label ?? "Produk belum dipilih"}
                      </p>
                    </div>
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-800">
                      {acquisitionStatusLabel[item.acquisitionStatus]}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-slate-400">Kendali layanan</p>
                      <p className="font-semibold">{item.pic.name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">
                        Waktu janji (WIB)
                      </p>
                      <p className="font-semibold">
                        {item.appointmentAt
                          ? formatDateTime(item.appointmentAt)
                          : "Belum dijadwalkan"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Target</p>
                      <p className="font-semibold">
                        {formatMetric(item.targetValue, item.metricUnit)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Realisasi</p>
                      <p className="font-semibold text-emerald-700">
                        {formatMetric(item.realizationValue, item.metricUnit)}
                      </p>
                    </div>
                  </div>
                </Link>
                <AppointmentCardCountdown
                  item={{
                    appointmentAt: item.appointmentAt?.toISOString() ?? null,
                    appointmentStatus: item.appointmentStatus,
                    serviceStatus: item.status,
                    accepted:
                      item.sourceSystem !== "MABES_LINK" ||
                      Boolean(item.acceptedAt),
                    nextReminder: item.nextReminder,
                  }}
                />
                <div className="mt-4 flex items-center justify-between gap-3 border-t pt-3">
                  <StatusBadge value={item.appointmentStatus} />
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">
                      {item.origin === "IN_BRANCH" ? "In-branch" : "Out-branch"}
                    </span>
                    {actor.role === Role.ADMIN ||
                    actor.role === Role.SUPERVISOR ||
                    item.createdById === actor.id ? (
                      <ServiceCaseDeleteButton
                        id={item.id}
                        version={item.version}
                      />
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </AppointmentCardClockProvider>
      ) : (
        <EmptyState
          title="Belum ada pekerjaan"
          description={
            "Belum ada janji dalam cakupan Anda. Gunakan tombol Buat janji untuk menambahkan jadwal."
          }
        />
      )}
    </>
  );
}
