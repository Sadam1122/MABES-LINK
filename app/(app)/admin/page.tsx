import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { AdminUserForm } from "@/components/admin-user-form";
import {
  NotificationConfigForm,
  EmailStatusButton,
  UserStatusButton,
} from "@/components/admin-actions";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db";
import { requirePageActor } from "@/lib/session";
import { getNotificationConfig, listUsers } from "@/lib/services/admin";

export default async function AdminPage() {
  const actor = await requirePageActor();
  if (actor.role !== Role.ADMIN) redirect("/dashboard");
  const [users, branches, notificationConfig] = await Promise.all([
    listUsers(actor),
    db.branch.findMany({
      select: { id: true, code: true, name: true },
      orderBy: { code: "asc" },
    }),
    getNotificationConfig(actor),
  ]);
  const reminders =
    (notificationConfig?.value as {
      reminderMinutesBefore?: number;
      digestTime?: string;
      quietStart?: string;
      quietEnd?: string;
    } | null) ?? {};
  return (
    <>
      <PageHeader
        eyebrow="Administrasi"
        title="Akun & Konfigurasi"
        description="Pengelolaan akun dilakukan server-side dan setiap perubahan dicatat dalam audit log."
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
                className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
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
                  <Badge tone="blue">{u.role}</Badge>
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
            ))}
          </div>
        </section>
        <div className="space-y-6">
          <AdminUserForm branches={branches} />
          <NotificationConfigForm
            config={{
              reminderMinutesBefore: reminders.reminderMinutesBefore ?? 30,
              digestTime: reminders.digestTime ?? "08:00",
              quietStart: reminders.quietStart ?? "20:00",
              quietEnd: reminders.quietEnd ?? "07:00",
            }}
          />
        </div>
      </div>
    </>
  );
}
