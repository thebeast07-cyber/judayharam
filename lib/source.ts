// Baris kode yang tampil di panel algoritma. Indeks baris dipakai trace dari engine,
// jadi kalau urutan di sini berubah, ubah juga nomor `line` di spin() (lib/engine.ts).
export const SPIN_LINES: string[] = [
  "function spin(rtp, bet, saldo) {",
  "  const r = Math.random();",
  "  let peluang = peluangMenang(rtp);      // diatur bandar",
  "  if (saldo > batasKaya) peluang *= 0.3; // kalahin yang lagi kaya",
  "  if (paksa) return paksa;               // tombol rahasia bandar",
  "  if (r < peluang) return bet * pengali;",
  "  return 0;",
  "}",
  "// reel digambar SETELAH hasil di atas keluar",
];
