import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { requirePageActor } from "@/lib/session";

export default async function NotificationsPage() {
  const actor = await requirePageActor();
  const items = await db.notification.findMany({
    where: {
      recipientId: actor.id,
      isTest: false,
      ...(actor.branchId
        ? { OR: [{ branchId: actor.branchId }, { branchId: null }] }
        : {}),
    },
    orderBy: { id: "desc" },
    take: 100,
  });
  return (
    <>
      <PageHeader
        eyebrow="Pemberitahuan internal"
        title="Notifikasi"
        description="Penugasan dan pengingat persisten untuk pekerjaan yang menjadi tanggung jawab Anda."
      />
      <div className="card divide-y overflow-hidden">
        {items.length ? (
          items.map((item) => (
            <Link
              href={item.link}
              key={item.id.toString()}
              className="block p-4 hover:bg-slate-50"
            >
              <div className="flex justify-between gap-3">
                <div>
                  <p className="font-bold">{item.title}</p>
                  <p className="mt-1 text-sm text-slate-600">{item.message}</p>
                </div>
                <time className="shrink-0 text-xs text-slate-400">
                  {formatDateTime(item.createdAt)}
                </time>
              </div>
            </Link>
          ))
        ) : (
          <p className="p-8 text-center text-sm text-slate-500">
            Belum ada notifikasi.
          </p>
        )}
      </div>
    </>
  );
}
