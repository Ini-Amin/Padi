/**
 * Shell app + router hash sederhana (dokumen 05 §2: tanpa lazy loading
 * di MVP). Rute didefinisikan di tipe `Route` dan `parseHash` di bawah.
 *
 * TIDAK ADA gate first-run sejak 20 Nov 2026: semua rute langsung bisa
 * dibuka, termasuk dengan profil kosong (Beranda menampilkan form entri
 * masalah tertanam bila belum ada masalah aktif). Rute #/onboarding
 * tetap ada untuk pengulangan manual. Field `onboarding.selesai` di
 * store dipertahankan (format persist tidak berubah) tapi tidak lagi
 * mengunci rute apa pun.
 */
import { useEffect, useState } from 'react';
import { seedDatabase, tandaiReuseTerlewat } from './db';
import { Home } from './components/Home';
import { ProblemFlow } from './components/ProblemFlow';
import { ProblemDetail } from './components/ProblemDetail';
import { ProblemList } from './components/ProblemList';
import { Session } from './components/Session';
import { Discovery } from './components/Discovery';
import { MapList } from './components/MapList';
import { FrameworkDetail } from './components/FrameworkDetail';
import { CatchUp } from './components/CatchUp';
import { Progress } from './components/Progress';
import { Onboarding } from './components/Onboarding';
import { Ikon } from './ikon';

export type Route =
  | { nama: 'beranda' }
  | { nama: 'daftar-masalah' }
  | { nama: 'masalah-baru' }
  | { nama: 'masalah'; id: string }
  | { nama: 'sesi'; id: string; reuseId: string | null }
  | { nama: 'discovery' }
  | { nama: 'peta' }
  | { nama: 'framework'; id: string }
  | { nama: 'catch-up' }
  | { nama: 'progres' }
  | { nama: 'onboarding' };

function parseHash(hash: string): Route {
  const tanpaHash = hash.replace(/^#/, '') || '/';
  const [path, query] = tanpaHash.split('?');
  const seg = path.split('/').filter(Boolean);
  if (seg.length === 0) return { nama: 'beranda' };
  if (seg[0] === 'masalah' && seg.length === 1) return { nama: 'daftar-masalah' };
  if (seg[0] === 'masalah' && seg[1] === 'baru') return { nama: 'masalah-baru' };
  if (seg[0] === 'masalah' && seg[1]) {
    return { nama: 'masalah', id: decodeURIComponent(seg[1]) };
  }
  if (seg[0] === 'sesi' && seg[1]) {
    const params = new URLSearchParams(query ?? '');
    return {
      nama: 'sesi',
      id: decodeURIComponent(seg[1]),
      reuseId: params.get('reuse'),
    };
  }
  if (seg[0] === 'discovery') return { nama: 'discovery' };
  if (seg[0] === 'peta') return { nama: 'peta' };
  if (seg[0] === 'framework' && seg[1]) {
    return { nama: 'framework', id: decodeURIComponent(seg[1]) };
  }
  if (seg[0] === 'catch-up') return { nama: 'catch-up' };
  if (seg[0] === 'progres') return { nama: 'progres' };
  if (seg[0] === 'onboarding') return { nama: 'onboarding' };
  return { nama: 'beranda' };
}

export function navigasi(ke: string): void {
  window.location.hash = ke;
}

function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  useEffect(() => {
    const onHash = (): void => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return route;
}

export function App(): React.JSX.Element {
  const route = useRoute();
  const [siap, setSiap] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let batal = false;
    (async () => {
      try {
        await seedDatabase();
        await tandaiReuseTerlewat();
        if (!batal) setSiap(true);
      } catch (e) {
        if (!batal) {
          setError(e instanceof Error ? e.message : 'Tidak bisa membuka database.');
        }
      }
    })();
    return () => {
      batal = true;
    };
  }, []);

  const aktif = (nama: string): string => {
    if (route.nama === 'beranda' && nama === 'beranda') return 'aktif';
    if (route.nama === 'peta' && nama === 'peta') return 'aktif';
    if (route.nama === 'progres' && nama === 'progres') return 'aktif';
    if (
      (route.nama === 'daftar-masalah' ||
        route.nama === 'masalah' ||
        route.nama === 'masalah-baru') &&
      nama === 'masalah'
    )
      return 'aktif';
    return '';
  };

  return (
    <div className={`pembungkus${route.nama === 'peta' ? ' lebar' : ''}`}>
      <button
        className="lewati-konten"
        type="button"
        onClick={() =>
          document.getElementById('konten-utama')?.focus()
        }
      >
        Lewati ke konten
      </button>
      <header className="kepala">
        <a className="merek" href="#/">
          [PADI] // TOOLBOX
        </a>
        <nav className="nav">
          <a href="#/" className={aktif('beranda')}>
            <Ikon nama="beranda" />
            Beranda
          </a>
          <a href="#/peta" className={aktif('peta')}>
            <Ikon nama="peta" />
            Peta
          </a>
          <a href="#/masalah" className={aktif('masalah')}>
            <Ikon nama="masalah" />
            Masalah
          </a>
          <a href="#/progres" className={aktif('progres')}>
            <Ikon nama="progres" />
            Progres
          </a>
        </nav>
      </header>
      <main id="konten-utama" tabIndex={-1}>
        {error ? (
          <div className="pesan-error" role="alert">
            <p>Tidak bisa membuka Padi: {error}</p>
            <button
              className="tombol-garis"
              type="button"
              onClick={() => window.location.reload()}
            >
              Coba Lagi
            </button>
          </div>
        ) : !siap ? (
          <p className="muted">Memuat…</p>
        ) : route.nama === 'onboarding' ? (
          // Pengulangan eksplisit dari layar Progres (atau kunjungan
          // langsung ke #/onboarding): selalu tampil, tidak mengunci
          // apa pun di baliknya.
          <Onboarding ulang />
        ) : (
          <>
            {route.nama === 'beranda' && <Home />}
            {route.nama === 'daftar-masalah' && <ProblemList />}
            {route.nama === 'masalah-baru' && <ProblemFlow />}
            {route.nama === 'masalah' && <ProblemDetail id={route.id} />}
            {route.nama === 'sesi' && (
              <Session key={route.id} id={route.id} reuseId={route.reuseId} />
            )}
            {route.nama === 'discovery' && <Discovery />}
            {route.nama === 'peta' && <MapList />}
            {route.nama === 'framework' && <FrameworkDetail key={route.id} id={route.id} />}
            {route.nama === 'catch-up' && <CatchUp />}
            {route.nama === 'progres' && <Progress />}
          </>
        )}
      </main>
      <footer className="kaki">
        <p className="muted kecil">Padi. Data tersimpan di perangkat ini.</p>
      </footer>
    </div>
  );
}
