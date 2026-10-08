"use client";

import { useState, type ReactNode } from "react";
import {
  DEFAULT_CONFIG,
  REELS,
  idleGrid,
  spin,
  type Config,
  type TraceStep,
} from "@/lib/engine";
import { sfx } from "@/lib/sound";
import AlgoPanel from "./AlgoPanel";
import Kitchen from "./Kitchen";
import Reels from "./Reels";

const rp = (n: number) => "Rp" + Math.round(n).toLocaleString("id-ID");

type Stats = { spins: number; bet: number; won: number };
const ZERO: Stats = { spins: 0, bet: 0, won: 0 };
const BETS = [1_000, 5_000, 10_000, 50_000];

function makeNote(win: number, bet: number, rtp: number): string {
  if (win === 0) return "Nggak ada kilau dan nggak ada bunyi menang. Taruhan lu langsung hilang.";
  const net = win - bet;
  if (net < 0) {
    return `Layar nyala dan bunyi "menang", tapi lu tetap rugi ${rp(-net)} di spin ini. Kekalahan yang didandani jadi kemenangan.`;
  }
  if (net === 0) return "Impas. Uang lu balik, tapi lu udah buang satu spin.";
  return `Menang beneran kali ini (+${rp(net)}). Tapi RTP ${(rtp * 100).toFixed(0)}% artinya dalam jangka panjang saldo lu tetap berkurang.`;
}

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
      <polyline points={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

function Lcd({ label, children, accent }: { label: string; children: ReactNode; accent?: boolean }) {
  return (
    <div className="lcd px-3 py-1.5">
      <div className="text-[10px] uppercase tracking-widest text-amber-200/70">{label}</div>
      <div className={`font-mono text-base font-bold sm:text-lg ${accent ? "text-emerald-300" : "text-amber-100"}`}>
        {children}
      </div>
    </div>
  );
}

function Pill({ on, onClick, children }: { on?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md border px-3 py-1.5 text-xs ${
        on ? "border-sky-400 bg-sky-500/20 text-sky-200" : "border-slate-600 bg-slate-900/70 text-slate-200"
      }`}
    >
      {children}
    </button>
  );
}

export default function Game() {
  const [cfg, setCfg] = useState<Config>(DEFAULT_CONFIG);
  const [balance, setBalance] = useState(DEFAULT_CONFIG.startBalance);
  const [grid, setGrid] = useState<number[][]>(idleGrid());
  const [stopped, setStopped] = useState<boolean[]>(Array(REELS).fill(true));
  const [hitCount, setHitCount] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [stats, setStats] = useState<Stats>(ZERO);
  const [history, setHistory] = useState<number[]>([DEFAULT_CONFIG.startBalance]);
  const [lastWin, setLastWin] = useState(0);
  const [showRecap, setShowRecap] = useState(false);
  const [showKitchen, setShowKitchen] = useState(false);
  const [trace, setTrace] = useState<TraceStep[]>([]);
  const [active, setActive] = useState(-1);
  const [slow, setSlow] = useState(false);
  const [sound, setSound] = useState(false); // mati dulu sampai pengguna sendiri yang nyalain
  const [sweet, setSweet] = useState(true); // "pemanis": kilau, glow, dan suara
  const [effectNote, setEffectNote] = useState("");

  const canSpin = !spinning && balance >= cfg.bet && !showRecap;

  function resetSession() {
    setBalance(cfg.startBalance);
    setStats(ZERO);
    setHistory([cfg.startBalance]);
    setGrid(idleGrid());
    setStopped(Array(REELS).fill(true));
    setHitCount(0);
    setLastWin(0);
    setTrace([]);
    setActive(-1);
    setEffectNote("");
    setShowRecap(false);
  }

  function changeBet(dir: 1 | -1) {
    if (spinning) return;
    const i = BETS.indexOf(cfg.bet);
    const next = BETS[Math.min(BETS.length - 1, Math.max(0, i + dir))];
    setCfg({ ...cfg, bet: next });
  }

  function doSpin() {
    if (!canSpin) return;
    const res = spin(cfg, balance, cfg.bet);
    const bet = cfg.bet;
    const rtp = cfg.rtp;
    const newBal = balance - bet + res.win;
    const willEnd = cfg.sessionLimit > 0 && stats.spins + 1 >= cfg.sessionLimit;
    const audible = sound && sweet;

    // Urutan: baris algoritma nyala satu-satu dulu, baru reel berhenti satu-satu.
    const stepMs = slow ? 550 : 130;
    const gap = slow ? 420 : 170;
    const traceEnd = res.trace.length * stepMs + 250;
    const total = traceEnd + (REELS - 1) * gap + 160;

    setSpinning(true);
    setHitCount(0);
    setLastWin(0);
    setEffectNote("");
    setBalance(balance - bet);
    setGrid(res.grid);
    setStopped(Array(REELS).fill(false));
    setTrace(res.trace);
    setActive(-1);
    if (audible) sfx.spin(traceEnd / 1000 + 0.2);

    res.trace.forEach((_, i) => setTimeout(() => setActive(i), 60 + i * stepMs));
    for (let c = 0; c < REELS; c++) {
      setTimeout(() => {
        setStopped((s) => s.map((v, j) => (j === c ? true : v)));
        if (audible) sfx.stop();
      }, traceEnd + c * gap);
    }

    setTimeout(() => {
      setHitCount(res.hitCount);
      setLastWin(res.win);
      setBalance(newBal);
      setStats((s) => ({ spins: s.spins + 1, bet: s.bet + bet, won: s.won + res.win }));
      setHistory((h) => [...h, newBal]);
      setCfg((c) => (c.force === "none" ? c : { ...c, force: "none" }));
      setEffectNote(makeNote(res.win, bet, rtp));
      setSpinning(false);
      if (audible) {
        if (res.win > 0) sfx.win(res.mult);
        else sfx.lose();
      }
      if (willEnd || newBal < bet) setShowRecap(true);
    }, total);
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
    setStopped(Array(REELS).fill(true));
    setHitCount(lastHit);
    setStats((s) => ({ spins: s.spins + spins, bet: s.bet + bet, won: s.won + won }));
    setHistory((h) => [...h, ...hist]);
    setShowRecap(true);
  }

  const net = stats.won - stats.bet;
  const realRtp = stats.bet > 0 ? (stats.won / stats.bet) * 100 : 0;

  return (
    <main className={`mx-auto max-w-6xl px-4 py-6 ${sweet ? "" : "plain"}`}>
      <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-center text-sm text-amber-200">
        Demo edukasi. Nggak ada deposit, nggak ada WD, uangnya bohongan.
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div>
          <div className="gold-frame mx-auto max-w-[720px]">
            <div className="rounded-[16px] bg-[#070f24]/95 p-3 sm:p-4">
              {/* bar atas */}
              <div className="mb-3 flex items-center justify-between gap-3">
                <Lcd label="Saldo">{rp(balance)}</Lcd>
                <div className="text-center">
                  <h1 className="gold-text text-3xl leading-none sm:text-5xl">JUDI HARAM</h1>
                  {cfg.gacorLabel && (
                    <div className="mt-1 inline-block rounded-full bg-emerald-500/20 px-3 py-0.5 text-xs font-semibold text-emerald-300">
                      GACOR 98%
                    </div>
                  )}
                </div>
                <Lcd label="Spin">
                  {stats.spins}
                  {cfg.sessionLimit > 0 ? `/${cfg.sessionLimit}` : ""}
                </Lcd>
              </div>

              <Reels grid={grid} stopped={stopped} hitCount={hitCount} />

              {/* bar bawah */}
              <div className="mt-3 grid grid-cols-1 items-center gap-3 sm:grid-cols-[1fr_auto]">
                <div className="grid grid-cols-3 gap-2">
                  <Lcd label="Menang" accent={lastWin > 0}>
                    {rp(lastWin)}
                  </Lcd>
                  <Lcd label="Jackpot">{rp(cfg.jackpotMult * cfg.bet)}</Lcd>
                  <div className="lcd px-2 py-1.5">
                    <div className="text-[10px] uppercase tracking-widest text-amber-200/70">Total bet</div>
                    <div className="flex items-center justify-between gap-1">
                      <button
                        onClick={() => changeBet(-1)}
                        disabled={spinning}
                        className="h-6 w-6 rounded-full border border-amber-400/60 text-amber-200 disabled:opacity-40"
                        aria-label="Kurangi taruhan"
                      >
                        −
                      </button>
                      <span className="font-mono text-sm font-bold text-amber-100">{rp(cfg.bet)}</span>
                      <button
                        onClick={() => changeBet(1)}
                        disabled={spinning}
                        className="h-6 w-6 rounded-full border border-amber-400/60 text-amber-200 disabled:opacity-40"
                        aria-label="Tambah taruhan"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  onClick={doSpin}
                  disabled={!canSpin}
                  className="spin-btn mx-auto"
                  aria-label="Spin"
                >
                  <img src="/ui/spin-button.webp" alt="" draggable={false} className="h-full w-full" />
                  <span className="absolute inset-0 grid place-items-center text-lg font-black tracking-wider text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
                    {spinning ? "..." : "SPIN"}
                  </span>
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Pill onClick={() => runBatch(1000)}>Simulasi 1.000 spin</Pill>
            <Pill onClick={() => runBatch(100000)}>Main sampai abis</Pill>
            <Pill
              on={sound}
              onClick={() => {
                if (!sound) sfx.unlock();
                setSound((v) => !v);
              }}
            >
              Suara: {sound ? "NYALA" : "MATI"}
            </Pill>
            <Pill on={sweet} onClick={() => setSweet((v) => !v)}>
              Pemanis: {sweet ? "NYALA" : "MATI"}
            </Pill>
            <Pill on={showKitchen} onClick={() => setShowKitchen((v) => !v)}>
              {showKitchen ? "Tutup Dapur" : "Intip Dapur"}
            </Pill>
          </div>

          {showKitchen && (
            <Kitchen cfg={cfg} setCfg={setCfg} balance={balance} onReset={resetSession} />
          )}
        </div>

        <AlgoPanel
          trace={trace}
          active={active}
          slow={slow}
          onToggleSlow={() => setSlow((v) => !v)}
          effectNote={effectNote}
        />
      </div>

      <footer className="mt-8 text-center text-xs text-slate-400">
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
