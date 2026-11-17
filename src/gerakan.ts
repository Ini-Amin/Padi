/**
 * Gerakan (Paket 3): hook bersama untuk animasi. Satu-satunya tempat yang
 * membaca `prefers-reduced-motion`: semua animasi mati bila user memintanya.
 *
 * Pembagian tugas antar library (dokumen 04 §5):
 * - AutoAnimate: transisi layout otomatis (daftar berubah isi/urutan).
 * - SplitType: judul layar utama, huruf muncul berurutan. CSS yang
 *   menggerakkan (`.judul-animasi .huruf` di style.css); SplitType hanya
 *   memecah judul jadi huruf.
 * - GSAP: sekuens terorkestrasi (reveal hasil matching, transisi langkah
 *   onboarding). Dipakai langsung di komponen yang memerlukannya.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import SplitType from 'split-type';

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

/**
 * Animasi judul: pecah h1 jadi huruf (SplitType), lalu muncul berurutan
 * lewat transisi CSS (`.judul-animasi .huruf`, `.jalan` di style.css).
 * Mengembalikan callback ref: pasang di h1 (`ref={refJudul}` +
 * `className="judul-animasi"`). Tidak melakukan apa pun bila gerakan
 * tidak aktif: judul tampil sebagai teks biasa.
 */
export function useJudulAnimasi(): (el: HTMLElement | null) => void {
  const gerakanAktif = useGerakanAktif();
  const splitRef = useRef<SplitType | null>(null);
  return useCallback(
    (el: HTMLElement | null) => {
      if (splitRef.current) {
        splitRef.current.revert();
        splitRef.current = null;
      }
      if (el === null || !gerakanAktif) return;
      const split = new SplitType(el, { types: 'chars', charClass: 'huruf' });
      splitRef.current = split;
      el.querySelectorAll('.huruf').forEach((huruf, i) => {
        (huruf as HTMLElement).style.transitionDelay =
          `${Math.min(i * 0.02, 0.4).toFixed(2)}s`;
      });
      // Tambahkan `.jalan` di frame berikutnya agar transisi berjalan.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => el.classList.add('jalan'));
      });
    },
    [gerakanAktif],
  );
}
