/**
 * Matching engine: modul murni, tanpa AI (PRD M4, dokumen 05 §1).
 * Masalah user (kriteria dari flow pertanyaan terbimbing) dicocokkan dengan
 * signature masalah tiap framework. Output: ranking 3 teratas + 1 slot
 * "coba yang belum pernah". TIDAK PERNAH satu jawaban pasti.
 */
import type { Framework, KriteriaMasalah, Masalah } from './domain';
import { LABEL_KRITERIA as LABEL } from './domain';
import { materiBaru } from './status';

/**
 * Pemetaan pola signature → kriteria masalah yang dicakupnya.
 * Pola adalah data (dari graph.json); pemetaan ini adalah aturan matching.
 * Setiap pola baru di graph.json WAJIB punya entri di sini (diuji di
 * tests/graph.test.ts lewat daftar pola yang dikenal).
 */
export const POLA_KE_KRITERIA: Record<string, KriteriaMasalah[]> = {
  memecah_variabel_eksternal: ['eksternal'],
  menilai_pengaruh_makro: ['eksternal', 'jangka_panjang'],
  memetakan_tren_jauh: ['eksternal', 'jangka_panjang'],
  menilai_daya_tarik_industri: ['persaingan', 'eksternal'],
  memetakan_kekuatan_kompetitif: ['persaingan'],
  memahami_struktur_persaingan: ['persaingan', 'jangka_panjang'],
  memilih_arah_pertumbuhan: ['pertumbuhan', 'tidak_tahu_fokus'],
  tidak_tahu_fokus: ['tidak_tahu_fokus'],
  memprioritaskan_peluang_pasar: [
    'pertumbuhan',
    'pasar_baru',
    'produk_baru',
    'sumber_daya_terbatas',
  ],
  // Fase 0: Value Chain (B)
  memetakan_aktivitas_internal: ['persaingan', 'sumber_daya_terbatas'],
  mencari_sumber_biaya_tinggi: ['sumber_daya_terbatas'],
  memahami_dari_mana_nilai_datang: ['persaingan', 'jangka_panjang'],
  // Fase 0: VRIO (B)
  menguji_keunggulan_bersaing: ['persaingan', 'jangka_panjang'],
  menilai_aset_dan_kemampuan: ['persaingan', 'sumber_daya_terbatas'],
  menentukan_apa_yang_dilindungi: ['persaingan', 'jangka_panjang'],
  // Fase 0: Core Competencies (B)
  menentukan_kemampuan_inti: ['persaingan', 'jangka_panjang'],
  memutuskan_bangun_atau_beli: ['sumber_daya_terbatas', 'produk_baru'],
  memfokuskan_keahlian_pembeda: ['persaingan', 'jangka_panjang'],
  // Fase 0: BCG Matrix (C)
  memetakan_portofolio_produk: ['pertumbuhan', 'sumber_daya_terbatas'],
  mengalokasikan_dana_antar_unit: ['sumber_daya_terbatas', 'pertumbuhan'],
  menilai_produk_bertumbuh_vs_mapan: ['pertumbuhan', 'jangka_panjang'],
  // Fase 0: Blue Ocean Strategy (C)
  mencari_ruang_pasar_baru: ['pasar_baru', 'pertumbuhan'],
  persaingan_harga_makin_ketat: ['persaingan', 'pasar_baru'],
  menciptakan_permintaan_baru: ['pasar_baru', 'produk_baru'],
  // Fase 0: McKinsey Three Horizons (D)
  menyeimbangkan_kini_dan_masa_depan: ['jangka_panjang', 'pertumbuhan'],
  inovasi_tergerus_urusan_harian: ['jangka_panjang', 'sumber_daya_terbatas'],
  memetakan_jadwal_pertumbuhan: ['pertumbuhan', 'jangka_panjang'],
  // Fase 0: McKinsey 7S (D)
  mendiagnosis_organisasi_tidak_selaras: ['jangka_panjang'],
  perubahan_mentok_karena_budaya: ['jangka_panjang'],
  menyelaraskan_struktur_dan_sdm: ['sumber_daya_terbatas', 'jangka_panjang'],
  // Fase 0: Business Model Canvas (E)
  merancang_model_bisnis: ['produk_baru', 'pasar_baru'],
  tidak_jelas_dari_mana_untung: ['produk_baru', 'sumber_daya_terbatas'],
  memetakan_cara_perusahaan_bekerja: ['pertumbuhan', 'produk_baru'],
  // Fase 0: Lean Startup (E)
  menguji_asumsi_paling_berisiko: ['produk_baru', 'sumber_daya_terbatas'],
  memutuskan_pivot_atau_lanjut: ['produk_baru', 'pertumbuhan'],
  membangun_tanpa_validasi: ['produk_baru', 'sumber_daya_terbatas'],
  // Fase 0: Design Thinking (E)
  memahami_masalah_pengguna: ['produk_baru', 'pasar_baru'],
  solusi_tidak_dipakai_pengguna: ['produk_baru'],
  mencari_ide_dari_empati: ['produk_baru', 'pertumbuhan'],
  // Fase 0: Agile Scrum (E)
  mengirim_produk_secara_iteratif: ['berwaktu', 'produk_baru'],
  proyek_molol_tanpa_hasil_terlihat: ['berwaktu', 'sumber_daya_terbatas'],
  tim_butuh_ritme_kerja: ['berwaktu'],
  // Fase 0: Kanban (E)
  pekerjaan_menumpuk_tidak_selesai: ['berwaktu', 'sumber_daya_terbatas'],
  memvisualkan_alur_kerja: ['berwaktu'],
  membatasi_pekerjaan_berjalan: ['sumber_daya_terbatas', 'berwaktu'],
  // Fase 0: Six Sigma DMAIC (F)
  mengurangi_cacat_proses: ['sumber_daya_terbatas', 'jangka_panjang'],
  memperbaiki_proses_yang_boros: ['sumber_daya_terbatas'],
  kualitas_tidak_konsisten: ['jangka_panjang', 'sumber_daya_terbatas'],
  // Fase 0: Lewin Change Model (F)
  memulai_perubahan_dari_status_quo: ['jangka_panjang'],
  perubahan_kembali_ke_kebiasaan_lama: ['jangka_panjang'],
  memahami_tahapan_perubahan: ['jangka_panjang', 'tidak_tahu_fokus'],
  // Fase 0: Kotter 8-Step (F)
  memimpin_perubahan_organisasi: ['jangka_panjang'],
  perubahan_ditolak_karyawan: ['jangka_panjang', 'tidak_tahu_fokus'],
  inisiatif_perubahan_mati_di_tengah: ['jangka_panjang', 'berwaktu'],
  // Fase 0: ADKAR (F)
  individu_belum_siap_berubah: ['jangka_panjang'],
  perubahan_gagal_di_level_orang: ['jangka_panjang'],
  mengelola_transisi_individu: ['jangka_panjang', 'berwaktu'],
  // Fase 0: Balanced Scorecard (G)
  mengukur_kinerja_menyeluruh: ['jangka_panjang', 'berwaktu'],
  menyelaraskan_target_antar_bagian: ['jangka_panjang'],
  strategi_tidak_turun_ke_aksi: ['jangka_panjang', 'berwaktu'],
  // Fase 0: OKRs (G)
  menetapkan_target_terukur: ['berwaktu', 'jangka_panjang'],
  menyelaraskan_tim_pada_tujuan: ['tidak_tahu_fokus', 'berwaktu'],
  fokus_terpecah_terlalu_banyak_target: ['tidak_tahu_fokus', 'sumber_daya_terbatas'],
  // Fase 0: AIDA (G)
  mengubah_perhatian_jadi_pembelian: ['pasar_baru', 'produk_baru'],
  pelanggan_tidak_sampai_ke_keputusan: ['pasar_baru'],
  merancang_alur_pemasaran: ['pasar_baru', 'pertumbuhan'],
};

export interface HasilMatching {
  framework: Framework;
  /** Jumlah kriteria masalah yang tercakup signature framework. */
  skor: number;
  kriteriaCocok: KriteriaMasalah[];
  alasan: string;
}

/** Kriteria yang dicakup signature sebuah framework. */
export function kriteriaDicakup(framework: Framework): Set<KriteriaMasalah> {
  const hasil = new Set<KriteriaMasalah>();
  for (const pola of framework.signature_masalah) {
    for (const k of POLA_KE_KRITERIA[pola] ?? []) hasil.add(k);
  }
  return hasil;
}

function buatAlasan(kriteriaCocok: KriteriaMasalah[]): string {
  if (kriteriaCocok.length === 0) return 'Kecocokan parsial dengan masalahmu.';
  const label = kriteriaCocok.map((k) => LABEL[k]);
  if (label.length === 1) return `Cocok karena masalahmu ${label[0]}.`;
  const awal = label.slice(0, -1).join(', ');
  return `Cocok karena masalahmu ${awal} dan ${label[label.length - 1]}.`;
}

/** Skor satu framework untuk satu masalah (0 jika tidak ada kriteria cocok). */
export function skorFramework(
  framework: Framework,
  masalah: Masalah,
): HasilMatching {
  const dicakup = kriteriaDicakup(framework);
  const kriteriaCocok = masalah.kriteria.filter((k) => dicakup.has(k));
  return {
    framework,
    skor: kriteriaCocok.length,
    kriteriaCocok,
    alasan: buatAlasan(kriteriaCocok),
  };
}

export interface HasilRanking {
  /** 3 teratas dengan skor > 0, urut skor turun lalu urutan katalog. */
  peringkat: HasilMatching[];
  /**
   * Slot eksplorasi: framework dengan kecocokan parsial (skor > 0) yang
   * BELUM PERNAH dipakai user dan tidak ada di peringkat. Null jika tidak ada.
   */
  eksplorasi: HasilMatching | null;
}

/**
 * Ranking untuk satu masalah. Framework yang ditandai tidak relevan
 * (`disembunyikan`) tidak pernah muncul di ranking (PRD Bagian 4).
 */
export function rankingUntukMasalah(
  masalah: Masalah,
  frameworks: Framework[],
  frameworkPernahDipakai: ReadonlySet<string>,
): HasilRanking {
  const kandidat = frameworks
    .filter((f) => f.status !== 'disembunyikan')
    .map((f) => skorFramework(f, masalah))
    .filter((h) => h.skor > 0)
    .sort(
      (a, b) =>
        b.skor - a.skor ||
        a.framework.urutan_katalog - b.framework.urutan_katalog,
    );
  const peringkat = kandidat.slice(0, 3);
  const idPeringkat = new Set(peringkat.map((h) => h.framework.id));
  // Slot eksplorasi = "materi baru": belum pernah dipakai DAN belum dikenal
  // (onboarding Q3). Framework yang dikenal tidak ditawarkan di sini.
  const eksplorasi =
    kandidat.find(
      (h) =>
        materiBaru(h.framework, frameworkPernahDipakai.has(h.framework.id)) &&
        !idPeringkat.has(h.framework.id),
    ) ?? null;
  return { peringkat, eksplorasi };
}

/** Alternatif berikutnya (peringkat 4–6) saat user menekan "Ganti". */
export function alternatifBerikutnya(
  masalah: Masalah,
  frameworks: Framework[],
  sudahTampil: ReadonlySet<string>,
): HasilMatching[] {
  return frameworks
    .filter((f) => f.status !== 'disembunyikan' && !sudahTampil.has(f.id))
    .map((f) => skorFramework(f, masalah))
    .filter((h) => h.skor > 0)
    .sort(
      (a, b) =>
        b.skor - a.skor ||
        a.framework.urutan_katalog - b.framework.urutan_katalog,
    )
    .slice(0, 3);
}
