/**
 * Onboarding problem-first (dokumen 04 §3.6): satu-satunya langkah wajib
 * adalah menyatakan satu masalah nyata. Padi langsung menunjukkan 3
 * framework yang cocok, lalu user masuk sesi 45 menit pertama.
 *
 * Langkah 0: textarea masalah + contoh yang bisa diklik + kriteria (pilih
 * minimal satu, agar matcher punya bahan). Langkah 1: ranking 3 framework
 * untuk masalah yang baru dibuat.
 * "Lewati" menandai onboarding selesai tanpa masalah (Beranda kosong).
 * Mode `ulang` (dari Progres): menyatakan masalah baru, tanpa gate.
 */
import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import gsap from 'gsap';
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

export function Onboarding({ ulang = false }: { ulang?: boolean }): React.JSX.Element {
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
  const refLangkah = useRef<HTMLDivElement | null>(null);

  // Transisi antar langkah (GSAP): layar masuk dengan fade + naik sedikit.
  // Berjalan saat mount dan setiap pergantian langkah; mati bila gerakan
  // tidak aktif.
  useEffect(() => {
    const el = refLangkah.current;
    if (el === null || !gerakanAktif) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        { opacity: 0, y: 8 },
        {
          opacity: 1,
          y: 0,
          duration: 0.3,
          ease: 'power1.out',
          clearProps: 'all',
        },
      );
    });
    return () => ctx.revert();
  }, [langkah, gerakanAktif]);

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

  /** Buat masalah, tandai onboarding selesai, tampilkan ranking. */
  const lihatCocok = async (): Promise<void> => {
    const teksMasalah = masalah.trim();
    if (teksMasalah.length === 0 || menyimpan || kriteria.size === 0) return;
    if (!bolehSelesaikan(profilTersimpan, ulang)) return;
    const jawaban: JawabanOnboarding = {
      masalah: teksMasalah,
      kriteria: [...kriteria],
    };
    setMenyimpan(true);
    try {
      const hasil = await terapkanHasilOnboarding(jawaban);
      if (hasil.masalah === null) return;
      setOnboarding(
        profilSelesai(jawaban, { masalahId: hasil.masalah.id }, hariIni()),
      );
      setMasalahAktif(hasil.masalah.id);
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
      <div ref={refLangkah}>
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

  return (
    <div ref={refLangkah}>
      <p className="indikator-langkah">Langkah 1 dari 2: masalahmu</p>
      <h1>
        Masalah apa yang sedang kamu hadapi?
      </h1>
      <p className="muted">
        Satu kalimat cukup. Padi akan mencocokkan masalahmu dengan framework
        yang tepat, lalu kamu langsung menerapkannya dalam satu sesi.
      </p>
      <label htmlFor="masalah-onboarding">Masalahmu</label>
      <textarea
        id="masalah-onboarding"
        value={masalah}
        onChange={(e) => setMasalah(e.target.value)}
        placeholder="Misal: tidak tahu harus fokus ke segmen pelanggan yang mana."
        autoFocus
      />
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
      <h2>Apa inti masalah ini?</h2>
      <p className="muted kecil">
        Pilih minimal satu. Padi memakai ini untuk mencocokkan framework.
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
      <div className="baris-tombol">
        <button
          className="tombol-utama"
          type="button"
          disabled={menyimpan || masalah.trim().length === 0 || kriteria.size === 0}
          onClick={() => void lihatCocok()}
        >
          {menyimpan ? 'Menyimpan…' : 'Lihat framework yang cocok'}
        </button>
        {ulang ? (
          <a className="tombol-teks" href="#/progres">
            Batalkan
          </a>
        ) : (
          <button className="tombol-teks" type="button" onClick={lewati}>
            Lewati
          </button>
        )}
      </div>
    </div>
  );
}
