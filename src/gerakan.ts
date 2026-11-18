/**
 * Gerakan (Paket 3): hook bersama untuk animasi. Satu-satunya tempat yang
 * membaca `prefers-reduced-motion`: semua animasi mati bila user memintanya.
 *
 * Pembagian tugas antar library (dokumen 04 §5):
 * - AutoAnimate: transisi layout otomatis (daftar berubah isi/urutan).
 * - Animasi mount (reveal Ranking, transisi langkah Onboarding): CSS
 *   murni (kelas .baris-ranking-masuk / .langkah-masuk, dipasang hanya
 *   bila hook ini true). GSAP DIHAPUS 18 Nov 2026: kedua pemakaiannya
 *   (fade + naik, stagger) setara di CSS dan GSAP menelan ~70 kB bundle.
 *   (Keputusan lama "GSAP core-only tidak bisa" sudah tidak relevan —
 *   yang dihapus adalah seluruh GSAP, bukan subsetnya.)
 * - Pemecah huruf judul (dulu SplitType, lalu vanilla) DIHAPUS 18 Nov
 *   2026 (proposal 6 studi contoh): reveal huruf-per-huruf adalah
 *   koreografi muat-halaman yang tidak melayani umpan balik.
 */
import { useEffect, useState } from 'react';

/** True bila animasi diizinkan (user tidak meminta reduced motion). */
export function useGerakanAktif(): boolean {
  const baca = (): boolean =>
    typeof window === 'undefined' ||
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [aktif, setAktif] = useState<boolean>(baca);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onUbah = (): void => setAktif(!mq.matches);
    mq.addEventListener('change', onUbah);
    return () => mq.removeEventListener('change', onUbah);
  }, []);
  return aktif;
}
