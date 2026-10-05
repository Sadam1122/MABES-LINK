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
import { divIcon } from "leaflet";
import { useEffect } from "react";

import {
  MANGGA_BESAR_BOUNDARY,
  MANGGA_BESAR_CENTER,
} from "@/lib/mangga-besar-boundary";
import { googleMapsLocationUrl } from "@/lib/geo";
import type { MappingMarkerIconValue } from "@/lib/mapping-icons";
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
}: {
  focusRequest: number;
  fitRequest: number;
  points: Point[];
}) {
  const map = useMap();
  useEffect(() => {
    if (focusRequest < 1) return;
    map.fitBounds(
      MANGGA_BESAR_BOUNDARY.map(([lat, lng]) => [lat, lng]),
      {
        padding: [22, 22],
      },
    );
  }, [focusRequest, map]);
  useEffect(() => {
    if (fitRequest < 1 || points.length === 0) return;
    map.fitBounds(
      points.map((point) => [point.latitude, point.longitude]),
      { padding: [36, 36], maxZoom: 17 },
    );
  }, [fitRequest, map, points]);
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
  const glyphs: Record<MappingMarkerIconValue, string> = {
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
    html: `<div aria-hidden="true" style="width:${size}px;height:${size}px;background:${color};border:${selected ? 4 : 3}px solid ${selected ? "#fbbf24" : "#fff"};border-radius:14px 14px 14px 4px;box-shadow:0 8px 18px rgba(15,23,42,.28);display:grid;place-items:center;transform:rotate(-45deg)"><svg viewBox="0 0 24 24" width="${Math.round(size * 0.5)}" height="${Math.round(size * 0.5)}" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transform:rotate(45deg)">${glyphs[point.markerIcon]}</svg></div>`,
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
  fitRequest,
  markerPalette,
  markerScale,
  selectedId,
  onPick,
  onSelect,
}: {
  points: Point[];
  userPosition: { latitude: number; longitude: number } | null;
  candidate: { latitude: number; longitude: number } | null;
  showBoundary: boolean;
  focusRequest: number;
  fitRequest: number;
  markerPalette: "status" | "blue" | "green" | "purple";
  markerScale: number;
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
      center={[MANGGA_BESAR_CENTER[0], MANGGA_BESAR_CENTER[1]]}
      zoom={15}
      className="h-[430px] w-full rounded-2xl"
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
      />
      {showBoundary && (
        <Polygon
          positions={MANGGA_BESAR_BOUNDARY.map(([lat, lng]) => [lat, lng])}
          pathOptions={{
            color: "#1d4ed8",
            weight: 3,
            fillColor: "#60a5fa",
            fillOpacity: 0.12,
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
      {points.map((point) => (
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
              <p>Pengguna: {point.contactName}</p>
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
