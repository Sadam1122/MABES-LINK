"use client";

import dynamic from "next/dynamic";
import { LocateFixed, MapPinPlus } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogClose } from "@/components/ui/dialog";
import { useFeedback } from "@/components/ui/feedback";
import { MarkerIconPicker } from "@/components/marker-icon-picker";
import { clientApi } from "@/lib/client-api";
import { geolocationErrorMessage } from "@/lib/geo";
import { type MappingMarkerIconValue } from "@/lib/mapping-icons";
import { isWithinManggaBesarBoundary } from "@/lib/mangga-besar-boundary";

const LocationPickerMap = dynamic(
  () => import("@/components/appointment-location-map"),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-[300px] place-items-center rounded-2xl bg-slate-100 text-sm text-slate-500">
        Memuat peta…
      </div>
    ),
  },
);

type Officer = {
  id: string;
  name: string;
  role: string;
  branchCode: string;
};

export function MappingCreateForm({
  officers,
  actorId,
}: {
  officers: Officer[];
  actorId: string;
}) {
  const { confirm, toast } = useFeedback();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [point, setPoint] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [locationSource, setLocationSource] = useState<
    "MAP_PIN" | "MANUAL_COORDINATES" | "DEVICE_GEOLOCATION"
  >("MAP_PIN");
  const [manualLatitude, setManualLatitude] = useState("");
  const [manualLongitude, setManualLongitude] = useState("");
  const [markerIcon, setMarkerIcon] = useState<MappingMarkerIconValue>("STORE");
  const defaultOfficer = useMemo(
    () => officers.find((officer) => officer.id === actorId) ?? officers[0],
    [actorId, officers],
  );
  const closeForm = () => {
    setOpen(false); setDirty(false); setPoint(null); setManualLatitude(""); setManualLongitude(""); setMarkerIcon("STORE"); setError("");
  };

  const selectPoint = (
    latitude: number,
    longitude: number,
    source: typeof locationSource,
  ) => {
    setPoint({ latitude, longitude });
    setManualLatitude(latitude.toFixed(7));
    setManualLongitude(longitude.toFixed(7));
    setLocationSource(source);
    setDirty(true);
    setError("");
  };

  const applyManualCoordinates = () => {
    const latitude = Number(manualLatitude);
    const longitude = Number(manualLongitude);
    if (
      manualLatitude.trim() === "" ||
      manualLongitude.trim() === "" ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      setError("Isi latitude −90…90 dan longitude −180…180 secara lengkap.");
      return;
    }
    selectPoint(latitude, longitude, "MANUAL_COORDINATES");
  };

  const useDeviceLocation = () => {
    if (!navigator.geolocation) {
      setError("Perangkat tidak mendukung geolocation.");
      return;
    }
    setError("Mengambil lokasi perangkat…");
    navigator.geolocation.getCurrentPosition(
      (position) =>
        selectPoint(
          position.coords.latitude,
          position.coords.longitude,
          "DEVICE_GEOLOCATION",
        ),
      (failure) => setError(geolocationErrorMessage(failure.code)),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );
  };

  const submit = async (formData: FormData) => {
    const inside = point ? isWithinManggaBesarBoundary(point.latitude, point.longitude) : null;
    if (
      !(await confirm({
        title: "Tambahkan lokasi mapping?",
        description: `${inside == null ? "Lokasi akan masuk daftar tanpa pin." : inside ? "Titik berada di dalam referensi batas Mangga Besar." : "Titik berada di luar referensi batas Mangga Besar."} Kebutuhan dan penggunaan produk belum dianggap terkonfirmasi.`,
        confirmLabel: "Tambahkan lokasi",
      }))
    )
      return;

    setBusy(true);
    setError("");
    try {
      await clientApi("/api/mapping", {
        method: "POST",
        body: JSON.stringify({
          businessAlias: formData.get("businessAlias"),
          contactPic: formData.get("contactPic") || null,
          need: "Belum dikonfirmasi",
          assignedToId: formData.get("assignedToId"),
          areaBlock: formData.get("areaBlock") || null,
          businessSector: formData.get("businessSector") || null,
          addressHint: formData.get("addressHint") || null,
          productNeeds: [],
          locationLabel: formData.get("locationLabel") || null,
          latitude: point?.latitude ?? null,
          longitude: point?.longitude ?? null,
          locationSource: point ? locationSource : null,
          mappingMarkerIcon: markerIcon,
        }),
      });
      setDirty(false);
      setOpen(false);
      toast("Lokasi mapping berhasil ditambahkan.", "success");
      window.location.reload();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Lokasi mapping gagal ditambahkan.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={!officers.length}>
        <MapPinPlus size={17} />
        Tambah lokasi
      </Button>
      <Dialog
        open={open}
        onClose={closeForm}
        title="Tambah lokasi mapping"
        description="Catat lokasi prospek tanpa menganggap kebutuhan atau penggunaan produk sudah terkonfirmasi. Koordinat boleh ditambahkan nanti."
        dirty={dirty}
        busy={busy}
        className="max-w-4xl"
      >
        <form
          className="space-y-5"
          onChange={() => setDirty(true)}
          onSubmit={(event) => {
            event.preventDefault();
            void submit(new FormData(event.currentTarget));
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="label">
              Nama toko/usaha
              <input
                className="field mt-1"
                name="businessAlias"
                minLength={2}
                maxLength={120}
                required
                autoFocus
              />
            </label>
            <label className="label">
              Nama pengguna/PIC tempat (opsional)
              <input className="field mt-1" name="contactPic" maxLength={100} />
            </label>
            <label className="label">
              PIC internal
              <select
                className="field mt-1"
                name="assignedToId"
                defaultValue={defaultOfficer?.id}
                required
              >
                {officers.map((officer) => (
                  <option key={officer.id} value={officer.id}>
                    {officer.name} · {officer.role} · {officer.branchCode}
                  </option>
                ))}
              </select>
            </label>
            <label className="label">
              Kategori usaha (opsional)
              <input
                className="field mt-1"
                name="businessSector"
                maxLength={100}
              />
            </label>
            <label className="label">
              Area/blok (opsional)
              <input className="field mt-1" name="areaBlock" maxLength={100} />
            </label>
            <label className="label">
              Label lokasi (opsional)
              <input
                className="field mt-1"
                name="locationLabel"
                maxLength={120}
              />
            </label>
            <label className="label sm:col-span-2">
              Petunjuk alamat minimum (opsional)
              <input
                className="field mt-1"
                name="addressHint"
                maxLength={220}
              />
            </label>
          </div>

          <MarkerIconPicker value={markerIcon} onChange={(next) => { setMarkerIcon(next); setDirty(true); }} label="Pilih ikon penanda lokasi" />

          <div className="space-y-3 rounded-2xl border bg-slate-50 p-3 sm:p-4">
            <div className="flex flex-wrap items-end gap-3">
              <label className="label min-w-48 flex-1">
                Latitude
                <input
                  className="field mt-1"
                  inputMode="decimal"
                  value={manualLatitude}
                  onChange={(event) => setManualLatitude(event.target.value)}
                  placeholder="-6.1500000"
                />
              </label>
              <label className="label min-w-48 flex-1">
                Longitude
                <input
                  className="field mt-1"
                  inputMode="decimal"
                  value={manualLongitude}
                  onChange={(event) => setManualLongitude(event.target.value)}
                  placeholder="106.8200000"
                />
              </label>
              <Button
                type="button"
                variant="outline"
                onClick={applyManualCoordinates}
              >
                Terapkan koordinat
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={useDeviceLocation}
              >
                <LocateFixed size={17} />
                Lokasi saya
              </Button>
            </div>
            <LocationPickerMap
              point={point}
              pointLabel="Lokasi mapping baru"
              onPick={(latitude, longitude) =>
                selectPoint(latitude, longitude, "MAP_PIN")
              }
            />
            <p className="text-xs text-slate-500">
              Klik peta untuk memasang pin. Posisi perangkat hanya digunakan
              setelah izin diberikan dan tidak disimpan sebagai riwayat GPS.
            </p>
            {point ? (
              <p
                className={`rounded-xl px-3 py-2 text-sm font-bold ${isWithinManggaBesarBoundary(point.latitude, point.longitude) ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}
              >
                {point.latitude.toFixed(7)}, {point.longitude.toFixed(7)} ·{" "}
                {isWithinManggaBesarBoundary(point.latitude, point.longitude)
                  ? "di dalam"
                  : "di luar"}{" "}
                referensi batas Mangga Besar
              </p>
            ) : null}
          </div>

          <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
            Jangan masukkan data nasabah, nomor rekening, saldo, dokumen, atau
            foto identitas. Foto tempat dapat ditambahkan setelah lokasi
            tersimpan.
          </p>
          {error ? (
            <p role="alert" className="text-sm font-semibold text-red-700">
              {error}
            </p>
          ) : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <DialogClose
              type="button"
              variant="outline"
              disabled={busy}
            >
              Batal
            </DialogClose>
            <Button type="submit" disabled={busy}>
              {busy ? "Menyimpan…" : "Simpan lokasi mapping"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
