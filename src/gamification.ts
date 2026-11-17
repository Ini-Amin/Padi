/**
 * Gamifikasi dasar — modul murni (PRD M5, dokumen 03 §2.8).
 * XP: sesi penerapan selesai 100, re-use selesai 50, artefak berkualitas +50,
 * skor sesi 3 +25. `total_xp = sum(xp_ledger)` — dihitung, bukan akumulator.
 * XP hanya naik; streak tidak pernah mengunci apa pun.
 */
import type { ISODate, Sesi, Skor, XpLedgerEntry } from './domain';
import { tambahHari } from './dates';

export const XP_PENERAPAN = 100;
export const XP_REUSE = 50;
export const XP_ARTEFAK_BERKUALITAS = 50;
export const XP_SKOR_3 = 25;

/** XP yang dihasilkan satu sesi yang selesai dinilai (sebelum dicatat). */
export function xpUntukSesi(
  jenis: Sesi['jenis'],
  skor: Skor,
  artefakBerkualitas: boolean,
): Array<{ jenis: XpLedgerEntry['jenis']; jumlah: number }> {
  const hasil: Array<{ jenis: XpLedgerEntry['jenis']; jumlah: number }> = [];
  if (jenis === 'penerapan') hasil.push({ jenis: 'penerapan', jumlah: XP_PENERAPAN });
  if (jenis === 're_use' || jenis === 'catch_up') {
    hasil.push({ jenis: 're_use', jumlah: XP_REUSE });
  }
  if (artefakBerkualitas) {
    hasil.push({ jenis: 'artefak_berkualitas', jumlah: XP_ARTEFAK_BERKUALITAS });
  }
  if (skor === 3) hasil.push({ jenis: 'skor_3', jumlah: XP_SKOR_3 });
  return hasil;
}

/** Total XP = jumlah ledger (satu-satunya definisi). */
export function totalXp(ledger: XpLedgerEntry[]): number {
  return ledger.reduce((acc, e) => acc + e.jumlah, 0);
}

/**
 * Definisi "selesai" (dokumen 03 §7, satu-satunya definisi):
 * - penerapan: durasi ≥30 menit ATAU ada artefak.
 * - re_use / catch_up: skor ≠ null.
 */
export function sesiSelesai(sesi: Sesi): boolean {
  if (sesi.jenis === 'penerapan') {
    return sesi.durasi_menit >= 30 || sesi.artefak_ids.length > 0;
  }
  return sesi.skor !== null;
}

/**
 * Streak: hari berturut-turut dengan ≥1 aktivitas, dihitung mundur dari
 * hari ini. Jika hari ini belum ada aktivitas, streak dihitung dari kemarin
 * (masih hidup — putus hanya jika 1 hari penuh tanpa aktivitas).
 * `aktivitas` = himpunan tanggal yang punya ≥1 record sesi.
 */
export function hitungStreak(aktivitas: ReadonlySet<string>, hariIni: ISODate): number {
  let streak = 0;
  let cursor: ISODate = aktivitas.has(hariIni) ? hariIni : tambahHari(hariIni, -1);
  while (aktivitas.has(cursor)) {
    streak += 1;
    cursor = tambahHari(cursor, -1);
  }
  return streak;
}

/** Apakah streak masih hidup (ada aktivitas hari ini atau kemarin). */
export function streakHidup(aktivitas: ReadonlySet<string>, hariIni: ISODate): boolean {
  return (
    aktivitas.has(hariIni) || aktivitas.has(tambahHari(hariIni, -1))
  );
}

/** Jarak hari sejak aktivitas terakhir (0 = hari ini). Null jika belum pernah. */
export function hariSejakAktivitas(
  aktivitas: ReadonlySet<string>,
  hariIni: ISODate,
): number | null {
  let jarak = 0;
  let cursor: ISODate = hariIni;
  while (jarak <= 3650) {
    if (aktivitas.has(cursor)) return jarak;
    cursor = tambahHari(cursor, -1);
    jarak += 1;
  }
  return null;
}
