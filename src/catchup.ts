/**
 * Model layar catch-up: modul murni (dokumen 07 §3.1).
 * Re-use yang terlewat >3 hari dikelompokkan jadi sesi catch-up
 * (maks 3 framework per sesi, 1 sesi per hari) oleh `kelompokCatchUp()`
 * di scheduler.ts; modul ini hanya menambah nama framework + jumlah hari
 * terlewat untuk tampilan, dan membangun input sesi catch-up.
 *
 * Penyelesaian sesi catch-up memakai `selesaikanSesi()` yang sama dengan
 * re-use (db.ts): jadwal lama ditandai selesai, rantai berikutnya dihitung
 * dari tanggal DISELESAIKAN, XP re-use (50) dicatat. Tidak ada logika
 * penyelesaian terpisah.
 */
import type { Framework, ISODate, JadwalReuse, JenisSesi } from './domain';
import { selisihHari } from './dates';
import { kelompokCatchUp } from './scheduler';

/** Durasi target sesi catch-up: sama dengan re-use (12 menit). */
export const DURASI_CATCH_UP_MENIT = 12;

export interface ItemCatchUp {
  jadwal: JadwalReuse;
  frameworkNama: string;
  /** Jumlah hari sejak jatuh tempo (selalu >3 untuk item catch-up). */
  hariTerlewat: number;
}

export interface KelompokCatchUpTampil {
  tanggal: ISODate;
  items: ItemCatchUp[];
}

/**
 * Kelompok catch-up siap tampil: nama framework terurai, hari terlewat
 * dihitung. Item yang framework-nya tidak ditemukan tetap ditampilkan
 * dengan nama pengganti (data tidak pernah disembunyikan diam-diam).
 */
export function modelCatchUp(
  jadwal: JadwalReuse[],
  frameworks: Framework[],
  hariIni: ISODate,
): KelompokCatchUpTampil[] {
  const namaById = new Map(frameworks.map((f) => [f.id, f.nama]));
  return kelompokCatchUp(jadwal, hariIni).map((kelompok) => ({
    tanggal: kelompok.tanggal,
    items: kelompok.items.map((j) => ({
      jadwal: j,
      frameworkNama: namaById.get(j.framework_id) ?? 'Framework tidak ditemukan',
      hariTerlewat: selisihHari(j.jatuh_tempo, hariIni),
    })),
  }));
}

/** Input `mulaiSesi()` untuk satu sesi catch-up (masalah dipilih di layar). */
export function inputSesiCatchUp(frameworkId: string): {
  framework_id: string;
  masalah_id: null;
  jenis: JenisSesi;
  durasi_target_menit: number;
} {
  return {
    framework_id: frameworkId,
    masalah_id: null,
    jenis: 'catch_up',
    durasi_target_menit: DURASI_CATCH_UP_MENIT,
  };
}
