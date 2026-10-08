"use client";

import { useEffect, useState } from "react";
import { Search, WalletCards } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useFeedback } from "@/components/ui/feedback";
import { clientApi } from "@/lib/client-api";

type Discovery = {
  version: number;
  segments: string[];
  opportunityTags: string[];
  sourceNeedHint?: string | null;
  usedProductsKnown: boolean;
  usedProducts: string[];
  usedProductsOther: string | null;
  sourceType: string | null;
  sourceUrl: string | null;
  sourceCheckedAt: string | null;
  riskReviewRequired: boolean;
  foodRule: "EITHER" | "BOTH";
  gofoodRating: number | string | null;
  gofoodReviews: number | null;
  gofoodUrl: string | null;
  gofoodCheckedAt: string | null;
  grabfoodRating: number | string | null;
  grabfoodReviews: number | null;
  grabfoodUrl: string | null;
  grabfoodCheckedAt: string | null;
};
type Opportunity = {
  id: string;
  productCode: string;
  needSummary: string;
  discoveredAt: string | null;
  needConfirmedAt: string | null;
  benefitExplainedAt: string | null;
  response: string;
  followUpConsent: boolean | null;
  nextAction: string | null;
  dueAt: string | null;
  evidenceNote: string | null;
  assignedToId: string;
  followUp: { id: string; status: string; dueAt: string } | null;
  version: number;
};
type Payload = {
  discovery: Discovery | null;
  foodScreening: {
    status: string;
    rule: string;
    matchingPlatforms: string[];
  } | null;
  opportunities: Opportunity[];
  officers: { id: string; name: string }[];
  productCatalog: {
    code: string;
    label: string;
    category: string;
    approved: boolean;
    source: string;
  }[];
  hints: string[];
  canEditDiscovery: boolean;
};
const segments = [
  ["PEMBISNIS", "Pembisnis"],
  ["PAYROLL", "Payroll"],
  ["PRIORITAS", "Prioritas"],
  ["INDIVIDU", "Individu"],
] as const;
const responses = [
  ["NOT_ASKED", "Belum ditanya"],
  ["INTERESTED", "Tertarik"],
  ["FOLLOW_UP", "Minta follow-up"],
  ["NOT_INTERESTED", "Tidak tertarik"],
  ["NOT_RELEVANT", "Tidak relevan"],
] as const;
const blank: Discovery = {
  version: 0,
  segments: [],
  opportunityTags: [],
  usedProductsKnown: false,
  usedProducts: [],
  usedProductsOther: null,
  sourceType: "UNKNOWN",
  sourceUrl: null,
  sourceCheckedAt: null,
  riskReviewRequired: false,
  foodRule: "EITHER",
  gofoodRating: null,
  gofoodReviews: null,
  gofoodUrl: null,
  gofoodCheckedAt: null,
  grabfoodRating: null,
  grabfoodReviews: null,
  grabfoodUrl: null,
  grabfoodCheckedAt: null,
};
function day(value: string | null) {
  return value ? value.slice(0, 10) : "";
}
function nullable(value: string) {
  return value.trim() || null;
}
function dateOrNull(value: string) {
  return value ? new Date(`${value}T12:00:00+07:00`).toISOString() : null;
}
function localDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(new Date(value).getTime() + 7 * 3_600_000);
  return date.toISOString().slice(0, 16);
}

export function MappingDiscoveryPanel({
  prospectId,
  defaultPicId,
}: {
  prospectId: string;
  defaultPicId: string;
}) {
  const [holdingSearch, setHoldingSearch] = useState("");
  const { toast } = useFeedback();
  const [data, setData] = useState<Payload | null>(null);
  const [form, setForm] = useState<Discovery>(blank);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    clientApi<Payload>(`/api/mapping/${prospectId}/discovery`)
      .then((result) => {
        if (!active) return;
        setData(result);
        setForm(result.discovery ?? blank);
        setError("");
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error ? cause.message : "Discovery gagal dimuat.",
          );
      });
    return () => {
      active = false;
    };
  }, [prospectId, reload]);

  const patch = <K extends keyof Discovery>(key: K, value: Discovery[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const toggle = (
    key: "segments" | "usedProducts",
    value: string,
  ) =>
    patch(
      key,
      form[key].includes(value)
        ? form[key].filter((item) => item !== value)
        : [...form[key], value],
    );

  async function saveDiscovery() {
    setBusy(true);
    setError("");
    try {
      await clientApi(`/api/mapping/${prospectId}/discovery`, {
        method: "PATCH",
        body: JSON.stringify({
          ...form,
          sourceCheckedAt: dateOrNull(day(form.sourceCheckedAt)),
          gofoodCheckedAt: dateOrNull(day(form.gofoodCheckedAt)),
          grabfoodCheckedAt: dateOrNull(day(form.grabfoodCheckedAt)),
          gofoodRating:
            form.gofoodRating === ""
              ? null
              : form.gofoodRating == null
                ? null
                : Number(form.gofoodRating),
          grabfoodRating:
            form.grabfoodRating === ""
              ? null
              : form.grabfoodRating == null
                ? null
                : Number(form.grabfoodRating),
          gofoodReviews:
            form.gofoodReviews === null || String(form.gofoodReviews) === ""
              ? null
              : Number(form.gofoodReviews),
          grabfoodReviews:
            form.grabfoodReviews === null || String(form.grabfoodReviews) === ""
              ? null
              : Number(form.grabfoodReviews),
        }),
      });
      toast("Product Holding tersimpan.", "success");
      setReload((value) => value + 1);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Discovery gagal disimpan.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveOpportunity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const response = String(fields.get("response"));
    const due = String(fields.get("dueAt") ?? "");
    const existing = data?.opportunities.find(
      (item) => item.productCode === selectedProduct,
    );
    const payload = {
      productCode: selectedProduct,
      needSummary: String(fields.get("needSummary") ?? ""),
      discoveryDone: fields.get("discoveryDone") === "on",
      needConfirmed: fields.get("needConfirmed") === "on",
      benefitExplained: fields.get("benefitExplained") === "on",
      response,
      followUpConsent: fields.get("followUpConsent") === "on",
      nextAction: nullable(String(fields.get("nextAction") ?? "")),
      dueAt: due ? new Date(`${due}:00+07:00`).toISOString() : null,
      evidenceNote: nullable(String(fields.get("evidenceNote") ?? "")),
      assignedToId: String(fields.get("assignedToId") ?? defaultPicId),
      version: existing?.version ?? 0,
    };
    setBusy(true);
    setError("");
    try {
      await clientApi(`/api/mapping/${prospectId}/opportunities`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      toast(
        "Catatan peluang tersimpan; reminder dijadwalkan bila follow-up diperlukan.",
        "success",
      );
      setReload((value) => value + 1);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Peluang gagal disimpan.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!data && !error)
    return (
      <section className="card p-4 text-sm text-slate-500" aria-busy="true">
        Memuat discovery…
      </section>
    );
  if (!data)
    return (
      <section className="card p-4 text-sm text-red-700" role="alert">
        {error}
      </section>
    );
  const existing = data.opportunities.find(
    (item) => item.productCode === selectedProduct,
  );
  return (
    <section
      className="card space-y-5 p-4"
      aria-label="Product Holding dan cross-selling"
    >
      <div className="flex items-start gap-3">
        <WalletCards className="mt-1 size-6 shrink-0 text-blue-800" />
        <div>
          <h2 className="font-black text-slate-950">Product Holding</h2>
          <p className="text-xs text-slate-500">
            Centang produk/layanan yang sudah digunakan dan telah dikonfirmasi.
            Produk yang ditawarkan serta respons tetap dicatat terpisah; bukan
            penilaian kelayakan.
          </p>
        </div>
      </div>
      {form.sourceNeedHint && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
          <strong>Catatan awal dari Excel · belum dikonfirmasi</strong>
          <p className="mt-1">{form.sourceNeedHint}</p>
        </div>
      )}
      <fieldset className="rounded-xl border p-3">
        <legend className="px-1 text-sm font-bold">
          Segmen 3P+1I (boleh lebih dari satu)
        </legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {segments.map(([code, label]) => (
            <label key={code} className="flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.segments.includes(code)}
                onChange={() => toggle("segments", code)}
                disabled={!data.canEditDiscovery}
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="rounded-xl border bg-slate-50 p-3">
        <p className="text-sm font-bold">Produk Mandiri yang sudah digunakan</p>
        <label className="mt-2 flex gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.usedProductsKnown}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                usedProductsKnown: event.target.checked,
                usedProducts: event.target.checked ? current.usedProducts : [],
                usedProductsOther: event.target.checked
                  ? current.usedProductsOther
                  : null,
              }))
            }
            disabled={!data.canEditDiscovery}
          />
          Sudah ditanya/dikonfirmasi
        </label>
        {!form.usedProductsKnown && (
          <p className="mt-1 text-xs text-slate-500">
            Belum tahu / belum ditanya. Pilihan aktif setelah konfirmasi; tidak
            disimpulkan dari sektor usaha.
          </p>
        )}
        <label className="relative mt-3 block">
          <span className="sr-only">Cari Product Holding</span>
          <Search className="pointer-events-none absolute left-3 top-3 size-4 text-slate-400" />
          <input
            className="field"
            style={{ paddingLeft: "2.5rem" }}
            value={holdingSearch}
            onChange={(event) => setHoldingSearch(event.target.value)}
            placeholder="Cari Livin’, KUM, KUR, CC, Kopra…"
          />
        </label>
        <p className="my-3 text-xs font-semibold text-blue-800">
          {form.usedProducts.length} dipilih · produk dan kanal/fitur dicatat
          sesuai konfirmasi
        </p>
        <div className="max-h-[32rem] space-y-2 overflow-y-auto pr-1">
          {[...new Set(data.productCatalog.map((p) => p.category))].map(
            (category) => {
              const products = data.productCatalog.filter(
                (p) =>
                  p.category === category &&
                  `${p.label} ${p.code}`
                    .toLowerCase()
                    .includes(holdingSearch.trim().toLowerCase()),
              );
              return products.length ? (
                <details
                  key={category}
                  open={
                    Boolean(holdingSearch) || category === "Rekening & simpanan"
                  }
                  className="rounded-xl border bg-white p-3"
                >
                  <summary className="cursor-pointer text-sm font-bold text-blue-950">
                    {category}{" "}
                    <span className="font-normal text-slate-500">
                      ({products.length})
                    </span>
                  </summary>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {products.map((product) => (
                      <label
                        key={product.code}
                        className={`flex min-h-11 items-center gap-3 rounded-lg border p-2 text-sm ${form.usedProducts.includes(product.code) ? "border-blue-500 bg-blue-50" : "border-slate-100"}`}
                      >
                        <input
                          type="checkbox"
                          className="size-4 shrink-0 accent-blue-800"
                          checked={form.usedProducts.includes(product.code)}
                          onChange={() => toggle("usedProducts", product.code)}
                          disabled={
                            !data.canEditDiscovery || !form.usedProductsKnown
                          }
                        />
                        {product.label}
                      </label>
                    ))}
                  </div>
                </details>
              ) : null;
            },
          )}
        </div>
        {!data.productCatalog.some((p) =>
          `${p.label} ${p.code}`
            .toLowerCase()
            .includes(holdingSearch.trim().toLowerCase()),
        ) && (
          <p className="py-3 text-sm text-slate-500">
            Produk tidak ditemukan. Gunakan Lainnya bila nama belum tercantum.
          </p>
        )}
        <label className="mt-3 block text-sm">
          Lainnya (jika sudah dikonfirmasi)
          <input
            className="field mt-1"
            value={form.usedProductsOther ?? ""}
            onChange={(event) =>
              patch("usedProductsOther", nullable(event.target.value))
            }
            maxLength={120}
            disabled={!data.canEditDiscovery || !form.usedProductsKnown}
          />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="label">
          Sumber data
          <select
            className="field mt-1"
            value={form.sourceType ?? "UNKNOWN"}
            onChange={(event) => patch("sourceType", event.target.value)}
            disabled={!data.canEditDiscovery}
          >
            <option value="UNKNOWN">Belum dicatat</option>
            <option value="PUBLIC_DIRECTORY">Direktori publik</option>
            <option value="FIELD_DISCOVERY">Discovery lapangan</option>
            <option value="INTERNAL_ALLOWED">
              Sumber internal yang diizinkan
            </option>
          </select>
        </label>
        <label className="label">
          URL sumber publik (opsional)
          <input
            className="field mt-1"
            type="url"
            value={form.sourceUrl ?? ""}
            onChange={(event) =>
              patch("sourceUrl", nullable(event.target.value))
            }
            disabled={!data.canEditDiscovery}
            placeholder="https://…"
          />
        </label>
        <label className="label">
          Tanggal cek sumber
          <input
            className="field mt-1"
            type="date"
            value={day(form.sourceCheckedAt)}
            onChange={(event) =>
              patch("sourceCheckedAt", dateOrNull(event.target.value))
            }
            disabled={!data.canEditDiscovery}
          />
        </label>
      </div>
      <label className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
        <input
          type="checkbox"
          checked={form.riskReviewRequired}
          onChange={(event) =>
            patch("riskReviewRequired", event.target.checked)
          }
          disabled={!data.canEditDiscovery}
        />
        Perlu review Risk/Compliance sebelum tindak lanjut lebih jauh (penanda
        manual, bukan keputusan otomatis).
      </label>
      <details className="rounded-xl border p-3">
        <summary className="cursor-pointer text-sm font-bold">
          Screening Livin’ Food (opsional)
        </summary>
        <p className="mt-2 text-xs text-slate-600">
          Kriteria internal pengguna: rating ≥4,5 dan review ≥500. Bukan syarat
          resmi atau persetujuan produk. Data lebih dari 30 hari perlu
          verifikasi ulang.
        </p>
        <label className="label mt-3 block">
          Aturan perbandingan
          <select
            className="field mt-1"
            value={form.foodRule}
            onChange={(event) =>
              patch("foodRule", event.target.value as "EITHER" | "BOTH")
            }
            disabled={!data.canEditDiscovery}
          >
            <option value="EITHER">Salah satu platform</option>
            <option value="BOTH">Kedua platform</option>
          </select>
        </label>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {(["gofood", "grabfood"] as const).map((platform) => {
            const ratingKey = `${platform}Rating` as const;
            const reviewsKey = `${platform}Reviews` as const;
            const urlKey = `${platform}Url` as const;
            const checkedKey = `${platform}CheckedAt` as const;
            return (
              <fieldset
                key={platform}
                className="space-y-2 rounded-xl border p-3"
              >
                <legend className="px-1 text-sm font-bold">
                  {platform === "gofood" ? "GoFood" : "GrabFood"}
                </legend>
                <label className="label block">
                  Rating
                  <input
                    className="field mt-1"
                    type="number"
                    min="0"
                    max="5"
                    step="0.1"
                    value={form[ratingKey] ?? ""}
                    onChange={(event) =>
                      patch(ratingKey, event.target.value || null)
                    }
                    disabled={!data.canEditDiscovery}
                  />
                </label>
                <label className="label block">
                  Jumlah review
                  <input
                    className="field mt-1"
                    type="number"
                    min="0"
                    value={form[reviewsKey] ?? ""}
                    onChange={(event) =>
                      patch(
                        reviewsKey,
                        event.target.value === ""
                          ? null
                          : Number(event.target.value),
                      )
                    }
                    disabled={!data.canEditDiscovery}
                  />
                </label>
                <label className="label block">
                  URL sumber
                  <input
                    className="field mt-1"
                    type="url"
                    value={form[urlKey] ?? ""}
                    onChange={(event) =>
                      patch(urlKey, nullable(event.target.value))
                    }
                    disabled={!data.canEditDiscovery}
                  />
                </label>
                <label className="label block">
                  Tanggal cek
                  <input
                    className="field mt-1"
                    type="date"
                    value={day(form[checkedKey])}
                    onChange={(event) =>
                      patch(checkedKey, dateOrNull(event.target.value))
                    }
                    disabled={!data.canEditDiscovery}
                  />
                </label>
              </fieldset>
            );
          })}
        </div>
        <p className="mt-3 text-sm font-semibold">
          Hasil tersimpan:{" "}
          {data.foodScreening?.status === "CANDIDATE"
            ? "Kandidat screening"
            : data.foodScreening?.status === "STALE"
              ? "Perlu verifikasi ulang"
              : data.foodScreening?.status === "NOT_MATCH"
                ? "Belum memenuhi kriteria internal"
                : "Data belum lengkap"}
        </p>
      </details>
      {data.canEditDiscovery && (
        <Button disabled={busy} onClick={() => void saveDiscovery()}>
          {busy ? "Menyimpan…" : "Simpan Product Holding"}
        </Button>
      )}
      <div className="border-t pt-4">
        <h3 className="font-bold">Pertanyaan discovery per sektor</h3>
        <ul className="mt-2 list-disc pl-5 text-sm text-slate-600">
          {data.hints.map((hint) => (
            <li key={hint}>{hint}</li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-slate-500">
          Saran pertanyaan saja; hanya kebutuhan yang dinyatakan calon nasabah
          boleh menjadi penawaran.
        </p>
      </div>
      <div className="border-t pt-4">
        <h3 className="font-bold">Produk yang ditawarkan & respons</h3>
        <p className="text-xs text-slate-500">
          Terpisah dari produk yang sudah digunakan. Perlu konfirmasi katalog
          dan otorisasi internal sebelum penawaran.
        </p>
        {data.productCatalog.some((product) => product.approved) ? (
          <>
            <label className="label mt-3 block">
              Produk yang relevan
              <select
                className="field mt-1"
                value={selectedProduct}
                onChange={(event) => setSelectedProduct(event.target.value)}
              >
                <option value="">Pilih produk yang disahkan…</option>
                {data.productCatalog
                  .filter((product) => product.approved)
                  .map((product) => (
                    <option key={product.code} value={product.code}>
                      {product.label}
                    </option>
                  ))}
              </select>
            </label>
            {selectedProduct && (
              <form
                key={`${selectedProduct}-${existing?.version ?? 0}`}
                className="mt-3 grid gap-3 sm:grid-cols-2"
                onSubmit={(event) => void saveOpportunity(event)}
              >
                <label className="label sm:col-span-2">
                  Kebutuhan yang dinyatakan calon nasabah
                  <input
                    className="field mt-1"
                    name="needSummary"
                    defaultValue={existing?.needSummary ?? ""}
                    minLength={5}
                    maxLength={300}
                    required
                  />
                </label>
                <label className="flex gap-2 text-sm">
                  <input
                    name="discoveryDone"
                    type="checkbox"
                    defaultChecked={Boolean(existing?.discoveredAt)}
                  />
                  Kunjungan/discovery dilakukan
                </label>
                <label className="flex gap-2 text-sm">
                  <input
                    name="needConfirmed"
                    type="checkbox"
                    defaultChecked={Boolean(existing?.needConfirmedAt)}
                  />
                  Kebutuhan dikonfirmasi
                </label>
                <label className="flex gap-2 text-sm">
                  <input
                    name="benefitExplained"
                    type="checkbox"
                    defaultChecked={Boolean(existing?.benefitExplainedAt)}
                  />
                  Manfaat relevan dijelaskan
                </label>
                <label className="label">
                  Respons
                  <select
                    className="field mt-1"
                    name="response"
                    defaultValue={existing?.response ?? "NOT_ASKED"}
                  >
                    {responses.map(([code, label]) => (
                      <option key={code} value={code}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="label">
                  PIC internal
                  <select
                    className="field mt-1"
                    name="assignedToId"
                    defaultValue={existing?.assignedToId ?? defaultPicId}
                  >
                    {data.officers.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex gap-2 text-sm">
                  <input
                    name="followUpConsent"
                    type="checkbox"
                    defaultChecked={existing?.followUpConsent ?? false}
                  />
                  Izin follow-up dicatat
                </label>
                <label className="label">
                  Next action
                  <input
                    className="field mt-1"
                    name="nextAction"
                    defaultValue={existing?.nextAction ?? ""}
                    maxLength={300}
                  />
                </label>
                <label className="label">
                  Jadwal follow-up WIB
                  <input
                    className="field mt-1"
                    name="dueAt"
                    type="datetime-local"
                    defaultValue={localDateTime(existing?.dueAt ?? null)}
                  />
                </label>
                <label className="label sm:col-span-2">
                  Bukti proses non-sensitif
                  <textarea
                    className="field mt-1"
                    name="evidenceNote"
                    defaultValue={existing?.evidenceNote ?? ""}
                    maxLength={500}
                    placeholder="Tanggal dan hasil diskusi; tanpa identitas, nomor, saldo, atau dokumen"
                  />
                </label>
                <div className="sm:col-span-2">
                  <Button disabled={busy}>
                    {busy ? "Menyimpan…" : "Simpan peluang"}
                  </Button>
                </div>
              </form>
            )}
          </>
        ) : (
          <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
            Belum ada produk yang ditandai disahkan dalam konfigurasi server.
            Discovery tetap dapat dicatat; penawaran menunggu konfirmasi
            otorisasi internal.
          </p>
        )}
        {data.opportunities.length > 0 && (
          <div className="mt-4 space-y-2">
            {data.opportunities.map((item) => (
              <div key={item.id} className="rounded-xl border p-3 text-sm">
                <strong>
                  {data.productCatalog.find(
                    (product) => product.code === item.productCode,
                  )?.label ?? item.productCode}
                </strong>
                <span className="ml-2 text-slate-600">
                  {responses.find(([code]) => code === item.response)?.[1]}
                </span>
                {item.followUp && (
                  <p className="text-xs text-blue-800">
                    Tugas follow-up: {item.followUp.status} ·{" "}
                    <a
                      className="underline"
                      href={`/follow-ups?task=${item.followUp.id}`}
                    >
                      Buka tugas
                    </a>
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}
    </section>
  );
}
