/**
 * Scheduler re-use: modul murni (dokumen 03 §2.7, PRD M2).
 * Review adalah RE-USE dari event pemakaian, bukan re-read:
 * setiap pemakaian (skor ≥1) menjadwalkan H+1, H+3, H+7, H+30.
 * Re-use berikutnya dihitung dari tanggal re-use DISELESAIKAN,
 * bukan dari jatuh tempo aslinya.
 */
import type { ISODate, JadwalReuse, JenisReuse } from './domain';
import { selisihHari, tambahHari } from './dates';

/** Interval re-use standar, dalam hari. */
export const INTERVAL_REUSE: ReadonlyArray<{ jenis: JenisReuse; hari: number }> = [
  { jenis: 'H+1', hari: 1 },
  { jenis: 'H+3', hari: 3 },
  { jenis: 'H+7', hari: 7 },
  { jenis: 'H+30', hari: 30 },
];

/** Urutan rantai re-use: setelah jenis ini selesai, jenis berikutnya. */
const BERIKUTNYA: Record<JenisReuse, JenisReuse | null> = {
  'H+1': 'H+3',
  'H+3': 'H+7',
  'H+7': 'H+30',
  'H+30': null,
  tambahan: null,
};

const HARI_INTERVAL: Record<JenisReuse, number> = {
  'H+1': 1,
  'H+3': 3,
  'H+7': 7,
  'H+30': 30,
  tambahan: 7,
};

/**
 * Jadwal awal dari satu pemakaian: H+1, H+3, H+7, H+30 dari tanggal pemakaian.
 * Contoh (PRD M2): dipakai Senin 16 Nov 2026 → 17 Nov, 19 Nov, 23 Nov, 16 Des.
 */
export function jadwalDariPemakaian(tanggalPemakaian: ISODate): Array<{
  jenis_reuse: JenisReuse;
  jatuh_tempo: ISODate;
}> {
  return INTERVAL_REUSE.map(({ jenis, hari }) => ({
    jenis_reuse: jenis,
    jatuh_tempo: tambahHari(tanggalPemakaian, hari),
  }));
}

/**
 * Jenis re-use berikutnya setelah `jenis` diselesaikan, atau null jika rantai
 * sudah habis (H+30 selesai → tidak ada lagi).
 */
export function jenisBerikutnya(jenis: JenisReuse): JenisReuse | null {
  return BERIKUTNYA[jenis];
}

/**
 * Jatuh tempo re-use berikutnya, dihitung dari tanggal re-use DISELESAIKAN.
 * Contoh: H+3 jatuh tempo 19 Nov tapi dikerjakan 23 Nov → H+7 berikutnya
 * jatuh 30 Nov (23 Nov + 7 hari), bukan 26 Nov.
 * Mengembalikan null jika tidak ada re-use berikutnya.
 */
export function jadwalBerikutnya(
  jenisSelesai: JenisReuse,
  tanggalDiselesaikan: ISODate,
): { jenis_reuse: JenisReuse; jatuh_tempo: ISODate } | null {
  const berikut = jenisBerikutnya(jenisSelesai);
  if (!berikut) return null;
  return {
    jenis_reuse: berikut,
    jatuh_tempo: tambahHari(tanggalDiselesaikan, HARI_INTERVAL[berikut]),
  };
}

/**
 * Re-use tambahan saat skor re-use <2: H+7 dari tanggal re-use tersebut.
 * Contoh: re-use 20 Nov skor 1 → re-use tambahan 27 Nov.
 */
export function jadwalTambahan(tanggalReuse: ISODate): {
  jenis_reuse: JenisReuse;
  jatuh_tempo: ISODate;
} {
  return { jenis_reuse: 'tambahan', jatuh_tempo: tambahHari(tanggalReuse, 7) };
}

/** Apakah re-use ini masuk aturan catch-up: terlewat lebih dari 3 hari. */
export function perluCatchUp(jadwal: JadwalReuse, hariIni: ISODate): boolean {
  return (
    jadwal.status === 'terlewat' && selisihHari(jadwal.jatuh_tempo, hariIni) > 3
  );
}

/**
 * Kelompokkan re-use yang perlu catch-up menjadi sesi-sesi catch-up:
 * maksimal 3 framework per sesi, maksimal 1 sesi per hari, diprioritaskan
 * yang paling lama jatuh tempo. Sesi pertama dijadwalkan hari ini, sisanya
 * digeser ke hari-hari berikutnya (dokumen 07 §3.1: 10 re-use tertinggal →
 * 4 sesi catch-up 3+3+3+1 dalam 4 hari berturut-turut).
 */
export function kelompokCatchUp(
  daftarTerlewat: JadwalReuse[],
  hariIni: ISODate,
): Array<{ tanggal: ISODate; items: JadwalReuse[] }> {
  const yangPerlu = daftarTerlewat
    .filter((j) => perluCatchUp(j, hariIni))
    .sort((a, b) =>
      a.jatuh_tempo < b.jatuh_tempo ? -1 : a.jatuh_tempo > b.jatuh_tempo ? 1 : 0,
    );
  const kelompok: Array<{ tanggal: ISODate; items: JadwalReuse[] }> = [];
  for (let i = 0; i < yangPerlu.length; i += 3) {
    kelompok.push({
      tanggal: tambahHari(hariIni, kelompok.length),
      items: yangPerlu.slice(i, i + 3),
    });
  }
  return kelompok;
}

/** Re-use yang jatuh tempo hari ini atau sudah terlewat (masih dikerjakan). */
export function reuseJatuhTempo(
  daftar: JadwalReuse[],
  hariIni: ISODate,
): JadwalReuse[] {
  return daftar
    .filter(
      (j) =>
        (j.status === 'terjadwal' || j.status === 'terlewat') &&
        j.jatuh_tempo <= hariIni,
    )
    .sort((a, b) =>
      a.jatuh_tempo < b.jatuh_tempo ? -1 : a.jatuh_tempo > b.jatuh_tempo ? 1 : 0,
    );
}
