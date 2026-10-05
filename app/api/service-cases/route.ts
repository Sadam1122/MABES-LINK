import {
  AcquisitionStatus,
  AppointmentStatus,
  ServiceCaseStatus,
} from "@prisma/client";
import { apiError, jsonOk, parseJson } from "@/lib/api";
import { requireActor } from "@/lib/session";
import {
  createServiceCase,
  listServiceCases,
} from "@/lib/services/service-cases";
import { paginationSchema, serviceCaseCreateSchema } from "@/lib/validation";

export async function GET(request: Request) {
  try {
    const actor = await requireActor();
    const raw = Object.fromEntries(new URL(request.url).searchParams);
    return jsonOk(
      await listServiceCases(actor, {
        ...paginationSchema.parse(raw),
        status: Object.values(ServiceCaseStatus).includes(
          raw.status as ServiceCaseStatus,
        )
          ? (raw.status as ServiceCaseStatus)
          : undefined,
        appointmentStatus: Object.values(AppointmentStatus).includes(
          raw.appointmentStatus as AppointmentStatus,
        )
          ? (raw.appointmentStatus as AppointmentStatus)
          : undefined,
        acquisitionStatus: Object.values(AcquisitionStatus).includes(
          raw.acquisitionStatus as AcquisitionStatus,
        )
          ? (raw.acquisitionStatus as AcquisitionStatus)
          : undefined,
        acquisitionCategory: raw.acquisitionCategory,
        overdue: raw.overdue === "1",
      }),
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireActor();
    return jsonOk(
      await createServiceCase(
        actor,
        serviceCaseCreateSchema.parse(await parseJson(request)),
        request.headers.get("x-request-id"),
      ),
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
