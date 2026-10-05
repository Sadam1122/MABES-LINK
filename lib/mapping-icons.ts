export const mappingMarkerIcons = [
  "STORE",
  "FOOD",
  "MARKET",
  "OFFICE",
  "HEALTH",
  "SERVICE",
] as const;

export type MappingMarkerIconValue = (typeof mappingMarkerIcons)[number];

export const mappingMarkerIconOptions: {
  value: MappingMarkerIconValue;
  label: string;
  description: string;
}[] = [
  { value: "STORE", label: "Toko", description: "Gerai atau toko umum" },
  { value: "FOOD", label: "Kuliner", description: "Makanan dan minuman" },
  { value: "MARKET", label: "Belanja", description: "Pasar dan retail" },
  { value: "OFFICE", label: "Kantor", description: "Kantor atau badan usaha" },
  {
    value: "HEALTH",
    label: "Kesehatan",
    description: "Apotek dan layanan kesehatan",
  },
  { value: "SERVICE", label: "Jasa", description: "Bengkel dan usaha jasa" },
];
