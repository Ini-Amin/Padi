/**
 * Uji matcher — ranking kriteria + alasan + slot eksplorasi (dokumen 07 §3.1).
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { Framework, KriteriaMasalah } from '../src/domain';
import {
  alternatifBerikutnya,
  rankingUntukMasalah,
  skorFramework,
} from '../src/matcher';
import { buatFramework, buatMasalah } from './factories';

const SEMUA_FRAMEWORK: Framework[] = [
  buatFramework({
    id: 'pestel',
    nama: 'PESTEL Analysis',
    urutan_katalog: 1,
    signature_masalah: ['memecah_variabel_eksternal', 'menilai_pengaruh_makro', 'memetakan_tren_jauh'],
  }),
  buatFramework({
    id: 'porter-5f',
    nama: 'Porter Five Forces',
    urutan_katalog: 2,
    signature_masalah: ['menilai_daya_tarik_industri', 'memetakan_kekuatan_kompetitif', 'memahami_struktur_persaingan'],
  }),
  buatFramework({
    id: 'ansoff',
    nama: 'Ansoff Matrix',
    urutan_katalog: 3,
    signature_masalah: ['memilih_arah_pertumbuhan', 'tidak_tahu_fokus', 'memprioritaskan_peluang_pasar'],
  }),
  // Framework ke-4 (hanya untuk pengujian slot eksplorasi: dengan 3 framework,
  // top-3 selalu berisi semua yang berskor > 0 sehingga slot eksplorasi
  // tidak pernah terisi).
  buatFramework({
    id: 'bcg',
    nama: 'BCG Matrix',
    urutan_katalog: 7,
    signature_masalah: ['memprioritaskan_peluang_pasar'],
  }),
];

describe('ranking contoh (dokumen 03 §4)', () => {
  it('masalah "startup tidak tahu fokus ke segmen mana" → Ansoff di 3 teratas', () => {
    const masalah = buatMasalah({
      judul: 'Startup saya tidak tahu harus fokus ke segmen mana',
      kriteria: ['tidak_tahu_fokus', 'sumber_daya_terbatas'],
    });
    const { peringkat } = rankingUntukMasalah(masalah, SEMUA_FRAMEWORK, new Set());
    expect(peringkat.length).toBeGreaterThan(0);
    expect(peringkat[0].framework.id).toBe('ansoff');
    expect(peringkat[0].alasan).toContain('tidak tahu harus fokus ke mana');
  });

  it('setiap hasil ranking punya alasan yang menyebut kriteria yang cocok', () => {
    const masalah = buatMasalah({
      judul: 'Regulasi baru mengancam pasar kami',
      kriteria: ['eksternal', 'jangka_panjang'],
    });
    const { peringkat } = rankingUntukMasalah(masalah, SEMUA_FRAMEWORK, new Set());
    expect(peringkat[0].framework.id).toBe('pestel');
    expect(peringkat[0].kriteriaCocok).toContain('eksternal');
    expect(peringkat[0].alasan).toContain('faktor luar');
  });

  it('masalah tanpa kriteria yang cocok → ranking kosong', () => {
    const masalah = buatMasalah({ judul: 'Masalah tanpa kriteria', kriteria: [] });
    const { peringkat, eksplorasi } = rankingUntukMasalah(masalah, SEMUA_FRAMEWORK, new Set());
    expect(peringkat).toEqual([]);
    expect(eksplorasi).toBeNull();
  });
});

describe('slot eksplorasi (PRD M4)', () => {
  it('slot eksplorasi selalu framework yang belum pernah dipakai user', () => {
    const masalah = buatMasalah({
      judul: 'Masalah eksternal dan persaingan',
      kriteria: ['eksternal', 'persaingan'],
    });
    // User pernah memakai PESTEL + Porter → eksplorasi bukan keduanya.
    const { eksplorasi } = rankingUntukMasalah(
      masalah,
      SEMUA_FRAMEWORK,
      new Set(['pestel', 'porter-5f']),
    );
    // Ansoff skor 0 untuk kriteria ini → tidak ada eksplorasi yang valid.
    expect(eksplorasi).toBeNull();

    // Dengan kriteria yang juga cocok untuk BCG, eksplorasi = BCG
    // (peringkat 1–3 terisi PESTEL/Porter/Ansoff; BCG belum pernah dipakai).
    const masalah2 = buatMasalah({
      judul: 'Masalah campuran',
      kriteria: ['eksternal', 'pertumbuhan'],
    });
    const hasil2 = rankingUntukMasalah(masalah2, SEMUA_FRAMEWORK, new Set(['pestel']));
    expect(hasil2.peringkat.map((h) => h.framework.id)).toEqual([
      'pestel',
      'porter-5f',
      'ansoff',
    ]);
    expect(hasil2.eksplorasi?.framework.id).toBe('bcg');
  });

  it('eksplorasi tidak pernah duplikat peringkat', () => {
    const masalah = buatMasalah({
      judul: 'Masalah campuran',
      kriteria: ['eksternal', 'persaingan', 'pertumbuhan'],
    });
    const { peringkat, eksplorasi } = rankingUntukMasalah(masalah, SEMUA_FRAMEWORK, new Set());
    if (eksplorasi) {
      expect(peringkat.map((h) => h.framework.id)).not.toContain(eksplorasi.framework.id);
    }
  });
});

describe('framework disembunyikan', () => {
  it('tidak pernah muncul di ranking', () => {
    const frameworks = SEMUA_FRAMEWORK.map((f) =>
      f.id === 'ansoff' ? { ...f, status: 'disembunyikan' as const } : f,
    );
    const masalah = buatMasalah({
      judul: 'Startup tidak tahu fokus',
      kriteria: ['tidak_tahu_fokus', 'sumber_daya_terbatas'],
    });
    const { peringkat, eksplorasi } = rankingUntukMasalah(masalah, frameworks, new Set());
    expect(peringkat.map((h) => h.framework.id)).not.toContain('ansoff');
    expect(eksplorasi?.framework.id).not.toBe('ansoff');
  });
});

describe('alternatifBerikutnya ("Ganti")', () => {
  it('menampilkan peringkat 4–6, bukan yang sudah tampil', () => {
    const masalah = buatMasalah({
      judul: 'Masalah campuran',
      kriteria: ['eksternal', 'persaingan', 'pertumbuhan', 'tidak_tahu_fokus'],
    });
    const { peringkat } = rankingUntukMasalah(masalah, SEMUA_FRAMEWORK, new Set());
    const sudahTampil = new Set(peringkat.map((h) => h.framework.id));
    const alternatif = alternatifBerikutnya(masalah, SEMUA_FRAMEWORK, sudahTampil);
    for (const a of alternatif) {
      expect(sudahTampil.has(a.framework.id)).toBe(false);
      expect(a.skor).toBeGreaterThan(0);
    }
  });
});

describe('property: ranking', () => {
  const arbKriteria = fc
    .array(
      fc.constantFrom(
        'eksternal',
        'persaingan',
        'tidak_tahu_fokus',
        'pertumbuhan',
        'pasar_baru',
        'produk_baru',
        'berwaktu',
        'sumber_daya_terbatas',
        'jangka_panjang',
      ) as fc.Arbitrary<KriteriaMasalah>,
      { minLength: 0, maxLength: 5 },
    )
    .map((arr) => [...new Set(arr)]);

  it('peringkat selalu urut skor turun, lalu urutan katalog', () => {
    fc.assert(
      fc.property(arbKriteria, (kriteria) => {
        const masalah = buatMasalah({ kriteria });
        const { peringkat } = rankingUntukMasalah(masalah, SEMUA_FRAMEWORK, new Set());
        for (let i = 1; i < peringkat.length; i++) {
          const a = peringkat[i - 1];
          const b = peringkat[i];
          expect(
            a.skor > b.skor ||
              (a.skor === b.skor &&
                a.framework.urutan_katalog < b.framework.urutan_katalog),
          ).toBe(true);
        }
      }),
    );
  });

  it('setiap item peringkat punya skor > 0 dan alasan yang menyebut ≥1 kriteria cocok', () => {
    fc.assert(
      fc.property(arbKriteria, (kriteria) => {
        const masalah = buatMasalah({ kriteria });
        const { peringkat } = rankingUntukMasalah(masalah, SEMUA_FRAMEWORK, new Set());
        for (const h of peringkat) {
          expect(h.skor).toBeGreaterThan(0);
          expect(h.kriteriaCocok.length).toBeGreaterThan(0);
          expect(h.alasan.length).toBeGreaterThan(0);
        }
      }),
    );
  });

  it('skor = jumlah kriteria masalah yang tercakup signature', () => {
    fc.assert(
      fc.property(arbKriteria, (kriteria) => {
        const masalah = buatMasalah({ kriteria });
        for (const f of SEMUA_FRAMEWORK) {
          const hasil = skorFramework(f, masalah);
          expect(hasil.skor).toBe(hasil.kriteriaCocok.length);
          expect(hasil.skor).toBeLessThanOrEqual(kriteria.length);
        }
      }),
    );
  });
});
