import { Role } from "@prisma/client";
import { Building2 } from "lucide-react";

import { AppNav } from "@/components/app-nav";
import { BrandLogo } from "@/components/brand-logo";
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
  const [branch, notificationConfig] = await Promise.all([
    actor.branchId
      ? db.branch.findUnique({
          where: { id: actor.branchId },
          select: { code: true, name: true },
        })
      : null,
    db.appConfig.findUnique({ where: { key: "notifications" } }),
  ]);
  const notificationValues = notificationConfig?.value as
    | Record<string, unknown>
    | null;
  return (
    <div id="app-shell" className="min-h-screen lg:grid lg:grid-cols-[244px_1fr]">
      <aside className="hidden min-h-screen flex-col bg-brand-deep text-white lg:fixed lg:inset-y-0 lg:flex lg:w-[244px]">
        <div className="border-b border-white/10 p-5">
          <div>
            <BrandLogo className="max-w-[182px]" sizes="182px" />
            <p className="mt-2 text-[11px] text-blue-200">
              Operasional Cabang 11539
            </p>
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
              <BrandLogo className="max-w-[142px]" sizes="142px" />
              <span className="sr-only">11539 · B.2</span>
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
              <NotificationCenter
                userId={actor.id}
                quietStart={String(notificationValues?.quietStart ?? "20:00")}
                quietEnd={String(notificationValues?.quietEnd ?? "07:00")}
              />
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
