/**
 * Inferensi kriteria masalah dari teks bebas (modul murni).
 *
 * Onboarding tidak lagi mewajibkan user mencentang kriteria secara manual:
 * kriteria ditebak dari kata kunci Bahasa Indonesia di teks masalah, lalu
 * digabung (union) dengan kriteria yang user centang sendiri di akordeon
 * opsional. Bila tidak ada kata kunci yang cocok, fallback ke
 * `tidak_tahu_fokus` — matcher tidak pernah menerima nol kriteria.
 *
 * Kosakata diselaraskan dengan pola signature di matcher.ts
 * (POLA_KE_KRITERIA): kata kunci di sini adalah cara user sehari-hari
 * mengungkapkan pola yang sama (mis. "kompetitor" ~ memetakan_kekuatan_
 * kompetitif, "deadline" ~ tim_butuh_ritme_kerja).
 *
 * Pencocokan memakai batas kata (word boundary) agar tidak ada positif
 * palsu dari substring ("fokus" tidak cocok di "terfokus", "dana" tidak
 * cocok di "pendanaan"). Tanpa stemming: varian kata ditulis eksplisit
 * di tabel.
 */
import type { KriteriaMasalah } from './domain';

/** Urutan kanonis kriteria (sama dengan urutan deklarasi di domain.ts). */
export const URUTAN_KRITERIA: KriteriaMasalah[] = [
  'eksternal',
  'persaingan',
  'tidak_tahu_fokus',
  'pertumbuhan',
  'pasar_baru',
  'produk_baru',
  'berwaktu',
  'sumber_daya_terbatas',
  'jangka_panjang',
];

/**
 * Kata kunci per kriteria. Frasa multi-kata dicocokkan utuh (spasi
 * dinormalisasi dulu). Kata yang ambigu sengaja TIDAK ada di sini:
 * "skala" (bisa berarti skala prioritas, bukan pertumbuhan) dan
 * "pasar" saja (terlalu umum — hanya frasa "pasar baru" dkk. yang
 * masuk pasar_baru).
 */
export const KATA_KUNCI_KRITERIA: Record<KriteriaMasalah, string[]> = {
  eksternal: [
    'regulasi',
    'peraturan',
    'pemerintah',
    'kebijakan',
    'pajak',
    'ekonomi',
    'inflasi',
    'resesi',
    'tren',
    'teknologi',
    'pasar global',
    'suku bunga',
  ],
  persaingan: [
    'kompetitor',
    'saingan',
    'pesaing',
    'bersaing',
    'persaingan',
    'kompetitif',
    'pangsa pasar',
    'perang harga',
  ],
  tidak_tahu_fokus: [
    'tidak tahu',
    'tidak tau',
    'gak tahu',
    'nggak tahu',
    'bingung',
    'fokus',
    'ragu',
    'bimbang',
    'tidak jelas',
    'prioritas',
    'prioritaskan',
    'memprioritaskan',
    'stuck',
    'arah',
  ],
  pertumbuhan: [
    'tumbuh',
    'bertumbuh',
    'pertumbuhan',
    'berkembang',
    'membesarkan',
    'memperbesar',
    'scale up',
    'naik kelas',
    'mencari peluang',
  ],
  pasar_baru: [
    'pasar baru',
    'ekspansi',
    'pasar luar',
    'pasar internasional',
    'segmen baru',
    'pelanggan baru',
    'menjangkau pasar',
    'buka cabang',
  ],
  produk_baru: [
    'produk baru',
    'fitur baru',
    'layanan baru',
    'meluncurkan',
    'luncurkan',
    'mvp',
    'prototipe',
    'ide produk',
  ],
  berwaktu: [
    'deadline',
    'tenggat',
    'batas waktu',
    'terlambat',
    'menumpuk',
    'jadwal',
    'molor',
    'tepat waktu',
    'sprint',
  ],
  sumber_daya_terbatas: [
    'terbatas',
    'budget',
    'anggaran',
    'dana',
    'modal',
    'biaya',
    'mahal',
    'irit',
    'hemat',
    'kekurangan',
    'sumber daya',
    'tim kecil',
    'sendirian',
    'orang sedikit',
  ],
  jangka_panjang: [
    'jangka panjang',
    'visi',
    'masa depan',
    'berkelanjutan',
    'bertahan',
    'dampak jangka',
    'rencana jangka',
    'strategi jangka',
  ],
};

/** Fallback bila tidak ada kata kunci yang cocok. */
export const KRITERIA_FALLBACK: KriteriaMasalah = 'tidak_tahu_fokus';

function lolosKataBatas(teks: string, kata: string): boolean {
  const lolos = kata.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${lolos}\\b`, 'u').test(teks);
}

/**
 * Tebak kriteria dari teks masalah. Mengembalikan kriteria yang cocok
 * dalam urutan kanonis (tanpa duplikat); bila tidak ada yang cocok,
 * mengembalikan [tidak_tahu_fokus]. Tidak peka huruf besar/kecil.
 */
export function inferKriteria(teks: string): KriteriaMasalah[] {
  const normal = teks.toLowerCase().replace(/\s+/g, ' ');
  const hasil = URUTAN_KRITERIA.filter((k) =>
    KATA_KUNCI_KRITERIA[k].some((kata) => lolosKataBatas(normal, kata)),
  );
  return hasil.length > 0 ? hasil : [KRITERIA_FALLBACK];
}

/**
 * Gabung hasil inferensi dengan kriteria yang user centang manual:
 * union tanpa duplikat, dalam urutan kanonis. Hasil tidak pernah kosong
 * karena inferensi selalu mengembalikan minimal fallback.
 */
export function gabungKriteria(
  inferensi: readonly KriteriaMasalah[],
  manual: ReadonlySet<KriteriaMasalah>,
): KriteriaMasalah[] {
  const gabungan = new Set<KriteriaMasalah>([...inferensi, ...manual]);
  return URUTAN_KRITERIA.filter((k) => gabungan.has(k));
}
