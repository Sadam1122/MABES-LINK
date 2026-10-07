import { NextRequest } from "next/server";
import { z } from "zod";

import { AppError } from "@/lib/errors";
import { publicApiError } from "@/lib/public-api";
import { checkPublicRateLimit } from "@/lib/qris-custom";

export const runtime = "nodejs";

const querySchema = z.string().trim().min(3).max(100);
type PhotonFeature = {
  geometry?: { coordinates?: unknown };
  properties?: Record<string, unknown>;
};

export async function GET(request: NextRequest) {
  try {
    const q = querySchema.parse(request.nextUrl.searchParams.get("q"));
    if (/@|\b\d{9,}\b/.test(q))
      throw new AppError("Cari nama tempat atau jalan publik, bukan email atau nomor pribadi.", 422, "PRIVATE_QUERY");
    const configured = process.env.LOCATION_SEARCH_URL;
    if (!configured)
      throw new AppError("Pencarian tempat belum dikonfigurasi. Pilih pin manual atau buka Google Maps.", 503, "SEARCH_UNAVAILABLE");
    await checkPublicRateLimit(request, "location-search", 120);
    const url = new URL(configured);
    if (url.username || url.password || (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))))
      throw new AppError("Konfigurasi pencarian lokasi tidak aman.", 503, "SEARCH_CONFIG_INVALID");
    url.searchParams.set("q", q);
    url.searchParams.set("limit", "6");
    url.searchParams.set("lat", "-6.15");
    url.searchParams.set("lon", "106.825");
    url.searchParams.set("lang", "id");
    const response = await fetch(url, {
      signal: AbortSignal.timeout(6000),
      headers: { Accept: "application/json" },
      cache: "no-store",
    }).catch(() => { throw new AppError("Penyedia pencarian lokasi tidak dapat dihubungi. Pilih pin manual atau coba lagi.", 502, "SEARCH_PROVIDER_UNAVAILABLE"); });
    if (!response.ok) throw new AppError("Penyedia pencarian lokasi sedang tidak tersedia.", 502, "SEARCH_PROVIDER_ERROR");
    const payload = await response.json() as { features?: PhotonFeature[] };
    const results = (Array.isArray(payload.features) ? payload.features : []).flatMap((feature) => {
      const coordinates = feature.geometry?.coordinates;
      if (!Array.isArray(coordinates) || coordinates.length < 2) return [];
      const [longitude, latitude] = coordinates;
      if (typeof latitude !== "number" || typeof longitude !== "number" || !Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return [];
      const properties = feature.properties ?? {};
      const parts = [properties.name, properties.street, properties.housenumber, properties.district, properties.city, properties.state]
        .filter((value): value is string => typeof value === "string" && Boolean(value.trim()));
      return [{ label: [...new Set(parts)].join(", ").slice(0, 180) || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`, latitude, longitude }];
    });
    return Response.json({ data: results }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return publicApiError(error);
  }
}
