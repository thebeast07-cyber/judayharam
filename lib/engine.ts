// Mesin slot bohongan. Gambar simbol ada di public/symbols/ (gampang diganti,
// cukup timpa file dengan nama yang sama). Urutan = tingkat hadiah, terakhir = jackpot.

export const REELS = 5;
export const ROWS = 3;

export const SYMBOLS = [
  { img: "/symbols/cherry.webp", label: "Ceri" },
  { img: "/symbols/lemon.webp", label: "Lemon" },
  { img: "/symbols/grape.webp", label: "Anggur" },
  { img: "/symbols/bell.webp", label: "Lonceng" },
  { img: "/symbols/bar.webp", label: "BAR" },
  { img: "/symbols/seven.webp", label: "Tujuh (Jackpot)" },
] as const;

const JACKPOT_SYM = SYMBOLS.length - 1;

export type Force = "none" | "lose" | "win" | "jackpot";

export interface Config {
  rtp: number; // 0.5 - 1.5
  jackpotMult: number; // pengali jackpot
  jackpotChance: number; // peluang jackpot per spin (0 - 0.01)
  rigWhenRich: boolean; // bandar kecilin peluang menang saat saldo gede
  rigThreshold: number;
  nearMiss: boolean; // sering kasih "hampir jackpot"
  gacorLabel: boolean; // label GACOR palsu, nggak ngubah apa-apa
  sessionLimit: number; // 0 = tanpa batas
  force: Force; // paksa hasil spin berikutnya (sekali pakai)
  startBalance: number;
  bet: number;
}

export const DEFAULT_CONFIG: Config = {
  rtp: 0.94,
  jackpotMult: 500,
  jackpotChance: 0.0005,
  rigWhenRich: false,
  rigThreshold: 2_000_000,
  nearMiss: false,
  gacorLabel: false,
  sessionLimit: 30,
  force: "none",
  startBalance: 1_000_000,
  bet: 10_000,
};

export interface Tier {
  sym: number;
  mult: number;
  p: number;
}

const BASE_TIERS: Tier[] = [
  { sym: 0, mult: 0.5, p: 0.18 },
  { sym: 1, mult: 1, p: 0.1 },
  { sym: 2, mult: 2, p: 0.06 },
  { sym: 3, mult: 5, p: 0.025 },
  { sym: 4, mult: 20, p: 0.004 },
];

// Peluang tiap hadiah dihitung dari RTP yang diset bandar.
export function buildTiers(cfg: Config, balance: number): Tier[] {
  const jpP = cfg.jackpotChance;
  const jpEV = jpP * cfg.jackpotMult;
  const remaining = Math.max(0, cfg.rtp - jpEV);
  const baseEV = BASE_TIERS.reduce((s, t) => s + t.p * t.mult, 0);
  const baseSum = BASE_TIERS.reduce((s, t) => s + t.p, 0);
  let k = remaining / baseEV;
  const maxSum = 1 - jpP - 0.02;
  if (baseSum * k > maxSum) k = maxSum / baseSum;

  const rigged = cfg.rigWhenRich && balance > cfg.rigThreshold;
  const rig = rigged ? 0.3 : 1;

  const tiers = BASE_TIERS.map((t) => ({ ...t, p: t.p * k * rig }));
  tiers.push({ sym: JACKPOT_SYM, mult: cfg.jackpotMult, p: rigged ? 0 : jpP });
  return tiers;
}

export function expectedRtp(tiers: Tier[]): number {
  return tiers.reduce((s, t) => s + t.p * t.mult, 0);
}

export interface SpinResult {
  grid: number[][]; // grid[reel][row]
  mult: number;
  win: number;
  hitCount: number; // berapa simbol berurutan di payline (0 = kalah)
  jackpot: boolean;
  nearMiss: boolean;
  trace: TraceStep[]; // langkah keputusan, dipakai panel algoritma
}

export interface TraceStep {
  line: number; // indeks baris di SPIN_LINES (lib/source.ts)
  note: string; // nilai variabel atau keputusan di langkah ini
}

const FORCE_LABEL: Record<Force, string> = {
  none: "",
  lose: "KALAH",
  win: "MENANG",
  jackpot: "JACKPOT",
};

function sumP(tiers: Tier[]): number {
  return tiers.reduce((s, t) => s + t.p, 0);
}

function randSym(rng: () => number, exclude = -1): number {
  let s = Math.floor(rng() * SYMBOLS.length);
  while (s === exclude) s = Math.floor(rng() * SYMBOLS.length);
  return s;
}

export function randomGrid(rng: () => number = Math.random): number[][] {
  return Array.from({ length: REELS }, () =>
    Array.from({ length: ROWS }, () => randSym(rng))
  );
}

export function idleGrid(): number[][] {
  return [
    [0, 1, 2],
    [1, 2, 3],
    [2, 3, 4],
    [3, 4, 0],
    [4, 0, 1],
  ];
}

// Hasil DIPUTUSKAN dulu, baru tampilan reel dibuat menyesuaikan.
export function spin(
  cfg: Config,
  balance: number,
  bet: number,
  rng: () => number = Math.random
): SpinResult {
  const tiers = buildTiers(cfg, balance);
  const pNormal = sumP(buildTiers({ ...cfg, rigWhenRich: false }, balance));
  const pFinal = sumP(tiers);
  const r = rng(); // angka acak yang jadi penentu
  let hit: Tier | null = null;

  if (cfg.force === "jackpot") {
    hit = tiers[tiers.length - 1];
  } else if (cfg.force === "win") {
    hit = tiers[Math.floor(rng() * (tiers.length - 1))];
  } else if (cfg.force === "none") {
    let x = r;
    for (const t of tiers) {
      if (x < t.p) {
        hit = t;
        break;
      }
      x -= t.p;
    }
  }

  const grid = randomGrid(rng);
  let hitCount = 0;
  let nearMiss = false;

  if (hit) {
    const x = rng();
    hitCount = x < 0.7 ? 3 : x < 0.95 ? 4 : 5;
    for (let i = 0; i < REELS; i++) {
      if (i < hitCount) grid[i][1] = hit.sym;
      else if (i === hitCount) grid[i][1] = randSym(rng, hit.sym);
    }
  } else {
    // pastikan payline tengah beneran kalah
    while (grid[0][1] === grid[1][1] && grid[1][1] === grid[2][1]) {
      grid[2][1] = randSym(rng);
    }
    if (cfg.nearMiss && rng() < 0.4) {
      nearMiss = true;
      for (const i of [0, 1, 2]) grid[i][0] = JACKPOT_SYM; // angka 7 "nyaris" sejajar
      if (grid[2][1] === JACKPOT_SYM) grid[2][1] = randSym(rng, JACKPOT_SYM);
    }
  }

  const mult = hit ? hit.mult : 0;
  const win = Math.round(bet * mult);

  // Jejak keputusan, baris-barisnya sesuai SPIN_LINES di lib/source.ts
  const pct = (p: number) => (p * 100).toFixed(1) + "%";
  const rigged = pFinal < pNormal - 1e-9;
  const forced = cfg.force !== "none";
  const trace: TraceStep[] = [
    { line: 1, note: `r = ${r.toFixed(4)}` },
    { line: 2, note: `peluang = ${pct(pNormal)} (dari RTP ${(cfg.rtp * 100).toFixed(0)}%)` },
    {
      line: 3,
      note: rigged
        ? `saldo Rp${Math.round(balance).toLocaleString("id-ID")} lewat batas, peluang dipotong jadi ${pct(pFinal)}`
        : cfg.rigWhenRich
          ? "saldo belum lewat batas, dilewati"
          : "fitur mati, dilewati",
    },
    {
      line: 4,
      note: forced ? `bandar paksa hasil: ${FORCE_LABEL[cfg.force]}` : "nggak ada paksaan, lanjut",
    },
  ];
  if (!forced) {
    if (hit) {
      trace.push({
        line: 5,
        note: `${r.toFixed(4)} < ${pct(pFinal)}? ya. MENANG x${hit.mult} = Rp${win.toLocaleString("id-ID")}`,
      });
    } else {
      trace.push({ line: 5, note: `${r.toFixed(4)} < ${pct(pFinal)}? tidak` });
      trace.push({ line: 6, note: "KALAH, dapat Rp0" });
    }
  }
  trace.push({ line: 8, note: "hasil udah pasti, reel baru digambar sekarang" });

  return {
    grid,
    mult,
    win,
    hitCount,
    jackpot: !!hit && hit.sym === JACKPOT_SYM,
    nearMiss,
    trace,
  };
}
