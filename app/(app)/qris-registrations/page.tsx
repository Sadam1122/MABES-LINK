import { Prisma, Role } from "@prisma/client";
import { ArrowLeft, ArrowRight, MapPin, Phone, QrCode } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { requirePageActor } from "@/lib/session";

const templateLabels: Record<string, string> = {
  BATIK_NUSANTARA: "Batik Nusantara",
  ALAM_INDONESIA: "Alam Indonesia",
};

export default async function QrisRegistrationsPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requirePageActor();
  if (actor.role !== Role.ADMIN && actor.role !== Role.OUT_BRANCH) notFound();
  if (actor.role === Role.OUT_BRANCH && !actor.branchId) notFound();
  const query = await searchParams;
  const search = typeof query.search === "string" ? query.search.trim().slice(0, 80) : "";
  const template = typeof query.template === "string" ? query.template : "";
  const page = Math.max(1, Math.min(1000, Number(query.page) || 1));
  const pageSize = 20;
  const where: Prisma.ProspectWhereInput = {
    isTest: false,
    publicQrisRequestId: { not: null },
    publicContactConsentAt: { not: null },
    ...(actor.role === Role.OUT_BRANCH ? { branchId: actor.branchId! } : {}),
    ...(template === "UNSELECTED" ? { publicQrisTemplate: null } : templateLabels[template] ? { publicQrisTemplate: template } : {}),
    ...(search ? { OR: [
      { internalCode: { contains: search, mode: "insensitive" } },
      { businessAlias: { contains: search, mode: "insensitive" } },
      { contactPic: { contains: search, mode: "insensitive" } },
      { publicContactPhone: { contains: search } },
    ] } : {}),
  };
  const total = await db.prospect.count({ where });
  const records = await db.prospect.findMany({
    where,
    orderBy: [{ publicContactConsentAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: {
      id: true, internalCode: true, businessAlias: true, contactPic: true,
      publicContactPhone: true, publicBusinessCategory: true,
      publicBankRelationship: true, publicContactWindow: true,
      publicContactConsentAt: true, publicQrisTemplate: true,
      publicQrisDesignedAt: true, addressHint: true, need: true,
      productNeeds: true, branch: { select: { code: true } },
      assignedTo: { select: { name: true } },
    },
  });
  const pageHref = (nextPage: number) => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (template) params.set("template", template);
    params.set("page", String(nextPage));
    return `/qris-registrations?${params}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="QRIS Custom" title="Pendaftar QRIS" description="Permintaan yang memberi persetujuan untuk dihubungi. ADMIN melihat seluruh cabang; OUTBRANCH hanya cabangnya." />
      <div className="rounded-3xl border border-blue-100 bg-gradient-to-br from-[#092b52] via-[#124a75] to-[#0b7280] p-5 text-white shadow-lg sm:p-7">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-white/15 p-3"><QrCode className="size-7 text-amber-300" /></div>
          <div><p className="text-sm text-blue-100">Permintaan yang dapat ditindaklanjuti</p><p className="mt-1 text-3xl font-black">{total}</p><p className="mt-2 max-w-2xl text-xs leading-5 text-blue-100">Template yang dipilih tercatat setelah pratinjau berhasil dibuat. Editor QRIS tidak menerbitkan atau memverifikasi merchant secara otomatis.</p></div>
        </div>
      </div>
      <form className="grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-[minmax(0,1fr)_220px_auto] sm:items-end">
        <label className="text-sm font-semibold">Cari pendaftar
          <input name="search" defaultValue={search} maxLength={80} placeholder="Nama, usaha, nomor HP, atau kode" className="field mt-1 w-full" />
        </label>
        <label className="text-sm font-semibold">Desain
          <select name="template" defaultValue={template} className="field mt-1 w-full">
            <option value="">Semua desain</option>
            <option value="BATIK_NUSANTARA">Batik Nusantara</option>
            <option value="ALAM_INDONESIA">Alam Indonesia</option>
            <option value="UNSELECTED">Belum memilih</option>
          </select>
        </label>
        <button className={buttonVariants({ variant: "default" })}>Terapkan</button>
      </form>
      {records.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {records.map((record) => (
            <article key={record.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b bg-slate-50/80 p-4">
                <div><p className="text-xs font-bold uppercase tracking-wider text-blue-700">{record.internalCode} · Cabang {record.branch.code}</p><h2 className="mt-1 text-lg font-black text-slate-900">{record.businessAlias}</h2><p className="text-sm text-slate-600">Kontak: {record.contactPic}</p></div>
                <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-900">{record.publicQrisTemplate ? templateLabels[record.publicQrisTemplate] ?? record.publicQrisTemplate : "Belum memilih desain"}</span>
              </div>
              <dl className="grid gap-x-4 gap-y-3 p-4 text-sm sm:grid-cols-2">
                <div><dt className="text-xs text-slate-500">Nomor HP</dt><dd className="mt-0.5 flex items-center gap-1 font-semibold"><Phone size={13} />{record.publicContactPhone ?? "—"}</dd></div>
                <div><dt className="text-xs text-slate-500">Kategori usaha</dt><dd className="mt-0.5 font-semibold">{record.publicBusinessCategory ?? "—"}</dd></div>
                <div className="sm:col-span-2"><dt className="text-xs text-slate-500">Alamat usaha</dt><dd className="mt-0.5 flex items-start gap-1"><MapPin size={14} className="mt-0.5 shrink-0" />{record.addressHint ?? "—"}</dd></div>
                <div><dt className="text-xs text-slate-500">Kebutuhan tercatat</dt><dd className="mt-0.5">{record.need}</dd></div>
                <div><dt className="text-xs text-slate-500">Produk diminati</dt><dd className="mt-0.5">{record.productNeeds.join(", ") || "—"}</dd></div>
                <div><dt className="text-xs text-slate-500">Hubungan dengan bank</dt><dd className="mt-0.5">{record.publicBankRelationship ?? "—"}</dd></div>
                <div><dt className="text-xs text-slate-500">Waktu dihubungi</dt><dd className="mt-0.5">{record.publicContactWindow ?? "Tidak ditentukan"}</dd></div>
                <div><dt className="text-xs text-slate-500">PIC internal</dt><dd className="mt-0.5 font-semibold">{record.assignedTo.name}</dd></div>
                <div><dt className="text-xs text-slate-500">Mendaftar</dt><dd className="mt-0.5">{record.publicContactConsentAt ? formatDateTime(record.publicContactConsentAt) : "—"}</dd></div>
                <div className="sm:col-span-2"><dt className="text-xs text-slate-500">Desain terakhir dibuat</dt><dd className="mt-0.5">{record.publicQrisDesignedAt ? formatDateTime(record.publicQrisDesignedAt) : "Belum ada pratinjau berhasil"}</dd></div>
              </dl>
            </article>
          ))}
        </div>
      ) : <div className="rounded-2xl border border-dashed bg-white p-10 text-center text-sm text-slate-500">Belum ada pendaftar yang cocok dengan filter ini.</div>}
      <div className="flex items-center justify-between gap-3 text-sm text-slate-600">
        <span>Halaman {page} · {total} pendaftar</span>
        <div className="flex gap-2">
          {page > 1 && <Link className={buttonVariants({ variant: "outline" })} href={pageHref(page - 1)}><ArrowLeft size={16} /> Sebelumnya</Link>}
          {page * pageSize < total && <Link className={buttonVariants({ variant: "outline" })} href={pageHref(page + 1)}>Berikutnya <ArrowRight size={16} /></Link>}
        </div>
      </div>
    </div>
  );
}
