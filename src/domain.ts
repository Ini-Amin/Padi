/**
 * Tipe domain Padi: satu-satunya definisi entitas (dokumen 03 v0.3).
 *
 * Aturan yang ditegakkan tipe di sini:
 * - Tanggal adalah `ISODate` (string bermerek `YYYY-MM-DD`). Aritmetika tanggal
 *   hanya lewat `dates.ts`, tidak ada string tanggal bebas yang bisa salah tulis.
 * - `Skor` hanya 0–3 (union literal, bukan number bebas).
 * - `ide_kunci` tepat 3 (tuple), sesuai dokumen 03.
 * - `status` framework TIDAK PERNAH diisi manual: satu-satunya penulis adalah
 *   `refreshFrameworkStatus()` di db.ts, yang memanggil `hitungStatus()` murni
 *   di status.ts. Status "dikuasai" tidak bisa ditulis langsung. Ia hasil
 *   hitung dari tiga syarat (transfer + artefak berkualitas + kemandirian).
 * - `kualitas_terpenuhi` dan `total_xp` adalah nilai turunan, dihitung dari
 *   field sumbernya, bukan diisi sebagai input.
 */

/** Tanggal kalender `YYYY-MM-DD`. Buat hanya lewat `dates.ts`. */
export type ISODate = string & { readonly __brand: 'ISODate' };

/** Skor rubrik 0–3 (PRD M1). */
export type Skor = 0 | 1 | 2 | 3;

export type Tema = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';

export type StatusFramework =
  | 'belum_dipakai'
  | 'dipakai'
  | 'dikuasai'
  | 'perlu_reuse'
  | 'disembunyikan';

export type StatusMasalah = 'aktif' | 'selesai' | 'diarsipkan';

export type JenisSesi = 'penerapan' | 're_use' | 'catch_up' | 'capstone';

export type JenisReuse = 'H+1' | 'H+3' | 'H+7' | 'H+30' | 'tambahan';

export type StatusReuse = 'terjadwal' | 'selesai' | 'terlewat' | 'dibatalkan';

export type TipeEdge = 'prasyarat' | 'kontras' | 'dipakai_bersama' | 'satu_tema';

export type JenisArtefak = 'teks' | 'diagram' | 'memo' | 'analisis_perusahaan';

/** Kriteria masalah: kosakata matching (dokumen 03 §2.1, PRD M4). */
export type KriteriaMasalah =
  | 'eksternal'
  | 'persaingan'
  | 'tidak_tahu_fokus'
  | 'pertumbuhan'
  | 'pasar_baru'
  | 'produk_baru'
  | 'berwaktu'
  | 'sumber_daya_terbatas'
  | 'jangka_panjang';

/** Label Bahasa Indonesia untuk tiap kriteria (tampil di UI). */
export const LABEL_KRITERIA: Record<KriteriaMasalah, string> = {
  eksternal: 'faktor luar yang tidak bisa kukendalikan',
  persaingan: 'persaingan di industri/pasar',
  tidak_tahu_fokus: 'tidak tahu harus fokus ke mana',
  pertumbuhan: 'mencari arah pertumbuhan',
  pasar_baru: 'masuk pasar baru',
  produk_baru: 'meluncurkan produk/layanan baru',
  berwaktu: 'ada tenggat waktu',
  sumber_daya_terbatas: 'sumber daya terbatas',
  jangka_panjang: 'dampak jangka panjang',
};

export const NAMA_TEMA: Record<Tema, string> = {
  A: 'Lingkungan Eksternal',
  B: 'Internal & Nilai',
  C: 'Posisi & Inovasi',
  D: 'Keputusan Strategis',
  E: 'Model & Eksekusi',
  F: 'Kualitas & Perubahan',
  G: 'Pengukuran & Motivasi',
};

export interface Framework {
  id: string;
  nama: string;
  tema: Tema;
  /** Urutan tampil di katalog 1–22. BUKAN urutan belajar. */
  urutan_katalog: number;
  ringkasan: string;
  ide_kunci: [string, string, string];
  keterbatasan: string;
  /** 2–4 pola kriteria masalah yang cocok (dipakai matching engine). */
  signature_masalah: string[];
  /** Lapis (a): masalah seperti apa yang cocok diselesaikan framework ini. */
  lapis_a_pemetaan: string;
  /** Lapis (b): langkah memakai framework ini. */
  lapis_b_prosedur: string;
  /** Lapis (c): kesalahan umum, kapan framework ini salah alat. */
  lapis_c_kesalahan: string;
  sumber: string;
  diedit_user: boolean;
  /** Dihitung otomatis (hitungStatus). Jangan tulis langsung. */
  status: StatusFramework;
  skor_terakhir: Skor | null;
  dipakai_pertama_pada: ISODate | null;
  dikuasai_pada: ISODate | null;
  /** Tulisan user: kapan framework ini SALAH alat. Syarat "dikuasai". */
  kapan_tidak_pakai: string | null;
  /**
   * Tanggal user menyatakan sudah mengenal framework ini (onboarding Q3).
   * Framework yang dikenal BUKAN materi baru: tidak muncul di slot eksplorasi
   * matching (status.ts `materiBaru`) dan langsung ke penerapan, bukan ke
   * "materi baru". Ini BUKAN status. Status tetap dihitung dari pemakaian
   * (hitungStatus). Null = belum pernah dinyatakan dikenal.
   */
  dikenal_pada: ISODate | null;
  tidak_relevan_pada: ISODate | null;
  diaktifkan_pada: ISODate | null;
  /** Cache denormalisasi: artefak dari sesi yang selesai. */
  artefak_ids: string[];
}

export interface Edge {
  id?: number;
  dari: string;
  ke: string;
  tipe: TipeEdge;
  /** Wajib untuk prasyarat/kontras/dipakai_bersama; null untuk satu_tema. */
  alasan: string | null;
}

export interface Masalah {
  id: string;
  judul: string;
  deskripsi: string;
  kriteria: KriteriaMasalah[];
  status: StatusMasalah;
  dibuat_pada: ISODate;
  selesai_pada: ISODate | null;
}

export interface Pemakaian {
  id: string;
  framework_id: string;
  masalah_id: string;
  sesi_id: string;
  tanggal: ISODate;
  skor: Skor;
}

export interface Sesi {
  id: string;
  framework_id: string;
  /** Wajib untuk penerapan/re_use/catch_up; null untuk capstone lintas-masalah. */
  masalah_id: string | null;
  jenis: JenisSesi;
  tanggal: ISODate;
  durasi_menit: number;
  /** Dihitung dari aturan "selesai" (dokumen 03 §7), bukan diisi bebas. */
  selesai: boolean;
  skor: Skor | null;
  catatan: string;
  artefak_ids: string[];
  /** Untuk sesi yang masih berjalan: timestamp mulai (ms sejak epoch). */
  dimulai_pada_ms: number | null;
  /** Durasi target timer dalam menit (45 penerapan, 12 re-use). */
  durasi_target_menit: number;
}

export interface Artefak {
  id: string;
  framework_id: string;
  masalah_id: string;
  sesi_id: string;
  jenis: JenisArtefak;
  judul: string;
  /** Isi Markdown. */
  isi: string;
  perusahaan: string | null;
  kualitas_lengkap: boolean;
  kualitas_prioritasi: boolean;
  kualitas_rekomendasi: boolean;
  /** Turunan: lengkap AND prioritasi AND rekomendasi. */
  kualitas_terpenuhi: boolean;
  dibuat_pada: ISODate;
  terakhir_dibuka: ISODate;
}

export interface JadwalReuse {
  id: string;
  pemakaian_id: string;
  framework_id: string;
  jenis_reuse: JenisReuse;
  jatuh_tempo: ISODate;
  status: StatusReuse;
  skor: Skor | null;
  sesi_id: string | null;
  /** Untuk `tambahan`: ID re-use yang skornya <2 dan memicu ini. */
  reuse_asli_id: string | null;
  /** ID grup sesi catch-up (re-use yang digabung berbagi ID ini). */
  catch_up_group_id: string | null;
}

/** Satu baris progres. `total_xp` TIDAK disimpan, dihitung dari xp_ledger. */
export interface Progres {
  id: string;
  streak_hari: number;
  terakhir_aktif: ISODate | null;
  /** Peta tanggal → ada aktivitas (untuk hitung streak dan grafik 7 hari). */
  riwayat_harian: Record<string, boolean>;
  terakhir_ekspor_pada: ISODate | null;
}

export interface XpLedgerEntry {
  id: string;
  sesi_id: string;
  jenis: 'penerapan' | 're_use' | 'artefak_berkualitas' | 'skor_3';
  jumlah: number;
  dibuat_pada: ISODate;
}

export interface Capstone {
  id: string;
  masalah_id: string;
  perusahaan: string | null;
  framework_ids: string[];
  temuan: Record<string, string>;
  rekomendasi: string;
  risiko: string;
  status: 'draft' | 'selesai';
  selesai_pada: ISODate | null;
}

/** Umpan balik "tidak cocok" pada ranking matching (telemetri PRD M4). */
export interface UmpanBalikMatching {
  id: string;
  masalah_id: string;
  framework_ids: string[];
  alasan: string | null;
  dibuat_pada: ISODate;
}

/** Bentuk file graph.json (sumber kebenaran konten, dokumen 05 §2). */
export interface GraphData {
  nodes: Framework[];
  edges: Edge[];
}
