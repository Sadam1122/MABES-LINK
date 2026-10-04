import { Badge } from "@/components/ui/badge";
const labels: Record<string, string> = {
  NEW: "Baru",
  NEED_CONFIRMED: "Kebutuhan terkonfirmasi",
  FOLLOW_UP: "Tindak lanjut",
  HANDOVER: "Serah terima",
  PROCESSING: "Diproses",
  READY: "Siap digunakan",
  CLOSED_LOST: "Tidak dilanjutkan",
  PLANNED: "Terjadwal",
  COMPLETED: "Selesai",
  CANCELLED: "Dibatalkan",
  DRAFT: "Draf",
  SUBMITTED: "Dikirim",
  ACCEPTED: "Diterima",
  ON_HOLD: "Tertahan",
  ESCALATED: "Eskalasi",
  OPEN: "Terbuka",
  IN_PROGRESS: "Ditangani",
  RESOLVED: "Selesai",
  VERIFIED: "Terverifikasi",
  CREATED: "Dibuat",
  ASSIGNED: "Ditugaskan",
  WAITING_CUSTOMER: "Menunggu nasabah",
  WAITING_SYSTEM: "Menunggu sistem",
  HANDLED: "Selesai ditangani",
  CLOSED: "Ditutup",
  REOPENED: "Dibuka kembali",
  NEEDS_SCHEDULING: "Perlu membuat janji",
  PENDING_CONFIRMATION: "Menunggu konfirmasi",
  CONFIRMED: "Janji terkonfirmasi",
  REJECTED: "Ditolak",
};
export function statusLabel(value: string) {
  return labels[value] ?? value.replaceAll("_", " ");
}
export function StatusBadge({ value }: { value: string }) {
  const tone =
    value === "READY" ||
    value === "COMPLETED" ||
    value === "RESOLVED" ||
    value === "VERIFIED"
      ? "green"
      : value === "ON_HOLD" ||
          value === "ESCALATED" ||
          value === "OPEN" ||
          value === "WAITING_CUSTOMER" ||
          value === "WAITING_SYSTEM"
        ? "amber"
        : value === "CANCELLED" ||
            value === "REJECTED" ||
            value === "CLOSED_LOST" ||
            value === "CLOSED"
          ? "red"
          : value === "PROCESSING" ||
              value === "IN_PROGRESS" ||
              value === "ACCEPTED"
            ? "blue"
            : "slate";
  return <Badge tone={tone}>{statusLabel(value)}</Badge>;
}
