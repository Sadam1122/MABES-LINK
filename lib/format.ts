export const JAKARTA_TIME_ZONE = "Asia/Jakarta";

export function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: JAKARTA_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: JAKARTA_TIME_ZONE,
    dateStyle: "medium",
  }).format(new Date(value));
}

export function jakartaLocalToIso(value: string) {
  const withSeconds = value.length === 16 ? `${value}:00` : value;
  const date = new Date(`${withSeconds}+07:00`);
  if (Number.isNaN(date.getTime()))
    throw new Error("Tanggal/waktu WIB tidak valid.");
  return date.toISOString();
}

export function isoToJakartaLocalInput(value: Date | string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const jakarta = new Date(date.getTime() + 7 * 60 * 60_000);
  return jakarta.toISOString().slice(0, 16);
}
