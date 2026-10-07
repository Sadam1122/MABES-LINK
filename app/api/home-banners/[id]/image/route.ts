import { apiError } from "@/lib/api";
import { readPublicHomeBanner } from "@/lib/services/home-banners";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const image = await readPublicHomeBanner((await params).id);
    return new Response(new Uint8Array(image.data), { headers: {
      "Content-Type": image.mimeType,
      "Cache-Control": "public, max-age=60",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    } });
  } catch (error) {
    return apiError(error);
  }
}
