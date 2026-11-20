/**
 * Onboarding problem-first (dokumen 04 §3.6): satu-satunya langkah wajib
 * adalah menyatakan satu masalah nyata. Padi langsung menunjukkan 3
 * framework yang cocok, lalu user masuk sesi 45 menit pertama.
 *
 * Langkah 0: textarea masalah + contoh yang bisa diklik. Kriteria TIDAK
 * lagi wajib dicentang manual: ditebak otomatis dari teks (inferKriteria)
 * dan digabung dengan centang manual di akordeon opsional (tertutup
 * default). Langkah 1: ranking 3 framework untuk masalah yang baru dibuat.
 * "Lewati" menandai onboarding selesai tanpa masalah (Beranda kosong).
 * Mode `ulang` (dari Progres): menyatakan masalah baru, tanpa gate.
 * Mode `embedded` (di Beranda saat belum ada masalah aktif): hanya form
 * langkah 0, tanpa indikator langkah dan tanpa Lewati/Batalkan; setelah
 * simpan, form menghilang dan Beranda menampilkan masalah aktif +
 * ranking (tanpa navigasi, tanpa reload).
 */
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, terapkanHasilOnboarding } from '../db';
import { usePadiStore } from '../store';
import { hariIni } from '../dates';
import { LABEL_KRITERIA } from '../domain';
import type { KriteriaMasalah, Masalah } from '../domain';
import {
  bolehSelesaikan,
  jawabanKosong,
  profilSelesai,
  type JawabanOnboarding,
} from '../onboarding';
import { gabungKriteria, inferKriteria } from '../inferKriteria';
import { Ranking } from './Ranking';
import { navigasi } from '../App';
import { useGerakanAktif } from '../gerakan';

/** Kriteria opsional langkah masalah: sama seperti Discovery/ProblemFlow. */
const JENIS_MASALAH: KriteriaMasalah[] = [
  'eksternal',
  'persaingan',
  'tidak_tahu_fokus',
  'pertumbuhan',
  'pasar_baru',
  'produk_baru',
  'jangka_panjang',
];

/** Contoh masalah yang bisa diklik untuk mengisi textarea. */
const CONTOH_MASALAH = [
  'Saya tidak tahu harus fokus ke segmen pelanggan yang mana.',
  'Tim saya sibuk, tapi pekerjaan penting sering tertunda.',
  'Saya ragu mengambil keputusan karena datanya tidak lengkap.',
];

export function Onboarding({
  ulang = false,
  embedded = false,
}: {
  ulang?: boolean;
  embedded?: boolean;
}): React.JSX.Element {
  const profilTersimpan = usePadiStore((s) => s.onboarding);
  const setOnboarding = usePadiStore((s) => s.setOnboarding);
  const setMasalahAktif = usePadiStore((s) => s.setMasalahAktif);

  const frameworks = useLiveQuery(() => db.frameworks.toArray(), []);
  const pemakaian = useLiveQuery(() => db.pemakaian.toArray(), []);

  const [langkah, setLangkah] = useState(0);
  const [masalah, setMasalah] = useState('');
  const [kriteria, setKriteria] = useState<Set<KriteriaMasalah>>(new Set());
  const [masalahBaru, setMasalahBaru] = useState<Masalah | null>(null);
  const [menyimpan, setMenyimpan] = useState(false);
  const gerakanAktif = useGerakanAktif();
  // Transisi antar langkah: kelas .langkah-masuk (animasi CSS, fade +
  // naik 8px, 0.3 detik). Kedua cabang langkah memakai key={langkah}
  // agar div me-mount ulang tiap pergantian langkah — tanpa key, React
  // memakai ulang node div yang sama dan animasi CSS tidak jalan lagi
  // (beda dengan GSAP yang men-trigger ulang lewat effect). Animasi
  // jalan saat mount dan setiap pergantian langkah; mati bila gerakan
  // tidak aktif. (GSAP dihapus 18 Nov 2026: satu-satunya pemakaian
  // adalah transisi ini + stagger Ranking — keduanya setara di CSS.)

  // Tebakan kriteria dari teks (dihitung ulang tiap ketikan; murah —
  // hanya regex batas kata). Ditampilkan sebagai petunjuk, bukan
  // sebagai pilihan: yang disimpan adalah gabungan tebakan + centang
  // manual (lihat lihatCocok).
  const tebakan = masalah.trim().length > 0 ? inferKriteria(masalah) : [];

  const toggleKriteria = (k: KriteriaMasalah): void => {
    setKriteria((sebelum) => {
      const berikut = new Set(sebelum);
      if (berikut.has(k)) berikut.delete(k);
      else berikut.add(k);
      return berikut;
    });
  };

  /** Lewati: onboarding selesai tanpa masalah. Beranda akan kosong. */
  const lewati = (): void => {
    if (!bolehSelesaikan(profilTersimpan, ulang)) {
      navigasi('#/');
      return;
    }
    setOnboarding(
      profilSelesai(jawabanKosong(), { masalahId: null }, hariIni()),
    );
    navigasi('#/');
  };

  /**
   * Buat masalah dari teks + kriteria gabungan (tebakan + centang
   * manual), tandai onboarding selesai, jadikan masalah aktif.
   * Mode embedded: selesai sampai di sini — Beranda me-render ulang
   * dan form menghilang (masalah aktif + ranking tampil). Mode
   * standalone: lanjut ke langkah 1 (ranking untuk masalah baru).
   * Guard bolehSelesaikan dilonggarkan di mode embedded seperti di
   * mode ulang: user yang sudah pernah onboarding tapi tidak punya
   * masalah aktif (mis. semua masalah diarsipkan) tetap harus bisa
   * menyatakan masalah baru dari Beranda.
   */
  const lihatCocok = async (): Promise<void> => {
    const teksMasalah = masalah.trim();
    if (teksMasalah.length === 0 || menyimpan) return;
    if (!bolehSelesaikan(profilTersimpan, ulang || embedded)) return;
    const jawaban: JawabanOnboarding = {
      masalah: teksMasalah,
      kriteria: gabungKriteria(inferKriteria(teksMasalah), kriteria),
    };
    setMenyimpan(true);
    try {
      const hasil = await terapkanHasilOnboarding(jawaban);
      if (hasil.masalah === null) return;
      setOnboarding(
        profilSelesai(jawaban, { masalahId: hasil.masalah.id }, hariIni()),
      );
      setMasalahAktif(hasil.masalah.id);
      if (embedded) return;
      setMasalahBaru(hasil.masalah);
      setLangkah(1);
    } finally {
      setMenyimpan(false);
    }
  };

  if (frameworks === undefined || pemakaian === undefined) {
    return <p className="muted">Memuat…</p>;
  }
  const dipakaiIds = new Set(pemakaian.map((p) => p.framework_id));

  if (langkah === 1 && masalahBaru !== null) {
    return (
      <div key={langkah} className={gerakanAktif ? 'langkah-masuk' : undefined}>
        <p className="indikator-langkah">Langkah 2 dari 2: pilih framework</p>
        <h1>3 framework yang cocok untuk masalahmu</h1>
        <p>
          <strong>{masalahBaru.judul}</strong>
        </p>
        <Ranking
          masalah={masalahBaru}
          frameworks={frameworks}
          dipakaiIds={dipakaiIds}
          animasiMasuk
        />
        <div className="baris-tombol">
          <a className="tombol-teks" href="#/discovery">
            Cari yang lain
          </a>
        </div>
      </div>
    );
  }

  const judul = embedded ? (
    <h2>Masalah apa yang sedang kamu hadapi?</h2>
  ) : (
    <h1>Masalah apa yang sedang kamu hadapi?</h1>
  );

  return (
    <div key={langkah} className={gerakanAktif ? 'langkah-masuk' : undefined}>
      {!embedded && (
        <p className="indikator-langkah">Langkah 1 dari 2: masalahmu</p>
      )}
      {judul}
      <p className="muted">
        Satu kalimat cukup. Padi akan mencocokkan masalahmu dengan framework
        yang tepat, lalu kamu langsung menerapkannya dalam satu sesi.
      </p>
      <label htmlFor="masalah-onboarding">Masalahmu</label>
      <textarea
        id="masalah-onboarding"
        className="scratchpad"
        value={masalah}
        onChange={(e) => setMasalah(e.target.value)}
        placeholder="Misal: tidak tahu harus fokus ke segmen pelanggan yang mana."
        autoFocus={!embedded}
      />
      {tebakan.length > 0 && (
        <p className="muted kecil">
          Tebakan Padi: {tebakan.map((k) => LABEL_KRITERIA[k]).join(', ')}.
        </p>
      )}
      <p className="muted kecil">Atau pakai contoh:</p>
      <div>
        {CONTOH_MASALAH.map((c) => (
          <button
            key={c}
            type="button"
            className="chip"
            onClick={() => setMasalah(c)}
          >
            {c}
          </button>
        ))}
      </div>
      <details className="akordeon-utilitas">
        <summary>
          Kriteria tambahan (opsional)
          {kriteria.size > 0 ? ` — ${kriteria.size} dipilih` : ''}
        </summary>
        <div className="isi-akordeon">
          <p className="muted kecil">
            Padi sudah menebak kriteria dari teksmu. Centang bila ada yang
            kurang — yang dicentang ditambahkan ke tebakan.
          </p>
          <div>
            {JENIS_MASALAH.map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={kriteria.has(k)}
                className={`chip${kriteria.has(k) ? ' terpilih' : ''}`}
                onClick={() => toggleKriteria(k)}
              >
                {LABEL_KRITERIA[k]}
              </button>
            ))}
          </div>
        </div>
      </details>
      <div className="baris-tombol">
        <button
          className="tombol-utama tombol-hijau"
          type="button"
          disabled={menyimpan || masalah.trim().length === 0}
          onClick={() => void lihatCocok()}
        >
          {menyimpan ? 'Menyimpan…' : 'Cari Framework'}
        </button>
        {!embedded &&
          (ulang ? (
            <a className="tombol-teks" href="#/progres">
              Batalkan
            </a>
          ) : (
            <button className="tombol-teks" type="button" onClick={lewati}>
              Lewati
            </button>
          ))}
      </div>
    </div>
  );
}
