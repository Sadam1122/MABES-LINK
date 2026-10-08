"use client";

import {
  CircleMarker,
  MapContainer,
  Marker,
  Polygon,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { divIcon, DomUtil } from "leaflet";
import { useEffect, useRef } from "react";

import { MANGGA_BESAR_BOUNDARY } from "@/lib/mangga-besar-boundary";
import { MABES_BRANCH } from "@/lib/branch-location";
import { googleMapsLocationUrl } from "@/lib/geo";
import { mappingMarkerGlyphs, type MappingMarkerIconValue } from "@/lib/mapping-icons";
type Point = {
  id: string;
  code: string;
  label: string;
  latitude: number;
  longitude: number;
  actionNeeded: boolean;
  businessAlias: string;
  picName: string;
  stage: string;
  dueAt: string | null;
  contactName: string;
  productNeeds: string[];
  usedAt: string | null;
  markerIcon: MappingMarkerIconValue;
};
const motionOptions = () => ({ animate: !window.matchMedia("(prefers-reduced-motion: reduce)").matches, duration: 0.7 });
function Picker({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(event) {
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

function MapController({
  focusRequest,
  fitRequest,
  points,
  candidate,
  bankRequest,
  selectedId,
}: {
  focusRequest: number;
  fitRequest: number;
  points: Point[];
  candidate: { latitude: number; longitude: number } | null;
  bankRequest: number;
  selectedId: string | null;
}) {
  const map = useMap();
  const previousSelection = useRef(selectedId);
  useEffect(() => {
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => map.invalidateSize({ pan: false }));
    });
    observer.observe(map.getContainer());
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [map]);
  useEffect(() => {
    if (bankRequest < 1) return;
    map.flyTo([MABES_BRANCH.latitude, MABES_BRANCH.longitude], 16, motionOptions());
  }, [bankRequest, map]);
  useEffect(() => {
    if (selectedId === previousSelection.current) return;
    previousSelection.current = selectedId;
    const point = points.find((item) => item.id === selectedId);
    if (point) map.flyTo([point.latitude, point.longitude], Math.max(map.getZoom(), 16), motionOptions());
  }, [map, points, selectedId]);
  useEffect(() => {
    if (focusRequest < 1) return;
    map.fitBounds(
      [...MANGGA_BESAR_BOUNDARY.map(([lat, lng]): [number, number] => [lat, lng]), [MABES_BRANCH.latitude, MABES_BRANCH.longitude] as [number, number]],
      {
        padding: [22, 22],
        ...motionOptions(),
      },
    );
  }, [focusRequest, map]);
  useEffect(() => {
    if (fitRequest < 1 || points.length === 0) return;
    map.fitBounds(
      points.map((point) => [point.latitude, point.longitude]),
      { padding: [36, 36], maxZoom: 17, ...motionOptions() },
    );
  }, [fitRequest, map, points]);
  useEffect(() => {
    if (!candidate) return;
    map.flyTo([candidate.latitude, candidate.longitude], Math.max(map.getZoom(), 16), motionOptions());
  }, [candidate, map]);
  return null;
}

function HeatLayer({ points, radius, opacity }: { points: Point[]; radius: number; opacity: number }) {
  const map = useMap();
  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    // A Leaflet pane keeps the overlay underneath markers/popups and in the
    // same coordinate system as the tiles while panning.
    const pane = map.getPane("mabesHeat") ?? map.createPane("mabesHeat");
    pane.style.zIndex = "450";
    pane.style.pointerEvents = "none";
    canvas.className = "leaflet-zoom-hide";
    Object.assign(canvas.style, { position: "absolute", pointerEvents: "none", opacity: String(opacity / 100) });
    pane.appendChild(canvas);
    const gradientCanvas = document.createElement("canvas");
    gradientCanvas.width = 256;
    gradientCanvas.height = 1;
    const gradientContext = gradientCanvas.getContext("2d");
    if (!gradientContext) { canvas.remove(); return; }
    const colors = gradientContext.createLinearGradient(0, 0, 256, 0);
    colors.addColorStop(0, "#167eb0");
    colors.addColorStop(0.35, "#27c2b0");
    colors.addColorStop(0.6, "#f6ae30");
    colors.addColorStop(1, "#c83930");
    gradientContext.fillStyle = colors;
    gradientContext.fillRect(0, 0, 256, 1);
    const palette = gradientContext.getImageData(0, 0, 256, 1).data;
    let frame = 0;
    const draw = () => {
      frame = 0;
      const size = map.getSize();
      if (size.x === 0 || size.y === 0) return;
      DomUtil.setPosition(canvas, map.containerPointToLayerPoint([0, 0]));
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(size.x * ratio));
      canvas.height = Math.max(1, Math.round(size.y * ratio));
      canvas.style.width = `${size.x}px`;
      canvas.style.height = `${size.y}px`;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.globalCompositeOperation = "lighter";
      for (const point of points) {
        const position = map.latLngToContainerPoint([point.latitude, point.longitude]);
        if (position.x < -radius || position.y < -radius || position.x > size.x + radius || position.y > size.y + radius) continue;
        const gradient = context.createRadialGradient(position.x, position.y, 2, position.x, position.y, radius);
        gradient.addColorStop(0, "rgba(0,0,0,.32)");
        gradient.addColorStop(0.42, "rgba(0,0,0,.16)");
        gradient.addColorStop(1, "rgba(0,0,0,0)");
        context.fillStyle = gradient;
        context.fillRect(position.x - radius, position.y - radius, radius * 2, radius * 2);
      }
      const image = context.getImageData(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < image.data.length; i += 4) {
        const density = image.data[i + 3] / 255;
        if (density < 0.025) { image.data[i + 3] = 0; continue; }
        const colorOffset = Math.min(255, Math.round(density * 255)) * 4;
        image.data[i] = palette[colorOffset];
        image.data[i + 1] = palette[colorOffset + 1];
        image.data[i + 2] = palette[colorOffset + 2];
        // Fade the edges rather than turning barely visible pixels opaque.
        image.data[i + 3] = Math.round(Math.min(0.85, density * 1.35) * 255);
      }
      context.globalCompositeOperation = "source-over";
      context.putImageData(image, 0, 0);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(draw); };
    map.on("move moveend zoomend resize viewreset", schedule);
    schedule();
    return () => {
      map.off("move moveend zoomend resize viewreset", schedule);
      if (frame) cancelAnimationFrame(frame);
      canvas.remove();
    };
  }, [map, points, radius, opacity]);
  return null;
}

function markerColor(
  point: Point,
  palette: "status" | "blue" | "green" | "purple",
) {
  if (palette === "status") return point.actionNeeded ? "#dc2626" : "#0b4d91";
  return { blue: "#1d4ed8", green: "#15803d", purple: "#7e22ce" }[palette];
}

function storeIcon(
  point: Point,
  palette: "status" | "blue" | "green" | "purple",
  size: number,
  selected: boolean,
) {
  const color = markerColor(point, palette);
  const glyphs: Partial<Record<MappingMarkerIconValue, string>> = {
    STORE:
      '<path d="M4 10h16v10H4zM3 10l2-6h14l2 6M8 20v-6h4v6M3 10c0 2 3 2 3 0 0 2 3 2 3 0 0 2 3 2 3 0 0 2 3 2 3 0 0 2 3 2 3 0"/>',
    FOOD: '<path d="M7 3v8M4 3v5c0 2 6 2 6 0V3M7 11v10M16 3v18M16 3c5 2 5 8 0 10"/>',
    MARKET:
      '<circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/><path d="M3 4h2l2.5 11h10l2-7H7"/>',
    OFFICE:
      '<path d="M4 21V5h10v16M14 9h6v12M8 9h2M8 13h2M8 17h2M17 13h1M17 17h1"/>',
    HEALTH:
      '<path d="M12 21s-8-4.5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6.5-8 11-8 11Z"/><path d="M9 12h6M12 9v6"/>',
    SERVICE:
      '<path d="M14.7 6.3a4 4 0 0 0-5-5L12 3.6 9.6 6 7.3 3.7a4 4 0 0 0 5 5L4 17l3 3 8.3-8.3a4 4 0 0 0 5-5L18 9l-2.4-2.4 2.3-2.3a4 4 0 0 0-3.2 2Z"/>',
  };
  return divIcon({
    className: "mabes-store-marker",
    html: `<div aria-hidden="true" style="width:${size}px;height:${size}px;background:${color};border:${selected ? 4 : 3}px solid ${selected ? "#fbbf24" : "#fff"};border-radius:14px 14px 14px 4px;box-shadow:0 8px 18px rgba(15,23,42,.28);display:grid;place-items:center;transform:rotate(-45deg)"><svg viewBox="0 0 24 24" width="${Math.round(size * 0.5)}" height="${Math.round(size * 0.5)}" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transform:rotate(45deg)">${glyphs[point.markerIcon] ?? mappingMarkerGlyphs[point.markerIcon]}</svg></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
  });
}

export default function MappingMap({
  points,
  userPosition,
  candidate,
  showBoundary,
  focusRequest,
  bankRequest,
  expanded = false,
  fitRequest,
  markerPalette,
  markerScale,
  viewMode,
  heatPoints,
  heatRadius,
  heatOpacity,
  showHeatPins,
  selectedId,
  onPick,
  onSelect,
}: {
  points: Point[];
  userPosition: { latitude: number; longitude: number } | null;
  candidate: { latitude: number; longitude: number } | null;
  showBoundary: boolean;
  focusRequest: number;
  bankRequest: number;
  expanded?: boolean;
  fitRequest: number;
  markerPalette: "status" | "blue" | "green" | "purple";
  markerScale: number;
  viewMode: "markers" | "heatmap";
  heatPoints: Point[];
  heatRadius: number;
  heatOpacity: number;
  showHeatPins: boolean;
  selectedId: string | null;
  onPick: (lat: number, lng: number) => void;
  onSelect: (id: string) => void;
}) {
  const tileUrl =
    process.env.NEXT_PUBLIC_MAP_TILE_URL ||
    "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
  const attribution =
    process.env.NEXT_PUBLIC_MAP_ATTRIBUTION ||
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
  return (
    <MapContainer
      center={[MABES_BRANCH.latitude, MABES_BRANCH.longitude]}
      zoom={15}
      className={`mabes-mapping-canvas w-full rounded-2xl ${expanded ? "mabes-mapping-canvas-expanded" : ""}`}
      scrollWheelZoom
    >
      <TileLayer
        url={tileUrl}
        attribution={attribution}
        maxZoom={Number(process.env.NEXT_PUBLIC_MAP_MAX_ZOOM || 19)}
      />
      <Picker onPick={onPick} />
      <MapController
        focusRequest={focusRequest}
        fitRequest={fitRequest}
        points={points}
        candidate={candidate}
        bankRequest={bankRequest}
        selectedId={selectedId}
      />
      {viewMode === "heatmap" && <HeatLayer points={heatPoints} radius={heatRadius} opacity={heatOpacity} />}
      {showBoundary && (
        <Polygon
          positions={MANGGA_BESAR_BOUNDARY.map(([lat, lng]) => [lat, lng])}
          pathOptions={{
            color: "#1d4ed8",
            weight: 3,
            fillColor: "#60a5fa",
            fillOpacity: viewMode === "heatmap" ? 0.025 : 0.08,
            dashArray: "8 6",
          }}
        >
          <Tooltip sticky>
            Referensi batas Kelurahan Mangga Besar
            <br />
            Bukan penetapan wilayah kerja cabang
          </Tooltip>
        </Polygon>
      )}
      <Marker position={[MABES_BRANCH.latitude, MABES_BRANCH.longitude]} title={MABES_BRANCH.name} alt={MABES_BRANCH.name} zIndexOffset={1000} icon={divIcon({
        className: "mabes-bank-marker",
        html: '<div class="mabes-bank-badge"><img src="/Gambar/01-Mandiri%20Master%20Brand%20Logo.png" alt="Mandiri"/><span>11539 · Mangga Besar</span></div>',
        iconSize: [132, 58], iconAnchor: [66, 58], popupAnchor: [0, -58],
      })}>
        <Tooltip>Mandiri Mangga Besar · titik acuan cabang</Tooltip>
        <Popup><div className="max-w-64 space-y-2"><strong>{MABES_BRANCH.name}</strong><p>{MABES_BRANCH.address}</p><p className="text-xs text-slate-500">Titik direktori publik; perlu konfirmasi pengelola. Bukan pusat batas kelurahan.</p><a href={MABES_BRANCH.googleMapsUrl} target="_blank" rel="noreferrer" className="font-bold text-blue-700 underline">Lokasi dan ulasan Google Maps ↗</a></div></Popup>
      </Marker>
      {(viewMode === "markers" || showHeatPins) && points.map((point) => (
        <Marker
          key={point.id}
          position={[point.latitude, point.longitude]}
          icon={storeIcon(
            point,
            markerPalette,
            markerScale,
            selectedId === point.id,
          )}
          eventHandlers={{ click: () => onSelect(point.id) }}
        >
          <Tooltip>
            <strong>{point.code}</strong>
            <br />
            {point.label}
          </Tooltip>
          <Popup>
            <div className="min-w-48 space-y-1 text-sm">
              <strong>{point.businessAlias}</strong>
              <p>
                {point.code} · PIC {point.picName}
              </p>
              <p>{point.usedAt ? "Pengguna" : "Kontak"}: {point.contactName}</p>
              <p>
                Produk:{" "}
                {point.productNeeds.length
                  ? point.productNeeds.join(", ")
                  : "Belum dirinci"}
              </p>
              <p>
                {point.usedAt
                  ? `Terverifikasi ${new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium" }).format(new Date(point.usedAt))}`
                  : "Penggunaan belum terverifikasi"}
              </p>
              <p>Status: {point.stage.replaceAll("_", " ")}</p>
              <p>
                {point.dueAt
                  ? `Follow-up ${new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" }).format(new Date(point.dueAt))} WIB`
                  : "Belum ada jadwal follow-up"}
              </p>
              <a
                href={googleMapsLocationUrl({
                  latitude: point.latitude,
                  longitude: point.longitude,
                })}
                target="_blank"
                rel="noreferrer"
                className="inline-block font-bold text-blue-700 underline"
              >
                Buka Google Maps
              </a>
            </div>
          </Popup>
        </Marker>
      ))}
      {userPosition && (
        <CircleMarker
          center={[userPosition.latitude, userPosition.longitude]}
          radius={8}
          pathOptions={{
            color: "#15803d",
            fillColor: "#22c55e",
            fillOpacity: 0.9,
          }}
        >
          <Tooltip>Posisi sementara perangkat</Tooltip>
        </CircleMarker>
      )}
      {candidate && (
        <CircleMarker
          center={[candidate.latitude, candidate.longitude]}
          radius={10}
          pathOptions={{
            color: "#7c3aed",
            fillColor: "#a78bfa",
            fillOpacity: 0.9,
            weight: 3,
          }}
        >
          <Tooltip>Titik tujuan yang akan disimpan</Tooltip>
        </CircleMarker>
      )}
    </MapContainer>
  );
}
