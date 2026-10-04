"use client";

import {
  CircleMarker,
  MapContainer,
  Polygon,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { useEffect } from "react";

import {
  MANGGA_BESAR_BOUNDARY,
  MANGGA_BESAR_CENTER,
} from "@/lib/mangga-besar-boundary";
import { googleMapsLocationUrl } from "@/lib/geo";
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
};
function Picker({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(event) {
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

function MapController({ focusRequest }: { focusRequest: number }) {
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
  return null;
}

export default function MappingMap({
  points,
  userPosition,
  candidate,
  showBoundary,
  focusRequest,
  onPick,
  onSelect,
}: {
  points: Point[];
  userPosition: { latitude: number; longitude: number } | null;
  candidate: { latitude: number; longitude: number } | null;
  showBoundary: boolean;
  focusRequest: number;
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
      <MapController focusRequest={focusRequest} />
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
        <CircleMarker
          key={point.id}
          center={[point.latitude, point.longitude]}
          radius={9}
          eventHandlers={{ click: () => onSelect(point.id) }}
          pathOptions={{
            color: point.actionNeeded ? "#dc2626" : "#0b4d91",
            fillOpacity: 0.8,
          }}
        >
          <Tooltip>
            <strong>{point.code}</strong>
            <br />
            {point.label}
          </Tooltip>
          <Popup>
            <div className="min-w-48 space-y-1 text-sm">
              <strong>{point.businessAlias}</strong>
              <p>{point.code} · PIC {point.picName}</p>
              <p>Pengguna: {point.contactName}</p>
              <p>Produk: {point.productNeeds.length ? point.productNeeds.join(", ") : "Belum dirinci"}</p>
              <p>{point.usedAt ? `Terverifikasi ${new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium" }).format(new Date(point.usedAt))}` : "Penggunaan belum terverifikasi"}</p>
              <p>Status: {point.stage.replaceAll("_", " ")}</p>
              <p>{point.dueAt ? `Follow-up ${new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" }).format(new Date(point.dueAt))} WIB` : "Belum ada jadwal follow-up"}</p>
              <a href={googleMapsLocationUrl({ latitude: point.latitude, longitude: point.longitude })} target="_blank" rel="noreferrer" className="inline-block font-bold text-blue-700 underline">Buka Google Maps</a>
            </div>
          </Popup>
        </CircleMarker>
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
