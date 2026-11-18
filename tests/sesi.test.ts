/**
 * Uji alur layar sesi: sesi.ts.
 * Re-use dan catch-up sama-sama meminta masalah BARU sebelum timer jalan
 * (retrieval practice); penerapan dan capstone tidak.
 */
import { describe, expect, it } from 'vitest';
import {
  formatDurasi,
  judulArtefakDefault,
  labelJenisSesi,
  perluKonfirmasiDini,
  perluPilihMasalah,
  tahapDariElapsed,
  tahapUntukTick,
} from '../src/sesi';

describe('perluPilihMasalah', () => {
  it('re-use dan catch-up tanpa masalah → pilih masalah dulu', () => {
    expect(perluPilihMasalah('re_use', null)).toBe(true);
    expect(perluPilihMasalah('catch_up', null)).toBe(true);
  });

  it('re-use dan catch-up dengan masalah → langsung ke timer', () => {
    expect(perluPilihMasalah('re_use', 'masalah-1')).toBe(false);
    expect(perluPilihMasalah('catch_up', 'masalah-1')).toBe(false);
  });

  it('penerapan dan capstone tidak pernah meminta pilih masalah', () => {
    expect(perluPilihMasalah('penerapan', null)).toBe(false);
    expect(perluPilihMasalah('capstone', null)).toBe(false);
  });
});

describe('labelJenisSesi', () => {
  it('semua jenis punya label Bahasa Indonesia', () => {
    expect(labelJenisSesi('penerapan')).toBe('Penerapan');
    expect(labelJenisSesi('re_use')).toBe('Re-use');
    expect(labelJenisSesi('catch_up')).toBe('Catch-up');
    expect(labelJenisSesi('capstone')).toBe('Capstone');
  });
});

describe('perluKonfirmasiDini', () => {
  it('timer belum jalan → tidak perlu (tombol nonaktif)', () => {
    expect(perluKonfirmasiDini(0, 2700)).toBe(false);
  });

  it('di bawah separuh target → perlu konfirmasi', () => {
    expect(perluKonfirmasiDini(95, 2700)).toBe(true);
    expect(perluKonfirmasiDini(1349, 2700)).toBe(true);
  });

  it('separuh target atau lebih → langsung ke penilaian', () => {
    expect(perluKonfirmasiDini(1350, 2700)).toBe(false);
    expect(perluKonfirmasiDini(2700, 2700)).toBe(false);
  });

  it('target 12 menit (re-use): batas separuh 360 detik', () => {
    expect(perluKonfirmasiDini(359, 720)).toBe(true);
    expect(perluKonfirmasiDini(360, 720)).toBe(false);
  });
});

describe('judulArtefakDefault', () => {
  it('memakai nama framework + judul masalah', () => {
    expect(judulArtefakDefault('OKRs', 'Tidak tahu tujuan hidup')).toBe(
      'OKRs untuk "Tidak tahu tujuan hidup"',
    );
  });

  it('tanpa masalah → hanya nama framework', () => {
    expect(judulArtefakDefault('OKRs', null)).toBe('OKRs');
  });
});

describe('formatDurasi', () => {
  it('0 menit → "<1 menit", bukan "0 menit"', () => {
    expect(formatDurasi(0)).toBe('<1 menit');
  });

  it('durasi normal memakai "N menit"', () => {
    expect(formatDurasi(1)).toBe('1 menit');
    expect(formatDurasi(45)).toBe('45 menit');
  });
});

describe('tahapDariElapsed', () => {
  it('batas 45 menit: 0/299 Recall, 300 Prosedur, 1200 Penerapan, 2100 Artefak', () => {
    expect(tahapDariElapsed(0, 2700)).toBe(0);
    expect(tahapDariElapsed(299, 2700)).toBe(0);
    expect(tahapDariElapsed(300, 2700)).toBe(1);
    expect(tahapDariElapsed(301, 2700)).toBe(1);
    expect(tahapDariElapsed(1199, 2700)).toBe(1);
    expect(tahapDariElapsed(1200, 2700)).toBe(2);
    expect(tahapDariElapsed(2099, 2700)).toBe(2);
    expect(tahapDariElapsed(2100, 2700)).toBe(3);
  });

  it('lewat target tetap Artefak', () => {
    expect(tahapDariElapsed(2700, 2700)).toBe(3);
    expect(tahapDariElapsed(5000, 2700)).toBe(3);
  });

  it('target tidak valid diperlakukan sebagai 45 menit', () => {
    expect(tahapDariElapsed(300, 0)).toBe(1);
    expect(tahapDariElapsed(300, -5)).toBe(1);
    expect(tahapDariElapsed(300, Number.NaN)).toBe(1);
    expect(tahapDariElapsed(299, Number.NaN)).toBe(0);
    expect(tahapDariElapsed(300, Number.POSITIVE_INFINITY)).toBe(1);
  });

  it('elapsed negatif dijepit ke 0 (Recall)', () => {
    expect(tahapDariElapsed(-10, 2700)).toBe(0);
  });

  it('batas diskalakan ke target lain (12 menit → 80/320/560 detik)', () => {
    expect(tahapDariElapsed(79, 720)).toBe(0);
    expect(tahapDariElapsed(80, 720)).toBe(1);
    expect(tahapDariElapsed(319, 720)).toBe(1);
    expect(tahapDariElapsed(320, 720)).toBe(2);
    expect(tahapDariElapsed(560, 720)).toBe(3);
  });
});

describe('tahapUntukTick', () => {
  it('tick 5→Prosedur, 20→Penerapan, 35→Artefak', () => {
    expect(tahapUntukTick(5)).toBe(1);
    expect(tahapUntukTick(20)).toBe(2);
    expect(tahapUntukTick(35)).toBe(3);
  });
});
