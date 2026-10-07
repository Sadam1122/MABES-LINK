export const qrisStickerIds = [
  "FLOWER", "STAR", "SPARKLE", "HEART", "COFFEE", "LEAF",
  "GIFT", "BUTTERFLY", "SUN", "MOON", "CROWN", "BAG",
  "CLOUD", "CHERRY", "CUPCAKE", "BALLOON", "MUSIC", "BOW", "FISH", "SMILE",
] as const;

export type QrisStickerId = (typeof qrisStickerIds)[number];

export const qrisStickers: { id: QrisStickerId; label: string }[] = [
  { id: "FLOWER", label: "Bunga" },
  { id: "STAR", label: "Bintang" },
  { id: "SPARKLE", label: "Kilau" },
  { id: "HEART", label: "Hati" },
  { id: "COFFEE", label: "Kopi" },
  { id: "LEAF", label: "Daun" },
  { id: "GIFT", label: "Hadiah" },
  { id: "BUTTERFLY", label: "Kupu-kupu" },
  { id: "SUN", label: "Matahari" },
  { id: "MOON", label: "Bulan" },
  { id: "CROWN", label: "Mahkota" },
  { id: "BAG", label: "Belanja" },
  { id: "CLOUD", label: "Awan" },
  { id: "CHERRY", label: "Ceri" },
  { id: "CUPCAKE", label: "Kue" },
  { id: "BALLOON", label: "Balon" },
  { id: "MUSIC", label: "Musik" },
  { id: "BOW", label: "Pita" },
  { id: "FISH", label: "Ikan" },
  { id: "SMILE", label: "Senyum" },
];

const navy = "#09345a";
const gold = "#d7a64a";
const teal = "#1190a5";

export function qrisStickerSvg(id: QrisStickerId) {
  const drawing: Record<QrisStickerId, string> = {
    FLOWER: `<g fill="${gold}">${Array.from({ length: 8 }, (_, i) => `<ellipse cx="32" cy="15" rx="8" ry="13" transform="rotate(${i * 45} 32 32)"/>`).join("")}</g><circle cx="32" cy="32" r="8" fill="${navy}"/>`,
    STAR: `<path d="M32 4 40 23 60 24 44 38 49 59 32 47 15 59 20 38 4 24 24 23Z" fill="${gold}" stroke="${navy}" stroke-width="2"/>`,
    SPARKLE: `<path d="M31 3 38 25 60 32 38 39 31 61 24 39 2 32 24 25Z" fill="${gold}" stroke="${navy}" stroke-width="2"/><circle cx="52" cy="10" r="4" fill="${teal}"/>`,
    HEART: `<path d="M32 56 8 33C-1 23 7 8 19 9c6 0 10 3 13 8 3-5 7-8 13-8 12-1 20 14 11 24Z" fill="${gold}" stroke="${navy}" stroke-width="2"/>`,
    COFFEE: `<path d="M11 25h34v15c0 10-7 17-17 17S11 50 11 40Z" fill="${gold}" stroke="${navy}" stroke-width="2"/><path d="M45 29h8c11 0 9 17-8 17M20 6c-6 7 5 8 0 15M32 6c-6 7 5 8 0 15" fill="none" stroke="${navy}" stroke-width="3" stroke-linecap="round"/>`,
    LEAF: `<path d="M8 54C12 18 31 5 57 7c-1 30-15 47-49 47Z" fill="${teal}" stroke="${navy}" stroke-width="2"/><path d="M9 55c15-17 30-27 48-48M23 39l-4-15M38 26l11 3" fill="none" stroke="${gold}" stroke-width="3"/>`,
    GIFT: `<rect x="10" y="25" width="44" height="32" rx="4" fill="${gold}" stroke="${navy}" stroke-width="2"/><path d="M7 24h50v10H7ZM30 24v33" fill="${teal}" stroke="${navy}" stroke-width="2"/><path d="M31 23C3 26 13 6 24 9c6 2 7 8 7 14Zm2 0c28 3 18-17 7-14-6 2-7 8-7 14Z" fill="${gold}" stroke="${navy}" stroke-width="2"/>`,
    BUTTERFLY: `<path d="M31 33C5 2 2 14 7 30c-8 16 6 27 24 9M33 33C59 2 62 14 57 30c8 16-6 27-24 9" fill="${gold}" stroke="${navy}" stroke-width="2"/><path d="M32 25v26M28 26l-7-11M36 26l7-11" stroke="${navy}" stroke-width="3" stroke-linecap="round"/><circle cx="19" cy="30" r="4" fill="${teal}"/><circle cx="45" cy="30" r="4" fill="${teal}"/>`,
    SUN: `<circle cx="32" cy="32" r="16" fill="${gold}" stroke="${navy}" stroke-width="2"/>${Array.from({ length: 12 }, (_, i) => `<path d="M32 3v8" transform="rotate(${i * 30} 32 32)" stroke="${gold}" stroke-width="4" stroke-linecap="round"/>`).join("")}`, 
    MOON: `<path d="M47 5a27 27 0 1 0 12 42A25 25 0 0 1 47 5Z" fill="${gold}" stroke="${navy}" stroke-width="2"/><circle cx="49" cy="18" r="3" fill="${teal}"/>`,
    CROWN: `<path d="M7 18 19 31 32 12 45 31 57 18 52 52H12Z" fill="${gold}" stroke="${navy}" stroke-width="2"/><path d="M13 46h38" stroke="${navy}" stroke-width="3"/><circle cx="32" cy="35" r="4" fill="${teal}"/>`,
    BAG: `<rect x="12" y="22" width="40" height="36" rx="5" fill="${gold}" stroke="${navy}" stroke-width="2"/><path d="M22 25v-7a10 10 0 0 1 20 0v7" fill="none" stroke="${navy}" stroke-width="3"/><path d="M25 42c4 6 10 6 14 0" fill="none" stroke="${teal}" stroke-width="3" stroke-linecap="round"/>`,
    CLOUD: `<path d="M16 49C3 49 3 31 15 29c2-12 18-19 27-8 11-2 19 8 16 17 2 7-4 11-12 11Z" fill="${teal}" stroke="${navy}" stroke-width="2"/><path d="M22 39h19" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`,
    CHERRY: `<path d="M31 30C28 14 33 8 43 5M32 30C41 12 51 11 57 14" fill="none" stroke="${teal}" stroke-width="4"/><path d="M43 5c-3 10-12 10-18 6 4-7 10-9 18-6Z" fill="${teal}"/><circle cx="22" cy="42" r="12" fill="${gold}" stroke="${navy}" stroke-width="2"/><circle cx="44" cy="43" r="12" fill="${gold}" stroke="${navy}" stroke-width="2"/>`,
    CUPCAKE: `<path d="M15 33h34l-5 25H20Z" fill="${gold}" stroke="${navy}" stroke-width="2"/><path d="M12 34c-4-7 1-13 8-12 0-8 11-12 16-6 9-5 18 3 16 10 8 3 7 12-2 12H16Z" fill="#f4e3bc" stroke="${navy}" stroke-width="2"/><circle cx="32" cy="14" r="5" fill="${teal}"/>`,
    BALLOON: `<ellipse cx="32" cy="25" rx="18" ry="22" fill="${gold}" stroke="${navy}" stroke-width="2"/><path d="M27 47h10l-5 7-5-7ZM32 54c-5 3 5 5 0 9" fill="none" stroke="${navy}" stroke-width="2"/><path d="M23 15c-4 5-5 11-4 16" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`,
    MUSIC: `<path d="M25 16v34M25 19l27-7v31" fill="none" stroke="${navy}" stroke-width="5" stroke-linecap="round"/><ellipse cx="18" cy="51" rx="9" ry="6" fill="${gold}"/><ellipse cx="45" cy="45" rx="9" ry="6" fill="${teal}"/>`,
    BOW: `<path d="M31 30C5 3 2 20 12 31 2 41 6 59 31 35M33 30C59 3 62 20 52 31c10 10 6 28-19 4" fill="${gold}" stroke="${navy}" stroke-width="2"/><circle cx="32" cy="32" r="7" fill="${teal}" stroke="${navy}" stroke-width="2"/>`,
    FISH: `<path d="M12 32C22 13 44 13 52 32c-8 19-30 19-40 0ZM11 32 3 20v24Z" fill="${teal}" stroke="${navy}" stroke-width="2"/><circle cx="39" cy="28" r="3" fill="${navy}"/><path d="M19 32h10" stroke="${gold}" stroke-width="3"/>`,
    SMILE: `<circle cx="32" cy="32" r="27" fill="${gold}" stroke="${navy}" stroke-width="2"/><circle cx="23" cy="26" r="3" fill="${navy}"/><circle cx="41" cy="26" r="3" fill="${navy}"/><path d="M19 37c5 14 21 14 26 0" fill="none" stroke="${navy}" stroke-width="3" stroke-linecap="round"/>`,
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">${drawing[id]}</svg>`;
}

export function qrisStickerPreview(id: QrisStickerId) {
  return `data:image/svg+xml,${encodeURIComponent(qrisStickerSvg(id))}`;
}
