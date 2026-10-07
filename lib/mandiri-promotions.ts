// Public product introductions, not eligibility/approval rules or sales permissions.
// Source links were inspected on 7 October 2026. Fees/features follow the linked
// official pages, not this abbreviated presentation. No customer data here.
export type MandiriPromotion = {
  id: string;
  label: string;
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  cta: string;
  image: string;
  alt: string;
  contain: boolean;
  products: string[];
};

// Keep each logo and its accessible name together so banners cannot accidentally
// pair a Livin'/Kopra image with another brand's description.
const promotionBrands = {
  mandiri: { image: "/Gambar/01-Mandiri%20Master%20Brand%20Logo.png", alt: "Bank Mandiri", contain: true },
  livin: { image: "/Gambar/Livin%2001-Master%20Brand%20Logo.png", alt: "Livin’ by Mandiri", contain: true },
  kopra: { image: "/Gambar/Kopra%2001-Master%20Brand%20Logo.png", alt: "Kopra by Mandiri", contain: true },
  merchant: { image: "/Gambar/livin%20merchant.jpeg", alt: "Livin’ Merchant", contain: true },
  axa: { image: "/Gambar/AXA_Mandiri_2016.svg", alt: "AXA Mandiri", contain: true },
} as const;

export const mandiriPromotions: MandiriPromotion[] = [
  {
    id: "qris", label: "Desain QRIS", eyebrow: "Untuk merchant Mangga Besar",
    title: "QRIS usaha Anda, tampil lebih berkarakter.",
    description: "Bingkai digital Batik Nusantara dan Alam Indonesia. Personalisasi desain tanpa mengubah QRIS resmi milik merchant.",
    href: "/qris-custom", cta: "Buat desain gratis",
    image: "/Gambar/QRIS%20Sign%20Mockups_%20Batik%20and%20Alam.png",
    alt: "Ilustrasi bingkai QRIS Batik dan Alam", contain: false,
    products: ["Batik Nusantara", "Alam Indonesia", "Unduhan PNG"],
  },
  {
    id: "livin", label: "Livin’", eyebrow: "Livin’ by Mandiri",
    title: "Temani keseharian Anda bersama Livin’.",
    description: "Kenali layanan pembukaan rekening, pembayaran, transfer, dan investasi melalui Livin’ by Mandiri. Informasi fitur dan ketentuan tersedia di kanal resmi.",
    href: "https://www.bankmandiri.co.id/en/livin", cta: "Jelajahi Livin’",
    ...promotionBrands.livin,
    products: ["Pembukaan rekening", "Transfer & pembayaran", "Investasi"],
  },
  {
    id: "kopra", label: "Kopra", eyebrow: "Kopra by Mandiri",
    title: "Kenali solusi digital untuk kebutuhan bisnis Anda.",
    description: "Jelajahi layanan Cash Management, Trade, dan Value Chain dalam ekosistem Kopra by Mandiri. Pilihan layanan mengikuti kebutuhan dan proses resmi Bank Mandiri.",
    href: "https://www.bankmandiri.co.id/en/kopra-better-experience", cta: "Kenali Kopra",
    ...promotionBrands.kopra,
    products: ["Cash Management", "Trade", "Value Chain"],
  },
  {
    id: "merchant", label: "Livin’ Merchant", eyebrow: "Untuk pelaku usaha",
    title: "Kenali Livin’ Merchant untuk usaha Anda.",
    description: "Temukan informasi penerimaan pembayaran dan pengelolaan usaha, serta ketentuan terbaru Livin’ Merchant langsung dari Bank Mandiri.",
    href: "https://www.bankmandiri.co.id/en/livin-merchant", cta: "Jelajahi layanan merchant",
    ...promotionBrands.merchant,
    products: ["QRIS", "Kasir", "Pengelolaan outlet"],
  },
  {
    id: "funding", label: "Simpanan", eyebrow: "Rekening & simpanan",
    title: "Temukan simpanan yang sesuai dengan kebutuhan Anda.",
    description: "Kenali pilihan tabungan dan deposito Mandiri untuk kebutuhan harian maupun rencana ke depan. Periksa biaya, persyaratan, dan ketentuan produk sebelum memilih.",
    href: "https://www.bankmandiri.co.id/en/mandiri-tabungan", cta: "Lihat pilihan simpanan",
    ...promotionBrands.livin,
    products: ["Tabungan Rupiah", "Tabungan NOW", "Tabungan Payroll", "Tabungan Rencana", "Deposito"],
  },
  {
    id: "credit", label: "Pinjaman", eyebrow: "Kredit & pembiayaan",
    title: "Kenali pilihan pembiayaan untuk rencana Anda.",
    description: "Jelajahi informasi pembiayaan Mandiri dan diskusikan kebutuhan Anda melalui kanal resmi. Pengajuan mengikuti persyaratan, analisis, dan persetujuan bank; bukan persetujuan melalui MABES LINK.",
    href: "https://www.bankmandiri.co.id/en/pinjaman", cta: "Kenali pilihan pinjaman",
    ...promotionBrands.mandiri,
    products: ["Mandiri KPR", "Kredit Serbaguna Mandiri", "Pembiayaan kendaraan"],
  },
  {
    id: "cards", label: "Kartu", eyebrow: "Kartu Mandiri",
    title: "Kenali pilihan kartu untuk kebutuhan transaksi.",
    description: "Temukan informasi kartu debit dan kartu kredit melalui katalog resmi. Fitur, biaya, pengajuan, serta syarat penggunaan mengikuti masing-masing produk.",
    href: "https://www.bankmandiri.co.id/site-map", cta: "Jelajahi pilihan kartu",
    ...promotionBrands.mandiri,
    products: ["Mandiri Debit", "Mandiri Kartu Kredit"],
  },
  {
    id: "wealth", label: "Investasi", eyebrow: "Pilihan investasi Mandiri",
    title: "Kenali pilihan investasi dengan lebih baik.",
    description: "Pelajari pilihan investasi yang tersedia melalui Bank Mandiri. Pahami risiko, biaya, dan karakteristiknya; tidak ada janji imbal hasil pada halaman ini.",
    href: "https://www.bankmandiri.co.id/en/investasi-asuransi", cta: "Pelajari pilihan investasi",
    ...promotionBrands.mandiri,
    products: ["Reksa Dana", "SBN"],
  },
  {
    id: "insurance", label: "Asuransi", eyebrow: "AXA Mandiri",
    title: "Kenali pilihan perlindungan AXA Mandiri.",
    description: "Pelajari pilihan asuransi jiwa, kesehatan, dan penyakit kritis dari AXA Mandiri. Manfaat, premi, pengecualian, serta proses klaim mengikuti ketentuan masing-masing polis.",
    href: "https://www.axa-mandiri.co.id/", cta: "Kenali asuransi AXA Mandiri",
    ...promotionBrands.axa,
    products: ["Perlindungan jiwa", "Perlindungan kesehatan", "Penyakit kritis"],
  },
  {
    id: "business", label: "Bisnis", eyebrow: "Layanan bisnis Mandiri",
    title: "Jelajahi layanan yang mendukung aktivitas usaha.",
    description: "Kenali simpanan bisnis, pinjaman usaha, serta layanan transaksi dan perdagangan. Pemilihan layanan dan pembukaan fasilitas tetap melalui proses resmi sesuai kebutuhan usaha.",
    href: "https://www.bankmandiri.co.id/bisnis", cta: "Jelajahi layanan bisnis",
    // Broad business products are not all Kopra services; use the parent brand.
    ...promotionBrands.mandiri,
    products: ["Tabungan Bisnis & Giro", "Pinjaman usaha", "Cash Management", "Trade Finance"],
  },
  {
    id: "priority", label: "Prioritas", eyebrow: "Mandiri Prioritas",
    title: "Kenali layanan Mandiri Prioritas.",
    description: "Pelajari layanan dan persyaratan keanggotaan Mandiri Prioritas dari sumber resmi. Konsultasikan kebutuhan Anda kepada petugas berwenang.",
    href: "https://www.bankmandiri.co.id/en/wealth-management/prioritas", cta: "Kenali Mandiri Prioritas",
    ...promotionBrands.mandiri,
    products: ["Mandiri Prioritas", "Layanan wealth management"],
  },
];

export const mandiriAnniversaryPromotion: MandiriPromotion = {
  id: "hut28", label: "Info promo", eyebrow: "Informasi promo resmi · Oktober 2026",
  title: "Spesial 28 tahun bersama Mandiri.",
  description: "Jelajahi program HUT ke-28 di situs resmi. Periode, kuota, outlet, dan syarat mengikuti masing-masing program.",
  href: "https://www.bankmandiri.co.id/en/hut-mandiri-28", cta: "Lihat program resmi",
  ...promotionBrands.mandiri, products: [],
};
