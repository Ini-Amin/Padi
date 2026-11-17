/**
 * Uji onboarding problem-first (PRD M0 revisi 17 Nov 2026, dokumen 02
 * US-0.1/US-0.2, dokumen 07 checklist manual #1). Modul murni di
 * src/onboarding.ts + integrasi matcher untuk framework dikenal
 * (ditandai dari detail framework). Alur DB ada di onboarding-db.test.ts.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { ISODate } from '../src/domain';
import { RUBRIK } from '../src/rubrik';
import { rankingUntukMasalah } from '../src/matcher';
import { materiBaru } from '../src/status';
import {
  bolehSelesaikan,
  jawabanKosong,
  masalahDariJawaban,
  profilOnboardingAwal,
  profilSelesai,
  tampilkanOnboarding,
  type JawabanOnboarding,
} from '../src/onboarding';
import { buatFramework, buatMasalah } from './factories';

const T = (s: string): ISODate => s as ISODate;

/** Sembarang jawaban: masalah boleh dijawab atau dilewati (null). */
const arbJawaban: fc.Arbitrary<JawabanOnboarding> = fc.record({
  masalah: fc.option(fc.string({ minLength: 1, maxLength: 40 }), { nil: null }),
  kriteria: fc.constant([]),
});

describe('struktur onboarding (PRD M0 revisi 17 Nov 2026)', () => {
  it('profil awal: belum selesai, semua jawaban kosong', () => {
    const profil = profilOnboardingAwal();
    expect(profil.selesai).toBe(false);
    expect(profil.selesaiPada).toBeNull();
    expect(profil.masalahId).toBeNull();
    expect(profil.masalah).toBeNull();
    expect(profil.kriteria).toEqual([]);
    expect(tampilkanOnboarding(profil)).toBe(true);
  });

  it('rubrik 0–3 (PRD M1) punya 4 butir dengan skor 0, 1, 2, 3', () => {
    expect(RUBRIK.map((r) => r.skor)).toEqual([0, 1, 2, 3]);
    expect(RUBRIK[2].judul).toBe('Bisa menerapkan');
    expect(RUBRIK[3].arti).toContain('masalah BARU');
  });
});

describe('masalahDariJawaban', () => {
  it('masalah dijawab → input buatMasalah dengan judul ter-trim', () => {
    const hasil = masalahDariJawaban({
      ...jawabanKosong(),
      masalah: '  Startup saya bingung fokus  ',
      kriteria: ['tidak_tahu_fokus'],
    });
    expect(hasil).toEqual({
      judul: 'Startup saya bingung fokus',
      deskripsi: 'Dinyatakan saat onboarding.',
      kriteria: ['tidak_tahu_fokus'],
    });
  });

  it('masalah dilewati (null) → tidak ada masalah', () => {
    expect(masalahDariJawaban(jawabanKosong())).toBeNull();
  });

  it('masalah hanya spasi → tidak ada masalah', () => {
    expect(
      masalahDariJawaban({ ...jawabanKosong(), masalah: '   ' }),
    ).toBeNull();
  });

  it('kriteria dideduplikasi', () => {
    const hasil = masalahDariJawaban({
      ...jawabanKosong(),
      masalah: 'X',
      kriteria: ['eksternal', 'eksternal', 'berwaktu'],
    });
    expect(hasil?.kriteria).toEqual(['eksternal', 'berwaktu']);
  });
});

describe('materiBaru (status.ts): framework dikenal bukan materi baru', () => {
  it('belum dipakai + belum dikenal → materi baru', () => {
    expect(materiBaru(buatFramework(), false)).toBe(true);
  });

  it('sudah dipakai → bukan materi baru', () => {
    expect(materiBaru(buatFramework(), true)).toBe(false);
  });

  it('belum dipakai tapi dikenal (ditandai dari detail framework) → bukan materi baru', () => {
    expect(
      materiBaru(buatFramework({ dikenal_pada: T('2026-11-17') }), false),
    ).toBe(false);
  });

  it('baris lama tanpa nilai dikenal_pada tetap dihitung belum dikenal', () => {
    const lama = buatFramework();
    // @ts-expect-error: simulasi baris Dexie sebelum field ini ada.
    delete lama.dikenal_pada;
    expect(materiBaru(lama, false)).toBe(true);
  });
});

describe('matcher + framework dikenal (ditandai dari detail framework)', () => {
  // 5 framework, semuanya cocok kriteria 'eksternal' (skor 1): peringkat
  // mengambil 3 pertama, slot eksplorasi mengambil yang ke-4.
  const lima = [
    buatFramework({ id: 'f1', urutan_katalog: 1, signature_masalah: ['memecah_variabel_eksternal'] }),
    buatFramework({ id: 'f2', urutan_katalog: 2, signature_masalah: ['menilai_daya_tarik_industri'] }),
    buatFramework({ id: 'f3', urutan_katalog: 3, signature_masalah: ['menilai_pengaruh_makro'] }),
    buatFramework({ id: 'f4', urutan_katalog: 4, signature_masalah: ['memetakan_tren_jauh'] }),
    buatFramework({ id: 'f5', urutan_katalog: 5, signature_masalah: ['memecah_variabel_eksternal'] }),
  ];
  const masalah = buatMasalah({ kriteria: ['eksternal'] });

  it('baseline: slot eksplorasi = framework ke-4 yang belum dipakai', () => {
    const hasil = rankingUntukMasalah(masalah, lima, new Set());
    expect(hasil.peringkat.map((h) => h.framework.id)).toEqual(['f1', 'f2', 'f3']);
    expect(hasil.eksplorasi?.framework.id).toBe('f4');
  });

  it('framework ke-4 dikenal → slot eksplorasi pindah ke ke-5', () => {
    const dikenal = lima.map((f) =>
      f.id === 'f4' ? { ...f, dikenal_pada: T('2026-11-17') } : f,
    );
    const hasil = rankingUntukMasalah(masalah, dikenal, new Set());
    expect(hasil.eksplorasi?.framework.id).toBe('f5');
  });

  it('semua kandidat eksplorasi dikenal → tidak ada slot eksplorasi', () => {
    const dikenal = lima.map((f) =>
      f.id === 'f4' || f.id === 'f5'
        ? { ...f, dikenal_pada: T('2026-11-17') }
        : f,
    );
    const hasil = rankingUntukMasalah(masalah, dikenal, new Set());
    expect(hasil.eksplorasi).toBeNull();
  });

  it('framework dikenal TETAP bisa masuk peringkat (langsung ke penerapan)', () => {
    const dikenal = lima.map((f) =>
      f.id === 'f1' ? { ...f, dikenal_pada: T('2026-11-17') } : f,
    );
    const hasil = rankingUntukMasalah(masalah, dikenal, new Set());
    expect(hasil.peringkat.map((h) => h.framework.id)).toContain('f1');
  });
});

describe('penyelesaian + gate first-run', () => {
  it('profilSelesai: selesai=true, jawaban + hasil domain tersimpan', () => {
    const jawaban: JawabanOnboarding = {
      ...jawabanKosong(),
      masalah: 'Fokus segmen?',
      kriteria: ['tidak_tahu_fokus'],
    };
    const profil = profilSelesai(jawaban, { masalahId: 'm-1' }, T('2026-11-17'));
    expect(profil.selesai).toBe(true);
    expect(profil.selesaiPada).toBe('2026-11-17');
    expect(profil.masalah).toBe('Fokus segmen?');
    expect(profil.kriteria).toEqual(['tidak_tahu_fokus']);
    expect(profil.masalahId).toBe('m-1');
    expect(tampilkanOnboarding(profil)).toBe(false);
  });

  it('"Lewati": profil selesai tanpa masalah (masalahId null)', () => {
    const profil = profilSelesai(
      jawabanKosong(),
      { masalahId: null },
      T('2026-11-17'),
    );
    expect(profil.selesai).toBe(true);
    expect(profil.masalah).toBeNull();
    expect(profil.masalahId).toBeNull();
    expect(tampilkanOnboarding(profil)).toBe(false);
  });

  it('bolehSelesaikan: belum selesai → boleh; sudah selesai → tidak, kecuali ulang', () => {
    const belum = profilOnboardingAwal();
    const sudah = { ...belum, selesai: true };
    expect(bolehSelesaikan(belum, false)).toBe(true);
    expect(bolehSelesaikan(sudah, false)).toBe(false);
    expect(bolehSelesaikan(sudah, true)).toBe(true);
  });

  it('property: pola lewati APAPUN (termasuk lewati semua) tetap bisa selesai', () => {
    fc.assert(
      fc.property(arbJawaban, (jawaban) => {
        // Gate terbuka sebelum selesai, tertutup setelah selesai.
        expect(bolehSelesaikan(profilOnboardingAwal(), false)).toBe(true);
        const profil = profilSelesai(
          jawaban,
          { masalahId: null },
          T('2026-11-17'),
        );
        expect(profil.selesai).toBe(true);
        expect(tampilkanOnboarding(profil)).toBe(false);
        // Jawaban dipertahankan apa adanya (termasuk null = dilewati).
        expect(profil.masalah).toBe(jawaban.masalah);
        expect(profil.kriteria).toEqual(jawaban.kriteria);
      }),
    );
  });

  it('property: setelah selesai, gate tidak pernah terbuka lagi (tanpa ulang)', () => {
    fc.assert(
      fc.property(arbJawaban, (jawaban) => {
        const profil = profilSelesai(
          jawaban,
          { masalahId: null },
          T('2026-11-17'),
        );
        expect(tampilkanOnboarding(profil)).toBe(false);
        expect(bolehSelesaikan(profil, false)).toBe(false);
        // Mengulang eksplisit tetap diizinkan.
        expect(bolehSelesaikan(profil, true)).toBe(true);
      }),
    );
  });
});

describe('langkah 2: ranking untuk masalah baru', () => {
  it('dengan masalah → ranking bisa dihitung (reuse matcher)', () => {
    const masalah = buatMasalah({ kriteria: ['eksternal'] });
    const frameworks = [
      buatFramework({ id: 'pestel', signature_masalah: ['memecah_variabel_eksternal'] }),
    ];
    const hasil = rankingUntukMasalah(masalah, frameworks, new Set());
    expect(hasil.peringkat.length).toBeGreaterThan(0);
    expect(hasil.peringkat[0].alasan.length).toBeGreaterThan(0);
  });
});
