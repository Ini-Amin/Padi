/**
 * Detail masalah: judul, kriteria, framework yang sudah dipakai,
 * artefak, dan ranking matching untuk masalah ini.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { usePadiStore } from '../store';
import { LABEL_KRITERIA } from '../domain';
import { formatTanggal, hariIni } from '../dates';
import { Ranking } from './Ranking';
import { navigasi } from '../App';

export function ProblemDetail({ id }: { id: string }): React.JSX.Element {
  const masalah = useLiveQuery(() => db.masalah.get(id), [id]);
  const frameworks = useLiveQuery(() => db.frameworks.toArray(), []);
  const pemakaian = useLiveQuery(
    () => db.pemakaian.where('masalah_id').equals(id).toArray(),
    [id],
  );
  const artefak = useLiveQuery(
    () => db.artefak.where('masalah_id').equals(id).toArray(),
    [id],
  );
  const semuaPemakaian = useLiveQuery(() => db.pemakaian.toArray(), []);
  const setMasalahAktif = usePadiStore((s) => s.setMasalahAktif);
  const masalahAktifId = usePadiStore((s) => s.masalahAktifId);

  if (
    masalah === undefined ||
    frameworks === undefined ||
    pemakaian === undefined ||
    artefak === undefined ||
    semuaPemakaian === undefined
  ) {
    return <p className="muted">Memuat…</p>;
  }
  if (!masalah) {
    return (
      <div>
        <p>Masalah tidak ditemukan.</p>
        <a className="tombol-garis" href="#/">
          Kembali ke Beranda
        </a>
      </div>
    );
  }

  const frameworkById = new Map(frameworks.map((f) => [f.id, f]));
  const dipakaiIds = new Set(semuaPemakaian.map((p) => p.framework_id));
  const frameworkDipakai = [...new Set(pemakaian.map((p) => p.framework_id))]
    .map((fid) => frameworkById.get(fid)?.nama)
    .filter((n): n is string => n !== undefined);

  const ubahStatus = async (status: 'aktif' | 'selesai' | 'diarsipkan'): Promise<void> => {
    await db.masalah.update(id, {
      status,
      selesai_pada: status === 'selesai' ? hariIni() : null,
    });
    if (status !== 'aktif') navigasi('#/masalah');
  };

  return (
    <div>
      <a className="tombol-teks" href="#/masalah">
        ← Kembali ke Masalah saya
      </a>
      <h1>{masalah.judul}</h1>
      <p className="muted">
        Dibuat {formatTanggal(masalah.dibuat_pada)} · Status: {masalah.status}
      </p>
      {masalah.deskripsi && <p>{masalah.deskripsi}</p>}
      <p className="kecil">
        Kriteria:{' '}
        {masalah.kriteria.length === 0
          ? 'tidak ada'
          : masalah.kriteria.map((k) => LABEL_KRITERIA[k]).join(', ')}
      </p>
      <p className="kecil">
        Framework yang sudah dipakai: {frameworkDipakai.join(', ') || 'belum ada'}
      </p>

      <div className="baris-tombol">
        {masalahAktifId !== id && (
          <button
            className="tombol-garis"
            type="button"
            onClick={() => {
              setMasalahAktif(id);
              navigasi('#/');
            }}
          >
            Jadikan masalah aktif
          </button>
        )}
        {masalah.status === 'aktif' && (
          <button className="tombol-teks" type="button" onClick={() => void ubahStatus('selesai')}>
            Tandai selesai
          </button>
        )}
        {masalah.status !== 'diarsipkan' && (
          <button className="tombol-teks" type="button" onClick={() => void ubahStatus('diarsipkan')}>
            Arsipkan
          </button>
        )}
      </div>

      {masalah.status === 'aktif' && (
        <Ranking masalah={masalah} frameworks={frameworks} dipakaiIds={dipakaiIds} />
      )}

      {artefak.length > 0 && (
        <div className="kartu">
          <h2>Artefak</h2>
          {artefak.map((a) => (
            <div className="baris-daftar" key={a.id}>
              <span>
                <strong>{a.judul}</strong>{' '}
                {a.kualitas_terpenuhi && (
                  <span className="lencana berkualitas">berkualitas</span>
                )}
                <span className="muted kecil">
                  {' '}
                  · {frameworkById.get(a.framework_id)?.nama ?? ''} ·{' '}
                  {formatTanggal(a.dibuat_pada)}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
