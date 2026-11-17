/**
 * Rubrik skor 0–3 (PRD M1, dokumen 02 US-1.4) — SATU-SATUNYA definisi rubrik.
 * Dipakai di penilaian sesi (Session.tsx) dan ditampilkan sekali di onboarding
 * (Onboarding.tsx, US-0.1). Jangan mengarang skala lain.
 */
import type { Skor } from './domain';

export interface ButirRubrik {
  skor: Skor;
  judul: string;
  arti: string;
}

export const RUBRIK: ButirRubrik[] = [
  { skor: 0, judul: 'Tidak menghasilkan apa pun', arti: 'Sesi dibuka tapi tidak ada artefak dan tidak ada kerja.' },
  { skor: 1, judul: 'Paham konsep', arti: 'Paham konsep, belum bisa menerapkan.' },
  { skor: 2, judul: 'Bisa menerapkan', arti: 'Bisa menerapkan ke 1 masalah nyata.' },
  { skor: 3, judul: 'Bisa menerapkan ke masalah baru', arti: 'Bisa menerapkan ke masalah BARU + menghubungkan ke framework lain.' },
];
