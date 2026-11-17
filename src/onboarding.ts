/**
 * Onboarding diagnostik (PRD M0, dokumen 02 US-0.1/US-0.2, dokumen 04 §3.6)
 * — modul murni. 6 pertanyaan, masing-masing BISA DILEWATI; tidak ada yang
 * wajib. Outputnya adalah rekomendasi awal yang bisa di-override user,
 * bukan kunci.
 *
 * Pemisahan penyimpanan (dokumen 05 §1):
 * - Jawaban + flag selesai = pengaturan kecil → localStorage via store.ts.
 * - Masalah dari Q1 + framework dikenal dari Q3 = data domain → Dexie
 *   via `terapkanHasilOnboarding()` di db.ts.
 *
 * Efek nyata jawaban pada jalur awal (bukan sekadar disimpan):
 * - Q1 dijawab → masalah dibuat, Beranda problem-first dengan ranking.
 * - Q1 dilewati + Q2 applier → Beranda problem-first (nyatakan masalah).
 * - Q1 dilewati + Q2 learner/review/dilewati → tawarkan guided discovery.
 * - Q3 cocok dengan katalog → framework ditandai dikenal, bukan materi baru.
 * - Q4 → jenis artefak default di penilaian sesi (bisa diubah).
 * - Q5/Q6 = telemetri lokal, bahan mentah personalisasi pasca-MVP (PRD M0).
 */
import type {
  Framework,
  ISODate,
  JenisArtefak,
  KriteriaMasalah,
} from './domain';

/** Q2: "Kalau 20 menit besok, kamu mau…?" */
export type GayaBelajar = 'paham_konsep' | 'pakai_konsep' | 'review';

export const LABEL_GAYA_BELAJAR: Record<GayaBelajar, string> = {
  paham_konsep: 'Paham konsep baru',
  pakai_konsep: 'Pakai konsep di pekerjaanmu',
  review: 'Review yang sudah lupa',
};

/** Q4: "Apa yang paling membosankan saat belajar?" */
export type Membosankan = 'membaca' | 'menonton' | 'latihan' | 'mengajar';

export const LABEL_MEMBOSANKAN: Record<Membosankan, string> = {
  membaca: 'Membaca',
  menonton: 'Menonton',
  latihan: 'Latihan',
  mengajar: 'Mengajar',
};

/** Q6: "Apa yang biasanya bikin kamu berhenti di tengah sesi?" */
export type PenghentiSesi =
  | 'distraksi'
  | 'bosan'
  | 'overwhelmed'
  | 'tidak_tahu_mulai';

export const LABEL_PENGHENTI: Record<PenghentiSesi, string> = {
  distraksi: 'Distraksi',
  bosan: 'Bosan',
  overwhelmed: 'Overwhelmed',
  tidak_tahu_mulai: 'Tidak tahu mulai dari mana',
};

/** Q3 (lanjutan): "Kapan terakhir kali kamu memakainya?" */
export type TerakhirPakai =
  | 'minggu_ini'
  | 'bulan_ini'
  | 'lebih_lama'
  | 'tidak_ingat';

export const LABEL_TERAKHIR_PAKAI: Record<TerakhirPakai, string> = {
  minggu_ini: 'Minggu ini',
  bulan_ini: 'Bulan ini',
  lebih_lama: 'Lebih dari sebulan lalu',
  tidak_ingat: 'Tidak ingat',
};

/** Jalur awal setelah onboarding (PRD M0). */
export type JalurAwal = 'problem-first' | 'guided-discovery';

/** Jumlah pertanyaan diagnostik (PRD M0). */
export const JUMLAH_PERTANYAAN = 6;

/**
 * Jawaban mentah 6 pertanyaan. `null` = dilewati. `kriteria` adalah chip
 * opsional di langkah Q1 (sama seperti Discovery/ProblemFlow) — tanpa
 * kriteria, matching tidak bisa memberi ranking untuk masalah Q1.
 */
export interface JawabanOnboarding {
  /** Q1: satu masalah nyata (teks bebas). */
  masalah: string | null;
  /** Kriteria opsional untuk masalah Q1. */
  kriteria: KriteriaMasalah[];
  /** Q2: learner vs applier vs review. */
  gayaBelajar: GayaBelajar | null;
  /** Q3: framework yang sudah dikenal (teks bebas, dicocokkan ke katalog). */
  frameworkDikenal: string | null;
  /** Q3 (lanjutan): kapan terakhir memakai framework itu. */
  terakhirPakai: TerakhirPakai | null;
  /** Q4: modality yang paling membosankan. */
  membosankan: Membosankan | null;
  /** Q5: berapa kali gagal konsisten dalam 2 minggu terakhir. */
  gagalKonsisten: number | null;
  /** Q6: failure mode yang biasa menghentikan sesi. */
  penghenti: PenghentiSesi | null;
}

/** Semua jawaban dilewati — onboarding tetap bisa selesai dari sini. */
export function jawabanKosong(): JawabanOnboarding {
  return {
    masalah: null,
    kriteria: [],
    gayaBelajar: null,
    frameworkDikenal: null,
    terakhirPakai: null,
    membosankan: null,
    gagalKonsisten: null,
    penghenti: null,
  };
}

/**
 * Profil onboarding yang di-persist (store.ts): jawaban + hasil penerapan
 * ke domain + flag selesai. `selesai` hanya berubah false → true; tidak
 * pernah kembali false (mengulang onboarding memperbarui jawaban, bukan
 * membuka gate lagi).
 */
export interface ProfilOnboarding extends JawabanOnboarding {
  selesai: boolean;
  selesaiPada: ISODate | null;
  /** Masalah yang dibuat dari Q1 (null jika Q1 dilewati). */
  masalahId: string | null;
  /** Framework katalog yang cocok dengan jawaban Q3 (null jika tidak cocok). */
  frameworkDikenalId: string | null;
}

export function profilOnboardingAwal(): ProfilOnboarding {
  return {
    ...jawabanKosong(),
    selesai: false,
    selesaiPada: null,
    masalahId: null,
    frameworkDikenalId: null,
  };
}

/**
 * Bangun profil selesai dari jawaban + hasil penerapan ke domain.
 * Murni: dipakai komponen setelah `terapkanHasilOnboarding()` (db.ts).
 */
export function profilSelesai(
  jawaban: JawabanOnboarding,
  hasil: { masalahId: string | null; frameworkDikenalId: string | null },
  tanggal: ISODate,
): ProfilOnboarding {
  return {
    ...jawaban,
    kriteria: [...jawaban.kriteria],
    selesai: true,
    selesaiPada: tanggal,
    masalahId: hasil.masalahId,
    frameworkDikenalId: hasil.frameworkDikenalId,
  };
}

/** Gate first-run: onboarding muncul hanya jika belum selesai (US-0.1). */
export function tampilkanOnboarding(profil: ProfilOnboarding): boolean {
  return !profil.selesai;
}

/**
 * Penyelesaian hanya boleh terjadi sekali per alur — kecuali pengulangan
 * eksplisit dari layar Progres. Mencegah masalah ganda dari penyelesaian
 * yang sama dipanggil dua kali (klik ganda, re-render).
 */
export function bolehSelesaikan(
  profil: ProfilOnboarding,
  ulang: boolean,
): boolean {
  return ulang || !profil.selesai;
}

/**
 * Input untuk `buatMasalah()` (db.ts) dari jawaban Q1. Null jika Q1 dilewati
 * atau hanya spasi — tidak ada masalah yang dibuat dari jawaban kosong.
 */
export function masalahDariJawaban(
  jawaban: JawabanOnboarding,
): { judul: string; deskripsi: string; kriteria: KriteriaMasalah[] } | null {
  const judul = (jawaban.masalah ?? '').trim();
  if (judul.length === 0) return null;
  return {
    judul,
    deskripsi: 'Dinyatakan saat onboarding.',
    kriteria: [...new Set(jawaban.kriteria)],
  };
}

/**
 * Jalur awal setelah onboarding. Aturan (PRD M0):
 * - Punya masalah (Q1 dijawab) → problem-first, apa pun jawaban Q2.
 * - Tanpa masalah + applier (Q2 "pakai konsep") → problem-first: Beranda
 *   mengajak menyatakan masalah langsung.
 * - Tanpa masalah + learner/review/Q2 dilewati → guided discovery dulu.
 */
export function jalurAwal(
  profil: Pick<ProfilOnboarding, 'masalahId' | 'gayaBelajar'>,
): JalurAwal {
  if (profil.masalahId !== null) return 'problem-first';
  if (profil.gayaBelajar === 'pakai_konsep') return 'problem-first';
  return 'guided-discovery';
}

/** Normalisasi untuk pencocokan nama framework (Q3): huruf kecil, tanpa spasi/tanda baca. */
function normalisasiNama(teks: string): string {
  return teks.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Singkatan dari nama (huruf pertama tiap kata), misal "Business Model Canvas" → "bmc". */
function singkatan(nama: string): string {
  return nama
    .split(/[^A-Za-z0-9]+/)
    .filter((kata) => kata.length > 0)
    .map((kata) => kata[0].toLowerCase())
    .join('');
}

/**
 * Cocokkan teks bebas Q3 ("Sebut satu framework yang sudah kamu tahu")
 * dengan satu framework di katalog. Null jika tidak ada yang cocok — teks
 * tetap disimpan di profil, tapi tidak ada framework yang ditandai dikenal.
 *
 * Urutan pencocokan (deterministik, urutan katalog sebagai penentu seri):
 * 1. Sama persis dengan nama / id / singkatan ("bmc", "pestel").
 * 2. Substring nama (min 4 karakter): "porter", "scrum", "kanban".
 * 3. Token nama di dalam teks ("saya tahu pestel" → PESTEL).
 */
export function cariFrameworkDariTeks(
  teks: string,
  frameworks: Framework[],
): Framework | null {
  const input = normalisasiNama(teks);
  if (input.length === 0) return null;

  const terurut = [...frameworks].sort(
    (a, b) => a.urutan_katalog - b.urutan_katalog,
  );

  for (const f of terurut) {
    const nama = normalisasiNama(f.nama);
    if (
      input === nama ||
      input === normalisasiNama(f.id) ||
      input === singkatan(f.nama)
    ) {
      return f;
    }
  }

  if (input.length >= 4) {
    for (const f of terurut) {
      if (normalisasiNama(f.nama).includes(input)) return f;
    }
  }

  for (const f of terurut) {
    const token = f.nama
      .split(/[^A-Za-z0-9]+/)
      .map((kata) => normalisasiNama(kata))
      .filter((kata) => kata.length >= 4);
    if (token.some((t) => input.includes(t))) return f;
  }

  return null;
}

/**
 * Jenis artefak default di penilaian sesi dari jawaban Q4: hindari modality
 * yang paling membosankan. Ini hanya default — user bisa mengubahnya di
 * form artefak (rekomendasi awal yang bisa di-override, PRD M0).
 */
export function jenisArtefakDefault(
  membosankan: Membosankan | null,
): JenisArtefak {
  switch (membosankan) {
    case 'membaca':
      return 'diagram'; // bukan teks panjang
    case 'menonton':
      return 'teks';
    case 'latihan':
      return 'memo'; // ringkas, satu halaman
    case 'mengajar':
      return 'teks';
    default:
      return 'teks';
  }
}
