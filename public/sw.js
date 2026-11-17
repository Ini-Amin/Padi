/**
 * Service worker Padi: minimal, tanpa library (Workbox tidak dipakai agar
 * build tetap di bawah target 500 KB dokumen 04).
 *
 * Navigasi: network-first, fallback cache. Aset same-origin: cache-first
 * (nama file build mengandung hash konten, jadi aman). Hanya request GET
 * same-origin yang disentuh; request lain diteruskan.
 *
 * Update: naikkan `CACHE` setiap rilis. Cache lama dihapus saat aktivasi;
 * `skipWaiting` + `clients.claim` membuat versi baru langsung aktif.
 */

const CACHE = 'padi-v5';

// Path RELATIF (bukan absolut mulai '/'): service worker disajikan dari
// /padi/sw.js di GitHub Pages, jadi path absolut akan salah menunjuk root
// domain. Path relatif di sini di-resolve terhadap URL script worker.
const ASET_AWAL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'favicon.svg',
  'data/graph.json',
  'icons/padi-192.png',
  'icons/padi-512.png',
  'icons/padi.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(ASET_AWAL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((kunci) =>
        Promise.all(kunci.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const salinan = res.clone();
          caches.open(CACHE).then((cache) => cache.put(request, salinan));
          return res;
        })
        .catch(() =>
          caches
            .match(request)
            .then((cached) => cached ?? caches.match('index.html')),
        ),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ??
        fetch(request).then((res) => {
          if (res.ok) {
            const salinan = res.clone();
            caches.open(CACHE).then((cache) => cache.put(request, salinan));
          }
          return res;
        }),
    ),
  );
});
