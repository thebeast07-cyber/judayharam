"use client";

import type { ReactNode } from "react";
import { buildTiers, expectedRtp, type Config, type Force } from "@/lib/engine";
import { SPIN_SOURCE } from "@/lib/source";

const rp = (n: number) => "Rp" + Math.round(n).toLocaleString("id-ID");

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="border-b border-slate-800 py-3">
      <div className="mb-1 text-sm font-medium text-slate-200">{label}</div>
      {children}
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-semibold ${
        on ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-800 text-slate-400"
      }`}
    >
      {on ? "NYALA" : "MATI"}
    </button>
  );
}

const FORCES: { id: Force; label: string }[] = [
  { id: "none", label: "Normal" },
  { id: "lose", label: "Paksa kalah" },
  { id: "win", label: "Paksa menang" },
  { id: "jackpot", label: "Paksa jackpot" },
];

export default function Kitchen({
  cfg,
  setCfg,
  balance,
  onReset,
}: {
  cfg: Config;
  setCfg: (c: Config) => void;
  balance: number;
  onReset: () => void;
}) {
  const set = <K extends keyof Config>(k: K, v: Config[K]) => setCfg({ ...cfg, [k]: v });
  const eff = expectedRtp(buildTiers(cfg, balance)) * 100;
  const oneIn = cfg.jackpotChance > 0 ? Math.round(1 / cfg.jackpotChance) : 0;

  return (
    <section className="mt-4 rounded-2xl border border-red-500/40 bg-slate-900 p-4">
      <h2 className="text-lg font-bold text-red-400">Dapur bandar</h2>
      <p className="text-xs text-slate-500">
        Semua yang lu geser di sini langsung ngubah hasil spin. Pemain biasa nggak pernah lihat panel ini.
      </p>

      <Row label={`RTP diset: ${(cfg.rtp * 100).toFixed(0)}%`} hint={`RTP efektif saat ini: ${eff.toFixed(1)}% (sisanya masuk kantong bandar)`}>
        <input
          type="range"
          min={50}
          max={150}
          value={Math.round(cfg.rtp * 100)}
          onChange={(e) => set("rtp", Number(e.target.value) / 100)}
          className="w-full"
        />
      </Row>

      <Row label={`Pengali jackpot: x${cfg.jackpotMult.toLocaleString("id-ID")}`}>
        <input
          type="number"
          min={1}
          value={cfg.jackpotMult}
          onChange={(e) => set("jackpotMult", Math.max(1, Number(e.target.value) || 1))}
          className="w-40 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
        />
      </Row>

      <Row
        label={`Peluang jackpot: ${oneIn ? `1 dari ${oneIn.toLocaleString("id-ID")} spin` : "nol"}`}
        hint="Geser sendiri, bandar yang nentuin seberapa jarang jackpot keluar."
      >
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(cfg.jackpotChance * 10000)}
          onChange={(e) => set("jackpotChance", Number(e.target.value) / 10000)}
          className="w-full"
        />
      </Row>

      <Row label="Paksa hasil spin berikutnya" hint="Sekali pakai, lalu balik normal.">
        <div className="flex flex-wrap gap-2">
          {FORCES.map((f) => (
            <button
              key={f.id}
              onClick={() => set("force", f.id)}
              className={`rounded-md border px-2 py-1 text-xs ${
                cfg.force === f.id
                  ? "border-sky-400 bg-sky-500/20 text-sky-200"
                  : "border-slate-700 text-slate-300"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </Row>

      <Row
        label="Kalahin pas saldo lagi gede"
        hint={`Kalau saldo di atas ${rp(cfg.rigThreshold)}, peluang menang dipotong dan jackpot dimatiin.`}
      >
        <div className="flex items-center gap-3">
          <Toggle on={cfg.rigWhenRich} onClick={() => set("rigWhenRich", !cfg.rigWhenRich)} />
          <input
            type="number"
            min={0}
            value={cfg.rigThreshold}
            onChange={(e) => set("rigThreshold", Math.max(0, Number(e.target.value) || 0))}
            className="w-36 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
          />
        </div>
      </Row>

      <Row label="Hampir jackpot (near-miss)" hint="Petir sengaja dipajang nyaris sejajar. Rasanya hampir menang, padahal kalah.">
        <Toggle on={cfg.nearMiss} onClick={() => set("nearMiss", !cfg.nearMiss)} />
      </Row>

      <Row
        label="Mode GACOR"
        hint={`Cuma ganti teks "GACOR 98%". Efek ke RTP: nol. RTP efektif tetap ${eff.toFixed(1)}%.`}
      >
        <Toggle on={cfg.gacorLabel} onClick={() => set("gacorLabel", !cfg.gacorLabel)} />
      </Row>

      <Row label="Batas spin per sesi (0 = tanpa batas)">
        <input
          type="number"
          min={0}
          value={cfg.sessionLimit}
          onChange={(e) => set("sessionLimit", Math.max(0, Number(e.target.value) || 0))}
          className="w-28 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
        />
      </Row>

      <Row label="Saldo awal (bohongan)" hint="Berlaku setelah 'Reset sesi'.">
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={10000}
            value={cfg.startBalance}
            onChange={(e) => set("startBalance", Math.max(10000, Number(e.target.value) || 10000))}
            className="w-40 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
          />
          <button onClick={onReset} className="rounded-md border border-slate-600 px-3 py-1 text-xs">
            Reset sesi
          </button>
        </div>
      </Row>

      <div className="pt-3">
        <div className="mb-1 text-sm font-medium text-slate-200">Kode yang jalan</div>
        <pre className="overflow-x-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-300">{SPIN_SOURCE}</pre>
      </div>
    </section>
  );
}
