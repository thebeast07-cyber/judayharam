# Judi Haram

Demo edukasi: simulasi slot bohongan buat nunjukin siapa yang sebenernya ngatur menang-kalah.

- Nggak ada deposit, nggak ada WD, nggak ada login, nggak ada suara kemenangan.
- Panel "Intip Dapur" nunjukin RTP, jackpot, near-miss, dan label "GACOR" palsu.
- Semua simbol buatan sendiri (emoji), bukan aset game orang lain.

## Jalanin

```bash
npm install
npm run dev
```

Buka http://localhost:3000

## Deploy

Push ke GitHub lalu import ke Vercel. Nggak butuh env var dan nggak butuh backend.

## Struktur

- `lib/engine.ts` mesin spin dan peluang hadiah
- `lib/source.ts` cuplikan kode yang tampil di dapur
- `components/Game.tsx` tampilan utama dan rekap sesi
- `components/Kitchen.tsx` panel dapur bandar
