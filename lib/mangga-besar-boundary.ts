export type MapCoordinate = readonly [latitude: number, longitude: number];

// Referensi batas Kelurahan Mangga Besar (KDEPUM 3173031005), disederhanakan
// dari FeatureServer GIS Pemprov DKI dengan outSR=4326. Ini bukan penetapan
// wilayah kerja cabang; cakupan operasional tetap mengikuti kewenangan internal.
export const MANGGA_BESAR_BOUNDARY_SOURCE =
  "https://gis-dpmptsp.jakarta.go.id/arcgis/rest/services/Hosted/Batas_Administrasi_Kelurahan_DKI_Jakarta/FeatureServer/85";

export const MANGGA_BESAR_BOUNDARY: readonly MapCoordinate[] = [
  [-6.150022, 106.816866],
  [-6.149429, 106.820426],
  [-6.142409, 106.820936],
  [-6.142154, 106.82037],
  [-6.142004, 106.820309],
  [-6.14123, 106.820785],
  [-6.140514, 106.820998],
  [-6.140204, 106.820925],
  [-6.14006, 106.820743],
  [-6.139921, 106.819265],
  [-6.140153, 106.818222],
  [-6.140746, 106.817301],
  [-6.140916, 106.8173],
  [-6.140958, 106.817129],
  [-6.141799, 106.815806],
  [-6.142735, 106.814928],
  [-6.145017, 106.815598],
  [-6.150022, 106.816866],
] as const;

export const MANGGA_BESAR_CENTER: MapCoordinate = [-6.1447, 106.81825];

function pointOnSegment(
  latitude: number,
  longitude: number,
  a: MapCoordinate,
  b: MapCoordinate,
) {
  const cross =
    (longitude - a[1]) * (b[0] - a[0]) - (latitude - a[0]) * (b[1] - a[1]);
  if (Math.abs(cross) > 1e-10) return false;
  return (
    latitude >= Math.min(a[0], b[0]) &&
    latitude <= Math.max(a[0], b[0]) &&
    longitude >= Math.min(a[1], b[1]) &&
    longitude <= Math.max(a[1], b[1])
  );
}

export function isWithinManggaBesarBoundary(
  latitude: number,
  longitude: number,
) {
  let inside = false;
  for (
    let i = 0, j = MANGGA_BESAR_BOUNDARY.length - 1;
    i < MANGGA_BESAR_BOUNDARY.length;
    j = i++
  ) {
    const current = MANGGA_BESAR_BOUNDARY[i];
    const previous = MANGGA_BESAR_BOUNDARY[j];
    if (pointOnSegment(latitude, longitude, previous, current)) return true;
    const intersects =
      current[0] > latitude !== previous[0] > latitude &&
      longitude <
        ((previous[1] - current[1]) * (latitude - current[0])) /
          (previous[0] - current[0]) +
          current[1];
    if (intersects) inside = !inside;
  }
  return inside;
}
