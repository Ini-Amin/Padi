/**
 * Alur layar sesi: predikat murni (dipakai Session.tsx).
 * Dipisah agar bisa diuji tanpa DOM.
 */
import type { JenisSesi } from './domain';

/**
 * Apakah sesi ini harus memilih masalah dulu sebelum timer jalan?
 * Berlaku untuk re-use DAN catch-up tanpa masalah: keduanya menguji
 * penguasaan dengan menerapkan framework ke masalah BARU (retrieval
 * practice, Prinsip 5a). Masalah tidak boleh sudah pernah memakai
 * framework yang sama.
 */
export function perluPilihMasalah(
  jenis: JenisSesi,
  masalahId: string | null,
): boolean {
  return (jenis === 're_use' || jenis === 'catch_up') && masalahId === null;
}

/** Label Bahasa Indonesia untuk jenis sesi (tampil di layar sesi). */
export function labelJenisSesi(jenis: JenisSesi): string {
  switch (jenis) {
    case 'penerapan':
      return 'Penerapan';
    case 're_use':
      return 'Re-use';
    case 'catch_up':
      return 'Catch-up';
    case 'capstone':
      return 'Capstone';
  }
}

/**
 * Apakah "Selesai & Nilai" perlu konfirmasi dini? Berlaku bila timer sudah
 * berjalan tapi belum separuh target — menyelesaikan jauh lebih awal
 * biasanya tidak disengaja (klik salah atau belum paham target).
 */
export function perluKonfirmasiDini(
  elapsedDetik: number,
  targetDetik: number,
): boolean {
  return elapsedDetik > 0 && elapsedDetik < targetDetik / 2;
}

/**
 * Tahap panduan dari waktu berjalan (dokumen 03 §7): 0 Recall (0–5′),
 * 1 Prosedur (5–20′), 2 Penerapan (20–35′), 3 Artefak (35–45′).
 * Batas dihitung relatif terhadap target (batas_menit / 45 × target)
 * dengan aritmetika bulat agar tidak ada flicker di batas akibat float.
 * Target tidak valid (≤0 / bukan angka) diperlakukan sebagai 45 menit;
 * lewat target tetap Artefak.
 */
export function tahapDariElapsed(
  elapsedDetik: number,
  targetDetik: number,
): 0 | 1 | 2 | 3 {
  const target =
    Number.isFinite(targetDetik) && targetDetik > 0 ? targetDetik : 45 * 60;
  const batas = [5, 20, 35].map((m) => Math.round((target * m) / 45));
  const elapsed = Math.max(0, elapsedDetik);
  if (elapsed < batas[0]) return 0;
  if (elapsed < batas[1]) return 1;
  if (elapsed < batas[2]) return 2;
  return 3;
}

/**
 * Tahap yang dibuka saat tick bar progres diklik. Tick menandai batas
 * tahap, jadi tick menit ke-5 membuka Prosedur (tahap 1), ke-20 membuka
 * Penerapan (tahap 2), ke-35 membuka Artefak (tahap 3).
 */
export function tahapUntukTick(menitTanda: number): 0 | 1 | 2 | 3 {
  if (menitTanda <= 5) return 1;
  if (menitTanda <= 20) return 2;
  return 3;
}

/** Judul artefak default saat dicentang (diisi dari catatan sesi). */
export function judulArtefakDefault(
  namaFramework: string,
  judulMasalah: string | null,
): string {
  return judulMasalah
    ? `${namaFramework} untuk "${judulMasalah}"`
    : namaFramework;
}

/**
 * Label durasi sesi. Sesi di bawah 1 menit (mis. selesai dini setelah
 * 54 detik) ditampilkan "<1 menit", bukan "0 menit".
 */
export function formatDurasi(menit: number): string {
  return menit <= 0 ? '<1 menit' : `${menit} menit`;
}
