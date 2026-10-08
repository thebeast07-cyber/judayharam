"use client";

import { useState } from "react";
import {
  DEFAULT_CONFIG,
  REELS,
  ROWS,
  SYMBOLS,
  idleGrid,
  randomGrid,
  spin,
  type Config,
} from "@/lib/engine";
import Kitchen from "./Kitchen";

const rp = (n: number) => "Rp" + Math.round(n).toLocaleString("id-ID");

type Stats = { spins: number; bet: number; won: number };
const ZERO: Stats = { spins: 0, bet: 0, won: 0 };
const BETS = [1_000, 5_000, 10_000, 50_000];

function Spark({ data }: { data: number[] }) {
  const step = Math.max(1, Math.ceil(data.length / 300));
  const pts = data.filter((_, i) => i % step === 0);
  const max = Math.max(...pts, 1);
  const min = Math.min(...pts, 0);
  const w = 300;
  const h = 80;
  const d = pts
    .map((v, i) => {
      const x = (i / Math.max(pts.length - 1, 1)) * w;
      const y = h - ((v - min) / (max - min || 1)) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-20 w-full text-sky-400">
      <polyline
        points={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Game() {
  const [cfg, setCfg] = useState<Config>(DEFAULT_CONFIG);
  const [balance, setBalance] = useState(DEFAULT_CONFIG.startBalance);
  const [grid, setGrid] = useState<number[][]>(idleGrid());
  const [hitCount, setHitCount] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [stats, setStats] = useState<Stats>(ZERO);
  const [history, setHistory] = useState<number[]>([DEFAULT_CONFIG.startBalance]);
  const [lastWin, setLastWin] = useState(0);
  const [showRecap, setShowRecap] = useState(false);
  const [showKitchen, setShowKitchen] = useState(false);

  const canSpin = !spinning && balance >= cfg.bet && !showRecap;

  function resetSession() {
    setBalance(cfg.startBalance);
    setStats(ZERO);
    setHistory([cfg.startBalance]);
    setGrid(idleGrid());
    setHitCount(0);
    setLastWin(0);
    setShowRecap(false);
  }

  function doSpin() {
    if (!canSpin) return;
    const res = spin(cfg, balance, cfg.bet);
    const bet = cfg.bet;
    const newBal = balance - bet + res.win;
    const willEnd = cfg.sessionLimit > 0 && stats.spins + 1 >= cfg.sessionLimit;

    setSpinning(true);
    setHitCount(0);
    setLastWin(0);
    setBalance(balance - bet);

    const t = setInterval(() => setGrid(randomGrid()), 70);
    setTimeout(() => {
      clearInterval(t);
      setGrid(res.grid);
      setHitCount(res.hitCount);
      setLastWin(res.win);
      setBalance(newBal);
      setStats((s) => ({ spins: s.spins + 1, bet: s.bet + bet, won: s.won + res.win }));
      setHistory((h) => [...h, newBal]);
      setCfg((c) => (c.force === "none" ? c : { ...c, force: "none" }));
      setSpinning(false);
      if (willEnd || newBal < bet) setShowRecap(true);
    }, 900);
  }

  // Simulasi cepat: nunjukin hasil jangka panjang tanpa nunggu animasi.
  function runBatch(n: number) {
    if (spinning) return;
    const c: Config = { ...cfg, force: "none" };
    let bal = balance;
    let bet = 0;
    let won = 0;
    let spins = 0;
    let lastGrid = grid;
    let lastHit = 0;
    const hist: number[] = [];
    while (spins < n && bal >= cfg.bet) {
      const r = spin(c, bal, cfg.bet);
      bal += r.win - cfg.bet;
      bet += cfg.bet;
      won += r.win;
      spins++;
      hist.push(bal);
      lastGrid = r.grid;
      lastHit = r.hitCount;
    }
    setBalance(bal);
    setGrid(lastGrid);
    setHitCount(lastHit);
    setStats((s) => ({ spins: s.spins + spins, bet: s.bet + bet, won: s.won + won }));
    setHistory((h) => [...h, ...hist]);
    setShowRecap(true);
  }

  const net = stats.won - stats.bet;
  const realRtp = stats.bet > 0 ? (stats.won / stats.bet) * 100 : 0;

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-center text-sm text-amber-200">
        Demo edukasi. Nggak ada deposit, nggak ada WD, uangnya bohongan.
      </div>

      <header className="mb-6 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight text-red-500">Judi Haram</h1>
        <p className="mt-2 text-sm text-slate-400">
          Ini cara kerja web slot dari dalam. Coba main, lalu buka dapurnya.
        </p>
        {cfg.gacorLabel && (
          <div className="mx-auto mt-3 inline-block rounded-full bg-emerald-500/20 px-4 py-1 text-sm font-semibold text-emerald-300">
            GACOR 98%
          </div>
        )}
      </header>

      <section className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
        <div className="mb-3 flex items-center justify-between text-sm">
          <div>
            <div className="text-slate-400">Saldo (bohongan)</div>
            <div className="text-xl font-bold">{rp(balance)}</div>
          </div>
          <div className="text-right">
            <div className="text-slate-400">Menang terakhir</div>
            <div className={`text-xl font-bold ${lastWin > 0 ? "text-emerald-400" : "text-slate-500"}`}>
              {rp(lastWin)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-2 rounded-xl bg-slate-950 p-2">
          {Array.from({ length: ROWS * REELS }).map((_, i) => {
            const r = Math.floor(i / REELS);
            const c = i % REELS;
            const hit = !spinning && r === 1 && c < hitCount;
            return (
              <div
                key={i}
                className={[
                  "flex aspect-square items-center justify-center rounded-lg border text-3xl sm:text-4xl",
                  r === 1 ? "border-slate-600 bg-slate-800" : "border-slate-800 bg-slate-900",
                  hit ? "border-emerald-400 bg-emerald-500/20" : "",
                  spinning ? "opacity-80" : "",
                ].join(" ")}
              >
                {SYMBOLS[grid[c][r]].icon}
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-sm text-slate-400">Taruhan</span>
          {BETS.map((b) => (
            <button
              key={b}
              onClick={() => setCfg({ ...cfg, bet: b })}
              className={`rounded-md border px-2 py-1 text-xs ${
                cfg.bet === b
                  ? "border-sky-400 bg-sky-500/20 text-sky-200"
                  : "border-slate-700 text-slate-300"
              }`}
            >
              {rp(b)}
            </button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <button
            onClick={doSpin}
            disabled={!canSpin}
            className="rounded-lg bg-sky-600 px-4 py-3 font-semibold text-white disabled:opacity-40"
          >
            {spinning ? "Muter..." : "SPIN"}
          </button>
          <button
            onClick={() => runBatch(1000)}
            disabled={spinning || balance < cfg.bet}
            className="rounded-lg border border-slate-600 px-4 py-3 text-sm text-slate-200 disabled:opacity-40"
          >
            Simulasi 1.000 spin
          </button>
          <button
            onClick={() => runBatch(100000)}
            disabled={spinning || balance < cfg.bet}
            className="rounded-lg border border-red-500/60 px-4 py-3 text-sm text-red-300 disabled:opacity-40"
          >
            Main sampai abis
          </button>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
          <span>
            Spin sesi ini: {stats.spins}
            {cfg.sessionLimit > 0 ? ` / ${cfg.sessionLimit}` : ""}
          </span>
          <button
            onClick={() => setShowKitchen((v) => !v)}
            className="rounded-md border border-slate-600 px-3 py-1 text-slate-200"
          >
            {showKitchen ? "Tutup Dapur" : "Intip Dapur"}
          </button>
        </div>
      </section>

      {showKitchen && (
        <Kitchen cfg={cfg} setCfg={setCfg} balance={balance} onReset={resetSession} />
      )}

      <footer className="mt-8 text-center text-xs text-slate-500">
        Butuh bantuan buat berhenti? Hubungi Halo Kemkes 1500-567 atau psikolog/puskesmas terdekat.
      </footer>

      {showRecap && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5">
            <h2 className="text-xl font-bold">Rekap sesi</h2>
            <div className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-slate-400">Jumlah spin</span><span>{stats.spins.toLocaleString("id-ID")}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Total taruhan</span><span>{rp(stats.bet)}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Total menang</span><span>{rp(stats.won)}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">RTP nyata sesi ini</span><span>{realRtp.toFixed(1)}%</span></div>
              <div className="flex justify-between font-semibold">
                <span>{net < 0 ? "Bandar untung" : "Selisih buat lu"}</span>
                <span className={net < 0 ? "text-red-400" : "text-emerald-400"}>{rp(Math.abs(net))}</span>
              </div>
            </div>
            <div className="mt-3 rounded-lg bg-slate-950 p-2">
              <Spark data={history} />
            </div>
            <p className="mt-3 text-sm text-slate-300">
              {net < 0
                ? "Ini yang terjadi tiap kali. Bandar nggak perlu curang, matematikanya udah mihak ke mereka."
                : "Kebetulan lu lagi untung. Coba 'Main sampai abis' dan lihat ujungnya ke mana."}
            </p>
            <div className="mt-4 flex gap-2">
              <button onClick={resetSession} className="flex-1 rounded-lg bg-sky-600 px-4 py-2 font-semibold">
                Ulang dari awal
              </button>
              <button
                onClick={() => {
                  setShowRecap(false);
                  setShowKitchen(true);
                }}
                className="flex-1 rounded-lg border border-slate-600 px-4 py-2 text-sm"
              >
                Intip Dapur
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
