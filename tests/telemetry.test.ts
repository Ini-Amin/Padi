/**
 * Uji telemetri + gamifikasi (dokumen 07 §3.1).
 * Metrik dihitung dari log — tanpa entitas terpisah.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { ISODate, Masalah, Sesi, Skor, XpLedgerEntry } from '../src/domain';
import {
  frameworkUnikBulanIni,
  hitungTransferRate,
  penyebaranMasalah,
} from '../src/telemetry';
import {
  hitungStreak,
  sesiSelesai,
  totalXp,
  xpUntukSesi,
} from '../src/gamification';
import { buatMasalah, buatPemakaian } from './factories';

const T = (s: string): ISODate => s as ISODate;
const HARI_INI = T('2026-11-20');

function masalahById(...daftar: Masalah[]): Map<string, Masalah> {
  return new Map(daftar.map((m) => [m.id, m]));
}

describe('hitungTransferRate', () => {
  it('3 dari 5 framework transfer → rate 0,6', () => {
    const a = buatMasalah({ id: 'm-a', judul: 'A', kriteria: ['eksternal'] });
    const b = buatMasalah({ id: 'm-b', judul: 'B', kriteria: ['persaingan'] });
    const byId = masalahById(a, b);
    const pemakaian = [
      // 3 framework transfer (2 masalah, skor ≥2)
      buatPemakaian({ framework_id: 'f1', masalah_id: 'm-a', skor: 2 }),
      buatPemakaian({ framework_id: 'f1', masalah_id: 'm-b', skor: 2 }),
      buatPemakaian({ framework_id: 'f2', masalah_id: 'm-a', skor: 3 }),
      buatPemakaian({ framework_id: 'f2', masalah_id: 'm-b', skor: 2 }),
      buatPemakaian({ framework_id: 'f3', masalah_id: 'm-a', skor: 2 }),
      buatPemakaian({ framework_id: 'f3', masalah_id: 'm-b', skor: 2 }),
      // 2 framework tanpa transfer
      buatPemakaian({ framework_id: 'f4', masalah_id: 'm-a', skor: 2 }),
      buatPemakaian({ framework_id: 'f5', masalah_id: 'm-a', skor: 1 }),
    ];
    const hasil = hitungTransferRate(pemakaian, byId, HARI_INI);
    expect(hasil).toEqual({ rate: 0.6, pembilang: 3, penyebut: 5 });
  });

  it('tanpa pemakaian → rate 0, penyebut 0', () => {
    expect(hitungTransferRate([], new Map(), HARI_INI)).toEqual({
      rate: 0,
      pembilang: 0,
      penyebut: 0,
    });
  });

  it('pemakaian di luar jendela 90 hari tidak dihitung', () => {
    const a = buatMasalah({ id: 'm-a', judul: 'A', kriteria: ['eksternal'] });
    const b = buatMasalah({ id: 'm-b', judul: 'B', kriteria: ['persaingan'] });
    const byId = masalahById(a, b);
    const pemakaian = [
      buatPemakaian({ framework_id: 'f1', masalah_id: 'm-a', skor: 2, tanggal: T('2026-08-01') }),
      buatPemakaian({ framework_id: 'f1', masalah_id: 'm-b', skor: 2, tanggal: T('2026-08-02') }),
    ];
    const hasil = hitungTransferRate(pemakaian, byId, HARI_INI);
    expect(hasil.penyebut).toBe(0);
  });
});

describe('frameworkUnikBulanIni', () => {
  it('menghitung framework berbeda dalam bulan kalender berjalan saja', () => {
    const pemakaian = [
      buatPemakaian({ framework_id: 'f1', tanggal: T('2026-11-02') }),
      buatPemakaian({ framework_id: 'f1', tanggal: T('2026-11-10') }),
      buatPemakaian({ framework_id: 'f2', tanggal: T('2026-11-15') }),
      buatPemakaian({ framework_id: 'f3', tanggal: T('2026-10-30') }),
    ];
    expect(frameworkUnikBulanIni(pemakaian, HARI_INI)).toBe(2);
  });
});

describe('penyebaranMasalah', () => {
  it('menghitung masalah dengan ≥2 framework berbeda', () => {
    const pemakaian = [
      buatPemakaian({ framework_id: 'f1', masalah_id: 'm-a' }),
      buatPemakaian({ framework_id: 'f2', masalah_id: 'm-a' }),
      buatPemakaian({ framework_id: 'f1', masalah_id: 'm-b' }),
      buatPemakaian({ framework_id: 'f1', masalah_id: 'm-b' }),
    ];
    expect(penyebaranMasalah(pemakaian)).toBe(1);
  });
});

describe('xpUntukSesi + totalXp (PRD M5)', () => {
  it('sesi penerapan skor 3 + artefak berkualitas = 100+50+25 = 175 XP, 3 entri ledger', () => {
    const xp = xpUntukSesi('penerapan', 3, true);
    expect(xp).toEqual([
      { jenis: 'penerapan', jumlah: 100 },
      { jenis: 'artefak_berkualitas', jumlah: 50 },
      { jenis: 'skor_3', jumlah: 25 },
    ]);
    const ledger: XpLedgerEntry[] = xp.map((x, i) => ({
      id: `e-${i}`,
      sesi_id: 's-1',
      jenis: x.jenis,
      jumlah: x.jumlah,
      dibuat_pada: HARI_INI,
    }));
    expect(totalXp(ledger)).toBe(175);
  });

  it('re-use selesai skor 2 tanpa artefak = 50 XP', () => {
    expect(xpUntukSesi('re_use', 2, false)).toEqual([{ jenis: 're_use', jumlah: 50 }]);
  });
});

describe('sesiSelesai — definisi tunggal (dokumen 03 §7)', () => {
  const sesiDasar: Sesi = {
    id: 's-1',
    framework_id: 'pestel',
    masalah_id: 'm-a',
    jenis: 'penerapan',
    tanggal: HARI_INI,
    durasi_menit: 0,
    selesai: false,
    skor: null,
    catatan: '',
    artefak_ids: [],
    dimulai_pada_ms: null,
    durasi_target_menit: 45,
  };

  it('penerapan ≥30 menit tanpa artefak → selesai', () => {
    expect(sesiSelesai({ ...sesiDasar, durasi_menit: 30 })).toBe(true);
  });

  it('penerapan 10 menit + artefak → selesai', () => {
    expect(sesiSelesai({ ...sesiDasar, durasi_menit: 10, artefak_ids: ['a-1'] })).toBe(true);
  });

  it('penerapan 10 menit tanpa artefak → belum selesai', () => {
    expect(sesiSelesai({ ...sesiDasar, durasi_menit: 10 })).toBe(false);
  });

  it('re-use: selesai ⟺ skor ≠ null', () => {
    const reuse = { ...sesiDasar, jenis: 're_use' as const };
    expect(sesiSelesai({ ...reuse, skor: null })).toBe(false);
    expect(sesiSelesai({ ...reuse, skor: 0 as Skor })).toBe(true);
  });
});

describe('hitungStreak', () => {
  it('aktivitas 3 hari berturut-turut → streak 3', () => {
    const aktivitas = new Set(['2026-11-18', '2026-11-19', '2026-11-20']);
    expect(hitungStreak(aktivitas, HARI_INI)).toBe(3);
  });

  it('1 hari kosong → streak 0', () => {
    const aktivitas = new Set(['2026-11-17', '2026-11-18']);
    expect(hitungStreak(aktivitas, HARI_INI)).toBe(0);
  });

  it('hari ini belum ada aktivitas, kemarin ada → streak tetap dihitung dari kemarin', () => {
    const aktivitas = new Set(['2026-11-18', '2026-11-19']);
    expect(hitungStreak(aktivitas, HARI_INI)).toBe(2);
  });
});

describe('property: telemetri', () => {
  it('transfer rate selalu dalam [0, 1] dan pembilang ≤ penyebut', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            framework_id: fc.constantFrom('f1', 'f2', 'f3'),
            masalah_id: fc.constantFrom('m-a', 'm-b'),
            skor: fc.integer({ min: 0, max: 3 }) as fc.Arbitrary<Skor>,
          }),
          { maxLength: 20 },
        ),
        (mentah) => {
          const a = buatMasalah({ id: 'm-a', judul: 'A', kriteria: ['eksternal'] });
          const b = buatMasalah({ id: 'm-b', judul: 'B', kriteria: ['persaingan'] });
          const byId = masalahById(a, b);
          const pemakaian = mentah.map((p) => buatPemakaian(p));
          const hasil = hitungTransferRate(pemakaian, byId, HARI_INI);
          expect(hasil.rate).toBeGreaterThanOrEqual(0);
          expect(hasil.rate).toBeLessThanOrEqual(1);
          expect(hasil.pembilang).toBeLessThanOrEqual(hasil.penyebut);
        },
      ),
    );
  });
});
