/* eslint-disable @next/next/no-img-element -- gambar privat memerlukan cookie sesi */

import { Role } from "@prisma/client";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { ServiceCaseActions } from "@/components/service-case-actions";
import { StatusBadge } from "@/components/status-badge";
import { formatDateTime } from "@/lib/format";
import { googleMapsLocationUrl } from "@/lib/geo";
import { requirePageActor } from "@/lib/session";
import { getServiceCase } from "@/lib/services/service-cases";

export default async function WorkDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requirePageActor();
  const { id } = await params;
  let item;
  try {
    item = await getServiceCase(actor, id);
  } catch {
    notFound();
  }
  return (
    <>
      <PageHeader
        eyebrow={item.code}
        title={item.title}
        description="Detail pekerjaan hanya dapat dilihat oleh PIC, supervisor cabang, atau administrator berwenang."
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_.8fr]">
        <section className="space-y-5">
          <div className="card p-5">
            <div className="flex flex-wrap gap-2">
              <StatusBadge value={item.status} />
              <StatusBadge value={item.appointmentStatus} />
            </div>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-slate-400">Referensi</dt>
                <dd className="font-semibold">
                  {item.prospect.internalCode}
                  {item.prospect.cakraReference
                    ? ` · CAKRA ${item.prospect.cakraReference}`
                    : ""}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">PIC</dt>
                <dd className="font-semibold">{item.pic.name}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Janji dengan</dt>
                <dd className="font-semibold">{item.prospect.contactPic}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Nama toko/usaha</dt>
                <dd>{item.prospect.businessAlias || "Tidak dicantumkan"}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Next action</dt>
                <dd>{item.nextAction}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Waktu tindak lanjut</dt>
                <dd>{formatDateTime(item.dueAt)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Waktu janji</dt>
                <dd>{formatDateTime(item.appointmentAt)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Diterima oleh</dt>
                <dd>{item.acceptedBy?.name ?? "Belum diterima"}</dd>
              </div>
            </dl>
            <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm leading-6">
              {item.description}
            </p>
            {item.prospect.latitude != null &&
            item.prospect.longitude != null ? (
              <div className="mt-5 rounded-xl border p-4">
                <p className="text-xs text-slate-400">Lokasi janji</p>
                <p className="mt-1 font-semibold">
                  {item.prospect.locationLabel || "Titik lokasi tersimpan"}
                </p>
                <a
                  className="mt-3 inline-flex min-h-11 items-center rounded-xl border px-4 text-sm font-bold text-blue-800 hover:bg-blue-50"
                  target="_blank"
                  rel="noreferrer"
                  href={googleMapsLocationUrl({
                    latitude: Number(item.prospect.latitude),
                    longitude: Number(item.prospect.longitude),
                  })}
                >
                  Buka Google Maps
                </a>
              </div>
            ) : null}
            {item.prospect.locationPhotos.length ? (
              <div className="mt-5">
                <p className="text-xs text-slate-400">Foto lokasi</p>
                <div className="mt-2 flex flex-wrap gap-3">
                  {item.prospect.locationPhotos.map((photo) => (
                    <img
                      key={photo.id}
                      src={`/api/location-photos/${photo.id}`}
                      alt="Foto lokasi janji"
                      className="h-28 w-40 rounded-xl object-cover"
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          <div className="card p-5">
            <h2 className="font-black">Readiness</h2>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-blue-50 p-3">
                <p className="text-xs text-slate-500">Layanan</p>
                <p className="font-bold">
                  {item.status === "HANDLED" ||
                  item.status === "VERIFIED" ||
                  item.status === "CLOSED"
                    ? "Selesai ditangani"
                    : "Belum selesai"}
                </p>
              </div>
              <div className="rounded-xl bg-emerald-50 p-3">
                <p className="text-xs text-slate-500">Penggunaan produk</p>
                <p className="font-bold">
                  {item.prospect.usageVerifications.length
                    ? "Terverifikasi"
                    : "Belum diverifikasi"}
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Penyelesaian layanan tidak otomatis menjadi penggunaan produk.
            </p>
          </div>
        </section>
        <ServiceCaseActions
          id={item.id}
          version={item.version}
          status={item.status}
          appointmentStatus={item.appointmentStatus}
          dueAt={item.dueAt.toISOString()}
          appointmentAt={item.appointmentAt?.toISOString() ?? null}
          canVerify={
            actor.role === Role.SUPERVISOR || actor.role === Role.ADMIN
          }
        />
      </div>
    </>
  );
}
