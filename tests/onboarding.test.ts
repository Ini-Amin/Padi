/**
 * Uji onboarding diagnostik (PRD M0, dokumen 02 US-0.1/US-0.2, dokumen 07
 * checklist manual #1). Modul murni di src/onboarding.ts + integrasi matcher
 * untuk framework dikenal (Q3). Alur DB ada di onboarding-db.test.ts.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { ISODate } from '../src/domain';
import { RUBRIK } from '../src/rubrik';
import { rankingUntukMasalah } from '../src/matcher';
import { materiBaru } from '../src/status';
import {
  JUMLAH_PERTANYAAN,
  bolehSelesaikan,
  cariFrameworkDariTeks,
  jalurAwal,
  jawabanKosong,
  jenisArtefakDefault,
  masalahDariJawaban,
  profilOnboardingAwal,
  profilSelesai,
  tampilkanOnboarding,
  type GayaBelajar,
  type JawabanOnboarding,
  type Membosankan,
  type PenghentiSesi,
  type ProfilOnboarding,
  type TerakhirPakai,
} from '../src/onboarding';
import { buatFramework, buatMasalah } from './factories';

const T = (s: string): ISODate => s as ISODate;

/** Katalog kecil untuk uji pencocokan Q3 (urutan katalog = penentu seri). */
const KATALOG = [
  buatFramework({ id: 'pestel', nama: 'PESTEL Analysis', urutan_katalog: 1 }),
  buatFramework({ id: 'porter-5f', nama: 'Porter Five Forces', urutan_katalog: 2 }),
  buatFramework({ id: 'bmc', nama: 'Business Model Canvas', urutan_katalog: 11 }),
  buatFramework({ id: 'kanban', nama: 'Kanban', urutan_katalog: 15 }),
  buatFramework({ id: 'dmaic', nama: 'Six Sigma DMAIC', urutan_katalog: 16 }),
  buatFramework({ id: 'agile-scrum', nama: 'Agile Scrum', urutan_katalog: 14 }),
];

const arbGaya = fc.constantFrom<GayaBelajar>('paham_konsep', 'pakai_konsep', 'review');
const arbMembosankan = fc.constantFrom<Membosankan>('membaca', 'menonton', 'latihan', 'mengajar');
const arbPenghenti = fc.constantFrom<PenghentiSesi>('distraksi', 'bosan', 'overwhelmed', 'tidak_tahu_mulai');
const arbTerakhir = fc.constantFrom<TerakhirPakai>('minggu_ini', 'bulan_ini', 'lebih_lama', 'tidak_ingat');

/** Sembarang jawaban: tiap pertanyaan boleh dijawab atau dilewati (null). */
const arbJawaban: fc.Arbitrary<JawabanOnboarding> = fc.record({
  masalah: fc.option(fc.string({ minLength: 1, maxLength: 40 }), { nil: null }),
  kriteria: fc.constant([]),
  gayaBelajar: fc.option(arbGaya, { nil: null }),
  frameworkDikenal: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: null }),
  terakhirPakai: fc.option(arbTerakhir, { nil: null }),
  membosankan: fc.option(arbMembosankan, { nil: null }),
  gagalKonsisten: fc.option(fc.integer({ min: 0, max: 14 }), { nil: null }),
  penghenti: fc.option(arbPenghenti, { nil: null }),
});

describe('struktur onboarding (PRD M0)', () => {
  it('tepat 6 pertanyaan diagnostik', () => {
    expect(JUMLAH_PERTANYAAN).toBe(6);
  });

  it('profil awal: belum selesai, semua jawaban kosong', () => {
    const profil = profilOnboardingAwal();
    expect(profil.selesai).toBe(false);
    expect(profil.selesaiPada).toBeNull();
    expect(profil.masalahId).toBeNull();
    expect(profil.frameworkDikenalId).toBeNull();
    expect(tampilkanOnboarding(profil)).toBe(true);
  });

  it('rubrik 0–3 (PRD M1) punya 4 butir dengan skor 0, 1, 2, 3', () => {
    expect(RUBRIK.map((r) => r.skor)).toEqual([0, 1, 2, 3]);
    expect(RUBRIK[2].judul).toBe('Bisa menerapkan');
    expect(RUBRIK[3].arti).toContain('masalah BARU');
  });
});

describe('masalahDariJawaban (Q1)', () => {
  it('Q1 dijawab → input buatMasalah dengan judul ter-trim', () => {
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

  it('Q1 dilewati (null) → tidak ada masalah', () => {
    expect(masalahDariJawaban(jawabanKosong())).toBeNull();
  });

  it('Q1 hanya spasi → tidak ada masalah', () => {
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

describe('jalurAwal (Q2 berpengaruh nyata)', () => {
  const tanpaMasalah = (gayaBelajar: ProfilOnboarding['gayaBelajar']) => ({
    masalahId: null,
    gayaBelajar,
  });

  it('punya masalah (Q1 dijawab) → problem-first, apa pun jawaban Q2', () => {
    expect(jalurAwal({ masalahId: 'm-1', gayaBelajar: 'paham_konsep' })).toBe(
      'problem-first',
    );
    expect(jalurAwal({ masalahId: 'm-1', gayaBelajar: null })).toBe(
      'problem-first',
    );
  });

  it('tanpa masalah + applier ("pakai konsep") → problem-first', () => {
    expect(jalurAwal(tanpaMasalah('pakai_konsep'))).toBe('problem-first');
  });

  it('tanpa masalah + learner ("paham konsep") → guided discovery', () => {
    expect(jalurAwal(tanpaMasalah('paham_konsep'))).toBe('guided-discovery');
  });

  it('tanpa masalah + review → guided discovery', () => {
    expect(jalurAwal(tanpaMasalah('review'))).toBe('guided-discovery');
  });

  it('tanpa masalah + Q2 dilewati → guided discovery', () => {
    expect(jalurAwal(tanpaMasalah(null))).toBe('guided-discovery');
  });
});

describe('cariFrameworkDariTeks (Q3)', () => {
  it('nama persis, tidak peduli huruf besar/kecil', () => {
    expect(cariFrameworkDariTeks('PESTEL Analysis', KATALOG)?.id).toBe('pestel');
    expect(cariFrameworkDariTeks('pestel analysis', KATALOG)?.id).toBe('pestel');
  });

  it('nama pendek ("pestel", "kanban")', () => {
    expect(cariFrameworkDariTeks('pestel', KATALOG)?.id).toBe('pestel');
    expect(cariFrameworkDariTeks('Kanban', KATALOG)?.id).toBe('kanban');
  });

  it('singkatan ("bmc")', () => {
    expect(cariFrameworkDariTeks('BMC', KATALOG)?.id).toBe('bmc');
  });

  it('substring nama ("porter", "scrum", "dmaic")', () => {
    expect(cariFrameworkDariTeks('porter', KATALOG)?.id).toBe('porter-5f');
    expect(cariFrameworkDariTeks('scrum', KATALOG)?.id).toBe('agile-scrum');
    expect(cariFrameworkDariTeks('dmaic', KATALOG)?.id).toBe('dmaic');
  });

  it('token di dalam kalimat ("saya tahu pestel")', () => {
    expect(cariFrameworkDariTeks('saya tahu pestel', KATALOG)?.id).toBe('pestel');
  });

  it('framework di luar katalog ("SWOT") → null', () => {
    expect(cariFrameworkDariTeks('SWOT', KATALOG)).toBeNull();
  });

  it('teks kosong → null', () => {
    expect(cariFrameworkDariTeks('', KATALOG)).toBeNull();
    expect(cariFrameworkDariTeks('   ', KATALOG)).toBeNull();
  });

  it('property: nama persis tiap framework di katalog selalu ditemukan', () => {
    fc.assert(
      fc.property(fc.constantFrom(...KATALOG), (f) => {
        expect(cariFrameworkDariTeks(f.nama, KATALOG)?.id).toBe(f.id);
      }),
    );
  });
});

describe('jenisArtefakDefault (Q4)', () => {
  it('membosankan membaca → diagram (bukan teks panjang)', () => {
    expect(jenisArtefakDefault('membaca')).toBe('diagram');
  });

  it('membosankan menonton/mengajar → teks; latihan → memo', () => {
    expect(jenisArtefakDefault('menonton')).toBe('teks');
    expect(jenisArtefakDefault('mengajar')).toBe('teks');
    expect(jenisArtefakDefault('latihan')).toBe('memo');
  });

  it('Q4 dilewati → teks (default lama)', () => {
    expect(jenisArtefakDefault(null)).toBe('teks');
  });
});

describe('materiBaru (status.ts) — framework dikenal bukan materi baru', () => {
  it('belum dipakai + belum dikenal → materi baru', () => {
    expect(materiBaru(buatFramework(), false)).toBe(true);
  });

  it('sudah dipakai → bukan materi baru', () => {
    expect(materiBaru(buatFramework(), true)).toBe(false);
  });

  it('belum dipakai tapi dikenal (Q3) → bukan materi baru', () => {
    expect(
      materiBaru(buatFramework({ dikenal_pada: T('2026-11-17') }), false),
    ).toBe(false);
  });

  it('baris lama tanpa nilai dikenal_pada tetap dihitung belum dikenal', () => {
    const lama = buatFramework();
    // @ts-expect-error — simulasi baris Dexie sebelum field ini ada.
    delete lama.dikenal_pada;
    expect(materiBaru(lama, false)).toBe(true);
  });
});

describe('matcher + framework dikenal (Q3)', () => {
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

  it('framework ke-4 dikenal (Q3) → slot eksplorasi pindah ke ke-5', () => {
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
      gayaBelajar: 'pakai_konsep',
    };
    const profil = profilSelesai(
      jawaban,
      { masalahId: 'm-1', frameworkDikenalId: 'pestel' },
      T('2026-11-17'),
    );
    expect(profil.selesai).toBe(true);
    expect(profil.selesaiPada).toBe('2026-11-17');
    expect(profil.masalah).toBe('Fokus segmen?');
    expect(profil.gayaBelajar).toBe('pakai_konsep');
    expect(profil.masalahId).toBe('m-1');
    expect(profil.frameworkDikenalId).toBe('pestel');
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
          { masalahId: null, frameworkDikenalId: null },
          T('2026-11-17'),
        );
        expect(profil.selesai).toBe(true);
        expect(tampilkanOnboarding(profil)).toBe(false);
        // Jawaban dipertahankan apa adanya (termasuk null = dilewati).
        expect(profil.masalah).toBe(jawaban.masalah);
        expect(profil.gayaBelajar).toBe(jawaban.gayaBelajar);
        expect(profil.penghenti).toBe(jawaban.penghenti);
      }),
    );
  });

  it('property: setelah selesai, gate tidak pernah terbuka lagi (tanpa ulang)', () => {
    fc.assert(
      fc.property(arbJawaban, (jawaban) => {
        const profil = profilSelesai(
          jawaban,
          { masalahId: null, frameworkDikenalId: null },
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

describe('layar penutup: ranking atau discovery', () => {
  it('dengan masalah → ranking bisa dihitung (reuse matcher)', () => {
    const masalah = buatMasalah({ kriteria: ['eksternal'] });
    const frameworks = [
      buatFramework({ id: 'pestel', signature_masalah: ['memecah_variabel_eksternal'] }),
    ];
    const hasil = rankingUntukMasalah(masalah, frameworks, new Set());
    expect(hasil.peringkat.length).toBeGreaterThan(0);
    expect(hasil.peringkat[0].alasan.length).toBeGreaterThan(0);
  });

  it('tanpa masalah → jalur guided discovery (bukan ranking kosong)', () => {
    const profil = profilSelesai(
      jawabanKosong(),
      { masalahId: null, frameworkDikenalId: null },
      T('2026-11-17'),
    );
    expect(profil.masalahId).toBeNull();
    expect(jalurAwal(profil)).toBe('guided-discovery');
  });
});
