import { apiError, assertSameOrigin, jsonOk } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { isWithinManggaBesarBoundary } from "@/lib/mangga-besar-boundary";
import {
  commitMappingImport,
  exportWorkbook,
  planMappingImport,
  templateWorkbook,
} from "@/lib/mapping-excel";
import { requireActor } from "@/lib/session";

export const runtime = "nodejs";

function workbookResponse(buffer: Awaited<ReturnType<typeof templateWorkbook>>, filename: string) {
  return new Response(Buffer.from(buffer), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store, private",
      "x-content-type-options": "nosniff",
    },
  });
}

export async function GET(request: Request) {
  try {
    const actor = await requireActor();
    const mode = new URL(request.url).searchParams.get("mode");
    if (mode === "template") return workbookResponse(await templateWorkbook(), "mabes-link-template-mapping.xlsx");
    if (mode === "export") return workbookResponse(await exportWorkbook(actor), "mabes-link-mapping.xlsx");
    throw new AppError("Mode Excel tidak dikenal.", 400, "INVALID_MODE");
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    const mode = new URL(request.url).searchParams.get("mode");
    if (mode !== "preview" && mode !== "commit") throw new AppError("Mode impor tidak dikenal.", 400, "INVALID_MODE");
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new AppError("Pilih file XLSX.", 422, "FILE_REQUIRED");
    if (mode === "preview") {
      const plan = await planMappingImport(actor, file);
      return jsonOk({ summary: plan.summary, errors: plan.errors,
        rows: plan.planned.slice(0, 30).map((row) => ({ row: row.row, action: row.existingId ? "Perbarui" : "Tambah",
          businessAlias: row.businessAlias, latitude: row.latitude, longitude: row.longitude,
          outsideReference: row.latitude != null && row.longitude != null && !isWithinManggaBesarBoundary(row.latitude, row.longitude) })) });
    }
    return jsonOk(await commitMappingImport(actor, file, request.headers.get("x-request-id")));
  } catch (error) { return apiError(error); }
}
