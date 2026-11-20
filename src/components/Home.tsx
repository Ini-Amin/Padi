/**
 * Beranda: "Masalah Saya + Framework yang Cocok" (dokumen 04 §3.1).
 * Satu-satunya tombol berisi penuh di sini adalah tombol utama ranking.
 * TIDAK ADA XP, streak, atau angka "X/22" di layar ini.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { db, mulaiSesi } from '../db';
import { usePadiStore } from '../store';
import { formatTanggal, hariIni } from '../dates';
import { reuseJatuhTempo } from '../scheduler';
import { modelCatchUp } from '../catchup';
import { Ranking } from './Ranking';
import { Onboarding } from './Onboarding';
import { navigasi } from '../App';
import type { Framework } from '../domain';

export function Home(): React.JSX.Element {
  const masalahAktifId = usePadiStore((s) => s.masalahAktifId);
  const setSesiBerjalan = usePadiStore((s) => s.setSesiBerjalan);

  const frameworks = useLiveQuery(() => db.frameworks.toArray(), []);
  const semuaMasalah = useLiveQuery(() => db.masalah.toArray(), []);
  const pemakaian = useLiveQuery(() => db.pemakaian.toArray(), []);
  const jadwal = useLiveQuery(() => db.jadwal_reuse.toArray(), []);
  const sesiHariIni = useLiveQuery(
    () => db.sesi.where('tanggal').equals(hariIni()).toArray(),
    [],
  );
  const draft = useLiveQuery(
    () =>
      db.sesi
        .filter((s) => !s.selesai && s.skor === null)
        .sortBy('tanggal'),
    [],
  );

  if (
    frameworks === undefined ||
    semuaMasalah === undefined ||
    pemakaian === undefined ||
    jadwal === undefined ||
    sesiHariIni === undefined ||
    draft === undefined
  ) {
    return <p className="muted">Memuat…</p>;
  }

  const frameworkById = new Map(frameworks.map((f) => [f.id, f]));
  const masalahById = new Map(semuaMasalah.map((m) => [m.id, m]));
  const dipakaiIds = new Set(pemakaian.map((p) => p.framework_id));

  const masalahAktif =
    (masalahAktifId ? masalahById.get(masalahAktifId) : undefined) ??
    semuaMasalah.find((m) => m.status === 'aktif');

  const reuseHariIni = reuseJatuhTempo(jadwal, hariIni());
  const kelompokCatchUp = modelCatchUp(jadwal, frameworks, hariIni());
  const totalTerlewat = kelompokCatchUp.reduce(
    (acc, k) => acc + k.items.length,
    0,
  );
  const selesaiHariIni = sesiHariIni.filter((s) => s.selesai).length;
  const draftTerbaru = draft[draft.length - 1];

  const mulaiReuse = async (jadwalId: string, frameworkId: string): Promise<void> => {
    const sesi = await mulaiSesi({
      framework_id: frameworkId,
      masalah_id: null, // re-use memilih masalah BARU di dalam layar sesi
      jenis: 're_use',
      durasi_target_menit: 12,
    });
    setSesiBerjalan(sesi.id);
    navigasi(`#/sesi/${sesi.id}?reuse=${jadwalId}`);
  };

  return (
    <div>
      <h1>Selamat belajar.</h1>
      <p className="muted">{formatTanggal(hariIni())}</p>

      {draftTerbaru && (
        <div className="kartu">
          <p>
            Lanjutkan penerapan{' '}
            <strong>{frameworkById.get(draftTerbaru.framework_id)?.nama ?? ''}</strong>
            {draftTerbaru.masalah_id
              ? ` untuk "${masalahById.get(draftTerbaru.masalah_id)?.judul ?? ''}"`
              : ''}
            .
          </p>
          <div className="baris-tombol">
            <a className="tombol-garis" href={`#/sesi/${draftTerbaru.id}`}>
              Lanjutkan sesi
            </a>
          </div>
        </div>
      )}

      {masalahAktif ? (
        <>
          <div className="kartu kartu-utama">
            <h2>{masalahAktif.judul}</h2>
            {masalahAktif.deskripsi && <p className="muted">{masalahAktif.deskripsi}</p>}
            <p className="kecil">
              Framework yang sudah dipakai untuk masalah ini:{' '}
              {frameworkUntukMasalah(pemakaian, masalahAktif.id, frameworkById)
                .map((f) => f.nama)
                .join(', ') ||
                'belum ada — sesi yang dimulai tapi belum dinilai tidak dihitung'}
            </p>
            <div className="baris-tombol">
              <a className="tombol-teks" href="#/masalah">
                Lihat semua masalah ({semuaMasalah.length})
              </a>
            </div>
          </div>

          <Ranking
            masalah={masalahAktif}
            frameworks={frameworks}
            dipakaiIds={dipakaiIds}
          />
        </>
      ) : (
        // Belum ada masalah aktif: form entri masalah langsung di Beranda
        // (Onboarding tertanam), bukan kartu jalan buntu. Setelah simpan,
        // masalahAktif terisi dan cabang di atas yang tampil.
        <Onboarding embedded />
      )}

      {kelompokCatchUp.length > 0 && (
        <div className="kartu kartu-garis">
          <h2>Re-use terlewat</h2>
          <p>
            <strong>{totalTerlewat} re-use</strong> terlewat lebih dari 3 hari,
            dikelompokkan jadi {kelompokCatchUp.length} sesi catch-up.
          </p>
          <div className="baris-tombol">
            <a className="tombol-garis" href="#/catch-up">
              Lihat sesi catch-up
            </a>
          </div>
        </div>
      )}

      {reuseHariIni.length > 0 && (
        <div className="kartu kartu-garis">
          <h2>Re-use hari ini</h2>
          <p className="muted kecil">
            Re-use: memakai lagi framework yang sudah dipelajari, untuk
            masalah lain.
          </p>
          {reuseHariIni.map((j) => (
            <div className="baris-daftar" key={j.id}>
              <span>
                <strong>{frameworkById.get(j.framework_id)?.nama ?? ''}</strong>{' '}
                <span className="lencana">{j.jenis_reuse}</span>
                <span className="muted kecil">
                  jatuh tempo {formatTanggal(j.jatuh_tempo)}
                </span>
              </span>
              <button
                className="tombol-garis"
                type="button"
                onClick={() => void mulaiReuse(j.id, j.framework_id)}
              >
                Re-use (12&prime;)
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="muted kecil">
        Hari ini:{' '}
        {selesaiHariIni === 0
          ? 'belum ada sesi selesai.'
          : `${selesaiHariIni} sesi selesai.`}
        {reuseHariIni.length === 0 && ' Tidak ada pengulangan terjadwal hari ini.'}
      </p>
    </div>
  );
}

function frameworkUntukMasalah(
  pemakaian: Array<{ masalah_id: string; framework_id: string }>,
  masalahId: string,
  frameworkById: ReadonlyMap<string, Framework>,
): Framework[] {
  const ids = new Set(
    pemakaian.filter((p) => p.masalah_id === masalahId).map((p) => p.framework_id),
  );
  return [...ids]
    .map((id) => frameworkById.get(id))
    .filter((f): f is Framework => f !== undefined);
}
