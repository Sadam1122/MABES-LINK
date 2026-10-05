import { Role } from "@prisma/client";

import { MappingCreateForm } from "@/components/mapping-create-form";
import { MappingWorkspace } from "@/components/mapping-workspace";
import { PageHeader } from "@/components/page-header";
import { db } from "@/lib/db";
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
  return "Seluruh mapping terverifikasi pada cabang Anda";
}

export default async function MappingPage() {
  const actor = await requirePageActor();
  const data = await listMappingProspects(actor, {
    page: 1,
    pageSize: 100,
  });
  const officers = await db.user.findMany({
    where: {
      active: true,
      isTest: false,
      branchId:
        actor.role === Role.ADMIN
          ? { not: null }
          : (actor.branchId ?? "__NO_BRANCH__"),
      role: { in: [Role.OUT_BRANCH, Role.CS, Role.SUPERVISOR, Role.ADMIN] },
    },
    select: {
      id: true,
      name: true,
      role: true,
      branch: { select: { code: true } },
    },
    orderBy: [{ branchId: "asc" }, { name: "asc" }],
  });
  const prospects = data.items.map((prospect) => ({
    ...prospect,
    latitude: prospect.latitude == null ? null : Number(prospect.latitude),
    longitude: prospect.longitude == null ? null : Number(prospect.longitude),
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
        description="Peta lokasi penggunaan terverifikasi dan permintaan QRIS Custom yang memberi persetujuan tindak lanjut. Status keduanya ditampilkan terpisah."
        actions={
          <MappingCreateForm
            actorId={actor.id}
            officers={officers.map((officer) => ({
              id: officer.id,
              name: officer.name,
              role: roleLabel[officer.role],
              branchCode: officer.branch?.code ?? "Tanpa cabang",
            }))}
          />
        }
      />
      <MappingWorkspace
        prospects={prospects}
        canEdit
        roleLabel={roleLabel[actor.role]}
        scopeLabel={mappingScopeLabel(actor.role)}
      />
    </>
  );
}
