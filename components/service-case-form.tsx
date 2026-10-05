"use client";

/* eslint-disable @next/next/no-img-element -- preview file lokal tidak dikirim ke image optimizer */

import dynamic from "next/dynamic";
import { Camera, LocateFixed, MapPin, Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogClose } from "@/components/ui/dialog";
import { useFeedback } from "@/components/ui/feedback";
import { clientApi } from "@/lib/client-api";
import { jakartaLocalToIso } from "@/lib/format";
import { geolocationErrorMessage } from "@/lib/geo";
import {
  acquisitionCatalog,
  getAcquisitionCategory,
  getAcquisitionProduct,
} from "@/lib/acquisition-products";

const AppointmentLocationMap = dynamic(
  () => import("@/components/appointment-location-map"),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-[300px] place-items-center rounded-2xl bg-slate-100 text-sm text-slate-500">
        Memuat peta lokasi…
      </div>
    ),
  },
);

type OfficerOption = {
  id: string;
  name: string;
  role: "CS" | "OUT_BRANCH";
  branchId: string | null;
  branchCode: string | null;
};
type SavedLocation = {
  id: string;
  label: string;
  detail: string;
  latitude: number;
  longitude: number;
};
type Point = { latitude: number; longitude: number };

export function ServiceCaseForm({
  officers,
  savedLocations,
  currentUserId,
}: {
  officers: OfficerOption[];
  savedLocations: SavedLocation[];
  currentUserId: string;
}) {
  const router = useRouter();
  const { toast } = useFeedback();
  const [open, setOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selectedPicIds, setSelectedPicIds] = useState<string[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [productId, setProductId] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [storeName, setStoreName] = useState("");
  const [locationLabel, setLocationLabel] = useState("");
  const [locationSearch, setLocationSearch] = useState("");
  const [latitudeInput, setLatitudeInput] = useState("");
  const [longitudeInput, setLongitudeInput] = useState("");
  const [point, setPoint] = useState<Point | null>(null);
  const [locationSource, setLocationSource] = useState<
    "MAP_PIN" | "MANUAL_COORDINATES" | "DEVICE_GEOLOCATION"
  >("MAP_PIN");
  const [geoMessage, setGeoMessage] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const selectedBranchId = officers.find((item) =>
    selectedPicIds.includes(item.id),
  )?.branchId;
  const visibleOfficers = selectedBranchId
    ? officers.filter((officer) => officer.branchId === selectedBranchId)
    : officers;
  const locationMatches = useMemo(() => {
    const term = locationSearch.trim().toLocaleLowerCase("id-ID");
    if (term.length < 2) return [];
    return savedLocations
      .filter((item) =>
        `${item.label} ${item.detail}`
          .toLocaleLowerCase("id-ID")
          .includes(term),
      )
      .slice(0, 6);
  }, [locationSearch, savedLocations]);
  const selectedCategory = getAcquisitionCategory(categoryId);
  const selectedProduct = getAcquisitionProduct(categoryId, productId);
  const productMatches = useMemo(() => {
    const term = productSearch.trim().toLocaleLowerCase("id-ID");
    if (term.length < 2) return [];
    return acquisitionCatalog
      .flatMap((category) =>
        category.products
          .filter((product) =>
            `${category.label} ${product.label}`
              .toLocaleLowerCase("id-ID")
              .includes(term),
          )
          .map((product) => ({ category, product })),
      )
      .slice(0, 10);
  }, [productSearch]);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  const setMapPoint = (
    next: Point,
    source: "MAP_PIN" | "MANUAL_COORDINATES" | "DEVICE_GEOLOCATION",
  ) => {
    setPoint(next);
    setLatitudeInput(next.latitude.toFixed(7));
    setLongitudeInput(next.longitude.toFixed(7));
    setLocationSource(source);
    setDirty(true);
    setError("");
  };

  const applyManualCoordinates = () => {
    const latitude = Number(latitudeInput);
    const longitude = Number(longitudeInput);
    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      setError(
        "Koordinat tidak valid. Latitude −90–90 dan longitude −180–180.",
      );
      return;
    }
    setMapPoint({ latitude, longitude }, "MANUAL_COORDINATES");
  };

  const useDeviceLocation = () => {
    if (!navigator.geolocation) {
      setGeoMessage("Perangkat tidak mendukung geolocation.");
      return;
    }
    setGeoMessage("Mengambil lokasi perangkat…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setMapPoint(
          {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          },
          "DEVICE_GEOLOCATION",
        );
        setGeoMessage(
          position.coords.accuracy > 100
            ? `Akurasi rendah (±${Math.round(position.coords.accuracy)} m). Periksa kembali pin.`
            : `Lokasi diperoleh (akurasi ±${Math.round(position.coords.accuracy)} m).`,
        );
      },
      (failure) => setGeoMessage(geolocationErrorMessage(failure.code)),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );
  };

  const choosePhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      event.target.value = "";
      setError("Foto harus JPEG, PNG, atau WebP dengan ukuran maksimal 5 MB.");
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
    setDirty(true);
    setError("");
  };

  const togglePic = (id: string) => {
    setSelectedPicIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
    setDirty(true);
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!selectedPicIds.length) {
      setError("Pilih minimal satu PIC internal.");
      return;
    }
    if (!selectedProduct) {
      setError("Pilih kategori dan produk/layanan akuisisi.");
      return;
    }
    if (!point) {
      setError(
        "Pilih titik pada peta, lokasi tersimpan, atau isi koordinat manual.",
      );
      return;
    }
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const numberOrNull = (name: string) => {
      const raw = String(form.get(name) ?? "").trim();
      return raw === "" ? null : Number(raw);
    };
    try {
      const item = await clientApi<{ id: string; prospectId: string }>(
        "/api/appointments",
        {
          method: "POST",
          body: JSON.stringify({
            acquisitionCategory: categoryId,
            acquisitionProduct: productId,
            acquisitionStatus: form.get("acquisitionStatus"),
            contactName: form.get("contactName"),
            businessAlias: storeName.trim() || null,
            customerCif: form.get("customerCif") || null,
            customerAccount: form.get("customerAccount") || null,
            customerPhone: form.get("customerPhone") || null,
            reason: form.get("reason"),
            nextAction: form.get("nextAction"),
            picIds: selectedPicIds,
            appointmentAt: jakartaLocalToIso(String(form.get("appointmentAt"))),
            targetValue: numberOrNull("targetValue"),
            realizationValue: numberOrNull("realizationValue"),
            metricUnit: form.get("metricUnit") || null,
            locationLabel,
            latitude: point.latitude,
            longitude: point.longitude,
            locationSource,
          }),
        },
      );
      let photoFailed = false;
      if (photo) {
        const body = new FormData();
        body.set("file", photo);
        const response = await fetch(
          `/api/prospects/${item.prospectId}/photos`,
          {
            method: "POST",
            body,
          },
        );
        photoFailed = !response.ok;
      }
      setDirty(false);
      setOpen(false);
      toast(
        photoFailed
          ? "Janji tersimpan, tetapi foto gagal diunggah. Foto dapat ditambahkan dari Mapping."
          : "Janji tersimpan dan reminder dibuat untuk seluruh PIC.",
        photoFailed ? "error" : "success",
      );
      router.push(`/work/${item.id}`);
      router.refresh();
    } catch (reason) {
      const message =
        reason instanceof Error ? reason.message : "Janji gagal disimpan.";
      setError(message);
      toast(message, "error");
    } finally {
      setBusy(false);
    }
  }

  const resetAndOpen = () => {
    const ownOfficer = officers.some((officer) => officer.id === currentUserId);
    setSelectedPicIds(ownOfficer ? [currentUserId] : []);
    setCategoryId("");
    setProductId("");
    setProductSearch("");
    setStoreName("");
    setLocationLabel("");
    setLocationSearch("");
    setLatitudeInput("");
    setLongitudeInput("");
    setPoint(null);
    setPhoto(null);
    setPreview(null);
    setGeoMessage("");
    setError("");
    setDirty(false);
    setOpen(true);
  };

  return (
    <>
      <Button onClick={resetAndOpen} disabled={!officers.length}>
        <Plus size={16} /> Buat janji
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Buat janji akuisisi"
        description="Isi jadwal, PIC internal, dan lokasi. Kode pekerjaan dibuat otomatis."
        dirty={dirty}
        busy={busy}
        className="max-w-4xl"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <DialogClose variant="outline" disabled={busy}>
              Batal
            </DialogClose>
            <Button
              type="submit"
              form="service-case-form"
              disabled={
                busy || !point || !selectedPicIds.length || !selectedProduct
              }
            >
              {busy ? "Menyimpan…" : "Simpan janji"}
            </Button>
          </div>
        }
      >
        <form
          id="service-case-form"
          onSubmit={submit}
          onChange={() => setDirty(true)}
          className="space-y-5"
        >
          <section className="space-y-4 rounded-2xl border border-blue-200 bg-blue-50/40 p-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[.12em] text-blue-700">
                Akuisisi Nasabah
              </p>
              <h3 className="mt-1 font-black">
                Pilih kategori dan produk/layanan
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Gunakan pencarian atau dua dropdown bertingkat agar daftar
                produk tetap ringkas.
              </p>
            </div>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-3.5 text-slate-400"
                size={17}
              />
              <input
                className="field pl-10"
                value={productSearch}
                onChange={(event) => setProductSearch(event.target.value)}
                placeholder="Cari QRIS, Kopra, KPR, Tabungan…"
                aria-label="Cari produk akuisisi"
              />
              {productMatches.length ? (
                <div className="absolute z-[1200] mt-1 max-h-72 w-full overflow-y-auto rounded-xl border bg-white shadow-xl">
                  {productMatches.map(({ category, product }) => (
                    <button
                      key={`${category.id}:${product.id}`}
                      type="button"
                      className="block min-h-12 w-full border-b px-3 py-2 text-left text-sm last:border-0 hover:bg-blue-50"
                      onClick={() => {
                        setCategoryId(category.id);
                        setProductId(product.id);
                        setProductSearch("");
                        setDirty(true);
                      }}
                    >
                      <strong>{product.label}</strong>
                      <span className="block text-xs text-slate-500">
                        {category.label}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="label">
                Kategori
                <select
                  className="field mt-1"
                  value={categoryId}
                  onChange={(event) => {
                    setCategoryId(event.target.value);
                    setProductId("");
                  }}
                  required
                >
                  <option value="">Pilih kategori</option>
                  {acquisitionCatalog.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="label">
                Produk / layanan
                <select
                  className="field mt-1"
                  value={productId}
                  onChange={(event) => setProductId(event.target.value)}
                  disabled={!selectedCategory}
                  required
                >
                  <option value="">Pilih produk / layanan</option>
                  {selectedCategory?.products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="rounded-xl bg-white px-3 py-2 text-sm font-bold text-blue-900">
              Akuisisi Nasabah &gt;{" "}
              {selectedCategory?.label ?? "Pilih kategori"} &gt;{" "}
              {selectedProduct?.label ?? "Pilih produk"}
            </p>
          </section>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="label">
              Janji dengan siapa
              <input
                data-autofocus
                name="contactName"
                className="field mt-1"
                minLength={2}
                maxLength={100}
                required
                placeholder="Nama orang/PIC yang ditemui"
              />
            </label>
            <label className="label">
              Nama toko/usaha{" "}
              <span className="font-normal text-slate-400">(opsional)</span>
              <input
                className="field mt-1"
                value={storeName}
                onChange={(event) => setStoreName(event.target.value)}
                maxLength={120}
                placeholder="Contoh: Toko Maju"
              />
            </label>
            <label className="label">
              Nomor HP
              <input
                name="customerPhone"
                className="field mt-1"
                inputMode="tel"
                maxLength={30}
                placeholder="08…"
              />
            </label>
            <label className="label">
              CIF{" "}
              <span className="font-normal text-slate-400">
                (jika tersedia)
              </span>
              <input
                name="customerCif"
                className="field mt-1"
                maxLength={40}
                autoComplete="off"
              />
            </label>
            <label className="label">
              Nomor rekening{" "}
              <span className="font-normal text-slate-400">
                (jika tersedia)
              </span>
              <input
                name="customerAccount"
                className="field mt-1"
                inputMode="numeric"
                maxLength={30}
                autoComplete="off"
              />
            </label>
            <label className="label">
              Status akuisisi
              <select
                name="acquisitionStatus"
                className="field mt-1"
                defaultValue="PROSPECT"
              >
                <option value="PROSPECT">Prospek</option>
                <option value="FOLLOW_UP">Follow Up</option>
                <option value="PROCESS">Proses</option>
                <option value="SUCCESS">Berhasil</option>
                <option value="UNSUCCESSFUL">Tidak Berhasil</option>
              </select>
            </label>
            <label className="label sm:col-span-2">
              Alasan dan tujuan janji
              <textarea
                name="reason"
                className="textarea mt-1"
                minLength={5}
                maxLength={700}
                required
                placeholder="Contoh: membahas kebutuhan transaksi usaha dan tindak lanjut"
              />
            </label>
            <label className="label sm:col-span-2">
              Next action
              <input
                name="nextAction"
                className="field mt-1"
                minLength={3}
                maxLength={300}
                required
                placeholder="Contoh: konfirmasi kebutuhan dan dokumen melalui prosedur resmi"
              />
            </label>
            <label className="label">
              Tanggal follow up / waktu janji (WIB)
              <input
                name="appointmentAt"
                type="datetime-local"
                className="field mt-1"
                required
              />
            </label>
            <label className="label">
              Satuan target
              <select
                name="metricUnit"
                className="field mt-1"
                defaultValue="CUSTOMER"
              >
                <option value="CUSTOMER">Nasabah</option>
                <option value="ACCOUNT">Rekening</option>
                <option value="MERCHANT">Merchant</option>
                <option value="IDR">Rupiah</option>
              </select>
            </label>
            <label className="label">
              Target
              <input
                name="targetValue"
                type="number"
                min="0"
                step="0.01"
                className="field mt-1"
                placeholder="Opsional"
              />
            </label>
            <label className="label">
              Realisasi
              <input
                name="realizationValue"
                type="number"
                min="0"
                step="0.01"
                className="field mt-1"
                placeholder="Opsional"
              />
            </label>
          </div>

          <fieldset className="rounded-2xl border p-4">
            <legend className="px-2 text-sm font-black">
              PIC internal (dapat lebih dari satu)
            </legend>
            <p className="mb-3 text-xs text-slate-500">
              PIC pertama menjadi penanggung jawab utama. Setelah memilih satu
              PIC, pilihan dibatasi pada cabang yang sama.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {visibleOfficers.map((officer) => (
                <label
                  key={officer.id}
                  className="flex min-h-12 items-center gap-3 rounded-xl border px-3 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={selectedPicIds.includes(officer.id)}
                    onChange={() => togglePic(officer.id)}
                  />
                  <span>
                    <strong>{officer.name}</strong>
                    <span className="block text-xs text-slate-500">
                      {officer.role === "OUT_BRANCH" ? "OUTBRANCH" : "CS"}
                      {officer.branchCode ? ` · ${officer.branchCode}` : ""}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <section className="space-y-4 rounded-2xl border p-4">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h3 className="flex items-center gap-2 font-black">
                  <MapPin size={18} /> Lokasi janji
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Cari titik yang pernah tersimpan, klik peta, gunakan GPS, atau
                  masukkan koordinat manual.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={useDeviceLocation}
              >
                <LocateFixed size={16} /> Lokasi saya
              </Button>
            </div>

            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-3.5 text-slate-400"
                size={17}
              />
              <input
                className="field pl-10"
                value={locationSearch}
                onChange={(event) => setLocationSearch(event.target.value)}
                placeholder="Cari lokasi tersimpan berdasarkan nama atau label"
              />
              {locationMatches.length ? (
                <div className="absolute z-[1200] mt-1 w-full overflow-hidden rounded-xl border bg-white shadow-xl">
                  {locationMatches.map((location) => (
                    <button
                      key={location.id}
                      type="button"
                      className="block min-h-12 w-full border-b px-3 py-2 text-left text-sm last:border-0 hover:bg-blue-50"
                      onClick={() => {
                        setMapPoint(
                          {
                            latitude: location.latitude,
                            longitude: location.longitude,
                          },
                          "MAP_PIN",
                        );
                        setLocationLabel(location.label);
                        setLocationSearch("");
                      }}
                    >
                      <strong>{location.label}</strong>
                      <span className="block text-xs text-slate-500">
                        {location.detail}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <AppointmentLocationMap
              point={point}
              onPick={(latitude, longitude) =>
                setMapPoint({ latitude, longitude }, "MAP_PIN")
              }
            />

            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <label className="label">
                Latitude
                <input
                  className="field mt-1"
                  inputMode="decimal"
                  value={latitudeInput}
                  onChange={(event) => setLatitudeInput(event.target.value)}
                  placeholder="-6.1450000"
                />
              </label>
              <label className="label">
                Longitude
                <input
                  className="field mt-1"
                  inputMode="decimal"
                  value={longitudeInput}
                  onChange={(event) => setLongitudeInput(event.target.value)}
                  placeholder="106.8180000"
                />
              </label>
              <Button
                type="button"
                variant="outline"
                onClick={applyManualCoordinates}
              >
                Terapkan koordinat
              </Button>
            </div>
            <label className="label">
              Label/alamat singkat lokasi
              <input
                className="field mt-1"
                value={locationLabel}
                onChange={(event) => setLocationLabel(event.target.value)}
                minLength={2}
                maxLength={120}
                required
                placeholder="Contoh: Ruko lantai 1, pintu kanan"
              />
            </label>
            {point ? (
              <p className="text-xs font-semibold text-blue-700">
                Titik: {point.latitude.toFixed(7)}, {point.longitude.toFixed(7)}
              </p>
            ) : (
              <p className="text-xs font-semibold text-amber-700">
                Pilih satu titik lokasi sebelum menyimpan.
              </p>
            )}
            {geoMessage ? (
              <p className="text-xs text-slate-600" role="status">
                {geoMessage}
              </p>
            ) : null}
          </section>

          <section className="rounded-2xl border p-4">
            <h3 className="flex items-center gap-2 font-black">
              <Camera size={18} /> Bukti aktivitas/lokasi (opsional)
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Gambar disimpan privat. Gunakan foto tempat atau aktivitas
              non-sensitif; jangan unggah wajah, KTP, dokumen nasabah, nomor
              rekening, atau layar berisi data pribadi.
            </p>
            <input
              className="mt-3 block w-full text-sm"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={choosePhoto}
            />
            {preview ? (
              <img
                src={preview}
                alt="Preview foto lokasi janji"
                className="mt-3 h-36 w-full rounded-xl object-cover sm:w-56"
              />
            ) : null}
          </section>

          {error ? (
            <div
              className="rounded-xl border border-red-200 bg-red-50 p-3"
              role="alert"
            >
              <p className="text-sm text-red-700">{error}</p>
            </div>
          ) : null}
        </form>
      </Dialog>
    </>
  );
}
