/**
 * Layar Progres (dokumen 04 §3.5, PRD M5): SATU-SATUNYA tempat XP dan streak
 * ditampilkan. Metrik toolbox (transfer rate, framework unik/bulan, masalah
 * aktif, penyebaran masalah). TIDAK ADA tampilan "X dari 22".
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { db, eksporData } from '../db';
import { formatTanggal, hariIni, tambahHari } from '../dates';
import { hitungStreak, totalXp } from '../gamification';
import { kelompokCatchUp } from '../scheduler';
import { labelJenisSesi } from '../sesi';
import {
  frameworkUnikBulanIni,
  hitungTransferRate,
  penyebaranMasalah,
} from '../telemetry';

export function Progress(): React.JSX.Element {
  const ledger = useLiveQuery(() => db.xp_ledger.toArray(), []);
  const semuaSesi = useLiveQuery(() => db.sesi.toArray(), []);
  const pemakaian = useLiveQuery(() => db.pemakaian.toArray(), []);
  const semuaMasalah = useLiveQuery(() => db.masalah.toArray(), []);
  const jadwal = useLiveQuery(() => db.jadwal_reuse.toArray(), []);
  const frameworks = useLiveQuery(() => db.frameworks.toArray(), []);

  if (
    ledger === undefined ||
    semuaSesi === undefined ||
    pemakaian === undefined ||
    semuaMasalah === undefined ||
    jadwal === undefined ||
    frameworks === undefined
  ) {
    return <p className="muted">Memuat…</p>;
  }

  const hari = hariIni();
  const aktivitas = new Set(semuaSesi.map((s) => s.tanggal));
  const streak = hitungStreak(aktivitas, hari);
  const masalahById = new Map(semuaMasalah.map((m) => [m.id, m]));
  const frameworkById = new Map(frameworks.map((f) => [f.id, f]));
  const transfer = hitungTransferRate(pemakaian, masalahById, hari);
  const unikBulanIni = frameworkUnikBulanIni(pemakaian, hari);
  const penyebaran = penyebaranMasalah(pemakaian);
  const masalahAktif = semuaMasalah.filter((m) => m.status === 'aktif').length;
  const kelompokTerlewat = kelompokCatchUp(jadwal, hari);
  const totalTerlewat = kelompokTerlewat.reduce(
    (acc, k) => acc + k.items.length,
    0,
  );

  // 7 hari terakhir (termasuk hari ini), untuk grafik aktivitas.
  const tujuhHari = Array.from({ length: 7 }, (_, i) => tambahHari(hari, i - 6));

  const unduhEkspor = async (): Promise<void> => {
    const json = await eksporData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `padi-ekspor-${hari}.json`;
    a.click();
    URL.revokeObjectURL(url);
    await db.progres.update('utama', { terakhir_ekspor_pada: hari });
  };

  return (
    <div>
      <h1>Progres</h1>

      <div className="metrik">
        <div className="kotak">
          <div className="angka">{totalXp(ledger)} XP</div>
          <p className="muted kecil">
            Cara dapat XP: +100 per sesi penerapan · +50 per re-use · +50
            artefak berkualitas · +25 skor 3. XP tidak pernah berkurang.
          </p>
        </div>
        <div className="kotak">
          <div className="angka">{streak} hari</div>
          <p className="muted kecil">
            Streak: hari berturut-turut dengan minimal 1 aktivitas. Streak tidak
            membuka atau mengunci apa pun.
          </p>
        </div>
      </div>

      <h2>7 hari terakhir</h2>
      <div className="grafik-hari">
        {tujuhHari.map((t) => (
          <div
            key={t}
            role="img"
            aria-label={`${formatTanggal(t)}: ${aktivitas.has(t) ? 'aktif' : 'tidak ada aktivitas'}`}
            className={`hari${aktivitas.has(t) ? ' aktif' : ''}`}
          >
            <div className="kotak-hari" />
            {formatTanggal(t).split(',')[0].slice(0, 3)} {t.slice(8, 10)}
          </div>
        ))}
      </div>
      <p className="muted kecil">Kotak kuning = ada sesi hari itu.</p>

      <h2>Metrik toolbox</h2>
      <div className="metrik">
        <div className="kotak">
          {transfer.penyebut === 0 ? (
            <div className="angka-kosong">Belum ada</div>
          ) : (
            <div className="angka">{`${Math.round(transfer.rate * 100)}%`}</div>
          )}
          <p className="muted kecil">
            Transfer rate: {transfer.pembilang} dari {transfer.penyebut}{' '}
            framework sudah dipakai untuk masalah baru (90 hari terakhir).
          </p>
        </div>
        <div className="kotak">
          <div className="angka">{unikBulanIni}</div>
          <p className="muted kecil">Framework unik dipakai bulan ini.</p>
        </div>
        <div className="kotak">
          <div className="angka">{masalahAktif}</div>
          <p className="muted kecil">Masalah sedang dikerjakan.</p>
        </div>
        <div className="kotak">
          <div className="angka">{penyebaran}</div>
          <p className="muted kecil">
            Masalah yang sudah memakai 2 framework atau lebih.
          </p>
        </div>
      </div>

      <h2>Data</h2>
      {kelompokTerlewat.length > 0 && (
        <div className="kartu">
          <h2>Re-use terlewat</h2>
          <p>
            <strong>{totalTerlewat} re-use</strong> terlewat lebih dari 3 hari,
            dikelompokkan jadi {kelompokTerlewat.length} sesi catch-up.
          </p>
          <div className="baris-tombol">
            <a className="tombol-garis" href="#/catch-up">
              Lihat sesi catch-up
            </a>
          </div>
        </div>
      )}
      <p className="muted kecil">
        Semua datamu tersimpan di perangkat ini. Ekspor secara berkala sebagai
        cadangan.
      </p>
      <div className="baris-tombol">
        <button className="tombol-garis" type="button" onClick={() => void unduhEkspor()}>
          Ekspor Data (JSON)
        </button>
        <a className="tombol-garis" href="#/onboarding">
          Ulangi onboarding
        </a>
      </div>
      <p className="muted kecil">
        Impor data akan tersedia di potongan berikutnya. Mengulang onboarding
        hanya menyatakan masalah baru. Tidak ada yang terkunci di baliknya.
      </p>

      <h2>Log sesi (7 hari terakhir)</h2>
      {semuaSesi
        .filter((s) => tujuhHari.includes(s.tanggal))
        .sort((a, b) => (a.tanggal < b.tanggal ? 1 : -1))
        .slice(0, 20)
        .map((s) => (
          <div className="baris-daftar" key={s.id}>
            <span>
              <a href={`#/sesi/${s.id}`}>
                {frameworkById.get(s.framework_id)?.nama ?? 'Framework tidak dikenal'}
              </a>
              {s.masalah_id
                ? ` untuk "${masalahById.get(s.masalah_id)?.judul ?? ''}"`
                : ''}{' · '}
              {formatTanggal(s.tanggal)} · {labelJenisSesi(s.jenis)} ·{' '}
              {s.durasi_menit} menit ·{' '}
              {s.selesai ? 'selesai' : 'belum memenuhi definisi selesai'}
              {s.skor !== null && ` · skor ${s.skor}`}
            </span>
          </div>
        ))}
      {semuaSesi.filter((s) => tujuhHari.includes(s.tanggal)).length === 0 && (
        <p className="muted">Belum ada sesi dalam 7 hari terakhir.</p>
      )}
    </div>
  );
}
