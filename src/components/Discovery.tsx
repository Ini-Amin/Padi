/**
 * Guided discovery: JALUR CADANGAN (PRD M6), bukan jalur utama.
 * Untuk user yang datang tanpa masalah nyata. Aturan keras: discovery
 * TIDAK BOLEH berujung "modul selesai". Satu-satunya ujung yang sah adalah
 * masalah + ranking (alur problem-first).
 */
import { useState } from 'react';
import type { KriteriaMasalah } from '../domain';
import { LABEL_KRITERIA } from '../domain';
import { buatMasalah } from '../db';
import { usePadiStore } from '../store';
import { navigasi } from '../App';

const AREA = ['Kuliah', 'Proyek', 'Kerja', 'Keputusan personal', 'Lainnya'];

const JENIS_MASALAH: KriteriaMasalah[] = [
  'eksternal',
  'persaingan',
  'tidak_tahu_fokus',
  'pertumbuhan',
  'pasar_baru',
  'produk_baru',
  'jangka_panjang',
];

export function Discovery(): React.JSX.Element {
  const [langkah, setLangkah] = useState(0);
  const [area, setArea] = useState('');
  const [bingung, setBingung] = useState('');
  const [judul, setJudul] = useState('');
  const [jenis, setJenis] = useState<Set<KriteriaMasalah>>(new Set());
  const [menyimpan, setMenyimpan] = useState(false);
  const setMasalahAktif = usePadiStore((s) => s.setMasalahAktif);

  const toggleJenis = (k: KriteriaMasalah): void => {
    setJenis((sebelum) => {
      const baru = new Set(sebelum);
      if (baru.has(k)) baru.delete(k);
      else baru.add(k);
      return baru;
    });
  };

  const keRumusan = (): void => {
    setJudul(bingung.trim());
    setLangkah(2);
  };

  const simpan = async (): Promise<void> => {
    if (menyimpan || judul.trim().length === 0 || jenis.size === 0) return;
    setMenyimpan(true);
    try {
      const masalah = await buatMasalah({
        judul,
        deskripsi: area ? `Area: ${area}.` : '',
        kriteria: [...jenis],
      });
      setMasalahAktif(masalah.id);
      navigasi('#/');
    } finally {
      setMenyimpan(false);
    }
  };

  return (
    <div>
      <p className="indikator-langkah">Jalur cadangan: menemukan masalah</p>

      {langkah === 0 && (
        <>
          <h1>Di area apa kamu sering bingung mengambil keputusan?</h1>
          <div role="radiogroup" aria-label="Area yang sering membingungkan">
            {AREA.map((a) => (
              <button
                key={a}
                type="button"
                role="radio"
                aria-checked={area === a}
                className={`pilihan${area === a ? ' terpilih' : ''}`}
                onClick={() => setArea(a)}
              >
                {a}
              </button>
            ))}
          </div>
          <div className="baris-tombol">
            <button
              className="tombol-utama"
              type="button"
              disabled={area.length === 0}
              onClick={() => setLangkah(1)}
            >
              Lanjut
            </button>
            <a className="tombol-teks" href="#/peta">
              Jelajahi Peta saja
            </a>
          </div>
        </>
      )}

      {langkah === 1 && (
        <>
          <h1>
            Di area {area.toLowerCase()}, apa yang paling sering membingungkanmu?
          </h1>
          <p className="muted">Satu kalimat cukup. Ini akan menjadi masalahmu.</p>
          <label htmlFor="bingung">Yang membingungkan</label>
          <textarea
            id="bingung"
            value={bingung}
            onChange={(e) => setBingung(e.target.value)}
            placeholder="Misal: tidak tahu harus fokus ke segmen pelanggan yang mana."
            autoFocus
          />
          <div className="baris-tombol">
            <button className="tombol-garis" type="button" onClick={() => setLangkah(0)}>
              Kembali
            </button>
            <button
              className="tombol-utama"
              type="button"
              disabled={bingung.trim().length === 0}
              onClick={keRumusan}
            >
              Rumuskan masalah
            </button>
          </div>
        </>
      )}

      {langkah === 2 && (
        <>
          <h1>Apakah ini masalahmu?</h1>
          <p className="muted">
            Periksa dan ubah seperlunya. Kalau ini bukan masalahmu, kembali dan
            rumuskan ulang.
          </p>
          <label htmlFor="judul-rumusan">Rumusan masalah</label>
          <input
            id="judul-rumusan"
            type="text"
            value={judul}
            onChange={(e) => setJudul(e.target.value)}
          />
          <h2>Apa inti masalah ini?</h2>
          <p className="muted kecil">Pilih minimal satu. Padi memakai ini untuk mencocokkan framework.</p>
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
          <div className="baris-tombol">
            <button className="tombol-garis" type="button" onClick={() => setLangkah(1)}>
              Rumuskan ulang
            </button>
            <button
              className="tombol-utama"
              type="button"
              disabled={menyimpan || judul.trim().length === 0 || jenis.size === 0}
              onClick={() => void simpan()}
            >
              {menyimpan ? 'Menyimpan…' : 'Ya, ini masalah saya'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
