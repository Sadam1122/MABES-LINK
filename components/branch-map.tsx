"use client";

import { divIcon } from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import { useEffect } from "react";
import { MABES_BRANCH } from "@/lib/branch-location";

function ResizeMap() {
  const map = useMap();
  useEffect(() => {
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => map.invalidateSize({ pan: false }));
    });
    observer.observe(map.getContainer());
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [map]);
  return null;
}

export default function BranchMap() {
  return <MapContainer center={[MABES_BRANCH.latitude, MABES_BRANCH.longitude]} zoom={16} scrollWheelZoom={false} className="h-[360px] w-full sm:h-[450px]">
    <TileLayer url={process.env.NEXT_PUBLIC_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png"} attribution={process.env.NEXT_PUBLIC_MAP_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'} maxZoom={Number(process.env.NEXT_PUBLIC_MAP_MAX_ZOOM || 19)} />
    <ResizeMap />
    <Marker position={[MABES_BRANCH.latitude, MABES_BRANCH.longitude]} title={MABES_BRANCH.name} alt={MABES_BRANCH.name} icon={divIcon({ className: "mabes-bank-marker", html: '<div class="mabes-bank-badge"><img src="/Gambar/01-Mandiri%20Master%20Brand%20Logo.png" alt="Mandiri"/><span>Mangga Besar</span></div>', iconSize: [132, 58], iconAnchor: [66, 58] })}>
      <Popup><strong>{MABES_BRANCH.name}</strong><p>{MABES_BRANCH.address}</p><a href={MABES_BRANCH.googleMapsUrl} target="_blank" rel="noreferrer">Lihat di Google Maps ↗</a></Popup>
    </Marker>
  </MapContainer>;
}
