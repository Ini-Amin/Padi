/**
 * Onboarding problem-first (PRD M0 revisi 17 Nov 2026, dokumen 04 §3.6):
 * modul murni. Satu-satunya langkah wajib adalah menyatakan satu masalah
 * nyata; Padi langsung menunjukkan 3 framework yang cocok, lalu user masuk
 * sesi 45 menit pertama. Tidak ada kuis, tidak ada skor diri.
 *
 * Pemisahan penyimpanan (dokumen 05 §1):
 * - Jawaban + flag selesai = pengaturan kecil → localStorage via store.ts.
 * - Masalah dari langkah pertama = data domain → Dexie via
 *   `terapkanHasilOnboarding()` di db.ts.
 *
 * Data yang dulu dikumpulkan diagnostik kini dikumpulkan di konteksnya:
 * - "Sudah tahu framework ini?" ditanya di detail framework
 *   (`tandaiDikenal()` di db.ts), bukan di onboarding.
 * - Konsistensi diukur dari pemakaian nyata (telemetri), bukan self-report.
 */
import type { ISODate, KriteriaMasalah } from './domain';

/**
 * Jawaban onboarding: satu masalah + kriteria opsional. `masalah` null
 * berarti user memilih "Lewati": onboarding selesai tanpa masalah.
 */
export interface JawabanOnboarding {
  /** Masalah nyata user (teks bebas). */
  masalah: string | null;
  /** Kriteria opsional untuk masalah (sama seperti Discovery/ProblemFlow). */
  kriteria: KriteriaMasalah[];
}

/** Semua jawaban kosong. Onboarding tetap bisa selesai dari sini. */
export function jawabanKosong(): JawabanOnboarding {
  return {
    masalah: null,
    kriteria: [],
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
  /** Masalah yang dibuat dari langkah pertama (null jika dilewati). */
  masalahId: string | null;
}

export function profilOnboardingAwal(): ProfilOnboarding {
  return {
    ...jawabanKosong(),
    selesai: false,
    selesaiPada: null,
    masalahId: null,
  };
}

/**
 * Bangun profil selesai dari jawaban + hasil penerapan ke domain.
 * Murni: dipakai komponen setelah `terapkanHasilOnboarding()` (db.ts).
 */
export function profilSelesai(
  jawaban: JawabanOnboarding,
  hasil: { masalahId: string | null },
  tanggal: ISODate,
): ProfilOnboarding {
  return {
    ...jawaban,
    kriteria: [...jawaban.kriteria],
    selesai: true,
    selesaiPada: tanggal,
    masalahId: hasil.masalahId,
  };
}

/** Gate first-run: onboarding muncul hanya jika belum selesai (US-0.1). */
export function tampilkanOnboarding(profil: ProfilOnboarding): boolean {
  return !profil.selesai;
}

/**
 * Penyelesaian hanya boleh terjadi sekali per alur, kecuali pengulangan
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
 * Input untuk `buatMasalah()` (db.ts) dari jawaban. Null jika dilewati
 * atau hanya spasi. Tidak ada masalah yang dibuat dari jawaban kosong.
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
