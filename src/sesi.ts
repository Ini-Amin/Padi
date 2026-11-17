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
