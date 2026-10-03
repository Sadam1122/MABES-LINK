"use client";
import { useMemo, useState } from "react";

const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});
export function FundingCalculator() {
  const [balance, setBalance] = useState(0);
  const [margin, setMargin] = useState(0);
  const [days, setDays] = useState(14);
  const [cost, setCost] = useState(0);
  const gross = useMemo(
    () => (balance * (margin / 100) * days) / 365,
    [balance, margin, days],
  );
  return (
    <div className="card p-5 sm:p-6">
      <div className="mb-5">
        <h2 className="text-lg font-black">Simulasi pendanaan</h2>
        <p className="mt-1 text-sm text-slate-500">
          Bukan realisasi laba. Input dan asumsi pengguna ditampilkan terpisah.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Saldo rata-rata tambahan neto</label>
          <input
            className="field"
            type="number"
            min="0"
            value={balance || ""}
            onChange={(e) => setBalance(Number(e.target.value))}
            placeholder="Rp"
          />
        </div>
        <div>
          <label className="label">Margin tahunan (%)</label>
          <input
            className="field"
            type="number"
            min="0"
            step="0.01"
            value={margin || ""}
            onChange={(e) => setMargin(Number(e.target.value))}
          />
        </div>
        <div>
          <label className="label">Jumlah hari</label>
          <input
            className="field"
            type="number"
            min="1"
            max="365"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          />
        </div>
        <div>
          <label className="label">Biaya terpisah</label>
          <input
            className="field"
            type="number"
            min="0"
            value={cost || ""}
            onChange={(e) => setCost(Number(e.target.value))}
          />
        </div>
      </div>
      <div className="mt-5 grid gap-3 rounded-2xl bg-slate-50 p-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Potensi margin bruto
          </p>
          <p className="mt-1 text-xl font-black text-brand">
            {rupiah.format(gross)}
          </p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Setelah biaya input
          </p>
          <p className="mt-1 text-xl font-black text-slate-900">
            {rupiah.format(gross - cost)}
          </p>
        </div>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">
        Rumus: saldo rata-rata tambahan neto × margin tahunan × hari ÷ 365. CASA
        bukan laba. Transfer internal Mandiri bukan dana baru; waktu hemat bukan
        penghematan gaji.
      </p>
    </div>
  );
}
