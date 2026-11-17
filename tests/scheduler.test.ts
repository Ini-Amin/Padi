/**
 * Uji scheduler: aritmetika tanggal re-use (dokumen 07 §3.1).
 * Contoh-contoh dari PRD M2 dan dokumen 07, ditambah property test fast-check.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { ISODate } from '../src/domain';
import { selisihHari, tambahHari } from '../src/dates';
import {
  jadwalBerikutnya,
  jadwalDariPemakaian,
  jadwalTambahan,
  kelompokCatchUp,
  perluCatchUp,
  reuseJatuhTempo,
} from '../src/scheduler';
import { buatJadwal } from './factories';

const T = (s: string): ISODate => s as ISODate;

/** Sembarang tanggal kalender dalam 2020–2030. */
const arbTanggal = fc
  .integer({ min: 0, max: 3650 })
  .map((n) => tambahHari(T('2020-01-01'), n));

describe('jadwalDariPemakaian (contoh PRD M2)', () => {
  it('16 Nov 2026 → H+1 17 Nov, H+3 19 Nov, H+7 23 Nov, H+30 16 Des', () => {
    const jadwal = jadwalDariPemakaian(T('2026-11-16'));
    expect(jadwal).toEqual([
      { jenis_reuse: 'H+1', jatuh_tempo: '2026-11-17' },
      { jenis_reuse: 'H+3', jatuh_tempo: '2026-11-19' },
      { jenis_reuse: 'H+7', jatuh_tempo: '2026-11-23' },
      { jenis_reuse: 'H+30', jatuh_tempo: '2026-12-16' },
    ]);
  });

  it('30 Des 2026 → H+7 melewati tahun baru: 6 Jan 2027', () => {
    const jadwal = jadwalDariPemakaian(T('2026-12-30'));
    expect(jadwal[2]).toEqual({ jenis_reuse: 'H+7', jatuh_tempo: '2027-01-06' });
  });

  it('28 Feb 2027 → H+3 melewati bulan: 3 Mar 2027', () => {
    const jadwal = jadwalDariPemakaian(T('2027-02-28'));
    expect(jadwal[1]).toEqual({ jenis_reuse: 'H+3', jatuh_tempo: '2027-03-03' });
  });
});

describe('jadwalBerikutnya: dari tanggal DISELESAIKAN', () => {
  it('H+3 jatuh tempo 19 Nov, dikerjakan 23 Nov → H+7 berikutnya 30 Nov', () => {
    expect(jadwalBerikutnya('H+3', T('2026-11-23'))).toEqual({
      jenis_reuse: 'H+7',
      jatuh_tempo: '2026-11-30',
    });
  });

  it('H+30 selesai → tidak ada re-use berikutnya', () => {
    expect(jadwalBerikutnya('H+30', T('2026-12-16'))).toBeNull();
  });

  it('rantai lengkap: H+1 → H+3 → H+7 → H+30 → null', () => {
    expect(jadwalBerikutnya('H+1', T('2026-11-17'))?.jenis_reuse).toBe('H+3');
    expect(jadwalBerikutnya('H+7', T('2026-11-23'))?.jenis_reuse).toBe('H+30');
  });
});

describe('jadwalTambahan (skor re-use <2)', () => {
  it('re-use 20 Nov skor 1 → tambahan 27 Nov', () => {
    expect(jadwalTambahan(T('2026-11-20'))).toEqual({
      jenis_reuse: 'tambahan',
      jatuh_tempo: '2026-11-27',
    });
  });
});

describe('catch-up (dokumen 07 §3.1)', () => {
  it('10 re-use tertinggal → 4 sesi (3+3+3+1) dalam 4 hari berturut-turut', () => {
    const hariIni = T('2026-11-20');
    // Semua 10 item terlewat >3 hari (5–14 hari) agar masuk aturan catch-up.
    const daftar = Array.from({ length: 10 }, (_, i) =>
      buatJadwal({
        status: 'terlewat',
        jatuh_tempo: tambahHari(hariIni, -(14 - i)),
      }),
    );
    const kelompok = kelompokCatchUp(daftar, hariIni);
    expect(kelompok.map((k) => k.items.length)).toEqual([3, 3, 3, 1]);
    expect(kelompok.map((k) => k.tanggal)).toEqual([
      '2026-11-20',
      '2026-11-21',
      '2026-11-22',
      '2026-11-23',
    ]);
  });

  it('terlewat ≤3 hari tidak masuk catch-up', () => {
    const hariIni = T('2026-11-20');
    const baru = buatJadwal({ status: 'terlewat', jatuh_tempo: T('2026-11-18') });
    const lama = buatJadwal({ status: 'terlewat', jatuh_tempo: T('2026-11-16') });
    expect(perluCatchUp(baru, hariIni)).toBe(false);
    expect(perluCatchUp(lama, hariIni)).toBe(true);
  });
});

describe('reuseJatuhTempo', () => {
  it('hanya yang terjadwal/terlewat dan jatuh tempo ≤ hari ini, urut tertua dulu', () => {
    const hariIni = T('2026-11-20');
    const daftar = [
      buatJadwal({ status: 'terjadwal', jatuh_tempo: T('2026-11-21') }),
      buatJadwal({ status: 'terlewat', jatuh_tempo: T('2026-11-18') }),
      buatJadwal({ status: 'selesai', jatuh_tempo: T('2026-11-15') }),
      buatJadwal({ status: 'terjadwal', jatuh_tempo: T('2026-11-20') }),
    ];
    const hasil = reuseJatuhTempo(daftar, hariIni);
    expect(hasil.map((j) => j.jatuh_tempo)).toEqual(['2026-11-18', '2026-11-20']);
  });
});

describe('property: aritmetika tanggal', () => {
  it('tambahHari lalu selisihHari mengembalikan n', () => {
    fc.assert(
      fc.property(arbTanggal, fc.integer({ min: -365, max: 365 }), (d, n) => {
        expect(selisihHari(d, tambahHari(d, n))).toBe(n);
      }),
    );
  });

  it('H+30 selalu tepat tanggal pemakaian + 30 hari', () => {
    fc.assert(
      fc.property(arbTanggal, (d) => {
        const jadwal = jadwalDariPemakaian(d);
        expect(jadwal[3].jatuh_tempo).toBe(tambahHari(d, 30));
      }),
    );
  });

  it('interval selalu [1, 3, 7, 30] dan jatuh tempo menaik', () => {
    fc.assert(
      fc.property(arbTanggal, (d) => {
        const jadwal = jadwalDariPemakaian(d);
        expect(jadwal.map((j) => selisihHari(d, j.jatuh_tempo))).toEqual([1, 3, 7, 30]);
        const tanggal = jadwal.map((j) => j.jatuh_tempo);
        expect([...tanggal].sort()).toEqual(tanggal);
      }),
    );
  });

  it('jadwalBerikutnya: jatuh tempo = tanggal diselesaikan + interval berikutnya', () => {
    const interval: Record<string, number> = { 'H+3': 3, 'H+7': 7, 'H+30': 30 };
    fc.assert(
      fc.property(
        arbTanggal,
        fc.constantFrom('H+1', 'H+3', 'H+7') as fc.Arbitrary<'H+1' | 'H+3' | 'H+7'>,
        (d, jenis) => {
          const berikut = jadwalBerikutnya(jenis, d);
          expect(berikut).not.toBeNull();
          expect(berikut!.jatuh_tempo).toBe(tambahHari(d, interval[berikut!.jenis_reuse]));
        },
      ),
    );
  });
});

describe('property: catch-up tidak pernah kehilangan item', () => {
  it('setiap item muncul tepat sekali, tiap kelompok ≤3, tanggal berurutan dari hari ini', () => {
    fc.assert(
      fc.property(
        arbTanggal,
        fc.integer({ min: 0, max: 25 }),
        fc.integer({ min: 4, max: 60 }),
        (hariIni, jumlah, hariTerlewat) => {
          const daftar = Array.from({ length: jumlah }, (_, i) =>
            buatJadwal({
              status: 'terlewat',
              jatuh_tempo: tambahHari(hariIni, -(hariTerlewat + i)),
            }),
          );
          const kelompok = kelompokCatchUp(daftar, hariIni);
          const semuaItem = kelompok.flatMap((k) => k.items);
          expect(semuaItem).toHaveLength(jumlah);
          expect(new Set(semuaItem.map((j) => j.id)).size).toBe(jumlah);
          for (const k of kelompok) {
            expect(k.items.length).toBeLessThanOrEqual(3);
            expect(k.items.length).toBeGreaterThan(0);
          }
          kelompok.forEach((k, i) => {
            expect(k.tanggal).toBe(tambahHari(hariIni, i));
          });
        },
      ),
    );
  });
});
