/**
 * Gerakan (Paket 3): hook bersama untuk animasi. Satu-satunya tempat yang
 * membaca `prefers-reduced-motion`: semua animasi mati bila user memintanya.
 *
 * Pembagian tugas antar library (dokumen 04 §5):
 * - AutoAnimate: transisi layout otomatis (daftar berubah isi/urutan).
 * - Pemecah huruf vanilla (bukan SplitType, demi ~11 kB bundle — JS
 *   −10,50 kB bersih sesudah tambahan toggle): judul layar utama,
 *   (`.judul-animasi .huruf` di style.css); kode di sini hanya memecah
 *   judul jadi huruf dan mengembalikan isi asli saat dibersihkan.
 * - GSAP: sekuens terorkestrasi (reveal hasil matching, transisi langkah
 *   onboarding). Dipakai langsung di komponen yang memerlukannya.
 *   (GSAP core-only tidak bisa: kedua pemakaian menganimasikan properti
 *   CSS — opacity/y — yang butuh CSSPlugin.)
 */
import { useCallback, useEffect, useRef, useState } from 'react';

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
 * Animasi judul: pecah h1 jadi huruf (span `.huruf` per huruf, spasi
 * tetap node teks supaya jarak kata terjaga), lalu muncul berurutan
 * lewat transisi CSS (`.judul-animasi .huruf`, `.jalan` di style.css).
 * Mengembalikan callback ref: pasang di h1 (`ref={refJudul}` +
 * `className="judul-animasi"`). Tidak melakukan apa pun bila gerakan
 * tidak aktif: judul tampil sebagai teks biasa. Isi asli dikembalikan
 * saat ref dilepas / dipanggil ulang (menggantikan `revert()` SplitType).
 */
export function useJudulAnimasi(): (el: HTMLElement | null) => void {
  const gerakanAktif = useGerakanAktif();
  const asliRef = useRef<{ el: HTMLElement; html: string } | null>(null);
  return useCallback(
    (el: HTMLElement | null) => {
      if (asliRef.current) {
        const { el: elLama, html } = asliRef.current;
        elLama.innerHTML = html;
        elLama.classList.remove('jalan');
        asliRef.current = null;
      }
      if (el === null || !gerakanAktif) return;
      const teksNode = [...el.childNodes].filter(
        (n): n is Text => n.nodeType === Node.TEXT_NODE,
      );
      if (teksNode.length === 0) return;
      asliRef.current = { el, html: el.innerHTML };
      // Indeks delay menghitung huruf saja (bukan spasi), sama seperti
      // pemakaian SplitType sebelumnya (querySelectorAll('.huruf')).
      let i = 0;
      for (const node of teksNode) {
        const fragmen = document.createDocumentFragment();
        for (const huruf of node.textContent ?? '') {
          if (huruf === ' ') {
            fragmen.append(' ');
            continue;
          }
          const span = document.createElement('span');
          span.className = 'huruf';
          span.textContent = huruf;
          span.style.transitionDelay =
            `${Math.min(i * 0.02, 0.4).toFixed(2)}s`;
          i++;
          fragmen.append(span);
        }
        node.replaceWith(fragmen);
      }
      // Tambahkan `.jalan` di frame berikutnya agar transisi berjalan.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => el.classList.add('jalan'));
      });
    },
    [gerakanAktif],
  );
}
