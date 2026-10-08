"use client";

import type { TraceStep } from "@/lib/engine";
import { SPIN_LINES } from "@/lib/source";

export default function AlgoPanel({
  trace,
  active,
  slow,
  onToggleSlow,
  effectNote,
}: {
  trace: TraceStep[];
  active: number; // indeks langkah terakhir yang sudah tampil (-1 = belum ada)
  slow: boolean;
  onToggleSlow: () => void;
  effectNote?: string; // penjelasan soal efek (kilau dan suara) setelah spin selesai
}) {
  const current = active >= 0 ? trace[active] : null;
  const noteByLine = new Map<number, string>();
  if (active >= 0) trace.slice(0, active + 1).forEach((s) => noteByLine.set(s.line, s.note));

  return (
    <section className="rounded-2xl border border-sky-500/30 bg-slate-900 p-4 lg:sticky lg:top-4 lg:self-start">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-sky-300">Algoritmanya</h2>
        <button
          onClick={onToggleSlow}
          className={`rounded-md border px-2 py-1 text-xs ${
            slow
              ? "border-sky-400 bg-sky-500/20 text-sky-200"
              : "border-slate-700 text-slate-300"
          }`}
        >
          Mode pelan: {slow ? "NYALA" : "MATI"}
        </button>
      </div>
      <p className="mb-3 text-xs text-slate-500">
        Tiap spin, baris yang jalan nyala di sini lengkap sama nilainya. Hasilnya udah diputuskan sebelum reel berhenti.
      </p>

      <div className="rounded-lg bg-slate-950 p-2 font-mono text-xs">
        {SPIN_LINES.map((code, i) => {
          const isCurrent = current?.line === i;
          const note = noteByLine.get(i);
          return (
            <div key={i} className={`rounded px-2 py-1 ${isCurrent ? "bg-sky-500/20" : ""}`}>
              <div className="flex gap-2">
                <span className="w-4 select-none text-right text-slate-600">{i + 1}</span>
                <span
                  className={`whitespace-pre-wrap break-words ${
                    isCurrent ? "text-sky-100" : note ? "text-slate-200" : "text-slate-500"
                  }`}
                >
                  {code}
                </span>
              </div>
              {note && (
                <div className={`ml-6 mt-0.5 ${isCurrent ? "text-amber-300" : "text-slate-400"}`}>
                  → {note}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {effectNote && (
        <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
          <div className="mb-1 font-semibold">Soal kilau dan suara barusan</div>
          {effectNote}
        </div>
      )}

      {trace.length === 0 && (
        <p className="mt-3 text-xs text-slate-500">Tekan SPIN buat lihat baris-barisnya jalan.</p>
      )}
      <p className="mt-3 text-xs text-slate-500">
        Nggak ada jam gacor, nggak ada pola. Cuma angka acak lawan peluang yang diset server.
      </p>
    </section>
  );
}
