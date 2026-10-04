import { Role } from "@prisma/client";

import { MappingWorkspace } from "@/components/mapping-workspace";
import { PageHeader } from "@/components/page-header";
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

export default async function MappingPage() {
  const actor = await requirePageActor();
  const data = await listMappingProspects(actor, {
    page: 1,
    pageSize: 100,
  });
  const prospects = data.items.map((prospect) => ({
    ...prospect,
    latitude:
      prospect.latitude == null ? null : Number(prospect.latitude),
    longitude:
      prospect.longitude == null ? null : Number(prospect.longitude),
    locationUpdatedAt: prospect.locationUpdatedAt?.toISOString() ?? null,
    visits: prospect.visits.map((visit) => ({
      ...visit,
      visitedAt: visit.visitedAt.toISOString(),
      createdAt: visit.createdAt.toISOString(),
    })),
    followUps: prospect.followUps.map((followUp) => ({
      ...followUp,
      dueAt: followUp.dueAt.toISOString(),
      createdAt: followUp.createdAt.toISOString(),
      updatedAt: followUp.updatedAt.toISOString(),
      completedAt: followUp.completedAt?.toISOString() ?? null,
    })),
    usageVerifications: prospect.usageVerifications.map((usage) => ({
      ...usage,
      usedAt: usage.usedAt.toISOString(),
      createdAt: usage.createdAt.toISOString(),
    })),
  }));
  return (
    <>
      <PageHeader
        eyebrow="Lokasi operasional"
        title="Mapping"
        description="Peta toko/usaha yang penggunaan produk Mandirinya sudah diverifikasi, termasuk pengguna, produk, PIC internal, dan lokasi."
      />
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
