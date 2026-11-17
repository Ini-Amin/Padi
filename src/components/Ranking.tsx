/**
 * Ranking matching (PRD M4): 3 framework teratas + 1 slot eksplorasi,
 * masing-masing dengan alasan yang menyebut kriteria yang cocok.
 * Tombol "Ganti" menampilkan alternatif peringkat 4–6; "Tidak cocok"
 * mencatat umpan balik sebagai telemetri (tanpa penalti).
 */
import { useMemo, useState } from 'react';
import type { Framework, Masalah } from '../domain';
import {
  alternatifBerikutnya,
  rankingUntukMasalah,
  type HasilMatching,
} from '../matcher';
import { db, mulaiSesi } from '../db';
import { navigasi } from '../App';
import { usePadiStore } from '../store';
import { hariIni } from '../dates';

interface Props {
  masalah: Masalah;
  frameworks: Framework[];
  dipakaiIds: ReadonlySet<string>;
  /**
   * Dipanggil saat user memulai sesi dari ranking ini. Dipakai layar penutup
   * onboarding untuk membalik flag `selesai` sebelum bernavigasi ke sesi —
   * tanpa ini, gate first-run di App.tsx akan menampilkan onboarding lagi.
   */
  onMulaiSesi?: () => void;
}

export function Ranking({ masalah, frameworks, dipakaiIds, onMulaiSesi }: Props): React.JSX.Element {
  const [menampilkanAlternatif, setMenampilkanAlternatif] = useState(false);
  const [umpanBalik, setUmpanBalik] = useState(false);
  const [memulai, setMemulai] = useState<string | null>(null);
  const setSesiBerjalan = usePadiStore((s) => s.setSesiBerjalan);

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
      onMulaiSesi?.();
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
    return (
      <div className="kartu">
        <h2>Framework yang cocok</h2>
        <p>
          Belum ada framework yang cocok dengan kriteria masalah ini. Coba
          nyatakan ulang masalahmu dengan kriteria yang berbeda, atau jelajahi
          Peta untuk melihat semua framework.
        </p>
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
      {daftar.map((h, i) => (
        <BarisRanking
          key={h.framework.id}
          hasil={h}
          peringkat={i + 1}
          utama={!menampilkanAlternatif && i === 0}
          memulai={memulai === h.framework.id}
          onPakai={() => void pakai(h.framework.id)}
        />
      ))}
      {menampilkanAlternatif && alternatif.length === 0 && (
        <p className="muted">Tidak ada alternatif lain untuk masalah ini.</p>
      )}
      {!menampilkanAlternatif && hasil.eksplorasi && (
        <BarisRanking
          hasil={hasil.eksplorasi}
          peringkat={null}
          utama={false}
          eksplorasi
          memulai={memulai === hasil.eksplorasi.framework.id}
          onPakai={() => void pakai(hasil.eksplorasi!.framework.id)}
        />
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
      {umpanBalik && (
        <p className="muted kecil">
          Terima kasih — umpan balikmu dicatat. Ranking berikutnya ditampilkan
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
}: {
  hasil: HasilMatching;
  peringkat: number | null;
  utama: boolean;
  eksplorasi?: boolean;
  memulai: boolean;
  onPakai: () => void;
}): React.JSX.Element {
  return (
    <div className="baris-ranking" onClick={onPakai} role="button" tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onPakai();
      }}
    >
      <span className="peringkat">{peringkat ?? ''}</span>
      <div style={{ flex: 1 }}>
        <span className="nama-framework">{hasil.framework.nama}</span>
        {eksplorasi && <span className="label-eksplorasi">eksplorasi</span>}
        <p className="alasan">{hasil.alasan}</p>
      </div>
      {utama ? (
        <button
          className="tombol-utama"
          type="button"
          disabled={memulai}
          onClick={(e) => {
            e.stopPropagation();
            onPakai();
          }}
        >
          {memulai ? 'Memulai…' : `Pakai ${hasil.framework.nama} (45')`}
        </button>
      ) : (
        <button
          className="tombol-garis"
          type="button"
          disabled={memulai}
          onClick={(e) => {
            e.stopPropagation();
            onPakai();
          }}
        >
          Pakai
        </button>
      )}
    </div>
  );
}
