/**
 * Uji model layar catch-up: catchup.ts (dokumen 07 §3.1).
 * Pengelompokan sendiri diuji di scheduler.test.ts; di sini yang diuji
 * adalah lapisan tampilannya: nama framework, hari terlewat, dan input sesi.
 */
import { describe, expect, it } from 'vitest';
import type { ISODate } from '../src/domain';
import {
  DURASI_CATCH_UP_MENIT,
  inputSesiCatchUp,
  modelCatchUp,
} from '../src/catchup';
import { buatFramework, buatJadwal } from './factories';

const T = (s: string): ISODate => s as ISODate;

const FRAMEWORKS = [
  buatFramework({ id: 'pestel', nama: 'PESTEL Analysis' }),
  buatFramework({ id: 'porter-5f', nama: 'Porter Five Forces' }),
  buatFramework({ id: 'ansoff', nama: 'Ansoff Matrix' }),
  buatFramework({ id: 'vrio', nama: 'VRIO' }),
];

describe('modelCatchUp', () => {
  it('4 re-use terlewat >3 hari → 2 kelompok (3+1), nama + hari terlewat terisi', () => {
    const hariIni = T('2026-11-20');
    const jadwal = [
      buatJadwal({ framework_id: 'pestel', jatuh_tempo: T('2026-11-10'), status: 'terlewat' }),
      buatJadwal({ framework_id: 'porter-5f', jatuh_tempo: T('2026-11-12'), status: 'terlewat' }),
      buatJadwal({ framework_id: 'ansoff', jatuh_tempo: T('2026-11-14'), status: 'terlewat' }),
      buatJadwal({ framework_id: 'vrio', jatuh_tempo: T('2026-11-15'), status: 'terlewat' }),
    ];
    const hasil = modelCatchUp(jadwal, FRAMEWORKS, hariIni);
    expect(hasil).toHaveLength(2);
    expect(hasil[0].items).toHaveLength(3);
    expect(hasil[1].items).toHaveLength(1);
    expect(hasil[0].tanggal).toBe('2026-11-20');
    expect(hasil[1].tanggal).toBe('2026-11-21');
    // Paling lama tertinggal didahulukan.
    expect(hasil[0].items[0].frameworkNama).toBe('PESTEL Analysis');
    expect(hasil[0].items[0].hariTerlewat).toBe(10);
    expect(hasil[1].items[0].frameworkNama).toBe('VRIO');
    expect(hasil[1].items[0].hariTerlewat).toBe(5);
  });

  it('re-use terlewat ≤3 hari dan yang masih terjadwal tidak masuk catch-up', () => {
    const hariIni = T('2026-11-20');
    const jadwal = [
      buatJadwal({ jatuh_tempo: T('2026-11-17'), status: 'terlewat' }), // 3 hari
      buatJadwal({ jatuh_tempo: T('2026-11-18'), status: 'terlewat' }), // 2 hari
      buatJadwal({ jatuh_tempo: T('2026-11-10'), status: 'terjadwal' }), // belum ditandai
      buatJadwal({ jatuh_tempo: T('2026-11-10'), status: 'selesai' }),
    ];
    expect(modelCatchUp(jadwal, FRAMEWORKS, hariIni)).toEqual([]);
  });

  it('framework tidak ditemukan tetap ditampilkan (tidak disembunyikan)', () => {
    const hariIni = T('2026-11-20');
    const jadwal = [
      buatJadwal({ framework_id: 'hilang', jatuh_tempo: T('2026-11-10'), status: 'terlewat' }),
    ];
    const hasil = modelCatchUp(jadwal, FRAMEWORKS, hariIni);
    expect(hasil).toHaveLength(1);
    expect(hasil[0].items[0].frameworkNama).toBe('Framework tidak ditemukan');
  });

  it('daftar kosong → tidak ada kelompok', () => {
    expect(modelCatchUp([], FRAMEWORKS, T('2026-11-20'))).toEqual([]);
  });
});

describe('inputSesiCatchUp', () => {
  it('membuat input sesi catch_up 12 menit tanpa masalah (dipilih di layar)', () => {
    expect(inputSesiCatchUp('pestel')).toEqual({
      framework_id: 'pestel',
      masalah_id: null,
      jenis: 'catch_up',
      durasi_target_menit: DURASI_CATCH_UP_MENIT,
    });
    expect(DURASI_CATCH_UP_MENIT).toBe(12);
  });
});
