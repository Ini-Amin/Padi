/**
 * Uji alur layar sesi: sesi.ts.
 * Re-use dan catch-up sama-sama meminta masalah BARU sebelum timer jalan
 * (retrieval practice); penerapan dan capstone tidak.
 */
import { describe, expect, it } from 'vitest';
import { labelJenisSesi, perluPilihMasalah } from '../src/sesi';

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
