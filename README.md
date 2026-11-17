# Padi — Toolbox Framework Berbasis Psikologi + Knowledge Graph

Padi adalah toolbox: user membawa masalah nyata, Padi membantu memilih
framework yang tepat untuk masalah itu, dan user belajar framework tersebut
**dengan memakainya** — bukan dengan mempelajarinya sebagai materi.

Dokumen produk (otoritatif, v0.5): `../docs/` — PRD, persona, model data,
desain UX/UI, arsitektur, fondasi ilmu belajar, roadmap & QA.

> **Status (v0.1.0, 17 Nov 2026): MVP M0–M5 LENGKAP** — scaffold + model
> data + loop problem-first end-to-end + **konten Fase 0 lengkap (22
> framework / 35 edge)** + **graph SVG statis (M3)** + **layar catch-up** +
> **PWA (manifest + service worker)** + **M0 onboarding diagnostik (6
> pertanyaan)**. Live di https://ini-amin.github.io/Padi/ (GitHub Pages,
> deploy otomatis dari `main` via `.github/workflows/pages.yml`).

## Menjalankan

```bash
npm install
npm run dev      # dev server (http://localhost:5173)
npm run build    # type-check (tsc strict) + build produksi
npm test         # 158 test (vitest + fast-check)
```

Deploy: app statis tanpa backend — GitHub Pages, deploy otomatis setiap
push ke `main` (workflow `.github/workflows/pages.yml`: `npm ci` → `npm
test` → `npm run build` → deploy `dist/`). Base path Vite adalah `/Padi/`
agar jalan di subpath project site; semua path absolut di kode memakai
`import.meta.env.BASE_URL`, dan manifest + service worker memakai path
relatif.

## Keputusan stack (dicatat sebelum Fase 1, sesuai dokumen 05)

| Keputusan | Pilihan | Alasan |
|---|---|---|
| Framework UI | **React** (bukan Svelte default) | Alternatif yang diizinkan dokumen 05; Zustand + dexie-react-hooks adalah pasangan yang teruji untuk pola ini. |
| Bahasa | TypeScript, `strict: true` | Wajib per dokumen 05 — domain penuh logika tanggal/status yang rawan bug tanpa type system. |
| State | Zustand | State bersama kecil (masalah aktif, sesi berjalan). |
| Penyimpanan | IndexedDB via Dexie, local-first | Satu database `padi`, satu object store per entitas (dokumen 03). |
| Test | vitest + fast-check | vitest adalah runner standar Vite; fast-check untuk property-based test aturan inti. Dokumen 07 menyarankan `node --test` sebagai contoh ("misal") — vitest dipilih karena integrasi TS-nya tanpa config tambahan. |
| Konten | `public/data/graph.json` | Dokumen 05 menempatkan `graph.json` di `data/` dan dimuat via `fetch`. Vite hanya menyajikan file di `public/` — jadi file-nya tinggal di `public/data/` agar bisa di-fetch. Satu file, satu sumber kebenaran, tanpa duplikasi. |

## Yang sudah dibangun di potongan ini

- **Scaffold Vite + React + TypeScript strict.** `npm run build` lolos
  (JS 387 KB / gzip 118 KB — di bawah target 500 KB dokumen 04).
- **Model data Dexie** (`src/db.ts`, database `padi` v1): frameworks, edges,
  masalah, pemakaian, sesi, artefak, jadwal_reuse, progres, xp_ledger,
  capstone, umpan_balik_matching. Seed dari `graph.json` memakai upsert by
  id — konten yang diedit user (`diedit_user`) tidak pernah ditimpa.
- **Modul murni** (tanpa dependensi browser, bisa diuji di Node):
  `dates.ts` (aritmetika tanggal UTC), `scheduler.ts` (re-use H+1/H+3/H+7/H+30
  dari event pemakaian + catch-up), `status.ts` (`hitungStatus` — satu-satunya
  tempat logika status), `matcher.ts` (matching kriteria + ranking + alasan),
  `telemetry.ts` (transfer rate, framework unik/bulan, penyebaran masalah),
  `gamification.ts` (XP + streak).
- **Loop problem-first end-to-end:** nyatakan masalah (flow 5 langkah) →
  ranking 3 framework + slot eksplorasi dengan alasan → sesi penerapan
  (timer 45', panduan 4 tahap, catatan autosave) → penilaian (form artefak +
  checklist kualitas + rubrik 0–3) → pemakaian tercatat + re-use H+1/H+3/H+7/H+30
  terjadwal otomatis + XP dicatat. Re-use (12') meminta masalah BARU dan tidak
  menampilkan catatan lama.
- **Guided discovery** sebagai jalur cadangan (PRD M6): 3 langkah menuju
  masalah + ranking. Bukan jalur utama, dan tidak pernah berujung "modul selesai".
- **Layar:** Beranda (masalah aktif + ranking + re-use hari ini + draft sesi
  + kartu re-use terlewat), Daftar Masalah, Detail Masalah, Peta (graph SVG
  statis + daftar bertema), Detail Framework (3 lapis, indikator 3 syarat
  "dikuasai", kolom "kapan tidak pakai", jadwal re-use, artefak, framework
  terkait), Catch-up (re-use terlewat >3 hari, maks 3 framework per sesi),
  Progres (XP + streak + metrik toolbox + ekspor JSON + tautan catch-up).
  Tanpa "X/22" di mana pun.
- **Graph SVG statis (M3, 16 Nov 2026):** `src/graph-layout.ts` (modul murni:
  satu kolom per tema A–G, node diurutkan `urutan_katalog`, edge se-kolom
  melengkung, edge paralel digeser supaya tidak menimpa) + `GraphSvg.tsx`
  (klik node → detail framework; legenda 4 tipe edge + dot status; wadah
  geser horizontal di layar sempit agar label tetap terbaca tanpa halaman
  meluber). Panah hanya untuk prasyarat.
- **Layar catch-up (16 Nov 2026):** `src/catchup.ts` (model tampil di atas
  `kelompokCatchUp()`) + `CatchUp.tsx` (rute `#/catch-up`, ditautkan dari
  Beranda dan Progres saat ada re-use terlewat). Satu sesi catch-up = satu
  framework 12', memakai layar sesi yang sama dengan re-use — termasuk
  memilih masalah BARU (`perluPilihMasalah()` di `src/sesi.ts` kini
  mencakup `catch_up`) dan penilaian rubrik; penyelesaian memakai
  `selesaikanSesi()` yang sama (rantai re-use berikutnya dijadwalkan dari
  tanggal diselesaikan, XP re-use 50). Field `catch_up_group_id` sengaja
  belum dipakai — pengelompokan dihitung dinamis dari jatuh tempo setiap
  render, jadi tidak ada grup yang perlu dikunci.
- **PWA (16 Nov 2026):** `public/manifest.webmanifest` (nama Padi, Bahasa
  Indonesia, theme color kuning aksen `#F5D90A`) + `public/sw.js` (tanpa
  library: navigasi network-first, aset same-origin cache-first, hanya GET
  same-origin; precache app shell + `graph.json`) + `src/pwa.ts`
  (registrasi dijaga — hanya di build produksi, tidak pernah melempar).
  Ikon bulir padi di `public/icons/` (SVG + PNG 192/512, maskable) dan
  `favicon.svg` diganti dari logo bawaan Vite. **Aturan rilis: naikkan
  `CACHE` di `sw.js` (misal `padi-v2`) setiap rilis** agar cache lama
  dihapus saat aktivasi. Data user sudah lokal (IndexedDB), jadi app
  berfungsi penuh offline setelah pertama kali dimuat.
- **Konten graph lengkap — Fase 0 selesai (16 Nov 2026): 22 framework /
  35 edge.** Setiap framework lengkap: ringkasan 41–52 kata, tepat 3 ide
  kunci, 1 keterbatasan, 3 signature masalah, 3 lapis konten (≥2 kalimat
  tiap lapis), sumber. Edge: 6 prasyarat + 4 kontras + 10 dipakai_bersama
  (semua terkurasi dokumen 03 §5, alasan 1 kalimat di `graph.json`) +
  15 satu_tema. Lihat "Graf konten (Fase 0)" di bawah untuk aturan
  distribusi edge.
- **M0 onboarding diagnostik (17 Nov 2026):** 6 pertanyaan berurutan,
  masing-masing bisa dilewati; gate first-run (hanya muncul sekali);
  layar penutup dengan ranking framework pertama + rubrik 0–3; Q2
  learner/applier mengubah tombol utama Beranda; Q3 menandai framework
  yang sudah dikenal (`dikenal_pada`, bukan materi baru); bisa diulang
  dari layar Progres tanpa membuat masalah ganda.
- **158 test lolos** (11 file): contoh aritmetika tanggal dari dokumen 07,
  8 kombinasi syarat "dikuasai", definisi transfer, ranking + slot eksplorasi,
  XP + streak, kelengkapan graph.json — termasuk property test fast-check
  (H+30 selalu tanggal+30; dikuasai ⟺ ketiga syarat; catch-up tidak pernah
  kehilangan item; ranking selalu urut skor).

## Aturan "invalid state tidak bisa direpresentasikan"

- `status` framework hanya ditulis `refreshFrameworkStatus()` (memanggil
  `hitungStatus()` murni). Tidak ada kode lain yang menulis status — status
  "dikuasai" tidak bisa ditulis langsung, hanya bisa dihasilkan dari
  ketiga syarat.
- `kualitas_terpenuhi` dihitung dari tiga checklist saat artefak dibuat.
- `total_xp` dihitung dari `xp_ledger` (sum), bukan akumulator.
- Tanggal adalah tipe bermerek `ISODate`; aritmetika hanya lewat `dates.ts`.
- `Skor` adalah union literal `0 | 1 | 2 | 3`; `ide_kunci` tuple tepat 3.

## Koreksi terhadap brief potongan ini (dokumen v0.5 menang)

Brief meminta property test "tidak ada 'dikuasai penuh' tanpa re-use H+30".
Itu definisi **v0.4** (dua tingkat + lencana H+30) yang **dihapus oleh pivot
v0.5**: PRD v0.5 M3 + US-2.5 menyatakan re-use H+30 adalah ukuran retensi,
**bukan** syarat status "dikuasai". Yang diimplementasikan dan diuji adalah
definisi v0.5: transfer + artefak berkualitas + kemandirian.

## Graf konten (Fase 0)

`public/data/graph.json` adalah satu-satunya sumber kebenaran konten:
**22 node / 35 edge**, sesuai dokumen 03 §5.

**Komposisi edge:** 6 `prasyarat` + 4 `kontras` + 10 `dipakai_bersama` +
15 `satu_tema`. Ke-20 edge lintas-tema mengikuti daftar terkurasi dokumen 03
§5 kata demi kata (termasuk alasan 1 kalimatnya); 6 edge `prasyarat` adalah:

| Dari → Ke | Alasan |
|---|---|
| PESTEL → Porter Five Forces | Konteks makro memberi latar sebelum menganalisis kekuatan industri. |
| Ansoff → McKinsey 3 Horizons | Keputusan arah pertumbuhan (Ansoff) membantu memetakan jangka waktu (3 Horizons). |
| Value Chain → VRIO | Petakan aktivitas dulu (Value Chain), baru uji mana yang jadi keunggulan (VRIO). |
| VRIO → Core Competencies | Keunggulan yang lolos VRIO dirangkum jadi kompetensi inti. |
| Lewin → Kotter 8-Step | Model sederhana Lewin (unfreeze–change–refreeze) adalah kerangka dasar konseptual sebelum 8 langkah Kotter. |
| Balanced Scorecard → OKRs | OKRs membutuhkan kerangka pengukuran (BSC) agar targetnya bisa dinilai. |

**Aturan distribusi 15 edge `satu_tema`** (pengelompokan pustaka, bukan
relasi kognitif — `alasan` selalu `null`): tema dengan ≤3 node memakai graf
lengkap (A: 3, B: 3, C: 1, D: 1, G: 3 = 11 edge); tema besar E (5 node) dan
F (4 node) memakai 2 pasang terpilih agar total tetap 15 — E: BMC–Design
Thinking (keduanya merancang apa yang dibangun sebelum eksekusi) dan Lean
Startup–Kanban (keduanya menerapkan cara berpikir lean pada aliran kerja);
F: DMAIC–Lewin (keduanya menata perbaikan/perubahan sebagai tahap berurutan)
dan Lewin–ADKAR (keduanya memodelkan transisi manusia melewati perubahan).
Subgraph `prasyarat` asiklik (diverifikasi `graph.test.ts`).

**Signature masalah:** setiap framework punya 3 pola; semua 66 pola (9 lama
+ 57 baru) punya entri di `POLA_KE_KRITERIA` (`src/matcher.ts`) — pola baru
tanpa entri akan menggagalkan `graph.test.ts`.

## Yang belum ada (potongan berikutnya)

1. **Impor JSON + auto-backup** (File System Access API). Ekspor sudah ada.
2. **Telemetri discovery**: discovery yang tidak berujung masalah belum dicatat.
3. **Unggah gambar artefak** (diagram PNG/JPG maks 5 MB sebagai Blob) — saat
   ini jenis diagram hanya deskripsi teks.
4. **Timer berbasis `Date.now()` penuh**: saat ini interval 1 detik + autosave
   30 detik; kehilangan <1 menit jika tab ditutup mendadak sebelum autosave.

## Batasan yang dijaga

- **Tanpa AI di MVP** (PRD non-goal). Matching memakai aturan + kriteria.
- **Tanpa data pribadi** di kode, dokumen, maupun konten seed. Persona fiktif
  "Raka Pratama" hanya ada di dokumen produk, bukan di app.
- **Semua teks user-facing dalam Bahasa Indonesia.** Nama framework tetap
  Bahasa Inggris (nama aslinya). Tanpa emoji di dalam app.
