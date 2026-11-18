/**
 * Ranking matching (PRD M4): 3 framework teratas + 1 slot eksplorasi,
 * masing-masing dengan alasan yang menyebut kriteria yang cocok.
 * Tombol "Ganti" menampilkan alternatif peringkat 4–6; "Tidak cocok"
 * mencatat umpan balik sebagai telemetri (tanpa penalti).
 */
import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import type { Framework, Masalah } from '../domain';
import { LABEL_KRITERIA } from '../domain';
import {
  alternatifBerikutnya,
  rankingUntukMasalah,
  type HasilMatching,
} from '../matcher';
import { db, mulaiSesi } from '../db';
import { navigasi } from '../App';
import { usePadiStore } from '../store';
import { hariIni } from '../dates';
import { useGerakanAktif } from '../gerakan';
import { Ikon } from '../ikon';

interface Props {
  masalah: Masalah;
  frameworks: Framework[];
  dipakaiIds: ReadonlySet<string>;
  /**
   * Reveal terorkestrasi (CSS): 3 baris hasil matching muncul berurutan
   * saat pertama tampil. Hanya dipakai langkah 2 onboarding, momen
   * penemuan hasil matching; di Beranda/Detail ranking tampil langsung.
   */
  animasiMasuk?: boolean;
}

export function Ranking({ masalah, frameworks, dipakaiIds, animasiMasuk = false }: Props): React.JSX.Element {
  const [menampilkanAlternatif, setMenampilkanAlternatif] = useState(false);
  const [umpanBalik, setUmpanBalik] = useState(false);
  const [memulai, setMemulai] = useState<string | null>(null);
  const setSesiBerjalan = usePadiStore((s) => s.setSesiBerjalan);
  const gerakanAktif = useGerakanAktif();
  // AutoAnimate: "Ganti" menukar isi daftar (peringkat ke alternatif).
  const [refDaftar] = useAutoAnimate({
    duration: gerakanAktif ? 250 : 0,
  });
  // Reveal hasil matching: baris muncul satu per satu (animasi CSS,
  // kelas .baris-ranking-masuk + delay per indeks). Sekali saja saat
  // mount pertama — "Ganti" menukar isi tanpa mengulang reveal.
  // Kelas dicabut 700ms setelah mount (stagger terlama 240ms + durasi
  // 350ms + margin); mencabutnya tidak mengubah tampilan karena state
  // akhir animasi sama dengan state natural baris.
  const [revealSelesai, setRevealSelesai] = useState(false);
  useEffect(() => {
    if (!animasiMasuk || !gerakanAktif) return;
    const t = setTimeout(() => setRevealSelesai(true), 700);
    return () => clearTimeout(t);
  }, [animasiMasuk, gerakanAktif]);
  const animasiBaris = animasiMasuk && gerakanAktif && !revealSelesai;

  const hasil = useMemo(
    () => rankingUntukMasalah(masalah, frameworks, dipakaiIds),
    [masalah, frameworks, dipakaiIds],
  );

  const alternatif = useMemo(() => {
    if (!menampilkanAlternatif) return [];
    const sudahTampil = new Set([
      ...hasil.peringkat.map((h) => h.framework.id),
      ...(hasil.eksplorasi ? [hasil.eksplorasi.framework.id] : []),
    ]);
    return alternatifBerikutnya(masalah, frameworks, sudahTampil);
  }, [menampilkanAlternatif, hasil, masalah, frameworks]);

  const pakai = async (frameworkId: string): Promise<void> => {
    if (memulai) return; // idempotensi: klik ganda tidak membuat 2 sesi
    setMemulai(frameworkId);
    try {
      const sesi = await mulaiSesi({
        framework_id: frameworkId,
        masalah_id: masalah.id,
        jenis: 'penerapan',
        durasi_target_menit: 45,
      });
      setSesiBerjalan(sesi.id);
      navigasi(`#/sesi/${sesi.id}`);
    } finally {
      setMemulai(null);
    }
  };

  const tandaiTidakCocok = async (): Promise<void> => {
    await db.umpan_balik_matching.add({
      id: crypto.randomUUID(),
      masalah_id: masalah.id,
      framework_ids: hasil.peringkat.map((h) => h.framework.id),
      alasan: null,
      dibuat_pada: hariIni(),
    });
    setUmpanBalik(true);
    setMenampilkanAlternatif(true);
  };

  if (hasil.peringkat.length === 0 && !hasil.eksplorasi) {
    const tanpaKriteria = masalah.kriteria.length === 0;
    return (
      <div className="kartu">
        <h2>Framework yang cocok</h2>
        <div className="kosong">
          <Ikon nama="cari" />
          <p>
            {tanpaKriteria
              ? 'Masalah ini belum punya kriteria, jadi Padi belum bisa mencocokkan framework. Jelajahi Peta untuk memilih framework sendiri.'
              : 'Belum ada framework yang cocok dengan kriteria masalah ini. Coba nyatakan ulang masalahmu dengan kriteria yang berbeda, atau jelajahi Peta untuk melihat semua framework.'}
          </p>
        </div>
        <div className="baris-tombol">
          <a className="tombol-garis" href="#/peta">
            Jelajahi Peta
          </a>
        </div>
      </div>
    );
  }

  const daftar = menampilkanAlternatif ? alternatif : hasil.peringkat;

  return (
    <div className="kartu">
      <h2>Framework yang cocok</h2>
      <p className="muted kecil">
        Kriteriamu:{' '}
        {masalah.kriteria.map((k) => LABEL_KRITERIA[k]).join(', ')}.
      </p>
      <div ref={refDaftar}>
        {daftar.map((h, i) => (
          <BarisRanking
            key={h.framework.id}
            hasil={h}
            peringkat={i + 1}
            utama={!menampilkanAlternatif && i === 0}
            memulai={memulai === h.framework.id}
            onPakai={() => void pakai(h.framework.id)}
            indeks={i}
            masuk={animasiBaris}
          />
        ))}
        {!menampilkanAlternatif && hasil.eksplorasi && (
          <BarisRanking
            hasil={hasil.eksplorasi}
            peringkat={null}
            utama={false}
            eksplorasi
            memulai={memulai === hasil.eksplorasi.framework.id}
            onPakai={() => void pakai(hasil.eksplorasi!.framework.id)}
            indeks={daftar.length}
            masuk={animasiBaris}
          />
        )}
      </div>
      {menampilkanAlternatif && alternatif.length === 0 && (
        <p className="muted">Tidak ada alternatif lain untuk masalah ini.</p>
      )}
      {!menampilkanAlternatif && hasil.eksplorasi && (
        <p className="muted kecil">
          Eksplorasi: framework yang belum pernah kamu pakai, untuk mencoba
          hal baru.
        </p>
      )}
      <div className="baris-tombol">
        {!menampilkanAlternatif && (
          <button
            className="tombol-garis"
            type="button"
            onClick={() => setMenampilkanAlternatif(true)}
          >
            Ganti
          </button>
        )}
        {menampilkanAlternatif && (
          <button
            className="tombol-garis"
            type="button"
            onClick={() => setMenampilkanAlternatif(false)}
          >
            Kembali ke ranking awal
          </button>
        )}
        <button className="tombol-teks" type="button" onClick={() => void tandaiTidakCocok()}>
          Tidak cocok
        </button>
      </div>
      {!menampilkanAlternatif && (
        <p className="muted kecil">
          Ganti menampilkan peringkat 4–6. Tidak cocok mencatat umpan balikmu
          dan menampilkan alternatif.
        </p>
      )}
      {umpanBalik && (
        <p className="muted kecil">
          Terima kasih, umpan balikmu dicatat. Ranking berikutnya ditampilkan
          di atas.
        </p>
      )}
    </div>
  );
}

function BarisRanking({
  hasil,
  peringkat,
  utama,
  eksplorasi,
  memulai,
  onPakai,
  indeks,
  masuk,
}: {
  hasil: HasilMatching;
  peringkat: number | null;
  utama: boolean;
  eksplorasi?: boolean;
  memulai: boolean;
  onPakai: () => void;
  /** Posisi baris untuk delay stagger (80ms per baris). */
  indeks: number;
  /** Reveal masuk aktif (hanya mount pertama onboarding). */
  masuk: boolean;
}): React.JSX.Element {
  // Barisnya sendiri bukan kontrol: satu-satunya aksi adalah tombol "Pakai"
  // (native button, bisa Enter dan Space). Klik-baris sengaja tidak ada:
  // memulai sesi 45 menit tidak boleh terjadi karena klik yang tidak sengaja.
  return (
    <div
      className={`baris-ranking${masuk ? ' baris-ranking-masuk' : ''}`}
      style={masuk ? ({ '--tunda': `${indeks * 80}ms` } as CSSProperties) : undefined}
    >
      <span className="peringkat">{peringkat ?? ''}</span>
      <div className="fleksibel-1">
        <span className="nama-framework">{hasil.framework.nama}</span>
        {eksplorasi && <span className="label-eksplorasi">eksplorasi</span>}
        <p className="alasan">{hasil.alasan}</p>
      </div>
      {utama ? (
        <button
          className="tombol-utama"
          type="button"
          disabled={memulai}
          onClick={onPakai}
        >
          {memulai ? 'Memulai…' : `Pakai ${hasil.framework.nama} (45')`}
        </button>
      ) : (
        <button
          className="tombol-garis"
          type="button"
          disabled={memulai}
          onClick={onPakai}
        >
          Pakai
        </button>
      )}
    </div>
  );
}
