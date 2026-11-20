/**
 * Uji inferKriteria: heuristik kata kunci Bahasa Indonesia untuk menebak
 * kriteria masalah dari teks bebas (dipakai Onboarding; wizard dan
 * Discovery tetap memakai centang manual). Modul murni, tanpa DOM/DB.
 */
import { describe, expect, it } from 'vitest';
import {
  KATA_KUNCI_KRITERIA,
  URUTAN_KRITERIA,
  gabungKriteria,
  inferKriteria,
} from '../src/inferKriteria';
import type { KriteriaMasalah } from '../src/domain';

describe('inferKriteria: satu kriteria per contoh', () => {
  const kasus: Array<[string, KriteriaMasalah]> = [
    ['Regulasi baru membuat usaha saya sulit bergerak.', 'eksternal'],
    ['Kompetitor banting harga terus-terusan.', 'persaingan'],
    ['Saya bingung harus mulai dari mana.', 'tidak_tahu_fokus'],
    ['Usaha saya tidak bertumbuh tiga tahun terakhir.', 'pertumbuhan'],
    ['Kami mau ekspansi ke pasar baru di luar pulau.', 'pasar_baru'],
    ['Saya mau meluncurkan produk baru bulan depan.', 'produk_baru'],
    ['Deadline proyek selalu terlewat.', 'berwaktu'],
    ['Modal kami terbatas, tidak bisa rekrut orang.', 'sumber_daya_terbatas'],
    ['Saya butuh visi jangka panjang untuk perusahaan ini.', 'jangka_panjang'],
  ];
  for (const [teks, kriteria] of kasus) {
    it(`"${teks}" → ${kriteria}`, () => {
      expect(inferKriteria(teks)).toContain(kriteria);
    });
  }
});

describe('inferKriteria: fallback', () => {
  it('teks tanpa kata kunci → tidak_tahu_fokus', () => {
    expect(inferKriteria('Toko online saya sepi pembeli.')).toEqual([
      'tidak_tahu_fokus',
    ]);
  });

  it('teks kosong / hanya spasi → tidak_tahu_fokus', () => {
    expect(inferKriteria('')).toEqual(['tidak_tahu_fokus']);
    expect(inferKriteria('   ')).toEqual(['tidak_tahu_fokus']);
  });
});

describe('inferKriteria: batas kata (tanpa positif palsu substring)', () => {
  it('"terfokus" tidak memicu "fokus"', () => {
    // "deadline" memicu berwaktu agar fallback tidak menyala dan
    // ketidakhadiran tidak_tahu_fokus bisa diuji.
    expect(
      inferKriteria('Tim saya terfokus mengejar deadline, tapi hasilnya nihil.'),
    ).toEqual(['berwaktu']);
  });

  it('"pendanaan" tidak memicu "dana"', () => {
    expect(
      inferKriteria('Pendanaan tahap awal sudah cair, tapi kompetitor agresif.'),
    ).toEqual(['persaingan']);
  });

  it('"skala prioritas" tidak memicu pertumbuhan (skala ambigu, sengaja tidak ada)', () => {
    expect(
      inferKriteria('Saya tidak paham skala prioritas tugas ini.'),
    ).not.toContain('pertumbuhan');
  });

  it('"pasar" saja tidak memicu pasar_baru', () => {
    expect(inferKriteria('Pasar sedang ramai.')).not.toContain('pasar_baru');
  });
});

describe('inferKriteria: perilaku umum', () => {
  it('tidak peka huruf besar/kecil', () => {
    expect(inferKriteria('DEADLINE DAN BUDGET kacau.')).toEqual(
      expect.arrayContaining(['berwaktu', 'sumber_daya_terbatas']),
    );
  });

  it('multi-kriteria: mengembalikan semuanya dalam urutan kanonis', () => {
    const hasil = inferKriteria(
      'Kompetitor menekan, budget terbatas, dan deadline mepet.',
    );
    expect(hasil).toEqual(['persaingan', 'berwaktu', 'sumber_daya_terbatas']);
  });

  it('frasa multi-kata dicocokkan utuh (spasi ganda tidak merusak)', () => {
    expect(inferKriteria('Kami masuk  pasar   baru tahun ini.')).toContain(
      'pasar_baru',
    );
  });

  it('varian kolokial "nggak tahu" dan "tidak tau" dikenali', () => {
    expect(inferKriteria('Saya nggak tahu mau ngapain.')).toContain(
      'tidak_tahu_fokus',
    );
    expect(inferKriteria('Saya tidak tau arahnya.')).toContain(
      'tidak_tahu_fokus',
    );
  });

  it('tanpa duplikat meski banyak kata kunci satu kriteria', () => {
    const hasil = inferKriteria('Bingung, ragu, dan tidak tahu harus fokus ke mana.');
    expect(hasil.filter((k) => k === 'tidak_tahu_fokus')).toHaveLength(1);
  });

  it('setiap kriteria punya minimal satu kata kunci', () => {
    for (const k of URUTAN_KRITERIA) {
      expect(KATA_KUNCI_KRITERIA[k].length).toBeGreaterThan(0);
    }
  });
});

describe('gabungKriteria: union inferensi + manual', () => {
  it('menggabungkan tanpa duplikat, dalam urutan kanonis', () => {
    const hasil = gabungKriteria(
      ['persaingan'],
      new Set<KriteriaMasalah>(['persaingan', 'berwaktu']),
    );
    expect(hasil).toEqual(['persaingan', 'berwaktu']);
  });

  it('manual kosong → hasil inferensi apa adanya', () => {
    expect(gabungKriteria(['pasar_baru'], new Set())).toEqual(['pasar_baru']);
  });

  it('manual menambah kriteria yang tidak terinferensi', () => {
    expect(
      gabungKriteria(['tidak_tahu_fokus'], new Set<KriteriaMasalah>(['eksternal'])),
    ).toEqual(['eksternal', 'tidak_tahu_fokus']);
  });
});
