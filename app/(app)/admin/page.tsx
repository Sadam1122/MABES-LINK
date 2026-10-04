import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { AdminUserForm } from "@/components/admin-user-form";
import {
  EmailStatusButton,
  UserAccessForm,
  UserStatusButton,
} from "@/components/admin-actions";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db";
import { requirePageActor } from "@/lib/session";
import { listUsers } from "@/lib/services/admin";

const roleLabel: Record<Role, string> = {
  [Role.ADMIN]: "ADMIN",
  [Role.CS]: "CS",
  [Role.SUPERVISOR]: "SUPERVISOR",
  [Role.OUT_BRANCH]: "OUTBRANCH",
};

export default async function AdminPage() {
  const actor = await requirePageActor();
  if (actor.role !== Role.ADMIN) redirect("/dashboard");
  const [users, branches] = await Promise.all([
    listUsers(actor),
    db.branch.findMany({
      select: { id: true, code: true, name: true },
      orderBy: { code: "asc" },
    }),
  ]);
  return (
    <>
      <PageHeader
        eyebrow="Administrasi"
        title="Manajemen Pengguna"
        description="ADMIN mengelola akun, role, cabang, dan status. Setiap perubahan diperiksa di server dan dicatat dalam audit log."
      />
      <div className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
        <section className="card overflow-hidden">
          <div className="border-b px-5 py-4">
            <h2 className="font-black">Daftar akun</h2>
          </div>
          <div className="divide-y">
            {users.map((u) => (
              <div
                key={u.id}
                className="px-5 py-4"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-bold">{u.name}</p>
                    <p className="text-sm text-slate-500">
                      {u.email} ·{" "}
                      {u.branch
                        ? `${u.branch.code} ${u.branch.name}`
                        : "Lintas cabang"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                  <Badge tone={u.active ? "green" : "red"}>
                    {u.active ? "Aktif" : "Nonaktif"}
                  </Badge>
                  <Badge tone="blue">{roleLabel[u.role]}</Badge>
                  <Badge tone={u.emailNotificationsEnabled ? "green" : "red"}>
                    {u.emailNotificationsEnabled
                      ? "Email diizinkan"
                      : "Email nonaktif"}
                  </Badge>
                  <EmailStatusButton
                    id={u.id}
                    enabled={u.emailNotificationsEnabled}
                  />
                  <UserStatusButton id={u.id} active={u.active} />
                  </div>
                </div>
                <UserAccessForm id={u.id} role={u.role} branchId={u.branchId} branches={branches} />
              </div>
            ))}
          </div>
        </section>
        <div className="space-y-6">
          <AdminUserForm branches={branches} />
        </div>
      </div>
    </>
  );
}
