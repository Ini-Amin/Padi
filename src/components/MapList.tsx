/**
 * Peta: graph SVG statis (M3) + tampilan daftar bertema sebagai fallback
 * aksesibilitas (dokumen 04 §3.3). Daftar menjawab "framework mana yang
 * berhubungan dengan masalah saya?" lewat status; graph menunjukkan relasinya.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { NAMA_TEMA, type Tema } from '../domain';
import { LABEL_STATUS, WARNA_STATUS } from '../status';
import { GraphSvg } from './GraphSvg';

const URUTAN_TEMA: Tema[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

export function MapList(): React.JSX.Element {
  const frameworks = useLiveQuery(() => db.frameworks.toArray(), []);

  if (frameworks === undefined) return <p className="muted">Memuat…</p>;

  return (
    <div>
      <h1>Peta framework</h1>
      <p className="muted">
        Pustaka framework, bukan urutan belajar. Klik node di peta untuk
        melihat detail, 3 lapis konten, dan statusnya.
      </p>
      <p className="muted kecil catatan-peta-kecil">
        Peta grafik hanya tampil di layar lebar. Daftar di bawah ini lengkap.
      </p>
      <GraphSvg />
      <h2>Daftar per tema</h2>
      {URUTAN_TEMA.map((tema) => {
        const daftar = frameworks
          .filter((f) => f.tema === tema)
          .sort((a, b) => a.urutan_katalog - b.urutan_katalog);
        if (daftar.length === 0) return null;
        return (
          <div key={tema}>
            <h2>
              Tema {tema}: {NAMA_TEMA[tema]}
            </h2>
            {daftar.map((f) => (
              <div className="baris-daftar" key={f.id}>
                <span>
                  <span className={`dot-status ${WARNA_STATUS[f.status]}`} />
                  <strong>{f.nama}</strong>{' '}
                  <span className="muted kecil">{LABEL_STATUS[f.status]}</span>
                </span>
                <a className="tombol-garis" href={`#/framework/${f.id}`}>
                  Detail
                </a>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
