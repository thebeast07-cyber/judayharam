// Suara sintetis lewat Web Audio API. Nggak ada file audio, jadi nggak ada isu lisensi.
// Sengaja kecil dan pendek: nggak ada fanfare jackpot.

let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const w = window as unknown as { webkitAudioContext?: typeof AudioContext };
    const C = window.AudioContext || w.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(
  freq: number,
  start: number,
  dur: number,
  opts: { type?: OscillatorType; vol?: number; endFreq?: number } = {}
) {
  const c = ac();
  if (!c) return;
  const { type = "sine", vol = 0.05, endFreq } = opts;
  const t0 = c.currentTime + start;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export const sfx = {
  // Dipanggil dari klik tombol (butuh gestur pengguna biar browser ngizinin audio).
  unlock() {
    ac();
  },
  // Reel mulai muter: dengung rendah selama `seconds`.
  spin(seconds: number) {
    tone(90, 0, seconds, { type: "sawtooth", vol: 0.018, endFreq: 150 });
  },
  // Satu reel berhenti.
  stop() {
    tone(220, 0, 0.06, { type: "square", vol: 0.035, endFreq: 110 });
  },
  // Menang: makin gede pengali, makin banyak nada (maksimal 4, tanpa fanfare).
  win(mult: number) {
    const notes = mult < 2 ? [523, 659] : mult < 20 ? [523, 659, 784] : [523, 659, 784, 1047];
    notes.forEach((f, i) => tone(f, i * 0.09, 0.18, { type: "triangle", vol: 0.05 }));
  },
  // Kalah: nada rendah turun.
  lose() {
    tone(190, 0, 0.28, { type: "sine", vol: 0.04, endFreq: 120 });
  },
};
