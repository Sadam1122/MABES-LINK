import { Role } from "@prisma/client";
import { Building2 } from "lucide-react";

import { AppNav } from "@/components/app-nav";
import { NotificationCenter } from "@/components/notification-center";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db";
import { requirePageActor } from "@/lib/session";

const roleLabel = {
  OUT_BRANCH: "OUTBRANCH",
  CS: "CS",
  SUPERVISOR: "SUPERVISOR",
  ADMIN: "ADMIN",
};

const scopeLabel = {
  OUT_BRANCH: "Penugasan saya",
  CS: "Penugasan & serah terima saya",
  SUPERVISOR: "Seluruh pekerjaan cabang",
  ADMIN: "Semua cabang & akun",
};

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const actor = await requirePageActor();
  const branch = actor.branchId
    ? await db.branch.findUnique({
        where: { id: actor.branchId },
        select: { code: true, name: true },
      })
    : null;
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[244px_1fr]">
      <aside className="hidden min-h-screen flex-col bg-brand-deep text-white lg:fixed lg:inset-y-0 lg:flex lg:w-[244px]">
        <div className="border-b border-white/10 p-5">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-accent font-black text-brand-deep">
              ML
            </div>
            <div>
              <p className="text-lg font-black leading-none">MABES LINK</p>
              <p className="mt-1 text-[11px] text-blue-200">
                Operasional Cabang 11539
              </p>
            </div>
          </div>
        </div>
        <AppNav
          isAdmin={actor.role === Role.ADMIN}
          roleLabel={roleLabel[actor.role]}
          scopeLabel={scopeLabel[actor.role]}
        />
      </aside>
      <AppNav
        isAdmin={actor.role === Role.ADMIN}
        roleLabel={roleLabel[actor.role]}
        scopeLabel={scopeLabel[actor.role]}
        mobileOnly
      />
      <div className="lg:col-start-2">
        <header className="sticky top-0 z-[1100] border-b bg-white/90 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4">
            <div className="flex items-center gap-3 lg:hidden">
              <div className="grid size-9 place-items-center rounded-xl bg-brand font-black text-white">
                ML
              </div>
              <div>
                <p className="text-sm font-black">MABES LINK</p>
                <p className="text-[10px] text-slate-500">11539 · B.2</p>
              </div>
            </div>
            <div className="hidden items-center gap-2 text-sm text-slate-500 lg:flex">
              <Building2 size={16} />
              <span>
                {actor.role === Role.ADMIN
                  ? "Akses superadmin · seluruh cabang"
                  : branch
                    ? `${branch.code} · ${branch.name}`
                    : "Akses lintas cabang"}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <NotificationCenter />
              <div className="hidden text-right sm:block">
                <p className="text-sm font-bold text-slate-900">{actor.name}</p>
                <p className="text-xs text-slate-500">
                  {roleLabel[actor.role]} · {scopeLabel[actor.role]}
                </p>
              </div>
              <Badge tone="blue">{roleLabel[actor.role]}</Badge>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-[1440px] px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:py-8 lg:pb-10">
          {children}
        </main>
      </div>
    </div>
  );
}
