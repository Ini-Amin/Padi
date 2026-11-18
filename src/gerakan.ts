/**
 * Gerakan (Paket 3): hook bersama untuk animasi. Satu-satunya tempat yang
 * membaca `prefers-reduced-motion`: semua animasi mati bila user memintanya.
 *
 * Pembagian tugas antar library (dokumen 04 §5):
 * - AutoAnimate: transisi layout otomatis (daftar berubah isi/urutan).
 * - GSAP: sekuens terorkestrasi (reveal hasil matching, transisi langkah
 *   onboarding). Dipakai langsung di komponen yang memerlukannya.
 *   (GSAP core-only tidak bisa: kedua pemakaian menganimasikan properti
 *   CSS — opacity/y — yang butuh CSSPlugin.)
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
