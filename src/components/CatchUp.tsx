/**
 * Layar Catch-up (dokumen 07 §3.1): kejar re-use yang terlewat lebih dari
 * 3 hari, dikelompokkan maksimal 3 framework per sesi, 1 sesi per hari.
 * Satu sesi catch-up = satu framework (12'), memakai layar sesi yang sama
 * dengan re-use, termasuk memilih masalah BARU dan penilaian rubrik.
 * Menyelesaikan catch-up menjadwalkan re-use berikutnya dalam rantai.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { db, mulaiSesi } from '../db';
import { usePadiStore } from '../store';
import { formatTanggal, hariIni } from '../dates';
import { DURASI_CATCH_UP_MENIT, inputSesiCatchUp, modelCatchUp } from '../catchup';
import { navigasi } from '../App';

export function CatchUp(): React.JSX.Element {
  const setSesiBerjalan = usePadiStore((s) => s.setSesiBerjalan);
  const frameworks = useLiveQuery(() => db.frameworks.toArray(), []);
  const jadwal = useLiveQuery(() => db.jadwal_reuse.toArray(), []);

  if (frameworks === undefined || jadwal === undefined) {
    return <p className="muted">Memuat…</p>;
  }

  const kelompok = modelCatchUp(jadwal, frameworks, hariIni());
  const totalItem = kelompok.reduce((acc, k) => acc + k.items.length, 0);

  const mulaiCatchUp = async (
    jadwalId: string,
    frameworkId: string,
  ): Promise<void> => {
    const sesi = await mulaiSesi(inputSesiCatchUp(frameworkId));
    setSesiBerjalan(sesi.id);
    navigasi(`#/sesi/${sesi.id}?reuse=${jadwalId}`);
  };

  return (
    <div>
      <h1>Catch-up</h1>
      <p className="muted">
        Re-use yang terlewat lebih dari 3 hari dikelompokkan menjadi sesi
        catch-up: maksimal 3 framework per sesi, 1 sesi per hari, yang paling
        lama tertinggal didahulukan.
      </p>

      {kelompok.length === 0 ? (
        <div className="kartu">
          <p>Tidak ada re-use yang terlewat.</p>
          <p className="muted">
            Re-use yang jatuh tempo hari ini atau baru terlewat 1–3 hari muncul
            di Beranda, bukan di sini.
          </p>
          <div className="baris-tombol">
            <a className="tombol-garis" href="#/">
              Kembali ke Beranda
            </a>
          </div>
        </div>
      ) : (
        <>
          <p>
            <strong>{totalItem} re-use terlewat</strong> dalam{' '}
            {kelompok.length} sesi catch-up.
          </p>
          {kelompok.map((k, i) => (
            <div className="kartu" key={k.tanggal}>
              <h2>
                Sesi {i + 1}:{' '}
                {k.tanggal === hariIni() ? 'hari ini' : formatTanggal(k.tanggal)}
              </h2>
              {k.items.map((item) => (
                <div className="baris-daftar" key={item.jadwal.id}>
                  <span>
                    <strong>{item.frameworkNama}</strong>{' '}
                    <span className="lencana">{item.jadwal.jenis_reuse}</span>
                    <span className="muted kecil">
                      jatuh tempo {formatTanggal(item.jadwal.jatuh_tempo)} ·
                      terlewat {item.hariTerlewat} hari
                    </span>
                  </span>
                  <button
                    className="tombol-garis"
                    type="button"
                    onClick={() =>
                      void mulaiCatchUp(item.jadwal.id, item.jadwal.framework_id)
                    }
                  >
                    Catch-up ({DURASI_CATCH_UP_MENIT}&prime;)
                  </button>
                </div>
              ))}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
