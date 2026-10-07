export type Coordinate = { latitude: number; longitude: number };

export function assertCoordinate(latitude: number, longitude: number) {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)
    throw new Error("Latitude harus berada antara -90 dan 90.");
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)
    throw new Error("Longitude harus berada antara -180 dan 180.");
}

export function googleMapsLocationUrl({ latitude, longitude }: Coordinate) {
  assertCoordinate(latitude, longitude);
  const url = new URL("https://www.google.com/maps/search/");
  url.search = new URLSearchParams({
    api: "1",
    query: `${latitude},${longitude}`,
  }).toString();
  return url.toString();
}

export function googleMapsAddressSearchUrl(query: string) {
  const url = new URL("https://www.google.com/maps/search/");
  url.search = new URLSearchParams({ api: "1", query: query.trim() }).toString();
  return url.toString();
}

export function googleMapsNavigationUrl({ latitude, longitude }: Coordinate) {
  assertCoordinate(latitude, longitude);
  const url = new URL("https://www.google.com/maps/dir/");
  url.search = new URLSearchParams({
    api: "1",
    destination: `${latitude},${longitude}`,
    dir_action: "navigate",
  }).toString();
  return url.toString();
}

export function haversineMeters(from: Coordinate, to: Coordinate) {
  assertCoordinate(from.latitude, from.longitude);
  assertCoordinate(to.latitude, to.longitude);
  const rad = (value: number) => (value * Math.PI) / 180;
  const earth = 6_371_000;
  const dLat = rad(to.latitude - from.latitude);
  const dLon = rad(to.longitude - from.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(from.latitude)) *
      Math.cos(rad(to.latitude)) *
      Math.sin(dLon / 2) ** 2;
  return earth * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatStraightLineDistance(meters: number) {
  return meters < 1000
    ? `${Math.round(meters)} m`
    : `${(meters / 1000).toFixed(meters < 10_000 ? 1 : 0)} km`;
}

export function geolocationErrorMessage(code: number) {
  if (code === 1)
    return "Izin lokasi ditolak. Masukkan koordinat atau pilih pin secara manual.";
  if (code === 2) return "Posisi perangkat tidak tersedia.";
  if (code === 3) return "Pengambilan lokasi melewati batas waktu.";
  return "Lokasi perangkat tidak dapat diperoleh.";
}
