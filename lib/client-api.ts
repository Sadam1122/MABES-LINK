"use client";

const fieldLabels: Record<string, string> = {
  appointmentStatus: "Status janji",
  acquisitionCategory: "Kategori", acquisitionProduct: "Produk/layanan",
  contactName: "Nama orang yang ditemui", businessAlias: "Nama toko/usaha",
  customerCif: "CIF", customerAccount: "Nomor rekening", customerPhone: "Nomor HP",
  reason: "Alasan janji", nextAction: "Next action", picIds: "PIC internal",
  appointmentAt: "Tanggal dan jam janji", targetValue: "Target", realizationValue: "Realisasi",
  metricUnit: "Satuan target", locationLabel: "Label lokasi", latitude: "Latitude",
  longitude: "Longitude", mappingMarkerIcon: "Ikon penanda",
};

export class ApiRequestError extends Error {
  constructor(message: string, public readonly field?: string) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export async function clientApi<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const fieldErrors = payload?.error?.details?.fieldErrors as Record<string, string[]> | undefined;
    const first = fieldErrors && Object.entries(fieldErrors).find(([, messages]) => messages?.length);
    if (first) throw new ApiRequestError(`${fieldLabels[first[0]] ?? first[0]}: ${first[1][0]}`, first[0]);
    throw new ApiRequestError(payload?.error?.message ?? "Permintaan gagal diproses.");
  }
  return payload.data as T;
}
