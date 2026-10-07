export const mappingMarkerIcons = [
  "STORE", "FOOD", "MARKET", "OFFICE", "HEALTH", "SERVICE",
  "TOWER", "CAFE", "BAKERY", "HOTEL", "SCHOOL", "WAREHOUSE",
  "FACTORY", "BANK", "PHARMACY", "SALON", "GYM", "AUTO",
  "ELECTRONICS", "FASHION", "FLORIST", "HOUSE", "MALL",
  "LOGISTICS", "WORSHIP", "PARK",
] as const;

export type MappingMarkerIconValue = (typeof mappingMarkerIcons)[number];
export type MarkerGroup = "Usaha" | "Fasilitas" | "Lokasi";

export const mappingMarkerIconOptions: {
  value: MappingMarkerIconValue;
  label: string;
  description: string;
  group: MarkerGroup;
}[] = [
  { value: "STORE", label: "Toko", description: "Gerai umum", group: "Usaha" },
  { value: "FOOD", label: "Kuliner", description: "Makanan", group: "Usaha" },
  { value: "MARKET", label: "Pasar", description: "Belanja harian", group: "Usaha" },
  { value: "OFFICE", label: "Kantor", description: "Perkantoran", group: "Fasilitas" },
  { value: "HEALTH", label: "Kesehatan", description: "Layanan kesehatan", group: "Fasilitas" },
  { value: "SERVICE", label: "Jasa", description: "Usaha jasa", group: "Usaha" },
  { value: "TOWER", label: "Menara", description: "Gedung tinggi", group: "Lokasi" },
  { value: "CAFE", label: "Kafe", description: "Kopi/minuman", group: "Usaha" },
  { value: "BAKERY", label: "Roti", description: "Toko roti", group: "Usaha" },
  { value: "HOTEL", label: "Hotel", description: "Akomodasi", group: "Fasilitas" },
  { value: "SCHOOL", label: "Sekolah", description: "Pendidikan", group: "Fasilitas" },
  { value: "WAREHOUSE", label: "Gudang", description: "Penyimpanan", group: "Lokasi" },
  { value: "FACTORY", label: "Pabrik", description: "Produksi", group: "Usaha" },
  { value: "BANK", label: "Bank", description: "Layanan keuangan", group: "Fasilitas" },
  { value: "PHARMACY", label: "Apotek", description: "Obat", group: "Usaha" },
  { value: "SALON", label: "Salon", description: "Perawatan", group: "Usaha" },
  { value: "GYM", label: "Olahraga", description: "Pusat kebugaran", group: "Fasilitas" },
  { value: "AUTO", label: "Otomotif", description: "Kendaraan", group: "Usaha" },
  { value: "ELECTRONICS", label: "Elektronik", description: "Perangkat", group: "Usaha" },
  { value: "FASHION", label: "Busana", description: "Pakaian", group: "Usaha" },
  { value: "FLORIST", label: "Bunga", description: "Florist", group: "Usaha" },
  { value: "HOUSE", label: "Rumah", description: "Hunian/ruko", group: "Lokasi" },
  { value: "MALL", label: "Pusat belanja", description: "Mall/plaza", group: "Fasilitas" },
  { value: "LOGISTICS", label: "Logistik", description: "Pengiriman", group: "Usaha" },
  { value: "WORSHIP", label: "Ibadah", description: "Tempat ibadah", group: "Fasilitas" },
  { value: "PARK", label: "Taman", description: "Ruang terbuka", group: "Lokasi" },
];

// Fragmen SVG statis; kunci selalu divalidasi oleh enum, tidak berasal dari HTML pengguna.
export const mappingMarkerGlyphs: Record<MappingMarkerIconValue, string> = {
  STORE: '<path d="M4 10h16v10H4zM3 10l2-6h14l2 6M8 20v-6h4v6M3 10c0 2 3 2 3 0 0 2 3 2 3 0 0 2 3 2 3 0 0 2 3 2 3 0"/>',
  FOOD: '<path d="M7 3v8M4 3v5c0 2 6 2 6 0V3M7 11v10M16 3v18M16 3c5 2 5 8 0 10"/>',
  MARKET: '<circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/><path d="M3 4h2l2.5 11h10l2-7H7"/>',
  OFFICE: '<path d="M4 21V5h10v16M14 9h6v12M8 9h2M8 13h2M8 17h2M17 13h1M17 17h1"/>',
  HEALTH: '<path d="M12 21s-8-4.5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6.5-8 11-8 11Z"/><path d="M9 12h6M12 9v6"/>',
  SERVICE: '<path d="M14.7 6.3a4 4 0 0 0-5-5L12 3.6 9.6 6 7.3 3.7a4 4 0 0 0 5 5L4 17l3 3 8.3-8.3a4 4 0 0 0 5-5L18 9l-2.4-2.4 2.3-2.3a4 4 0 0 0-3.2 2Z"/>',
  TOWER: '<path d="M12 2 5 8v13h14V8l-7-6ZM9 21v-5h6v5M9 9h1M14 9h1M9 12h1M14 12h1"/>',
  CAFE: '<path d="M4 7h13v8a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V7ZM17 8h2a3 3 0 0 1 0 6h-2M7 3v2M12 3v2M3 21h17"/>',
  BAKERY: '<path d="M5 12c-2-2-1-6 2-7 2-1 4 0 5 2 1-2 3-3 5-2 3 1 4 5 2 7l-2 8H7l-2-8ZM8 10l2 7M16 10l-2 7"/>',
  HOTEL: '<path d="M3 21V5h18v16M7 9h2M15 9h2M7 13h2M15 13h2M10 21v-5h4v5"/>',
  SCHOOL: '<path d="M3 10 12 4l9 6-9 5-9-5ZM6 12v6c4 3 8 3 12 0v-6M21 10v7"/>',
  WAREHOUSE: '<path d="M3 21V8l9-5 9 5v13M7 21v-9h10v9M7 15h10M10 12v9M14 12v9"/>',
  FACTORY: '<path d="M3 21V11l6 3V8l6 3V4h5v17H3ZM7 18h1M12 18h1M17 18h1"/>',
  BANK: '<path d="M2 9 12 3l10 6H2ZM4 21h16M6 10v8M10 10v8M14 10v8M18 10v8M3 18h18"/>',
  PHARMACY: '<path d="M8 3h8v4H8zM7 7h10l2 4v10H5V11l2-4ZM9 15h6M12 12v6"/>',
  SALON: '<circle cx="7" cy="7" r="2"/><circle cx="7" cy="17" r="2"/><path d="m9 8 12 12M9 16 21 4M12 11l3 3"/>',
  GYM: '<path d="M3 9v6M6 7v10M18 7v10M21 9v6M6 12h12"/>',
  AUTO: '<path d="M5 16 7 9h10l2 7M4 16h16v4H4zM7 20v2M17 20v2M7 17h1M16 17h1"/>',
  ELECTRONICS: '<rect x="4" y="4" width="16" height="13" rx="2"/><path d="M8 21h8M12 17v4M8 9h8M8 12h5"/>',
  FASHION: '<path d="m8 3-5 5 3 3 2-2v12h8V9l2 2 3-3-5-5-4 3-4-3Z"/>',
  FLORIST: '<circle cx="12" cy="10" r="2"/><path d="M12 8c-2-5-5-4-4-1-5-1-5 2-2 4-3 3-1 5 3 3 1 4 4 4 5 0 4 2 6 0 3-3 4-2 3-5-2-4 1-4-2-5-4-1ZM12 12v9M9 18c-2-2-4-2-5-1 1 2 3 3 5 3M15 18c2-2 4-2 5-1-1 2-3 3-5 3"/>',
  HOUSE: '<path d="m2 11 10-8 10 8M5 10v11h14V10M9 21v-7h6v7"/>',
  MALL: '<path d="M4 21V6h16v15M8 6V3h8v3M8 11h2M14 11h2M8 15h2M14 15h2M9 21v-3h6v3"/>',
  LOGISTICS: '<path d="M3 7h11v12H3zM14 10h4l3 4v5h-7M6 19a2 2 0 1 0 4 0M16 19a2 2 0 1 0 4 0M3 11h11"/>',
  WORSHIP: '<path d="M5 21V11l7-5 7 5v10M8 21v-7h8v7M3 21h18M9 6c0-2 1-3 3-4 2 1 3 2 3 4"/>',
  PARK: '<path d="M12 3c-4 0-6 3-5 6-3 1-4 6-1 8h12c3-2 2-7-1-8 1-3-1-6-5-6ZM12 17v5M8 22h8"/>',
};
