"use client";

/* eslint-disable @next/next/no-img-element -- foto dilayani endpoint privat berotorisasi */

import L from "leaflet";
import { useEffect } from "react";
import {
  MapContainer,
  Marker,
  Polygon,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";

import {
  MANGGA_BESAR_BOUNDARY,
  MANGGA_BESAR_CENTER,
} from "@/lib/mangga-besar-boundary";
import { mappingMarkerGlyphs, type MappingMarkerIconValue } from "@/lib/mapping-icons";

export type AppointmentMapPoint = {
  id: string;
  code: string;
  label: string;
  locationLabel: string;
  latitude: number;
  longitude: number;
  appointmentStatus: string;
  appointmentAt: string;
  picNames: string[];
  companionNames?: string[];
  photoId: string | null;
  markerIcon: MappingMarkerIconValue;
};

const markerStyle: Record<string, { color: string }> = {
  CONFIRMED: { color: "#2563eb" },
  PENDING_CONFIRMATION: { color: "#d97706" },
  NEEDS_SCHEDULING: { color: "#7c3aed" },
  COMPLETED: { color: "#059669" },
  CANCELLED: { color: "#64748b" },
};

function FitResults({ points }: { points: AppointmentMapPoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) {
      map.setView([points[0].latitude, points[0].longitude], 17);
      return;
    }
    map.fitBounds(
      L.latLngBounds(points.map((item) => [item.latitude, item.longitude])),
      { padding: [36, 36], maxZoom: 17 },
    );
  }, [map, points]);
  return null;
}

export default function AppointmentSpreadMap({
  points,
  markerSize,
}: {
  points: AppointmentMapPoint[];
  markerSize: number;
}) {
  return (
    <MapContainer
      center={[MANGGA_BESAR_CENTER[0], MANGGA_BESAR_CENTER[1]]}
      zoom={15}
      className="h-[min(68vh,680px)] min-h-[420px] w-full rounded-2xl"
      scrollWheelZoom
    >
      <TileLayer
        url={
          process.env.NEXT_PUBLIC_MAP_TILE_URL ||
          "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        }
        attribution={
          process.env.NEXT_PUBLIC_MAP_ATTRIBUTION ||
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }
        maxZoom={Number(process.env.NEXT_PUBLIC_MAP_MAX_ZOOM || 19)}
      />
      <Polygon
        positions={MANGGA_BESAR_BOUNDARY.map(([latitude, longitude]) => [
          latitude,
          longitude,
        ])}
        pathOptions={{
          color: "#1d4ed8",
          weight: 2,
          fillColor: "#60a5fa",
          fillOpacity: 0.06,
          dashArray: "8 6",
        }}
      >
        <Tooltip>Referensi batas administratif Mangga Besar</Tooltip>
      </Polygon>
      <FitResults points={points} />
      {points.map((item) => {
        const appearance = markerStyle[item.appointmentStatus] ?? markerStyle.CONFIRMED;
        const icon = L.divIcon({
          className: "appointment-marker-shell",
          html: `<span aria-hidden="true" style="display:grid;place-items:center;width:${markerSize}px;height:${markerSize}px;border-radius:14px 14px 14px 4px;background:${appearance.color};color:white;border:3px solid white;box-shadow:0 8px 22px rgba(15,23,42,.28)"><svg viewBox="0 0 24 24" width="${Math.round(markerSize * .53)}" height="${Math.round(markerSize * .53)}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${mappingMarkerGlyphs[item.markerIcon]}</svg></span>`,
          iconSize: [markerSize, markerSize],
          iconAnchor: [markerSize / 2, markerSize],
          popupAnchor: [0, -markerSize],
        });
        return (
          <Marker key={item.id} position={[item.latitude, item.longitude]} icon={icon}>
            <Tooltip>{item.code} · {item.label}</Tooltip>
            <Popup minWidth={240}>
              <div className="space-y-1 text-sm">
                {item.photoId ? <img src={`/api/location-photos/${item.photoId}`} alt="Foto lokasi janji" className="mb-2 h-28 w-full rounded-lg object-cover" /> : null}
                <strong>{item.label}</strong>
                <p>{item.locationLabel}</p>
                <p>Kendali layanan: {item.picNames.join(", ")}</p>
                {item.companionNames?.length ? <p>Pendamping: {item.companionNames.join(", ")}</p> : null}
                <a className="font-bold text-blue-700" href={`/work/${item.id}`}>Buka detail janji</a>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
