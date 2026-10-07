import { AppointmentSpreadWorkspace } from "@/components/appointment-spread-workspace";
import { PageHeader } from "@/components/page-header";
import { requirePageActor } from "@/lib/session";
import { listAppointmentLocations } from "@/lib/services/service-cases";

export default async function AppointmentMapPage() {
  const actor = await requirePageActor();
  const rows = await listAppointmentLocations(actor);
  const points = rows.flatMap((item) => {
    if (
      item.appointmentAt == null ||
      item.prospect.latitude == null ||
      item.prospect.longitude == null
    )
      return [];
    const picNames = Array.from(
      new Set(item.participants.map((participant) => participant.user.name)),
    );
    return [{
      id: item.id,
      code: item.code,
      label: item.prospect.businessAlias,
      locationLabel: item.prospect.locationLabel || "Titik lokasi janji",
      latitude: Number(item.prospect.latitude),
      longitude: Number(item.prospect.longitude),
      markerIcon: item.prospect.mappingMarkerIcon,
      appointmentStatus: item.appointmentStatus,
      appointmentAt: item.appointmentAt.toISOString(),
      picNames: picNames.length ? picNames : [item.pic.name],
      photoId: item.prospect.locationPhotos[0]?.id ?? null,
    }];
  });
  return (
    <>
      <PageHeader
        eyebrow="Geospasial akuisisi"
        title="Mapping Janji"
        description="Lihat sebaran lokasi janji, PIC, status, dan waktu sesuai cakupan role dan cabang."
      />
      <AppointmentSpreadWorkspace
        points={points}
        referenceNow={new Date().toISOString()}
      />
    </>
  );
}
