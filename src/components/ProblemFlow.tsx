/**
 * Flow nyatakan masalah (dokumen 04 §4.4): satu pertanyaan per satu:
 * judul, jenis masalah, tekanan waktu, sumber daya, apa yang sudah dicoba.
 * Jenis masalah wajib (minimal satu) agar matcher punya kriteria; langkah
 * lain kecuali judul bisa dilewati. Output: Masalah + kriteria matching,
 * lalu kembali ke Beranda dengan ranking untuk masalah itu.
 */
import { useState } from 'react';
import type { KriteriaMasalah } from '../domain';
import { LABEL_KRITERIA } from '../domain';
import { buatMasalah } from '../db';
import { usePadiStore } from '../store';
import { navigasi } from '../App';

const JENIS_MASALAH: KriteriaMasalah[] = [
  'eksternal',
  'persaingan',
  'tidak_tahu_fokus',
  'pertumbuhan',
  'pasar_baru',
  'produk_baru',
  'jangka_panjang',
];

const LANGKAH = [
  'Judul masalah',
  'Jenis masalah',
  'Tekanan waktu',
  'Sumber daya',
  'Apa yang sudah dicoba',
];

export function ProblemFlow(): React.JSX.Element {
  const [langkah, setLangkah] = useState(0);
  const [judul, setJudul] = useState('');
  const [jenis, setJenis] = useState<Set<KriteriaMasalah>>(new Set());
  const [berwaktu, setBerwaktu] = useState<boolean | null>(null);
  const [sumberDayaTerbatas, setSumberDayaTerbatas] = useState<boolean | null>(null);
  const [sudahDicoba, setSudahDicoba] = useState('');
  const [menyimpan, setMenyimpan] = useState(false);
  const setMasalahAktif = usePadiStore((s) => s.setMasalahAktif);

  const lanjut = (): void => setLangkah((l) => Math.min(l + 1, LANGKAH.length - 1));
  const mundur = (): void => setLangkah((l) => Math.max(l - 1, 0));

  const toggleJenis = (k: KriteriaMasalah): void => {
    setJenis((sebelum) => {
      const baru = new Set(sebelum);
      if (baru.has(k)) baru.delete(k);
      else baru.add(k);
      return baru;
    });
  };

  const simpan = async (): Promise<void> => {
    if (menyimpan || judul.trim().length === 0) return;
    setMenyimpan(true);
    try {
      const kriteria: KriteriaMasalah[] = [...jenis];
      if (berwaktu) kriteria.push('berwaktu');
      if (sumberDayaTerbatas) kriteria.push('sumber_daya_terbatas');
      const deskripsi =
        sudahDicoba.trim().length > 0
          ? `Sudah dicoba: ${sudahDicoba.trim()}`
          : '';
      const masalah = await buatMasalah({ judul, deskripsi, kriteria });
      setMasalahAktif(masalah.id);
      navigasi('#/');
    } finally {
      setMenyimpan(false);
    }
  };

  return (
    <div>
      <p className="indikator-langkah">
        {LANGKAH.map((nama, i) => (
          <span key={nama}>
            {i > 0 && ' · '}
            <span
              className={i === langkah ? 'langkah-aktif' : undefined}
              aria-current={i === langkah ? 'step' : undefined}
            >
              {i + 1}. {nama}
            </span>
          </span>
        ))}
      </p>

      {langkah === 0 && (
        <>
          <h1>Sebut satu masalah nyata yang mau kamu selesaikan.</h1>
          <p className="muted">
            Satu kalimat cukup. Contoh: "Startup saya tidak tahu harus fokus ke
            segmen mana."
          </p>
          <label htmlFor="judul">Judul masalah</label>
          <input
            id="judul"
            type="text"
            value={judul}
            onChange={(e) => setJudul(e.target.value)}
            placeholder="Tulis masalahmu di sini"
            autoFocus
          />
          {judul.trim().length === 0 && (
            <p className="muted kecil">Isi judul dulu untuk lanjut.</p>
          )}
        </>
      )}

      {langkah === 1 && (
        <>
          <h1>Apa inti masalahmu?</h1>
          <p className="muted">Pilih minimal satu. Boleh lebih dari satu. Padi memakai ini untuk mencocokkan framework.</p>
          <div>
            {JENIS_MASALAH.map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={jenis.has(k)}
                className={`chip${jenis.has(k) ? ' terpilih' : ''}`}
                onClick={() => toggleJenis(k)}
              >
                {LABEL_KRITERIA[k]}
              </button>
            ))}
          </div>
        </>
      )}

      {langkah === 2 && (
        <>
          <h1>Apakah masalah ini ada tenggat waktunya?</h1>
          <p className="muted">
            Dipakai untuk mencocokkan framework: masalah bertenggat mengarah
            ke framework berritme cepat seperti Agile dan Kanban.
          </p>
          <div role="radiogroup" aria-label="Tenggat waktu">
            <button
              type="button"
              role="radio"
              aria-checked={berwaktu === true}
              className={`pilihan${berwaktu === true ? ' terpilih' : ''}`}
              onClick={() => setBerwaktu(true)}
            >
              Ya, ada tenggat. Perlu jawaban dalam waktu dekat.
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={berwaktu === false}
              className={`pilihan${berwaktu === false ? ' terpilih' : ''}`}
              onClick={() => setBerwaktu(false)}
            >
              Tidak ada tenggat khusus.
            </button>
          </div>
        </>
      )}

      {langkah === 3 && (
        <>
          <h1>Apakah sumber dayamu terbatas untuk masalah ini?</h1>
          <p className="muted">Waktu, uang, orang, atau ketiganya.</p>
          <p className="muted">
            Dipakai untuk mencocokkan framework: jawaban "terbatas"
            mengutamakan framework yang membantumu memilih dengan hati-hati.
          </p>
          <div role="radiogroup" aria-label="Keterbatasan sumber daya">
            <button
              type="button"
              role="radio"
              aria-checked={sumberDayaTerbatas === true}
              className={`pilihan${sumberDayaTerbatas === true ? ' terpilih' : ''}`}
              onClick={() => setSumberDayaTerbatas(true)}
            >
              Ya, terbatas. Harus memilih dengan hati-hati.
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={sumberDayaTerbatas === false}
              className={`pilihan${sumberDayaTerbatas === false ? ' terpilih' : ''}`}
              onClick={() => setSumberDayaTerbatas(false)}
            >
              Cukup, bukan kendala utama.
            </button>
          </div>
        </>
      )}

      {langkah === 4 && (
        <>
          <h1>Apa yang sudah kamu coba?</h1>
          <p className="muted">
            Opsional. Ini tampil di halaman masalahmu, supaya kamu tidak
            mengulang yang sudah dicoba.
          </p>
          <label htmlFor="dicoba">Yang sudah dicoba</label>
          <textarea
            id="dicoba"
            value={sudahDicoba}
            onChange={(e) => setSudahDicoba(e.target.value)}
            placeholder="Misal: sudah baca-baca kompetitor, tapi belum bisa memutuskan."
          />
        </>
      )}

      <div className="baris-tombol">
        {langkah > 0 && (
          <button className="tombol-garis" type="button" onClick={mundur}>
            Kembali
          </button>
        )}
        {langkah < LANGKAH.length - 1 ? (
          <>
            <button
              className="tombol-utama"
              type="button"
              disabled={
                (langkah === 0 && judul.trim().length === 0) ||
                (langkah === 1 && jenis.size === 0)
              }
              onClick={lanjut}
            >
              Lanjut
            </button>
            {langkah > 1 && (
              <button className="tombol-teks" type="button" onClick={lanjut}>
                Lewati
              </button>
            )}
          </>
        ) : (
          <button
            className="tombol-utama"
            type="button"
            disabled={menyimpan || judul.trim().length === 0}
            onClick={() => void simpan()}
          >
            {menyimpan ? 'Menyimpan…' : 'Simpan masalah & lihat ranking'}
          </button>
        )}
        <a className="tombol-teks" href="#/masalah">
          Batalkan
        </a>
      </div>
    </div>
  );
}
