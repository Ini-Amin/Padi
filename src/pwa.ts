/**
 * Registrasi service worker (PWA). Dijaga agar tidak pernah merusak
 * lingkungan tanpa service worker (test Node, browser lama, dev server).
 *
 * Hanya didaftarkan di build produksi: di dev server, service worker akan
 * menyajikan aset lama dan menyembunyikan perubahan kode.
 */
export function serviceWorkerDidukung(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof window !== 'undefined'
  );
}

/**
 * Daftarkan `sw.js` (relatif terhadap base path Vite, agar jalan di
 * subpath seperti /Padi/ di GitHub Pages, bukan hanya di root domain).
 * Mengembalikan true bila registrasi berhasil.
 * Tidak pernah melempar: gagal registrasi (misal konteks tidak aman)
 * hanya berarti app berjalan sebagai web biasa.
 */
export async function daftarkanServiceWorker(): Promise<boolean> {
  if (!serviceWorkerDidukung()) return false;
  if (!import.meta.env.PROD) return false;
  try {
    await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
    return true;
  } catch {
    return false;
  }
}
