"use client";

/* eslint-disable @next/next/no-img-element -- endpoint gambar privat memerlukan cookie sesi dan tidak boleh diproksi optimizer publik */

import dynamic from "next/dynamic";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
} from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { clientApi } from "@/lib/client-api";
import {
  formatStraightLineDistance,
  geolocationErrorMessage,
  googleMapsLocationUrl,
  googleMapsNavigationUrl,
  haversineMeters,
} from "@/lib/geo";
import {
  isWithinManggaBesarBoundary,
  MANGGA_BESAR_BOUNDARY_SOURCE,
} from "@/lib/mangga-besar-boundary";

const LeafletMap = dynamic(() => import("@/components/mapping-map"), {
  ssr: false,
  loading: () => (
    <div className="grid h-[430px] place-items-center rounded-2xl bg-slate-100 text-sm text-slate-500">
      Memuat peta… Daftar lokasi tetap tersedia.
    </div>
  ),
});

type Prospect = {
  id: string;
  internalCode: string;
  businessAlias: string;
  areaBlock: string | null;
  businessSector: string | null;
  addressHint: string | null;
  locationLabel: string | null;
  latitude: number | null;
  longitude: number | null;
  locationUpdatedAt: string | null;
  version: number;
  opportunityStage: string;
  assignedTo: { id: string; name: string };
  visits: { visitedAt: string; outcome: string; notes: string }[];
  followUps: { dueAt: string }[];
  locationPhotos: { id: string; width: number; height: number }[];
};
type Position = { latitude: number; longitude: number; accuracy: number };

export function MappingWorkspace({
  prospects,
  canEdit,
  roleLabel,
  scopeLabel,
}: {
  prospects: Prospect[];
  canEdit: boolean;
  roleLabel: string;
  scopeLabel: string;
}) {
  const [selected, setSelected] = useState<Prospect | null>(
    prospects[0] ?? null,
  );
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [manualLat, setManualLat] = useState("");
  const [manualLng, setManualLng] = useState("");
  const [label, setLabel] = useState(prospects[0]?.locationLabel ?? "");
  const [userPosition, setUserPosition] = useState<Position | null>(null);
  const [geoMessage, setGeoMessage] = useState("");
  const [sortNearest, setSortNearest] = useState(false);
  const [boundaryFilter, setBoundaryFilter] = useState<
    "all" | "inside" | "outside"
  >("all");
  const [picFilter, setPicFilter] = useState("all");
  const [showBoundary, setShowBoundary] = useState(true);
  const [focusRequest, setFocusRequest] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [openedAt] = useState(() => Date.now());

  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoMessage("Perangkat tidak mendukung geolocation.");
      return;
    }
    setGeoMessage("Mengambil lokasi perangkat…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };
        setUserPosition(next);
        setGeoMessage(
          next.accuracy > 100
            ? `Akurasi rendah (±${Math.round(next.accuracy)} m). Periksa pin sebelum menyimpan.`
            : `Lokasi diperoleh (akurasi ±${Math.round(next.accuracy)} m).`,
        );
      },
      (failure) => setGeoMessage(geolocationErrorMessage(failure.code)),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );
  }, []);

  useEffect(() => {
    if (!("permissions" in navigator)) return;
    void navigator.permissions
      .query({ name: "geolocation" })
      .then((result) => {
        if (result.state === "granted") locate();
      })
      .catch(() => {});
  }, [locate]);

  const picOptions = useMemo(
    () =>
      Array.from(
        new Map(
          prospects.map((item) => [
            item.assignedTo.id,
            { id: item.assignedTo.id, name: item.assignedTo.name },
          ]),
        ).values(),
      ).sort((a, b) => a.name.localeCompare(b.name, "id")),
    [prospects],
  );

  const filteredProspects = useMemo(
    () =>
      prospects.filter((item) => {
        if (picFilter !== "all" && item.assignedTo.id !== picFilter)
          return false;
        if (boundaryFilter === "all") return true;
        const inside =
          item.latitude != null &&
          item.longitude != null &&
          isWithinManggaBesarBoundary(
            Number(item.latitude),
            Number(item.longitude),
          );
        return boundaryFilter === "inside" ? inside : !inside;
      }),
    [boundaryFilter, picFilter, prospects],
  );

  const withDistance = useMemo(
    () =>
      filteredProspects
        .map((item) => ({
          item,
          distance:
            userPosition && item.latitude != null && item.longitude != null
              ? haversineMeters(userPosition, {
                  latitude: Number(item.latitude),
                  longitude: Number(item.longitude),
                })
              : null,
        }))
        .sort((a, b) =>
          sortNearest
            ? (a.distance ?? Number.POSITIVE_INFINITY) -
              (b.distance ?? Number.POSITIVE_INFINITY)
            : 0,
        ),
    [filteredProspects, userPosition, sortNearest],
  );
  const points = useMemo(
    () =>
      filteredProspects
        .filter((item) => item.latitude != null && item.longitude != null)
        .map((item) => ({
          id: item.id,
          code: item.internalCode,
          label: item.locationLabel || item.areaBlock || "Lokasi tersimpan",
          latitude: Number(item.latitude),
          longitude: Number(item.longitude),
          actionNeeded:
            item.opportunityStage === "NEED_CONFIRMED" ||
            item.followUps.some(
              (followUp) => new Date(followUp.dueAt).getTime() <= openedAt,
            ),
        })),
    [filteredProspects, openedAt],
  );

  function choose(item: Prospect) {
    setSelected(item);
    setLabel(item.locationLabel ?? "");
    setPoint(null);
    setManualLat("");
    setManualLng("");
    setPreview(null);
    setError("");
  }

  async function saveLocation(candidate = point) {
    if (!selected || !candidate) return;
    const isInside = isWithinManggaBesarBoundary(candidate.lat, candidate.lng);
    if (
      !confirm(
        `${isInside ? "" : "Titik berada di luar referensi batas Kelurahan Mangga Besar.\n\n"}Simpan ${candidate.lat.toFixed(7)}, ${candidate.lng.toFixed(7)} sebagai lokasi tujuan?`,
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await clientApi(`/api/prospects/${selected.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          version: selected.version,
          latitude: candidate.lat,
          longitude: candidate.lng,
          locationLabel: label || null,
        }),
      });
      location.reload();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Lokasi gagal disimpan.",
      );
    } finally {
      setBusy(false);
    }
  }

  function applyManual() {
    const lat = Number(manualLat);
    const lng = Number(manualLng);
    if (
      manualLat.trim() === "" ||
      manualLng.trim() === "" ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      setError("Isi latitude −90…90 dan longitude −180…180 secara lengkap.");
      return;
    }
    setPoint({ lat, lng });
    setError("");
  }

  async function copyCoordinates() {
    if (selected?.latitude == null || selected.longitude == null) return;
    await navigator.clipboard.writeText(
      `${selected.latitude},${selected.longitude}`,
    );
    setGeoMessage("Koordinat disalin.");
  }

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !selected) return;
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch(`/api/prospects/${selected.id}/photos`, {
        method: "POST",
        body,
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.error?.message ?? "Unggah gagal.");
      location.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unggah gagal.");
    } finally {
      setBusy(false);
    }
  }

  async function removePhoto(id: string) {
    if (!confirm("Hapus gambar lokasi ini?")) return;
    await clientApi(`/api/location-photos/${id}`, { method: "DELETE" });
    location.reload();
  }

  async function replacePhoto(
    id: string,
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch(`/api/location-photos/${id}`, {
        method: "PATCH",
        body,
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.error?.message ?? "Penggantian gagal.");
      location.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Penggantian gagal.");
    } finally {
      setBusy(false);
    }
  }

  const saved =
    selected?.latitude != null && selected.longitude != null
      ? {
          latitude: Number(selected.latitude),
          longitude: Number(selected.longitude),
        }
      : null;
  const candidateInside = point
    ? isWithinManggaBesarBoundary(point.lat, point.lng)
    : null;
  const insideCount = prospects.filter(
    (item) =>
      item.latitude != null &&
      item.longitude != null &&
      isWithinManggaBesarBoundary(
        Number(item.latitude),
        Number(item.longitude),
      ),
  ).length;

  return (
    <div className="space-y-4">
      <section className="card grid gap-3 border-blue-200 bg-blue-50/60 p-4 md:grid-cols-[1fr_auto_auto] md:items-center">
        <div>
          <p className="text-xs font-black uppercase tracking-[.14em] text-blue-700">
            Akses aktif · {roleLabel}
          </p>
          <p className="mt-1 font-bold text-slate-900">{scopeLabel}</p>
          <p className="mt-1 text-xs text-slate-600">
            {insideCount} titik di dalam referensi batas · {prospects.length}{" "}
            record dapat diakses
          </p>
        </div>
        <label className="text-xs font-bold text-slate-700">
          Filter PIC
          <select
            className="field mt-1 min-w-44"
            value={picFilter}
            onChange={(event) => setPicFilter(event.target.value)}
          >
            <option value="all">Semua PIC yang terlihat</option>
            {picOptions.map((pic) => (
              <option key={pic.id} value={pic.id}>
                {pic.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-bold text-slate-700">
          Posisi terhadap batas
          <select
            className="field mt-1 min-w-44"
            value={boundaryFilter}
            onChange={(event) =>
              setBoundaryFilter(
                event.target.value as "all" | "inside" | "outside",
              )
            }
          >
            <option value="all">Semua titik</option>
            <option value="inside">Di dalam batas</option>
            <option value="outside">Di luar / belum bertitik</option>
          </select>
        </label>
      </section>
      <div className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
        <section className="space-y-4">
          <div className="card overflow-hidden p-2">
            <div className="flex flex-wrap items-center gap-2 p-2">
              <Button
                variant="outline"
                onClick={() => setShowBoundary((value) => !value)}
              >
                {showBoundary ? "Sembunyikan batas" : "Tampilkan batas"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setFocusRequest((value) => value + 1)}
              >
                Fokus Mangga Besar
              </Button>
              <span className="text-xs text-slate-500">
                Garis biru: referensi administratif, bukan penetapan wilayah
                kerja.
              </span>
            </div>
            <LeafletMap
              points={points}
              userPosition={userPosition}
              candidate={
                point ? { latitude: point.lat, longitude: point.lng } : null
              }
              showBoundary={showBoundary}
              focusRequest={focusRequest}
              onPick={(lat, lng) => {
                setPoint({ lat, lng });
                setManualLat(lat.toFixed(7));
                setManualLng(lng.toFixed(7));
                setError("");
              }}
              onSelect={(id) => {
                const item = prospects.find((prospect) => prospect.id === id);
                if (item) choose(item);
              }}
            />
            <p className="px-2 pb-1 pt-2 text-xs text-slate-500">
              Klik peta untuk memilih titik. Layer peta menerima permintaan tile
              dan koordinat area tampilan; jangan masukkan informasi rahasia
              pada label.{" "}
              <a
                href={MANGGA_BESAR_BOUNDARY_SOURCE}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-blue-700 underline"
              >
                Sumber batas: GIS Pemprov DKI
              </a>
            </p>
          </div>
          {selected && (
            <div className="card space-y-4 p-4">
              <div>
                <h2 className="font-black">
                  Lokasi tujuan · {selected.internalCode}
                </h2>
                <p className="text-sm text-slate-500">
                  Posisi perangkat hanya dipakai sementara untuk cek jarak dan
                  tidak disimpan sebagai riwayat.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="label">
                  Label lokasi
                  <input
                    className="field mt-1"
                    value={label}
                    onChange={(event) => setLabel(event.target.value)}
                    maxLength={120}
                  />
                </label>
                <div>
                  <span className="label">Posisi perangkat</span>
                  <Button variant="outline" onClick={locate}>
                    Lokasi saya
                  </Button>
                </div>
                <label className="label">
                  Latitude
                  <input
                    className="field mt-1"
                    value={manualLat}
                    onChange={(event) => setManualLat(event.target.value)}
                    inputMode="decimal"
                    placeholder="-6.1500000"
                  />
                </label>
                <label className="label">
                  Longitude
                  <input
                    className="field mt-1"
                    value={manualLng}
                    onChange={(event) => setManualLng(event.target.value)}
                    inputMode="decimal"
                    placeholder="106.8200000"
                  />
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={applyManual}>
                  Gunakan koordinat manual
                </Button>
                {userPosition && (
                  <Button
                    variant="outline"
                    onClick={() =>
                      setPoint({
                        lat: userPosition.latitude,
                        lng: userPosition.longitude,
                      })
                    }
                  >
                    Pilih posisi saya
                  </Button>
                )}
                {point && canEdit && (
                  <Button disabled={busy} onClick={() => void saveLocation()}>
                    Simpan lokasi tujuan
                  </Button>
                )}
              </div>
              {geoMessage && (
                <p className="text-sm text-slate-600">{geoMessage}</p>
              )}
              {candidateInside != null && (
                <p
                  className={`rounded-xl px-3 py-2 text-sm font-semibold ${
                    candidateInside
                      ? "bg-emerald-50 text-emerald-800"
                      : "bg-amber-50 text-amber-900"
                  }`}
                >
                  {candidateInside
                    ? "Titik berada di dalam referensi batas Mangga Besar."
                    : "Titik berada di luar referensi batas Mangga Besar. Pastikan cakupan penugasan sebelum menyimpan."}
                </p>
              )}
              {saved && (
                <div className="flex flex-wrap gap-2 border-t pt-4">
                  <Button
                    variant="outline"
                    onClick={() => void copyCoordinates()}
                  >
                    Salin koordinat
                  </Button>
                  <a
                    className={buttonVariants({ variant: "outline" })}
                    target="_blank"
                    rel="noreferrer"
                    href={googleMapsLocationUrl(saved)}
                  >
                    Buka Google Maps
                  </a>
                  <a
                    className={buttonVariants()}
                    target="_blank"
                    rel="noreferrer"
                    href={googleMapsNavigationUrl(saved)}
                  >
                    Navigasi
                  </a>
                </div>
              )}
              <div className="border-t pt-4">
                <p className="label">Foto lokasi (opsional, maks. 3)</p>
                <div className="flex flex-wrap gap-3">
                  {selected.locationPhotos.map((photo) => (
                    <div key={photo.id} className="relative">
                      <img
                        src={`/api/location-photos/${photo.id}`}
                        alt="Tampilan lokasi"
                        className="h-24 w-32 rounded-xl object-cover"
                      />
                      {canEdit && (
                        <div className="absolute inset-x-1 bottom-1 flex justify-between gap-1">
                          <label className="cursor-pointer rounded bg-white/90 px-2 py-1 text-xs">
                            Ganti
                            <input
                              className="sr-only"
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              disabled={busy}
                              onChange={(event) =>
                                void replacePhoto(photo.id, event)
                              }
                            />
                          </label>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void removePhoto(photo.id)}
                            className="rounded bg-white/90 px-2 py-1 text-xs"
                          >
                            Hapus
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  {preview && (
                    <img
                      src={preview}
                      alt="Preview gambar baru"
                      className="h-24 w-32 rounded-xl object-cover opacity-70"
                    />
                  )}
                </div>
                {canEdit && selected.locationPhotos.length < 3 && (
                  <input
                    className="mt-3 block text-sm"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => void upload(event)}
                  />
                )}
                <p className="mt-2 text-xs text-slate-500">
                  JPEG/PNG/WebP, maks. 5 MB. Foto tempat saja; jangan unggah
                  wajah, KTP, dokumen, atau layar berisi data pribadi.
                </p>
              </div>
              {error && <p className="text-sm text-red-700">{error}</p>}
            </div>
          )}
        </section>
        <section className="space-y-3">
          <div className="flex justify-end">
            <Button
              variant="outline"
              disabled={!userPosition}
              onClick={() => setSortNearest(!sortNearest)}
            >
              {sortNearest ? "Urutan semula" : "Urutkan terdekat"}
            </Button>
          </div>
          {withDistance.length ? (
            withDistance.map(({ item, distance }) => (
              <button
                type="button"
                onClick={() => choose(item)}
                key={item.id}
                className={`card w-full p-4 text-left ${
                  selected?.id === item.id ? "ring-2 ring-blue-700" : ""
                }`}
              >
                <div className="flex justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs text-blue-700">
                      {item.internalCode}
                    </p>
                    <p className="font-bold">
                      {item.locationLabel || item.businessAlias}
                    </p>
                  </div>
                  {distance != null && (
                    <span className="text-xs font-bold text-emerald-700">
                      {formatStraightLineDistance(distance)}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {item.areaBlock || "Area belum diisi"} ·{" "}
                  {item.businessSector || "Sektor belum diisi"} · PIC{" "}
                  {item.assignedTo.name}
                </p>
                {item.latitude != null && item.longitude != null && (
                  <p className="mt-1 text-xs font-semibold text-blue-700">
                    {isWithinManggaBesarBoundary(
                      Number(item.latitude),
                      Number(item.longitude),
                    )
                      ? "Di dalam referensi batas"
                      : "Di luar referensi batas"}
                  </p>
                )}
                {distance != null && (
                  <p className="mt-2 text-xs text-slate-500">
                    Jarak garis lurus; bukan jarak rute atau waktu tempuh.
                  </p>
                )}
              </button>
            ))
          ) : (
            <div className="card p-8 text-center text-sm text-slate-500">
              Tidak ada lokasi sesuai filter.
            </div>
          )}
          {selected && (
            <div className="card p-4">
              <p className="font-bold">Tugas terkait</p>
              <Link
                href={`/work?search=${encodeURIComponent(selected.internalCode)}`}
                className={buttonVariants({
                  variant: "outline",
                  size: "sm",
                  className: "mt-3",
                })}
              >
                Buka pekerjaan
              </Link>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
