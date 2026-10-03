"use client";

export async function clientApi<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(payload?.error?.message ?? "Permintaan gagal diproses.");
  return payload.data as T;
}
