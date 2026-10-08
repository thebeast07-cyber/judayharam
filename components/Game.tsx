"use client";

import { useEffect, useState, type ReactNode } from "react";
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
const AUTO_STEPS = [10, 25, 50];

// 10.000 -> "10rb", 1.500.000 -> "1,5jt"
function short(n: number): string {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `${(a / 1_000_000).toFixed(1).replace(/\.0$/, "").replace(".", ",")}jt`;
  if (a >= 1_000) return `${Math.round(a / 1_000)}rb`;
  return String(a);
}

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

function Lcd({
  label,
  children,
  accent,
  className = "",
}: {
  label: string;
  children: ReactNode;
  accent?: boolean;
  className?: string;
}) {
  return (
    <div className={`lcd px-2 py-1 sm:px-3 sm:py-1.5 ${className}`}>
      <div className="text-[9px] uppercase tracking-widest text-amber-200/70 sm:text-[10px]">{label}</div>
      <div
        className={`whitespace-nowrap font-mono text-[12px] font-bold sm:text-base lg:text-lg ${
          accent ? "text-emerald-300" : "text-amber-100"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function Pill({ on, onClick, children }: { on?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap rounded-md border px-3 py-2 text-xs lg:py-1.5 ${
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
  const [auto, setAuto] = useState(false);
  const [autoLeft, setAutoLeft] = useState(0);
  const [autoMenu, setAutoMenu] = useState(false);
  const [results, setResults] = useState<{ win: number; bet: number }[]>([]); // terbaru di depan

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
    setAuto(false);
    setResults([]);
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
      setResults((r) => [{ win: res.win, bet }, ...r].slice(0, 20));
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

  function startAuto(n: number) {
    if (!canSpin) return;
    setAutoMenu(false);
    setAutoLeft(n);
    setAuto(true);
  }

  function stopAuto() {
    setAuto(false);
  }

  // Spin otomatis: lanjut tiap spin kelar, berhenti kalau jatah habis,
  // saldo nggak cukup, atau rekap sesi muncul (batas spin per sesi).
  useEffect(() => {
    if (!auto) return;
    if (showRecap || autoLeft <= 0 || balance < cfg.bet) {
      setAuto(false);
      return;
    }
    if (spinning) return;
    const t = setTimeout(() => {
      setAutoLeft((n) => n - 1);
      doSpin();
    }, 450);
    return () => clearTimeout(t);
  });

  const net = stats.won - stats.bet;
  const realRtp = stats.bet > 0 ? (stats.won / stats.bet) * 100 : 0;
  const spinCount = `${stats.spins}${cfg.sessionLimit > 0 ? `/${cfg.sessionLimit}` : ""}`;
  const ticker =
    active >= 0 && trace[active] ? `› ${trace[active].note}` : "Tekan SPIN. Langkah algoritmanya muncul di sini.";

  return (
    <main className={`mx-auto max-w-6xl px-3 pb-40 pt-3 sm:px-4 lg:pb-6 lg:pt-6 ${sweet ? "" : "plain"}`}>
      <div className="mb-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-center text-xs text-amber-200 sm:text-sm">
        Demo edukasi. Nggak ada deposit, nggak ada WD, uangnya bohongan.
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div>
          <div className="gold-frame mx-auto max-w-[720px]">
            <div className="rounded-[16px] bg-[#070f24]/95 p-2 sm:p-4">
              {/* judul */}
              <div className="mb-2 flex items-center justify-between gap-3 sm:mb-3">
                <Lcd label="Saldo" className="hidden sm:block">
                  {rp(balance)}
                </Lcd>
                <div className="mx-auto text-center">
                  <h1 className="gold-text text-3xl leading-none sm:text-5xl">JUDI HARAM</h1>
                  {cfg.gacorLabel && (
                    <div className="mt-1 inline-block rounded-full bg-emerald-500/20 px-3 py-0.5 text-xs font-semibold text-emerald-300">
                      GACOR 98%
                    </div>
                  )}
                </div>
                <Lcd label="Spin" className="hidden sm:block">
                  {spinCount}
                </Lcd>
              </div>

              {/* ringkasan ringkas khusus layar kecil */}
              <div className="mb-2 grid grid-cols-3 gap-1.5 sm:hidden">
                <Lcd label="Saldo">{rp(balance)}</Lcd>
                <Lcd label="Menang" accent={lastWin > 0} className={spinning ? "opacity-50" : ""}>
                  {rp(lastWin)}
                </Lcd>
                <Lcd label="Spin">{spinCount}</Lcd>
              </div>

              <Reels grid={grid} stopped={stopped} hitCount={hitCount} />

              {/* ticker algoritma, di desktop sudah ada panel samping */}
              <div className="mt-2 min-h-[2.5rem] rounded-lg bg-slate-950/80 px-3 py-2 font-mono text-[11px] leading-snug text-sky-200 lg:hidden">
                {ticker}
              </div>

              {/* riwayat per spin + total sesi: yang nggak pernah ditampilin mesin slot asli */}
              <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-slate-950/60 px-3 py-1.5 text-[11px]">
                <div className="flex min-w-0 flex-1 gap-1 overflow-hidden">
                  {results.length === 0 ? (
                    <span className="text-slate-500">Riwayat spin muncul di sini</span>
                  ) : (
                    results.slice(0, 8).map((r, i) => {
                      const d = r.win - r.bet;
                      return (
                        <span
                          key={i}
                          className={`shrink-0 rounded px-1.5 py-0.5 font-mono font-semibold ${
                            d > 0
                              ? "bg-emerald-500/20 text-emerald-300"
                              : d < 0
                                ? "bg-red-500/20 text-red-300"
                                : "bg-slate-700/60 text-slate-300"
                          }`}
                        >
                          {d === 0 ? "0" : `${d > 0 ? "+" : "−"}${short(d)}`}
                        </span>
                      );
                    })
                  )}
                </div>
                <div className={`shrink-0 font-mono font-bold ${net < 0 ? "text-red-400" : "text-emerald-300"}`}>
                  Total {net < 0 ? "−" : "+"}
                  {rp(Math.abs(net))}
                </div>
              </div>

              {/* bar kontrol: nempel di bawah layar di HP, nyatu di bingkai di desktop */}
              <div className="fixed inset-x-0 bottom-0 z-40 border-t border-amber-500/30 bg-[#070f24]/95 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur lg:static lg:mt-3 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
                <div className="mx-auto flex max-w-[720px] items-center gap-2 sm:gap-3">
                  <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-3">
                    <Lcd
                      label="Menang"
                      accent={lastWin > 0}
                      className={`hidden sm:block ${spinning ? "opacity-50" : ""}`}
                    >
                      {rp(lastWin)}
                    </Lcd>
                    <Lcd label="Jackpot" className="hidden sm:block">
                      {rp(cfg.jackpotMult * cfg.bet)}
                    </Lcd>
                    <div className="lcd px-2 py-1 sm:py-1.5">
                      <div className="text-[9px] uppercase tracking-widest text-amber-200/70 sm:text-[10px]">
                        Total bet
                      </div>
                      <div className="flex items-center justify-between gap-1">
                        <button
                          onClick={() => changeBet(-1)}
                          disabled={spinning}
                          className="h-8 w-8 rounded-full border border-amber-400/60 text-lg leading-none text-amber-200 disabled:opacity-40 lg:h-6 lg:w-6 lg:text-base"
                          aria-label="Kurangi taruhan"
                        >
                          −
                        </button>
                        <span className="font-mono text-sm font-bold text-amber-100">{rp(cfg.bet)}</span>
                        <button
                          onClick={() => changeBet(1)}
                          disabled={spinning}
                          className="h-8 w-8 rounded-full border border-amber-400/60 text-lg leading-none text-amber-200 disabled:opacity-40 lg:h-6 lg:w-6 lg:text-base"
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
                    className="spin-btn -mt-8 shrink-0 lg:mt-0"
                    aria-label="Spin"
                  >
                    <img src="/ui/spin-button.webp" alt="" draggable={false} className="h-full w-full" />
                    <span className="absolute inset-0 grid place-items-center text-base font-black tracking-wider text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] lg:text-lg">
                      {spinning ? "..." : "SPIN"}
                    </span>
                  </button>

                  {/* Auto: di HP lewat tombol ini, di desktop lewat chip di bawah mesin */}
                  <div className="relative shrink-0 lg:hidden">
                    {auto ? (
                      <button
                        onClick={stopAuto}
                        className="h-12 w-16 rounded-xl border border-sky-400 bg-sky-500/20 text-xs font-bold leading-tight text-sky-200"
                      >
                        Stop
                        <br />
                        {autoLeft}
                      </button>
                    ) : (
                      <button
                        onClick={() => setAutoMenu((v) => !v)}
                        disabled={!canSpin}
                        className="h-12 w-16 rounded-xl border border-slate-500 bg-slate-900 text-xs font-bold text-slate-200 disabled:opacity-40"
                      >
                        Auto
                      </button>
                    )}
                    {autoMenu && !auto && (
                      <div className="absolute bottom-full right-0 mb-2 flex gap-1 rounded-xl border border-slate-600 bg-slate-900 p-1.5 shadow-xl">
                        {AUTO_STEPS.map((n) => (
                          <button
                            key={n}
                            onClick={() => startAuto(n)}
                            className="h-10 w-12 rounded-lg border border-slate-600 text-sm font-bold text-slate-100"
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* chip: scroll samping di HP, rata tengah di desktop */}
          <div className="-mx-3 mt-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:-mx-4 sm:px-4 lg:mx-0 lg:flex-wrap lg:justify-center lg:overflow-visible lg:px-0">
            <div className="hidden lg:block">
              {auto ? (
                <Pill on onClick={stopAuto}>
                  Stop otomatis (sisa {autoLeft})
                </Pill>
              ) : (
                <div className="flex items-center gap-1 rounded-md border border-slate-600 bg-slate-900/70 px-2 py-1 text-xs text-slate-200">
                  <span className="text-slate-400">Otomatis</span>
                  {AUTO_STEPS.map((n) => (
                    <button
                      key={n}
                      onClick={() => startAuto(n)}
                      disabled={!canSpin}
                      className="rounded border border-slate-600 px-2 py-0.5 hover:border-sky-400 disabled:opacity-40"
                    >
                      {n}
                    </button>
                  ))}
                </div>
              )}
            </div>
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
          <div className="max-h-full w-full max-w-md overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-5">
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
              <button onClick={resetSession} className="flex-1 rounded-lg bg-sky-600 px-4 py-3 font-semibold">
                Ulang dari awal
              </button>
              <button
                onClick={() => {
                  setShowRecap(false);
                  setShowKitchen(true);
                }}
                className="flex-1 rounded-lg border border-slate-600 px-4 py-3 text-sm"
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
