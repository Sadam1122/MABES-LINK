import { Role } from "@prisma/client";
import { MappingWorkspace } from "@/components/mapping-workspace";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { requirePageActor } from "@/lib/session";
import { listMappingProspects } from "@/lib/services/visits";

const roleLabel: Record<Role, string> = {
  [Role.OUT_BRANCH]: "OUTBRANCH",
  [Role.CS]: "CS",
  [Role.SUPERVISOR]: "SUPERVISOR",
  [Role.ADMIN]: "ADMIN",
};

function mappingScopeLabel(role: Role) {
  if (role === Role.ADMIN) return "Semua cabang dan seluruh petugas";
  if (role === Role.SUPERVISOR) return "Seluruh pekerjaan pada cabang Anda";
  if (role === Role.OUT_BRANCH)
    return "Prospek yang ditugaskan atau dibuat oleh Anda";
  return "Prospek pada penugasan atau serah terima Anda";
}

export default async function MappingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requirePageActor();
  const query = await searchParams;
  const value = (key: string) =>
    typeof query[key] === "string" ? (query[key] as string) : undefined;
  const data = await listMappingProspects(actor, {
    page: 1,
    pageSize: 100,
    search: value("search"),
    areaBlock: value("areaBlock"),
    businessSector: value("businessSector"),
    actionNeeded: value("actionNeeded") === "1",
  });
  const prospects = data.items.map((p) => ({
    ...p,
    latitude: p.latitude == null ? null : Number(p.latitude),
    longitude: p.longitude == null ? null : Number(p.longitude),
    locationUpdatedAt: p.locationUpdatedAt?.toISOString() ?? null,
    visits: p.visits.map((v) => ({
      ...v,
      visitedAt: v.visitedAt.toISOString(),
      createdAt: v.createdAt.toISOString(),
    })),
    followUps: p.followUps.map((f) => ({
      ...f,
      dueAt: f.dueAt.toISOString(),
      createdAt: f.createdAt.toISOString(),
      updatedAt: f.updatedAt.toISOString(),
      completedAt: f.completedAt?.toISOString() ?? null,
    })),
  }));
  return (
    <>
      <PageHeader
        eyebrow="Lokasi operasional"
        title="Peta lokasi & kunjungan"
        description="Titik tujuan, pekerjaan terkait, dan tindak lanjut berdasarkan data yang berwenang Anda akses."
      />
      <form className="card mb-5 grid gap-3 p-4 sm:grid-cols-4">
        <input
          className="field"
          name="search"
          defaultValue={value("search")}
          placeholder="Cari kode, alias, area…"
        />
        <input
          className="field"
          name="areaBlock"
          defaultValue={value("areaBlock")}
          placeholder="Area/blok"
        />
        <input
          className="field"
          name="businessSector"
          defaultValue={value("businessSector")}
          placeholder="Sektor usaha"
        />
        <div className="flex gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="actionNeeded"
              value="1"
              defaultChecked={value("actionNeeded") === "1"}
            />{" "}
            Perlu tindakan
          </label>
          <button className={buttonVariants({ variant: "outline" })}>
            Filter
          </button>
        </div>
      </form>
      <MappingWorkspace
        prospects={prospects}
        canEdit={(
          [Role.OUT_BRANCH, Role.SUPERVISOR, Role.ADMIN] as Role[]
        ).includes(actor.role)}
        roleLabel={roleLabel[actor.role]}
        scopeLabel={mappingScopeLabel(actor.role)}
      />
    </>
  );
}
