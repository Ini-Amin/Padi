/**
 * Telemetri — modul murni (dokumen 03 §7, PRD Tabel A).
 * Semua metrik DIHITUNG dari log pemakaian/sesi, bukan disimpan sebagai
 * entitas terpisah. Tidak ada data yang keluar dari perangkat.
 */
import type { ISODate, Masalah, Pemakaian } from './domain';
import { bulanDari, selisihHari } from './dates';
import { hitungMasalahBerbeda } from './status';

export interface TransferRate {
  /** Framework dengan transfer ÷ framework yang pernah dipakai (0–1). */
  rate: number;
  pembilang: number;
  penyebut: number;
}

/**
 * Transfer rate per 90 hari berjalan: framework yang dipakai untuk ≥2 masalah
 * berbeda (skor ≥2) dalam jendela ÷ framework yang pernah dipakai dalam jendela.
 */
export function hitungTransferRate(
  pemakaian: Pemakaian[],
  masalahById: ReadonlyMap<string, Masalah>,
  hariIni: ISODate,
  jendelaHari = 90,
): TransferRate {
  const dalamJendela = pemakaian.filter(
    (p) => selisihHari(p.tanggal, hariIni) >= 0 && selisihHari(p.tanggal, hariIni) < jendelaHari,
  );
  const perFramework = new Map<string, Pemakaian[]>();
  for (const p of dalamJendela) {
    const daftar = perFramework.get(p.framework_id) ?? [];
    daftar.push(p);
    perFramework.set(p.framework_id, daftar);
  }
  let pembilang = 0;
  for (const daftar of perFramework.values()) {
    if (hitungMasalahBerbeda(daftar, masalahById) >= 2) pembilang += 1;
  }
  const penyebut = perFramework.size;
  return { rate: penyebut === 0 ? 0 : pembilang / penyebut, pembilang, penyebut };
}

/** Jumlah framework unik dengan ≥1 pemakaian dalam bulan kalender berjalan. */
export function frameworkUnikBulanIni(
  pemakaian: Pemakaian[],
  hariIni: ISODate,
): number {
  const bulan = bulanDari(hariIni);
  const unik = new Set(
    pemakaian.filter((p) => bulanDari(p.tanggal) === bulan).map((p) => p.framework_id),
  );
  return unik.size;
}

/** Jumlah masalah yang dikerjakan dengan ≥2 framework berbeda. */
export function penyebaranMasalah(pemakaian: Pemakaian[]): number {
  const perMasalah = new Map<string, Set<string>>();
  for (const p of pemakaian) {
    const himpunan = perMasalah.get(p.masalah_id) ?? new Set<string>();
    himpunan.add(p.framework_id);
    perMasalah.set(p.masalah_id, himpunan);
  }
  let jumlah = 0;
  for (const himpunan of perMasalah.values()) {
    if (himpunan.size >= 2) jumlah += 1;
  }
  return jumlah;
}
