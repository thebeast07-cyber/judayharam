"use client";

import { REELS, ROWS, SYMBOLS } from "@/lib/engine";

// Urutan simbol yang kelihatan "nge-blur" pas reel lagi muter (cuma tampilan).
const STRIP = [0, 3, 1, 5, 2, 4, 1, 0, 4, 2, 5, 3];

function Cell({ sym, win }: { sym: number; win?: boolean }) {
  return (
    <div className={`reel-cell ${win ? "win-cell" : ""}`}>
      <img src={SYMBOLS[sym].img} alt={SYMBOLS[sym].label} draggable={false} />
    </div>
  );
}

export default function Reels({
  grid,
  stopped,
  hitCount,
}: {
  grid: number[][]; // grid[reel][row]
  stopped: boolean[]; // reel mana yang sudah berhenti
  hitCount: number; // jumlah simbol menang berurutan di payline
}) {
  return (
    <div className="reel-window">
      <div className="relative grid grid-cols-5 gap-2">
        {Array.from({ length: REELS }).map((_, c) => {
          const rot = [...STRIP.slice(c), ...STRIP.slice(0, c)];
          const items = [...rot, ...rot];
          return (
            <div key={c} className="reel">
              {stopped[c] ? (
                <div className="reel-drop">
                  {Array.from({ length: ROWS }).map((_, r) => (
                    <Cell key={r} sym={grid[c][r]} win={r === 1 && c < hitCount} />
                  ))}
                </div>
              ) : (
                <div className="reel-strip">
                  {items.map((s, i) => (
                    <Cell key={i} sym={s} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <div className="payline" />
      </div>
    </div>
  );
}
