/**
 * Sistem ikon: SVG inline dari Hugeicons (free set,
 * @hugeicons/core-free-icons 3.1.1, diambil 18 Nov 2026 dari jsDelivr).
 * 24×24, stroke 1.5, currentColor. Tanpa paket/CDN/font (offline-first).
 * Lingkaran <circle> asli diubah jadi <path> dua busur (render sama)
 * supaya semua ikon satu format data. Titik "?" HelpCircle memakai
 * stroke 1.5 seragam (aslinya 1.8 — selisih 0,3px tidak terlihat).
 * Analytics01 dipakai tanpa bingkai kotak luar (hanya 3 batang) —
 * bingkainya hiasan, batangnya yang dibaca sebagai grafik.
 * Jalur-jalur satu ikon digabung dalam satu atribut `d` (tiap subpath
 * diawali M — SVG mengizinkan banyak subpath dalam satu path). Angka
 * dibulatkan ke 2 desimal (hemat ~0,2 kB; tak terlihat pada 20px).
 */
export type NamaIkon =
  | 'beranda'
  | 'peta'
  | 'masalah'
  | 'progres'
  | 'cari'
  | 'tambah';

/** Atribut `d` per ikon (sumber di komentar per baris). */
const PATH: Record<NamaIkon, string> = {
  // Home04.
  beranda:
    'M3 11.99V14.5C3 17.8 3 19.45 4.03 20.47C5.05 21.5 6.7 21.5 10 21.5H14C17.3 21.5 18.95 21.5 19.97 20.47C21 19.45 21 17.8 21 14.5V11.99C21 10.31 21 9.47 20.64 8.74C20.29 8.01 19.62 7.5 18.3 6.46L16.3 4.91C14.23 3.3 13.2 2.5 12 2.5C10.8 2.5 9.77 3.3 7.7 4.91L5.7 6.46C4.38 7.5 3.71 8.01 3.36 8.74C3 9.47 3 10.31 3 11.99Z M16 17H8',
  // Route01 (dua node terhubung jalur — peta framework).
  peta: 'M21 5A3 3 0 1 1 15 5A3 3 0 1 1 21 5 M9 19A3 3 0 1 1 3 19A3 3 0 1 1 9 19 M12 5H8.5C6.57 5 5 6.57 5 8.5C5 10.43 6.57 12 8.5 12H15.5C17.43 12 19 13.57 19 15.5C19 17.43 17.43 19 15.5 19H12',
  // HelpCircle.
  masalah:
    'M22 12A10 10 0 1 1 2 12A10 10 0 1 1 22 12 M9.5 9.5C9.5 8.12 10.62 7 12 7C13.38 7 14.5 8.12 14.5 9.5C14.5 10.36 14.07 11.11 13.41 11.56C12.73 12.03 12 12.67 12 13.5 M12 17H12.01',
  // Analytics01 (tanpa bingkai kotak).
  progres: 'M7 17L7 13 M12 17L12 7 M17 17L17 11',
  // Search01.
  cari: 'M17 17L21 21 M19 11C19 6.58 15.42 3 11 3C6.58 3 3 6.58 3 11C3 15.42 6.58 19 11 19C15.42 19 19 15.42 19 11Z',
  // PlusSign.
  tambah: 'M12 4V20M20 12H4',
};

/** Ikon dekoratif (selalu ada teks pendamping, jadi aria-hidden). */
export function Ikon({ nama }: { nama: NamaIkon }): React.JSX.Element {
  return (
    <svg
      className="ikon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATH[nama]} />
    </svg>
  );
}
