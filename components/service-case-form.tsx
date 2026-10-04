"use client";

/* eslint-disable @next/next/no-img-element -- preview file lokal tidak dikirim ke image optimizer */

import dynamic from "next/dynamic";
import { Camera, LocateFixed, MapPin, Plus } from "lucide-react";
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

type ProspectOption = {
  id: string;
  internalCode: string;
  cakraReference: string | null;
  businessAlias: string;
  contactPic: string;
  branchId: string;
  version: number;
  locationLabel: string | null;
  latitude: number | null;
  longitude: number | null;
  locationSource: string | null;
};

type OfficerOption = {
  id: string;
  name: string;
  branchId: string | null;
};

type Point = { latitude: number; longitude: number };

export function ServiceCaseForm({
  prospects,
  officers,
}: {
  prospects: ProspectOption[];
  officers: OfficerOption[];
}) {
  const router = useRouter();
  const { toast } = useFeedback();
  const [open, setOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [prospectId, setProspectId] = useState("");
  const [contactName, setContactName] = useState("");
  const [storeName, setStoreName] = useState("");
  const [locationLabel, setLocationLabel] = useState("");
  const [point, setPoint] = useState<Point | null>(null);
  const [locationSource, setLocationSource] = useState<
    "MAP_PIN" | "MANUAL_COORDINATES" | "DEVICE_GEOLOCATION"
  >("MAP_PIN");
  const [geoMessage, setGeoMessage] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const selected = useMemo(
    () => prospects.find((prospect) => prospect.id === prospectId) ?? null,
    [prospectId, prospects],
  );
  const visibleOfficers = useMemo(
    () =>
      selected
        ? officers.filter(
            (officer) =>
              officer.branchId === selected.branchId ||
              officer.branchId === null,
          )
        : [],
    [officers, selected],
  );

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  const chooseProspect = (id: string) => {
    setProspectId(id);
    const prospect = prospects.find((item) => item.id === id);
    setContactName(prospect?.contactPic ?? "");
    setStoreName("");
    setLocationLabel(prospect?.locationLabel ?? "");
    setPoint(
      prospect?.latitude != null && prospect.longitude != null
        ? {
            latitude: Number(prospect.latitude),
            longitude: Number(prospect.longitude),
          }
        : null,
    );
    setLocationSource(
      prospect?.locationSource === "DEVICE_GEOLOCATION" ||
        prospect?.locationSource === "MANUAL_COORDINATES"
        ? prospect.locationSource
        : "MAP_PIN",
    );
    setDirty(true);
    setError("");
  };

  const useDeviceLocation = () => {
    if (!navigator.geolocation) {
      setGeoMessage("Perangkat tidak mendukung geolocation.");
      return;
    }
    setGeoMessage("Mengambil lokasi perangkat…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setPoint({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLocationSource("DEVICE_GEOLOCATION");
        setDirty(true);
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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !selected) return;
    if (!point) {
      setError("Pilih titik lokasi janji pada peta atau gunakan lokasi perangkat.");
      return;
    }
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const appointmentAt = jakartaLocalToIso(String(form.get("appointmentAt")));
      const item = await clientApi<{ id: string }>("/api/service-cases", {
        method: "POST",
        body: JSON.stringify({
          prospectId: selected.id,
          prospectVersion: selected.version,
          origin: "OUT_BRANCH",
          title: `Janji akuisisi · ${storeName.trim() || selected.internalCode}`,
          description: form.get("reason"),
          picId: form.get("picId"),
          nextAction: "Laksanakan janji akuisisi sesuai jadwal",
          dueAt: appointmentAt,
          appointmentStatus: "CONFIRMED",
          appointmentAt,
          contactPic: contactName,
          businessAlias: storeName.trim() || undefined,
          locationLabel: locationLabel.trim() || null,
          latitude: point.latitude,
          longitude: point.longitude,
          locationSource,
        }),
      });

      let photoFailed = false;
      if (photo) {
        const body = new FormData();
        body.set("file", photo);
        const response = await fetch(`/api/prospects/${selected.id}/photos`, {
          method: "POST",
          body,
        });
        photoFailed = !response.ok;
      }
      setDirty(false);
      setOpen(false);
      toast(
        photoFailed
          ? "Janji tersimpan dan reminder dibuat, tetapi foto gagal diunggah. Tambahkan foto dari detail Mapping."
          : "Janji akuisisi tersimpan. Reminder internal akan diproses worker.",
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
    setProspectId("");
    setContactName("");
    setStoreName("");
    setLocationLabel("");
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
      <Button onClick={resetAndOpen} disabled={!prospects.length}>
        <Plus size={16} /> Buat janji
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Buat janji akuisisi"
        description="Gunakan referensi existing, tentukan orang yang ditemui, lokasi, dan waktu janji dalam WIB."
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
              disabled={busy || !selected || !point}
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
          <label className="label">
            Referensi existing
            <select
              data-autofocus
              name="prospectId"
              className="field mt-1"
              value={prospectId}
              onChange={(event) => chooseProspect(event.target.value)}
              required
            >
              <option value="">Pilih referensi</option>
              {prospects.map((prospect) => (
                <option key={prospect.id} value={prospect.id}>
                  {prospect.internalCode}
                  {prospect.cakraReference
                    ? ` · CAKRA ${prospect.cakraReference}`
                    : ""}
                </option>
              ))}
            </select>
          </label>

          {selected ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="label">
                  Janji dengan siapa
                  <input
                    className="field mt-1"
                    value={contactName}
                    onChange={(event) => setContactName(event.target.value)}
                    minLength={2}
                    maxLength={100}
                    required
                    placeholder="Nama orang/PIC yang ditemui"
                  />
                </label>
                <label className="label">
                  Nama toko/usaha (opsional)
                  <input
                    className="field mt-1"
                    value={storeName}
                    onChange={(event) => setStoreName(event.target.value)}
                    maxLength={120}
                    placeholder={selected.businessAlias}
                  />
                </label>
                <label className="label sm:col-span-2">
                  Alasan dan tujuan janji
                  <textarea
                    name="reason"
                    className="textarea mt-1"
                    minLength={5}
                    maxLength={700}
                    required
                    placeholder="Contoh: membahas kebutuhan transaksi usaha dan jadwal tindak lanjut"
                  />
                </label>
                <label className="label">
                  PIC internal
                  <select name="picId" className="field mt-1" required>
                    <option value="">Pilih PIC</option>
                    {visibleOfficers.map((officer) => (
                      <option key={officer.id} value={officer.id}>
                        {officer.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="label">
                  Waktu janji (WIB)
                  <input
                    name="appointmentAt"
                    type="datetime-local"
                    className="field mt-1"
                    required
                  />
                </label>
              </div>

              <section className="space-y-3 rounded-2xl border p-4">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div>
                    <h3 className="flex items-center gap-2 font-black">
                      <MapPin size={18} /> Lokasi janji
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Klik peta untuk memindahkan pin. Koordinat disimpan pada referensi yang sama.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={useDeviceLocation}
                  >
                    <LocateFixed size={16} /> Gunakan lokasi saya
                  </Button>
                </div>
                <AppointmentLocationMap
                  point={point}
                  onPick={(latitude, longitude) => {
                    setPoint({ latitude, longitude });
                    setLocationSource("MAP_PIN");
                    setDirty(true);
                  }}
                />
                <label className="label">
                  Label/alamat singkat lokasi
                  <input
                    className="field mt-1"
                    value={locationLabel}
                    onChange={(event) => setLocationLabel(event.target.value)}
                    maxLength={120}
                    placeholder="Contoh: Ruko lantai 1, pintu sebelah kanan"
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
                  <Camera size={18} /> Foto lokasi (opsional)
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Foto tempat/toko untuk membantu kunjungan. Jangan unggah wajah, KTP, dokumen, atau layar berisi data pribadi.
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
            </>
          ) : null}

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
