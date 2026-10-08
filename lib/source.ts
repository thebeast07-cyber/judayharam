// Cuplikan inti logika yang ditampilkan di panel "Intip Dapur".
export const SPIN_SOURCE = [
  "// Inti logikanya. Cuma segini.",
  "function spin(rtp, bet) {",
  "  const r = Math.random();              // angka acak 0..1",
  "  const peluang = hitungDariRTP(rtp);   // diatur bandar, bukan pemain",
  "  if (r < peluang) return bet * pengali; // menang",
  "  return 0;                              // kalah",
  "}",
  "",
  "// Hasil sudah diputuskan SEBELUM reel muter.",
  "// Animasi muter itu cuma pajangan.",
  "// Nggak ada jam gacor, nggak ada pola. Cuma angka yang diset server.",
].join("\n");
