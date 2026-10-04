import { Role } from "@prisma/client";

import { NotificationConfigForm } from "@/components/admin-actions";
import { NotificationAudioSettings } from "@/components/notification-audio-settings";
import { PageHeader } from "@/components/page-header";
import { db } from "@/lib/db";
import { requirePageActor } from "@/lib/session";

export default async function NotificationSettingsPage() {
  const actor = await requirePageActor();
  const notificationConfig = await db.appConfig.findUnique({
    where: { key: "notifications" },
  });
  const values =
    (notificationConfig?.value as {
      reminderMinutesBefore?: number;
      digestTime?: string;
      quietStart?: string;
      quietEnd?: string;
    } | null) ?? {};

  return (
    <>
      <PageHeader
        eyebrow="Perangkat & reminder"
        title="Pengaturan Notifikasi"
        description="Atur audio dan izin notifikasi untuk akun pada perangkat ini. Preferensi browser tidak mengubah data akun."
      />
      <div className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
        <NotificationAudioSettings
          userId={actor.id}
          quietStart={values.quietStart ?? "20:00"}
          quietEnd={values.quietEnd ?? "07:00"}
        />
        {actor.role === Role.ADMIN ? (
          <NotificationConfigForm
            config={{
              reminderMinutesBefore: values.reminderMinutesBefore ?? 30,
              digestTime: values.digestTime ?? "08:00",
              quietStart: values.quietStart ?? "20:00",
              quietEnd: values.quietEnd ?? "07:00",
            }}
          />
        ) : (
          <aside className="card h-fit p-5 text-sm leading-6 text-slate-600">
            Jadwal reminder dan jam senyap cabang dikelola ADMIN. Pengaturan suara, volume, jenis alarm, dan izin sistem di kiri tersimpan per akun/perangkat.
          </aside>
        )}
      </div>
    </>
  );
}
