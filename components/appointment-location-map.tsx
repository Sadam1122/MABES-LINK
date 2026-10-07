"use client";

import { useEffect } from "react";
import { divIcon } from "leaflet";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polygon,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";

import {
  MANGGA_BESAR_BOUNDARY,
  MANGGA_BESAR_CENTER,
} from "@/lib/mangga-besar-boundary";
import { mappingMarkerGlyphs, type MappingMarkerIconValue } from "@/lib/mapping-icons";

function PickLocation({
  onPick,
}: {
  onPick: (latitude: number, longitude: number) => void;
}) {
  useMapEvents({
    click(event) {
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

function FocusPoint({
  point,
}: {
  point: { latitude: number; longitude: number } | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (point) map.setView([point.latitude, point.longitude], 17);
  }, [map, point]);
  return null;
}

export default function AppointmentLocationMap({
  point,
  onPick,
  pointLabel = "Titik janji",
  markerIcon,
}: {
  point: { latitude: number; longitude: number } | null;
  onPick: (latitude: number, longitude: number) => void;
  pointLabel?: string;
  markerIcon?: MappingMarkerIconValue;
}) {
  return (
    <MapContainer
      center={
        point
          ? [point.latitude, point.longitude]
          : [MANGGA_BESAR_CENTER[0], MANGGA_BESAR_CENTER[1]]
      }
      zoom={point ? 17 : 15}
      className="h-[300px] w-full rounded-2xl"
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
          fillOpacity: 0.08,
          dashArray: "8 6",
        }}
      >
        <Tooltip>Referensi batas Mangga Besar</Tooltip>
      </Polygon>
      <PickLocation onPick={onPick} />
      <FocusPoint point={point} />
      {point && markerIcon ? <Marker position={[point.latitude, point.longitude]} icon={divIcon({ className: "appointment-selected-marker", html: `<span aria-hidden="true" style="display:grid;place-items:center;width:42px;height:42px;border:3px solid white;border-radius:14px 14px 14px 4px;background:#0b4d91;color:white;box-shadow:0 8px 22px rgba(15,23,42,.28)"><svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${mappingMarkerGlyphs[markerIcon]}</svg></span>`, iconSize: [42, 42], iconAnchor: [21, 42] })}><Tooltip>{pointLabel}</Tooltip></Marker> : point ? (
        <CircleMarker
          center={[point.latitude, point.longitude]}
          radius={10}
          pathOptions={{
            color: "#7c3aed",
            fillColor: "#a78bfa",
            fillOpacity: 0.9,
            weight: 3,
          }}
        >
          <Tooltip>{pointLabel}</Tooltip>
        </CircleMarker>
      ) : null}
    </MapContainer>
  );
}
