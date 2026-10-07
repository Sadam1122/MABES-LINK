"use client";

/* eslint-disable @next/next/no-img-element -- endpoint gambar privat memerlukan cookie sesi dan tidak boleh diproksi optimizer publik */

import dynamic from "next/dynamic";
import Link from "next/link";
import { Building2, Maximize2, Minimize2, ListFilter } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
} from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { useFeedback } from "@/components/ui/feedback";
import { MarkerGlyph, MarkerIconPicker } from "@/components/marker-icon-picker";
import { MappingDiscoveryPanel } from "@/components/mapping-discovery-panel";
import { useDebouncedValue } from "@/lib/client/use-debounced-value";
import { clientApi } from "@/lib/client-api";
import {
  formatStraightLineDistance,
  geolocationErrorMessage,
  googleMapsAddressSearchUrl,
  googleMapsLocationUrl,
  googleMapsNavigationUrl,
  haversineMeters,
} from "@/lib/geo";
import {
  isWithinManggaBesarBoundary,
  MANGGA_BESAR_BOUNDARY_SOURCE,
} from "@/lib/mangga-besar-boundary";
import { type MappingMarkerIconValue } from "@/lib/mapping-icons";

const LeafletMap = dynamic(() => import("@/components/mapping-map"), {
  ssr: false,
  loading: () => (
    <div className="mabes-mapping-canvas grid place-items-center rounded-2xl bg-slate-100 text-sm text-slate-500">
      Memuat peta… Daftar lokasi tetap tersedia.
    </div>
  ),
});

type Prospect = {
  id: string;
  internalCode: string;
  businessAlias: string;
  publicQrisRequestId?: string | null;
  mappingImportedAt?: string | null;
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
  mappingDiscovery: { segments: string[]; opportunityTags: string[]; riskReviewRequired: boolean;
    foodRule: "EITHER" | "BOTH"; gofoodRating: number | null; gofoodReviews: number | null; gofoodCheckedAt: string | null;
    grabfoodRating: number | null; grabfoodReviews: number | null; grabfoodCheckedAt: string | null } | null;
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

export function MappingWorkspace({
  prospects,
  canEdit,
  totalLocations,
  roleLabel,
  scopeLabel,
}: {
  prospects: Prospect[];
  canEdit: boolean;
  totalLocations: number;
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
  const [pinFilter, setPinFilter] = useState<"all" | "missing" | "saved">("all");
  const [placeQuery, setPlaceQuery] = useState(prospects[0]?.addressHint ?? "");
  const [placeResults, setPlaceResults] = useState<{ label: string; latitude: number; longitude: number }[]>([]);
  const [placeBusy, setPlaceBusy] = useState(false);
  const [placeMessage, setPlaceMessage] = useState("");
  const [picFilter, setPicFilter] = useState("all");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 280);
  const [stageFilter, setStageFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [segmentFilter, setSegmentFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [foodFilter, setFoodFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState(false);
  const [scheduleFilter, setScheduleFilter] = useState("all");
  const [actionNeededOnly, setActionNeededOnly] = useState(false);
  const [showBoundary, setShowBoundary] = useState(true);
  const [viewMode, setViewMode] = useState<"markers" | "heatmap">("markers");
  const [heatScope, setHeatScope] = useState<"all" | "verified" | "action">("all");
  const [heatRadius, setHeatRadius] = useState(56);
  const [heatOpacity, setHeatOpacity] = useState(75);
  const [showHeatPins, setShowHeatPins] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);
  const [bankRequest, setBankRequest] = useState(0);
  const [mapExpanded, setMapExpanded] = useState(false);
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
    const normalizedSearch = debouncedSearch.trim().toLocaleLowerCase("id");
        if (
          normalizedSearch &&
          ![
            item.internalCode,
            item.businessAlias,
            item.contactPic,
            item.locationLabel,
            item.addressHint,
            item.areaBlock,
            item.businessSector,
            ...item.productNeeds,
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
        if (segmentFilter !== "all" && !item.mappingDiscovery?.segments.includes(segmentFilter)) return false;
        if (tagFilter !== "all" && !item.mappingDiscovery?.opportunityTags.includes(tagFilter)) return false;
        if (foodFilter !== "all") {
          const profile = item.mappingDiscovery;
          const platforms = profile ? [
            { rating: profile.gofoodRating, reviews: profile.gofoodReviews, checkedAt: profile.gofoodCheckedAt },
            { rating: profile.grabfoodRating, reviews: profile.grabfoodReviews, checkedAt: profile.grabfoodCheckedAt },
          ] : [];
          const passes = platforms.map((entry) => entry.rating != null && entry.reviews != null && entry.checkedAt != null &&
            new Date(entry.checkedAt).getTime() <= openedAt && openedAt - new Date(entry.checkedAt).getTime() <= 30 * 86_400_000 &&
            entry.rating >= 4.5 && entry.reviews >= 500);
          const candidate = profile?.foodRule === "BOTH" ? passes.length === 2 && passes.every(Boolean) : passes.some(Boolean);
          if (foodFilter === "candidate" && !candidate) return false;
          if (foodFilter === "not-candidate" && candidate) return false;
        }
        if (riskFilter && !item.mappingDiscovery?.riskReviewRequired) return false;
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
        const hasPin = item.latitude != null && item.longitude != null;
        if (pinFilter === "missing" && hasPin) return false;
        if (pinFilter === "saved" && !hasPin) return false;
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
      pinFilter,
      categoryFilter,
      segmentFilter,
      tagFilter,
      foodFilter,
      riskFilter,
      openedAt,
      picFilter,
      prospects,
      scheduleFilter,
      debouncedSearch,
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
  const heatPoints = useMemo(() => points.filter((item) => heatScope === "all" || (heatScope === "verified" ? item.usedAt !== null : item.actionNeeded)), [points, heatScope]);

  function choose(item: Prospect) {
    setSelected(item);
    setLabel(item.locationLabel ?? "");
    setPlaceQuery(item.addressHint ?? "");
    setPlaceResults([]);
    setPlaceMessage("");
    setSelectedMarkerIcon(item.mappingMarkerIcon);
    setPoint(null);
    setPointSource("MAP_PIN");
    setManualLat("");
    setManualLng("");
    setPreview(null);
    setError("");
  }

  async function searchPlace() {
    const query = placeQuery.trim();
    if (query.length < 3) {
      setPlaceMessage("Isi nama tempat atau alamat publik minimal 3 karakter.");
      return;
    }
    setPlaceBusy(true);
    setPlaceMessage("");
    setPlaceResults([]);
    try {
      const results = await clientApi<{ label: string; latitude: number; longitude: number }[]>(
        `/api/location-search?q=${encodeURIComponent(query.slice(0, 100))}`,
      );
      setPlaceResults(results);
      setPlaceMessage(results.length
        ? "Pilih kandidat, periksa posisi di peta, lalu konfirmasi simpan. Hasil pencarian belum tentu tepat."
        : "Tidak ada kandidat. Periksa alamat di Google Maps lalu pilih pin atau masukkan koordinat manual.");
    } catch (cause) {
      setPlaceMessage(cause instanceof Error ? cause.message : "Pencarian tidak tersedia. Pilih pin atau masukkan koordinat manual.");
    } finally {
      setPlaceBusy(false);
    }
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
  const missingPinCount = prospects.filter((item) => item.latitude == null || item.longitude == null).length;

  return (
    <div className="space-y-4">
      <section className="card overflow-hidden border-blue-200">
        <div className="bg-[#092b60] p-5 text-white sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[.18em] text-amber-300">Peta kerja · {roleLabel}</p>
              <h2 className="mt-2 text-xl font-black tracking-tight sm:text-2xl">Temukan lokasi, lanjutkan pekerjaan</h2>
              <p className="mt-2 text-sm text-blue-100">{scopeLabel}. Koordinat dari workbook tetap perlu verifikasi lapangan.</p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-bold">
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-2">{withDistance.length} hasil</span>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-2">{insideCount} dalam batas</span>
              <span className="rounded-full border border-amber-300/30 bg-amber-300/15 px-3 py-2 text-amber-100">{missingPinCount} tanpa pin</span>
            </div>
          </div>
          <p className="mt-3 text-xs text-blue-200">{prospects.length} dari {totalLocations} lokasi termuat · Ekspor Excel mencakup seluruh cakupan Anda (maks. 5.000).</p>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4 xl:items-end sm:p-5">
          <label className="text-xs font-bold text-slate-700 xl:col-span-2">Cari nama, alamat, atau PIC
            <input className="field mt-1" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari lokasi atau nama usaha…" />
          </label>
          <label className="text-xs font-bold text-slate-700">PIC
            <select className="field mt-1" value={picFilter} onChange={(event) => setPicFilter(event.target.value)}>
              <option value="all">Semua PIC</option>
              {picOptions.map((pic) => <option key={pic.id} value={pic.id}>{pic.name}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-700">Kategori usaha
            <select className="field mt-1" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              <option value="all">Semua kategori</option>
              {categoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
          </label>
          <div className="flex flex-wrap items-center gap-2 sm:col-span-2 xl:col-span-4">
            <button type="button" aria-pressed={actionNeededOnly} onClick={() => setActionNeededOnly((value) => !value)} className={`min-h-10 rounded-full border px-4 text-xs font-bold transition ${actionNeededOnly ? "border-amber-400 bg-amber-100 text-amber-950" : "border-slate-200 bg-white text-slate-700 hover:border-blue-400"}`}>Perlu tindakan</button>
            <button type="button" aria-pressed={pinFilter === "missing"} onClick={() => setPinFilter(pinFilter === "missing" ? "all" : "missing")} className={`min-h-10 rounded-full border px-4 text-xs font-bold transition ${pinFilter === "missing" ? "border-amber-400 bg-amber-100 text-amber-950" : "border-slate-200 bg-white text-slate-700 hover:border-blue-400"}`}>Tanpa pin · {missingPinCount}</button>
            <button type="button" aria-pressed={pinFilter === "saved"} onClick={() => setPinFilter(pinFilter === "saved" ? "all" : "saved")} className={`min-h-10 rounded-full border px-4 text-xs font-bold transition ${pinFilter === "saved" ? "border-blue-500 bg-blue-50 text-blue-900" : "border-slate-200 bg-white text-slate-700 hover:border-blue-400"}`}>Sudah bertitik</button>
          </div>
        </div>
        <details className="group border-t border-slate-200 bg-[#f8fafd] px-4 py-3 sm:px-5">
          <summary className="cursor-pointer text-sm font-bold text-blue-900">Filter lanjutan <span className="ml-1 text-slate-500 group-open:hidden">＋</span><span className="ml-1 hidden text-slate-500 group-open:inline">−</span></summary>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4 xl:items-end">
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
        <label className="text-xs font-bold text-slate-700">Segmen 3P+1I<select className="field mt-1" value={segmentFilter} onChange={(event) => setSegmentFilter(event.target.value)}><option value="all">Semua segmen</option><option value="PEMBISNIS">Pembisnis</option><option value="PAYROLL">Payroll</option><option value="PRIORITAS">Prioritas</option><option value="INDIVIDU">Individu</option></select></label>
        <label className="text-xs font-bold text-slate-700">Peluang / sektor<select className="field mt-1" value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}><option value="all">Semua tag</option><option value="LIVIN_FOOD_SCREEN">Livin’ Food (screening)</option><option value="LIVIN_MERCHANT_QRIS">Livin’ Merchant/QRIS</option><option value="KOPRA_WHOLESALE">Kopra/Wholesale</option><option value="HOTEL">Hotel</option><option value="HEALTHCARE">Kesehatan</option><option value="CULINARY">Kuliner</option><option value="OFFICE">Kantor</option><option value="OTHER">Lainnya</option></select></label>
        <label className="text-xs font-bold text-slate-700">Screening Livin’ Food<select className="field mt-1" value={foodFilter} onChange={(event) => setFoodFilter(event.target.value)}><option value="all">Semua hasil</option><option value="candidate">Kandidat screening</option><option value="not-candidate">Belum kandidat / perlu verifikasi</option></select></label>
        <label className="flex items-center gap-2 text-xs font-bold text-slate-700"><input type="checkbox" checked={riskFilter} onChange={(event) => setRiskFilter(event.target.checked)} />Perlu review Risk/Compliance</label>
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
        <Button
          variant="ghost"
          className="scroll-mt-28 scroll-mb-28"
          onClick={() => {
            setSearch("");
            setPicFilter("all");
            setStageFilter("all");
            setCategoryFilter("all");
            setSegmentFilter("all");
            setTagFilter("all");
            setFoodFilter("all");
            setRiskFilter(false);
            setScheduleFilter("all");
            setBoundaryFilter("all");
            setPinFilter("all");
            setActionNeededOnly(false);
          }}
        >
          Reset filter
        </Button>
          </div>
        </details>
      </section>
      <div className={`grid items-start gap-4 ${mapExpanded ? "grid-cols-1" : "xl:grid-cols-[minmax(0,1fr)_290px] 2xl:grid-cols-[minmax(0,1fr)_310px]"}`}>
        <section className="min-w-0 space-y-4">
          <div className="card overflow-hidden p-2">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-3 sm:p-4">
              <div><h2 className="text-base font-bold text-slate-950">Sebaran lokasi</h2><p className="text-xs text-slate-500">{points.length} titik sesuai filter dan izin Anda · maksimal 1.000 lokasi terbaru termuat</p></div>
              <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setMapExpanded((value) => !value)} aria-pressed={mapExpanded} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 text-xs font-bold text-blue-900 hover:bg-blue-100">
                {mapExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}{mapExpanded ? "Tampilkan daftar" : "Perbesar peta"}
              </button>
              <div className="inline-flex rounded-xl border bg-slate-100 p-1" role="group" aria-label="Tampilan peta">
                <button type="button" aria-pressed={viewMode === "markers"} onClick={() => setViewMode("markers")} className={`rounded-lg px-3 py-2 text-xs font-bold transition ${viewMode === "markers" ? "bg-white text-blue-900 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}>Penanda</button>
                <button type="button" aria-pressed={viewMode === "heatmap"} onClick={() => setViewMode("heatmap")} className={`rounded-lg px-3 py-2 text-xs font-bold transition ${viewMode === "heatmap" ? "bg-white text-blue-900 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}>Heatmap</button>
              </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 p-2">
              <Button variant="outline" onClick={() => setBankRequest((value) => value + 1)}><Building2 size={16} /> Fokus cabang</Button>
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
            </div>
            <details className="mx-2 mb-3 rounded-xl border border-slate-200 bg-slate-50" open={viewMode === "heatmap"}>
              <summary className="cursor-pointer px-3 py-3 text-xs font-bold text-slate-700">{viewMode === "heatmap" ? "Pengaturan heatmap & penanda" : "Warna, ukuran penanda & legenda"}</summary>
              <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 p-3">
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
              {viewMode === "heatmap" && <label className="flex min-h-11 items-center gap-2 rounded-xl border bg-white px-3 text-xs font-bold">Titik heatmap
                <select className="bg-transparent" value={heatScope} onChange={(event) => setHeatScope(event.target.value as typeof heatScope)}>
                  <option value="all">Semua terlihat</option><option value="verified">Penggunaan terverifikasi</option><option value="action">Perlu tindakan</option>
                </select>
              </label>}
              {viewMode === "heatmap" && <>
                <label className="flex min-h-11 items-center gap-2 rounded-xl border bg-white px-3 text-xs font-bold">Radius {heatRadius}px
                  <input type="range" min="28" max="90" step="2" value={heatRadius} onChange={(event) => setHeatRadius(Number(event.target.value))} aria-label="Radius heatmap" />
                </label>
                <label className="flex min-h-11 items-center gap-2 rounded-xl border bg-white px-3 text-xs font-bold">Opasitas {heatOpacity}%
                  <input type="range" min="30" max="100" step="5" value={heatOpacity} onChange={(event) => setHeatOpacity(Number(event.target.value))} aria-label="Opasitas heatmap" />
                </label>
                <label className="flex min-h-11 items-center gap-2 rounded-xl border bg-white px-3 text-xs font-bold"><input type="checkbox" checked={showHeatPins} onChange={(event) => setShowHeatPins(event.target.checked)} /> Tampilkan pin</label>
              </>}
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
            </details>
            <LeafletMap
              points={points}
              viewMode={viewMode}
              heatPoints={heatPoints}
              heatRadius={heatRadius}
              heatOpacity={heatOpacity}
              showHeatPins={showHeatPins}
              userPosition={userPosition}
              candidate={
                point ? { latitude: point.lat, longitude: point.lng } : null
              }
              showBoundary={showBoundary}
              focusRequest={focusRequest}
              bankRequest={bankRequest}
              expanded={mapExpanded}
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
            {viewMode === "heatmap" && <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-3 text-xs text-slate-600"><span className="flex items-center gap-2"><span aria-hidden="true" className="h-2 w-24 rounded-full bg-gradient-to-r from-sky-600 via-amber-400 to-red-600" />{heatPoints.length ? `${heatPoints.length} titik · rendah → padat` : "Tidak ada titik untuk cakupan heatmap ini. Ubah filter titik."}</span><strong>Bukan skor kredit atau potensi dana.</strong></div>}
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
              {!saved && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                Alamat dan ikon dari Excel sudah tersimpan. Pin belum dibuat karena koordinat belum tersedia. Cari alamat, periksa kandidat di peta, lalu simpan titik yang benar.
              </div>}
              <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-3">
                <label className="label" htmlFor="mapping-place-query">Cari alamat atau nama tempat publik</label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input id="mapping-place-query" className="field min-w-0 flex-1" value={placeQuery} onChange={(event) => setPlaceQuery(event.target.value)} placeholder="Contoh: nama usaha, jalan, Jakarta" maxLength={100} />
                  <Button type="button" variant="outline" disabled={placeBusy} onClick={() => void searchPlace()}>{placeBusy ? "Mencari…" : "Cari kandidat"}</Button>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                  {placeQuery.trim() && <a href={googleMapsAddressSearchUrl(placeQuery)} target="_blank" rel="noreferrer" className="font-bold text-blue-800 underline">Periksa di Google Maps ↗</a>}
                  <span className="text-slate-600">Pencarian eksternal hanya dijalankan saat Anda menekan tombol atau tautan. Jangan cari data rahasia.</span>
                </div>
                {placeMessage && <p role="status" className="mt-2 text-xs text-slate-700">{placeMessage}</p>}
                {placeResults.length > 0 && <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">
                  {placeResults.map((result, index) => <button key={`${index}-${result.latitude}-${result.longitude}`} type="button" onClick={() => {
                    setPoint({ lat: result.latitude, lng: result.longitude });
                    setPointSource("MAP_PIN");
                    setManualLat(result.latitude.toFixed(7));
                    setManualLng(result.longitude.toFixed(7));
                    setPlaceMessage("Kandidat dipilih. Periksa pin ungu pada peta; lokasi belum tersimpan.");
                  }} className="flex w-full items-start justify-between gap-3 rounded-xl border border-blue-100 bg-white p-3 text-left text-xs hover:border-blue-500">
                    <span>{result.label}</span><span className="shrink-0 font-semibold text-blue-800">Lihat titik</span>
                  </button>)}
                </div>}
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
                <div className="mt-3"><MarkerIconPicker value={selectedMarkerIcon} onChange={setSelectedMarkerIcon} label="Pilih ikon penanda" /></div>
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
                          : selected.locationSource === "WORKBOOK_UNVERIFIED"
                            ? "Koordinat workbook · belum diverifikasi di lapangan"
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
          {selected && <MappingDiscoveryPanel key={selected.id} prospectId={selected.id} defaultPicId={selected.assignedTo.id} />}
        </section>
        <section aria-label="Daftar lokasi hasil filter" className={`${mapExpanded ? "hidden" : "min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm xl:sticky xl:top-24"}`}>
          <div className="space-y-3 border-b border-slate-100 p-4">
            <div className="flex items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-sm font-black text-slate-900"><ListFilter size={17} /> Daftar lokasi</h2><span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-bold text-blue-800">{withDistance.length}</span></div>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              disabled={!userPosition}
              onClick={() => setSortNearest(!sortNearest)}
            >
              {sortNearest ? "Urutan semula" : "Urutkan terdekat"}
            </Button>
          </div>
          <div className="mapping-location-list space-y-2 overflow-y-auto overscroll-contain p-3" tabIndex={0} aria-label="Gulir hasil lokasi">
          {withDistance.length ? (
            withDistance.map(({ item, distance }) => (
              <button
                type="button"
                onClick={() => choose(item)}
                key={item.id}
                aria-pressed={selected?.id === item.id}
                className={`w-full rounded-xl border p-3 text-left transition-colors ${
                  selected?.id === item.id ? "border-blue-600 bg-blue-50 ring-1 ring-blue-600" : "border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50"
                }`}
              >
                <div className="flex justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs text-blue-700">
                      {item.internalCode}
                    </p>
                    <p className="flex items-center gap-2 font-bold"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-700"><MarkerGlyph icon={item.mappingMarkerIcon} size={18} /></span>{item.locationLabel || item.businessAlias}</p>
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
                {selected?.id === item.id && <>
                <p className="mt-2 text-xs font-semibold text-slate-700">
                  {item.usageVerifications[0] ? "Kontak terverifikasi" : "Kontak belum diverifikasi"}: {item.contactPic}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Catatan produk awal (belum dikonfirmasi):{" "}
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
                ) : item.publicQrisRequestId ? <p className="mt-1 text-xs font-semibold text-amber-700">Permintaan QRIS Custom · penggunaan belum diverifikasi</p> : item.mappingImportedAt ? <p className="mt-1 text-xs font-semibold text-blue-700">Lokasi hasil impor · penggunaan belum diverifikasi</p> : <p className="mt-1 text-xs font-semibold text-blue-700">Prospek mapping · kebutuhan belum dikonfirmasi</p>}
                </>}
                {item.latitude != null && item.longitude != null && (
                  <p className="mt-1 text-xs font-semibold text-blue-700">
                    {isWithinManggaBesarBoundary(
                      Number(item.latitude),
                      Number(item.longitude),
                    )
                      ? "Di dalam referensi batas"
                      : "Di luar referensi batas"}
                    {item.locationSource === "WORKBOOK_UNVERIFIED" && <span className="ml-1 text-amber-800">· pin workbook perlu verifikasi</span>}
                  </p>
                )}
                {(item.latitude == null || item.longitude == null) && (
                  <p className="mt-1 text-xs font-semibold text-amber-700">Perlu verifikasi pin · klik kartu untuk cari alamat atau pilih titik</p>
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
              Belum ada lokasi mapping yang sesuai filter.
            </div>
          )}
          </div>
          {selected && (
            <div className="border-t border-slate-100 p-4">
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
