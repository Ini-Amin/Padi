/**
 * Daftar masalah (dokumen 04 §3.7): aktif di atas, selesai/diarsipkan di bawah.
 * Masalah tidak pernah dihapus, hanya diarsipkan.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { db } from '../db';
import { usePadiStore } from '../store';
import { formatTanggal } from '../dates';
import { navigasi } from '../App';
import { useGerakanAktif } from '../gerakan';
import { Ikon } from '../ikon';

export function ProblemList(): React.JSX.Element {
  const semuaMasalah = useLiveQuery(() => db.masalah.toArray(), []);
  const pemakaian = useLiveQuery(() => db.pemakaian.toArray(), []);
  const frameworks = useLiveQuery(() => db.frameworks.toArray(), []);
  const setMasalahAktif = usePadiStore((s) => s.setMasalahAktif);
  const gerakanAktif = useGerakanAktif();
  // AutoAnimate: kartu berpindah saat status masalah berubah (aktif ke
  // selesai/diarsipkan mengurutkan ulang daftar).
  const [refDaftar] = useAutoAnimate({
    duration: gerakanAktif ? 250 : 0,
  });

  if (
    semuaMasalah === undefined ||
    pemakaian === undefined ||
    frameworks === undefined
  ) {
    return <p className="muted">Memuat…</p>;
  }

  const frameworkById = new Map(frameworks.map((f) => [f.id, f]));
  const terurut = [...semuaMasalah].sort((a, b) => {
    const bobot = (s: string): number => (s === 'aktif' ? 0 : s === 'selesai' ? 1 : 2);
    return bobot(a.status) - bobot(b.status) || (a.dibuat_pada < b.dibuat_pada ? 1 : -1);
  });

  return (
    <div>
      <h1>Masalah saya</h1>
      <div className="baris-tombol">
        <a className="tombol-utama" href="#/masalah/baru">
          Nyatakan masalah baru
        </a>
      </div>
      {terurut.length === 0 && (
        <div className="kosong">
          <Ikon nama="tambah" />
          <p className="muted">
            Belum ada masalah. Nyatakan satu masalah nyata untuk memulai.
          </p>
        </div>
      )}
      <div ref={refDaftar}>
        {terurut.map((m) => {
        const fw = [...new Set(
          pemakaian.filter((p) => p.masalah_id === m.id).map((p) => p.framework_id),
        )]
          .map((fid) => frameworkById.get(fid)?.nama)
          .filter((n): n is string => n !== undefined);
        return (
          <div className="kartu" key={m.id}>
            <p>
              <strong>{m.judul}</strong>{' '}
              <span className="lencana">{m.status}</span>
            </p>
            <p className="muted kecil">
              Dibuat {formatTanggal(m.dibuat_pada)}
              {fw.length > 0 && ` · Framework: ${fw.join(', ')}`}
            </p>
            <div className="baris-tombol">
              <a className="tombol-garis" href={`#/masalah/${m.id}`}>
                Buka
              </a>
              {m.status === 'aktif' && (
                <button
                  className="tombol-teks"
                  type="button"
                  onClick={() => {
                    setMasalahAktif(m.id);
                    navigasi('#/');
                  }}
                >
                  Ke Beranda
                </button>
              )}
            </div>
          </div>
        );
        })}
      </div>
    </div>
  );
}
