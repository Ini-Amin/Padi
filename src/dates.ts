/**
 * Aritmetika tanggal: modul murni, tanpa dependensi browser (dokumen 07 §3.1).
 * Semua perhitungan memakai kalender UTC agar tidak terganggu DST maupun
 * zona waktu perangkat. Satu-satunya tempat tanggal dibuat/diubah.
 */
import type { ISODate } from './domain';

/** Tanggal hari ini (waktu lokal perangkat, diformat sebagai ISODate). */
export function hariIni(d: Date = new Date()): ISODate {
  const tahun = d.getFullYear();
  const bulan = String(d.getMonth() + 1).padStart(2, '0');
  const hari = String(d.getDate()).padStart(2, '0');
  return `${tahun}-${bulan}-${hari}` as ISODate;
}

/** Tambah N hari kalender ke sebuah tanggal. H+30 selalu berarti tanggal+30. */
export function tambahHari(tanggal: ISODate, n: number): ISODate {
  const d = new Date(`${tanggal}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10) as ISODate;
}

/** Selisih hari: positif jika `b` sesudah `a`. */
export function selisihHari(a: ISODate, b: ISODate): number {
  const msPerHari = 24 * 60 * 60 * 1000;
  const ta = Date.parse(`${a}T00:00:00Z`);
  const tb = Date.parse(`${b}T00:00:00Z`);
  return Math.round((tb - ta) / msPerHari);
}

/** Format panjang Bahasa Indonesia, misal "Selasa, 17 Nov 2026". */
export function formatTanggal(tanggal: ISODate): string {
  const d = new Date(`${tanggal}T12:00:00Z`);
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d);
}

/** Format pendek, misal "17 Nov". */
/** Bulan kalender `YYYY-MM` dari sebuah tanggal (untuk metrik bulanan). */
export function bulanDari(tanggal: ISODate): string {
  return tanggal.slice(0, 7);
}
