"use client";

/* eslint-disable @next/next/no-img-element -- endpoint gambar privat memerlukan cookie sesi dan tidak boleh diproksi optimizer publik */

import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Building2,
  HeartPulse,
  ShoppingBasket,
  Store,
  Utensils,
  Wrench,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
} from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { useFeedback } from "@/components/ui/feedback";
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
import {
  mappingMarkerIconOptions,
  type MappingMarkerIconValue,
} from "@/lib/mapping-icons";

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
  publicQrisRequestId?: string | null;
  contactPic: string;
  areaBlock: string | null;
  businessSector: string | null;
  productNeeds: string[];
  addressHint: string | null;
  locationLabel: string | null;
  latitude: number | null;
  longitude: number | null;
  locationUpdatedAt: string | null;
  locationSource: string | null;
  mappingMarkerIcon: MappingMarkerIconValue;
  version: number;
  opportunityStage: string;
  assignedTo: { id: string; name: string };
  visits: { visitedAt: string; outcome: string; notes: string }[];
  followUps: { dueAt: string }[];
  locationPhotos: { id: string; width: number; height: number }[];
  usageVerifications: {
    id: string;
    usedAt: string;
    evidenceReference: string;
  }[];
};
type Position = { latitude: number; longitude: number; accuracy: number };

const markerIconComponents = {
  STORE: Store,
  FOOD: Utensils,
  MARKET: ShoppingBasket,
  OFFICE: Building2,
  HEALTH: HeartPulse,
  SERVICE: Wrench,
} satisfies Record<MappingMarkerIconValue, typeof Store>;

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
  const { confirm, toast } = useFeedback();
  const [selected, setSelected] = useState<Prospect | null>(
    prospects[0] ?? null,
  );
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [pointSource, setPointSource] = useState<
    "MAP_PIN" | "MANUAL_COORDINATES" | "DEVICE_GEOLOCATION"
  >("MAP_PIN");
  const [manualLat, setManualLat] = useState("");
  const [manualLng, setManualLng] = useState("");
  const [label, setLabel] = useState(prospects[0]?.locationLabel ?? "");
  const [selectedMarkerIcon, setSelectedMarkerIcon] =
    useState<MappingMarkerIconValue>(
      prospects[0]?.mappingMarkerIcon ?? "STORE",
    );
  const [userPosition, setUserPosition] = useState<Position | null>(null);
  const [geoMessage, setGeoMessage] = useState("");
  const [sortNearest, setSortNearest] = useState(false);
  const [boundaryFilter, setBoundaryFilter] = useState<
    "all" | "inside" | "outside"
  >("all");
  const [picFilter, setPicFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [scheduleFilter, setScheduleFilter] = useState("all");
  const [actionNeededOnly, setActionNeededOnly] = useState(false);
  const [showBoundary, setShowBoundary] = useState(true);
  const [focusRequest, setFocusRequest] = useState(1);
  const [fitRequest, setFitRequest] = useState(0);
  const [markerPalette, setMarkerPalette] = useState<
    "status" | "blue" | "green" | "purple"
  >("status");
  const [markerScale, setMarkerScale] = useState(40);
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

  const categoryOptions = useMemo(
    () =>
      Array.from(
        new Set(
          prospects
            .map((item) => item.businessSector)
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((a, b) => a.localeCompare(b, "id")),
    [prospects],
  );

  const jakartaDayKey = (value: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(value);

  const filteredProspects = useMemo(
    () =>
      prospects.filter((item) => {
        const normalizedSearch = search.trim().toLocaleLowerCase("id");
        if (
          normalizedSearch &&
          ![
            item.internalCode,
            item.businessAlias,
            item.contactPic,
            item.locationLabel,
            item.assignedTo.name,
          ].some((value) =>
            value?.toLocaleLowerCase("id").includes(normalizedSearch),
          )
        )
          return false;
        if (picFilter !== "all" && item.assignedTo.id !== picFilter)
          return false;
        if (stageFilter !== "all" && item.opportunityStage !== stageFilter)
          return false;
        if (categoryFilter !== "all" && item.businessSector !== categoryFilter)
          return false;
        const dueAt = item.followUps[0]?.dueAt
          ? new Date(item.followUps[0].dueAt)
          : null;
        if (
          actionNeededOnly &&
          item.opportunityStage !== "NEED_CONFIRMED" &&
          !(dueAt && dueAt.getTime() <= openedAt)
        )
          return false;
        if (scheduleFilter === "none" && dueAt) return false;
        if (scheduleFilter !== "all" && scheduleFilter !== "none") {
          if (!dueAt) return false;
          const today = jakartaDayKey(new Date(openedAt));
          const dueDay = jakartaDayKey(dueAt);
          if (scheduleFilter === "overdue" && dueAt.getTime() >= openedAt)
            return false;
          if (scheduleFilter === "today" && dueDay !== today) return false;
          if (
            scheduleFilter === "upcoming" &&
            (dueAt.getTime() <= openedAt || dueDay === today)
          )
            return false;
        }
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
    [
      actionNeededOnly,
      boundaryFilter,
      categoryFilter,
      openedAt,
      picFilter,
      prospects,
      scheduleFilter,
      search,
      stageFilter,
    ],
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
          businessAlias: item.businessAlias,
          picName: item.assignedTo.name,
          stage: item.opportunityStage,
          dueAt: item.followUps[0]?.dueAt ?? null,
          contactName: item.contactPic,
          productNeeds: item.productNeeds,
          usedAt: item.usageVerifications[0]?.usedAt ?? null,
          markerIcon: item.mappingMarkerIcon,
        })),
    [filteredProspects, openedAt],
  );

  function choose(item: Prospect) {
    setSelected(item);
    setLabel(item.locationLabel ?? "");
    setSelectedMarkerIcon(item.mappingMarkerIcon);
    setPoint(null);
    setPointSource("MAP_PIN");
    setManualLat("");
    setManualLng("");
    setPreview(null);
    setError("");
  }

  async function saveLocation(candidate = point) {
    if (!selected || !candidate) return;
    const isInside = isWithinManggaBesarBoundary(candidate.lat, candidate.lng);
    if (
      !(await confirm({
        title: "Simpan lokasi tujuan?",
        description: `${isInside ? "" : "Titik berada di luar referensi batas Kelurahan Mangga Besar. "}Koordinat ${candidate.lat.toFixed(7)}, ${candidate.lng.toFixed(7)} akan disimpan.`,
        confirmLabel: "Simpan lokasi",
      }))
    )
      return;
    setBusy(true);
    setError("");
    try {
      await clientApi(`/api/mapping/${selected.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          version: selected.version,
          latitude: candidate.lat,
          longitude: candidate.lng,
          locationLabel: label || null,
          locationSource: pointSource,
          mappingMarkerIcon: selectedMarkerIcon,
        }),
      });
      toast("Lokasi berhasil disimpan.", "success");
      location.reload();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Lokasi gagal disimpan.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveMarkerIcon() {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      const hasCoordinates =
        selected.latitude != null && selected.longitude != null;
      await clientApi(`/api/mapping/${selected.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          version: selected.version,
          latitude: hasCoordinates ? Number(selected.latitude) : null,
          longitude: hasCoordinates ? Number(selected.longitude) : null,
          locationLabel: selected.locationLabel,
          locationSource: hasCoordinates
            ? selected.locationSource || "MAP_PIN"
            : null,
          mappingMarkerIcon: selectedMarkerIcon,
        }),
      });
      toast("Ikon marker berhasil disimpan.", "success");
      location.reload();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Ikon marker gagal disimpan.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function removeLocation() {
    if (!selected || !saved) return;
    if (
      !(await confirm({
        title: "Hapus titik lokasi?",
        description:
          "Koordinat dan label lokasi akan dikosongkan. Foto dan riwayat audit tetap dipertahankan.",
        confirmLabel: "Hapus titik",
        tone: "danger",
      }))
    )
      return;
    setBusy(true);
    setError("");
    try {
      await clientApi(`/api/mapping/${selected.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          version: selected.version,
          latitude: null,
          longitude: null,
          locationLabel: null,
          locationSource: null,
        }),
      });
      toast("Titik lokasi dihapus. Riwayat audit tetap tersedia.", "success");
      location.reload();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Lokasi gagal dihapus.",
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
    setPointSource("MANUAL_COORDINATES");
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
    if (
      !(await confirm({
        title: "Hapus gambar lokasi?",
        description:
          "Gambar akan dihapus dari penyimpanan privat dan perubahan dicatat.",
        confirmLabel: "Hapus gambar",
        tone: "danger",
      }))
    )
      return;
    await clientApi(`/api/location-photos/${id}`, { method: "DELETE" });
    toast("Gambar lokasi dihapus.", "success");
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
      <section className="card grid gap-3 border-blue-200 bg-blue-50/60 p-4 md:grid-cols-2 xl:grid-cols-4 xl:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[.14em] text-blue-700">
            Akses aktif · {roleLabel}
          </p>
          <p className="mt-1 font-bold text-slate-900">{scopeLabel}</p>
          <p className="mt-1 text-xs text-slate-600">
            {insideCount} titik di dalam referensi batas · {prospects.length}{" "}
            pengguna terverifikasi dapat diakses
          </p>
        </div>
        <label className="text-xs font-bold text-slate-700 xl:col-start-1">
          Cari nama, toko, atau PIC
          <input
            className="field mt-1"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari lokasi…"
          />
        </label>
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
          Status akuisisi
          <select
            className="field mt-1"
            value={stageFilter}
            onChange={(event) => setStageFilter(event.target.value)}
          >
            <option value="all">Semua status</option>
            <option value="NEW">Baru</option>
            <option value="NEED_CONFIRMED">Kebutuhan terkonfirmasi</option>
            <option value="FOLLOW_UP">Tindak lanjut</option>
            <option value="HANDOVER">Serah terima</option>
            <option value="PROCESSING">Diproses</option>
            <option value="READY">Siap digunakan</option>
            <option value="CLOSED_LOST">Ditutup</option>
          </select>
        </label>
        <label className="text-xs font-bold text-slate-700">
          Kategori usaha
          <select
            className="field mt-1"
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
          >
            <option value="all">Semua kategori</option>
            {categoryOptions.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-bold text-slate-700">
          Jadwal follow-up
          <select
            className="field mt-1"
            value={scheduleFilter}
            onChange={(event) => setScheduleFilter(event.target.value)}
          >
            <option value="all">Semua jadwal</option>
            <option value="overdue">Terlambat</option>
            <option value="today">Hari ini (WIB)</option>
            <option value="upcoming">Akan datang</option>
            <option value="none">Belum dijadwalkan</option>
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
        <label className="flex min-h-11 items-center gap-2 rounded-xl border bg-white px-3 text-sm font-bold text-slate-700">
          <input
            type="checkbox"
            checked={actionNeededOnly}
            onChange={(event) => setActionNeededOnly(event.target.checked)}
          />
          Perlu tindakan
        </label>
        <Button
          variant="ghost"
          onClick={() => {
            setSearch("");
            setPicFilter("all");
            setStageFilter("all");
            setCategoryFilter("all");
            setScheduleFilter("all");
            setBoundaryFilter("all");
            setActionNeededOnly(false);
          }}
        >
          Reset filter
        </Button>
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
              <Button
                variant="outline"
                disabled={points.length === 0}
                onClick={() => setFitRequest((value) => value + 1)}
              >
                Fokus hasil filter
              </Button>
              <label className="flex min-h-11 items-center gap-2 rounded-xl border bg-white px-3 text-xs font-bold">
                Warna marker
                <select
                  className="bg-transparent"
                  value={markerPalette}
                  onChange={(event) =>
                    setMarkerPalette(
                      event.target.value as
                        | "status"
                        | "blue"
                        | "green"
                        | "purple",
                    )
                  }
                >
                  <option value="status">Status</option>
                  <option value="blue">Biru</option>
                  <option value="green">Hijau</option>
                  <option value="purple">Ungu</option>
                </select>
              </label>
              <label className="flex min-h-11 items-center gap-2 rounded-xl border bg-white px-3 text-xs font-bold">
                Skala ikon {markerScale}px
                <input
                  aria-label="Skala ikon marker"
                  type="range"
                  min="30"
                  max="58"
                  step="2"
                  value={markerScale}
                  onChange={(event) =>
                    setMarkerScale(Number(event.target.value))
                  }
                />
              </label>
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
              fitRequest={fitRequest}
              markerPalette={markerPalette}
              markerScale={markerScale}
              selectedId={selected?.id ?? null}
              onPick={(lat, lng) => {
                setPoint({ lat, lng });
                setPointSource("MAP_PIN");
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
              <div className="rounded-2xl border bg-slate-50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="label">Ikon penanda lokasi</p>
                    <p className="text-xs text-slate-500">
                      Ikon tersimpan pada lokasi dan terlihat oleh seluruh role
                      yang berhak mengaksesnya.
                    </p>
                  </div>
                  {selectedMarkerIcon !== selected.mappingMarkerIcon ? (
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() => void saveMarkerIcon()}
                    >
                      Simpan ikon
                    </Button>
                  ) : null}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {mappingMarkerIconOptions.map((option) => {
                    const Icon = markerIconComponents[option.value];
                    const active = selectedMarkerIcon === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        title={option.description}
                        aria-label={`Gunakan ikon ${option.label}`}
                        aria-pressed={active}
                        onClick={() => setSelectedMarkerIcon(option.value)}
                        className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm font-bold transition ${
                          active
                            ? "border-blue-700 bg-blue-700 text-white"
                            : "bg-white text-slate-700 hover:border-blue-300"
                        }`}
                      >
                        <Icon size={17} />
                        {option.label}
                      </button>
                    );
                  })}
                </div>
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
                    onClick={() => {
                      setPoint({
                        lat: userPosition.latitude,
                        lng: userPosition.longitude,
                      });
                      setPointSource("DEVICE_GEOLOCATION");
                    }}
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
                <div className="border-t pt-4">
                  <p className="mb-3 text-xs text-slate-500">
                    Sumber:{" "}
                    {selected.locationSource === "DEVICE_GEOLOCATION"
                      ? "Lokasi perangkat"
                      : selected.locationSource === "MANUAL_COORDINATES"
                        ? "Koordinat manual"
                        : selected.locationSource === "MAP_PIN"
                          ? "Pin peta"
                          : "Belum tercatat"}
                    {selected.locationUpdatedAt
                      ? ` · dicatat ${new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" }).format(new Date(selected.locationUpdatedAt))} WIB`
                      : ""}
                  </p>
                  <div className="flex flex-wrap gap-2">
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
                    {canEdit ? (
                      <Button
                        variant="danger"
                        disabled={busy}
                        onClick={() => void removeLocation()}
                      >
                        Hapus titik
                      </Button>
                    ) : null}
                  </div>
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
                <p className="mt-2 text-xs font-semibold text-slate-700">
                  {item.usageVerifications[0] ? "Pengguna" : "Kontak permintaan"}: {item.contactPic}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Produk:{" "}
                  {item.productNeeds.length
                    ? item.productNeeds.join(", ")
                    : "Belum dirinci"}
                </p>
                {item.usageVerifications[0] ? (
                  <p className="mt-1 text-xs text-emerald-700">
                    Penggunaan terverifikasi{" "}
                    {new Intl.DateTimeFormat("id-ID", {
                      timeZone: "Asia/Jakarta",
                      dateStyle: "medium",
                    }).format(new Date(item.usageVerifications[0].usedAt))}
                  </p>
                ) : item.publicQrisRequestId ? <p className="mt-1 text-xs font-semibold text-amber-700">Permintaan QRIS Custom · penggunaan belum diverifikasi</p> : null}
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
                {item.followUps[0]?.dueAt ? (
                  <p className="mt-2 text-xs font-semibold text-slate-700">
                    Follow-up:{" "}
                    {new Intl.DateTimeFormat("id-ID", {
                      timeZone: "Asia/Jakarta",
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(item.followUps[0].dueAt))}{" "}
                    WIB
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-slate-400">
                    Belum ada jadwal follow-up
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
              Belum ada toko/pengguna terverifikasi yang sesuai filter.
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
