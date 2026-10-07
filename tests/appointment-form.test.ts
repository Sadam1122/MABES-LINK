import { describe, expect, it } from "vitest";

import { mappingMarkerIcons, mappingMarkerIconOptions, mappingMarkerGlyphs } from "@/lib/mapping-icons";
import { appointmentCreateSchema } from "@/lib/validation";

const validFormPayload = {
  acquisitionCategory: "LIVIN_MERCHANT",
  acquisitionProduct: "LIVIN_MERCHANT_QRIS",
  acquisitionStatus: "PROSPECT",
  contactName: "Kontak Samaran",
  businessAlias: null,
  customerCif: "",
  customerAccount: "",
  customerPhone: "",
  reason: "Membahas kebutuhan QRIS usaha samaran",
  nextAction: "Konfirmasi kebutuhan sebelum kunjungan",
  picIds: ["officer-test"],
  appointmentAt: "2026-10-07T03:00:00.000Z",
  targetValue: null,
  realizationValue: null,
  metricUnit: "CUSTOMER",
  locationLabel: "Ruko samaran",
  latitude: 0,
  longitude: 0,
  locationSource: "MAP_PIN",
};

describe("form janji dan ikon peta", () => {
  it("menerima kolom opsional kosong, titik 0 yang valid, dan ikon baru", () => {
    const parsed = appointmentCreateSchema.parse({ ...validFormPayload, mappingMarkerIcon: "TOWER" });
    expect(parsed.customerCif).toBeNull();
    expect(parsed.customerAccount).toBeNull();
    expect(parsed.customerPhone).toBeNull();
    expect(parsed.mappingMarkerIcon).toBe("TOWER");
    expect(parsed.latitude).toBe(0);
  });

  it("janji lama tanpa ikon tetap memakai penanda toko", () => {
    expect(appointmentCreateSchema.parse(validFormPayload).mappingMarkerIcon).toBe("STORE");
  });

  it("memberi error pada field yang salah, bukan menerima koordinat palsu", () => {
    const result = appointmentCreateSchema.safeParse({ ...validFormPayload, customerPhone: "123", latitude: -91 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.customerPhone?.length).toBeGreaterThan(0);
      expect(result.error.flatten().fieldErrors.latitude?.length).toBeGreaterThan(0);
    }
  });

  it("setiap ikon mempunyai label dan simbol unik yang dapat digambar", () => {
    expect(mappingMarkerIcons.length).toBeGreaterThan(20);
    expect(new Set(mappingMarkerIconOptions.map((item) => item.value)).size).toBe(mappingMarkerIcons.length);
    for (const value of mappingMarkerIcons) expect(mappingMarkerGlyphs[value]).toContain("<");
  });
});
