/**
 * Onboarding diagnostik (PRD M0, dokumen 02 US-0.1, dokumen 04 §3.6).
 * 6 pertanyaan berurutan, masing-masing bisa dilewati, <5 menit, tanpa akun.
 *
 * Dua fase penyelesaian:
 * - Fase 1 (setelah Q6): jawaban diterapkan ke domain (masalah Q1 dibuat,
 *   framework Q3 ditandai dikenal) dan jawaban disimpan di store — tapi
 *   flag `selesai` BELUM dibalik, agar layar penutup tetap tampil.
 * - Fase 2 (keluar dari penutup): "Mulai Sesi Pertama" atau tombol "Pakai"
 *   di ranking membalik `selesai` lalu bernavigasi. Gate di App.tsx baru
 *   terbuka setelah ini — user yang menutup app di layar penutup akan
 *   melihat onboarding lagi, tapi jawaban sudah tersimpan dan masalah
 *   tidak dibuat ganda (penjaga `masalahTidakBerubah`).
 *
 * Mode ulang (`ulang`, dari layar Progres): jawaban lama diisi dulu;
 * menyelesaikan memperbarui profil tanpa membuka gate lagi.
 */
import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, mulaiSesi, terapkanHasilOnboarding } from '../db';
import { usePadiStore } from '../store';
import { hariIni } from '../dates';
import type { KriteriaMasalah, Masalah } from '../domain';
import { LABEL_KRITERIA } from '../domain';
import { RUBRIK } from '../rubrik';
import { rankingUntukMasalah } from '../matcher';
import {
  JUMLAH_PERTANYAAN,
  LABEL_GAYA_BELAJAR,
  LABEL_MEMBOSANKAN,
  LABEL_PENGHENTI,
  LABEL_TERAKHIR_PAKAI,
  bolehSelesaikan,
  jawabanKosong,
  profilSelesai,
  type GayaBelajar,
  type JawabanOnboarding,
  type Membosankan,
  type PenghentiSesi,
  type TerakhirPakai,
} from '../onboarding';
import { Ranking } from './Ranking';
import { navigasi } from '../App';

/** Kriteria opsional langkah Q1 — sama seperti Discovery/ProblemFlow. */
const JENIS_MASALAH: KriteriaMasalah[] = [
  'eksternal',
  'persaingan',
  'tidak_tahu_fokus',
  'pertumbuhan',
  'pasar_baru',
  'produk_baru',
  'jangka_panjang',
];

const PILIHAN_Q2: GayaBelajar[] = ['paham_konsep', 'pakai_konsep', 'review'];
const PILIHAN_Q4: Membosankan[] = ['membaca', 'menonton', 'latihan', 'mengajar'];
const PILIHAN_TERAKHIR: TerakhirPakai[] = [
  'minggu_ini',
  'bulan_ini',
  'lebih_lama',
  'tidak_ingat',
];
const PILIHAN_Q6: PenghentiSesi[] = [
  'distraksi',
  'bosan',
  'overwhelmed',
  'tidak_tahu_mulai',
];

const LANGKAH_PENUTUP = JUMLAH_PERTANYAAN;

export function Onboarding({ ulang = false }: { ulang?: boolean }): React.JSX.Element {
  const profilTersimpan = usePadiStore((s) => s.onboarding);
  const setOnboarding = usePadiStore((s) => s.setOnboarding);
  const setMasalahAktif = usePadiStore((s) => s.setMasalahAktif);
  const setSesiBerjalan = usePadiStore((s) => s.setSesiBerjalan);

  const frameworks = useLiveQuery(() => db.frameworks.toArray(), []);
  const pemakaian = useLiveQuery(() => db.pemakaian.toArray(), []);
  const semuaMasalah = useLiveQuery(() => db.masalah.toArray(), []);

  // Jawaban diisi dari profil tersimpan (mode ulang, atau kembali setelah
  // menutup app di tengah onboarding) — bukan dari nol.
  const [langkah, setLangkah] = useState(0);
  const [masalah, setMasalah] = useState(profilTersimpan.masalah ?? '');
  const [kriteria, setKriteria] = useState<Set<KriteriaMasalah>>(
    new Set(profilTersimpan.kriteria),
  );
  const [gayaBelajar, setGayaBelajar] = useState<GayaBelajar | null>(
    profilTersimpan.gayaBelajar,
  );
  const [frameworkDikenal, setFrameworkDikenal] = useState(
    profilTersimpan.frameworkDikenal ?? '',
  );
  const [terakhirPakai, setTerakhirPakai] = useState<TerakhirPakai | null>(
    profilTersimpan.terakhirPakai,
  );
  const [membosankan, setMembosankan] = useState<Membosankan | null>(
    profilTersimpan.membosankan,
  );
  const [gagalKonsisten, setGagalKonsisten] = useState(
    profilTersimpan.gagalKonsisten === null
      ? ''
      : String(profilTersimpan.gagalKonsisten),
  );
  const [penghenti, setPenghenti] = useState<PenghentiSesi | null>(
    profilTersimpan.penghenti,
  );
  const [menyimpan, setMenyimpan] = useState(false);
  const [memulai, setMemulai] = useState(false);

  const dipakaiIds = useMemo(
    () => new Set((pemakaian ?? []).map((p) => p.framework_id)),
    [pemakaian],
  );

  /** Masalah penutup: dari profil tersimpan (diisi fase 1). */
  const masalahPenutup: Masalah | undefined = useMemo(
    () =>
      (semuaMasalah ?? []).find((m) => m.id === profilTersimpan.masalahId),
    [semuaMasalah, profilTersimpan.masalahId],
  );

  if (
    frameworks === undefined ||
    pemakaian === undefined ||
    semuaMasalah === undefined
  ) {
    return <p className="muted">Memuat…</p>;
  }

  const jawabanSaatIni = (): JawabanOnboarding => {
    const gagal = parseInt(gagalKonsisten, 10);
    return {
      masalah: masalah.trim().length === 0 ? null : masalah,
      kriteria: [...kriteria],
      gayaBelajar,
      frameworkDikenal:
        frameworkDikenal.trim().length === 0 ? null : frameworkDikenal,
      terakhirPakai,
      membosankan,
      gagalKonsisten: Number.isNaN(gagal)
        ? null
        : Math.max(0, Math.min(14, gagal)),
      penghenti,
    };
  };

  /** Fase 1: terapkan jawaban ke domain + simpan profil (belum `selesai`). */
  const selesaikanFase1 = async (
    jawaban: JawabanOnboarding,
  ): Promise<void> => {
    if (menyimpan) return;
    if (!bolehSelesaikan(profilTersimpan, ulang)) {
      setLangkah(LANGKAH_PENUTUP);
      return;
    }
    setMenyimpan(true);
    try {
      // Q1 tidak berubah sejak fase 1 sebelumnya → jangan buat masalah ganda.
      const masalahTidakBerubah =
        profilTersimpan.masalahId !== null &&
        (jawaban.masalah ?? '').trim() ===
          (profilTersimpan.masalah ?? '').trim();
      const jawabanDb = masalahTidakBerubah
        ? { ...jawaban, masalah: null }
        : jawaban;
      const hasil = await terapkanHasilOnboarding(jawabanDb, frameworks);
      const masalahId = hasil.masalah?.id ?? profilTersimpan.masalahId;
      const frameworkDikenalId =
        hasil.frameworkDikenalId ?? profilTersimpan.frameworkDikenalId;
      setOnboarding({
        ...profilSelesai(jawaban, { masalahId, frameworkDikenalId }, hariIni()),
        // `selesai` dibalik di fase 2 (keluar dari penutup), bukan di sini.
        selesai: profilTersimpan.selesai,
        selesaiPada: profilTersimpan.selesaiPada,
      });
      if (hasil.masalah) setMasalahAktif(hasil.masalah.id);
      setLangkah(LANGKAH_PENUTUP);
    } finally {
      setMenyimpan(false);
    }
  };

  /** Fase 2: balik flag `selesai` (sekali saja) saat keluar dari penutup. */
  const tandaiSelesai = (): void => {
    const profil = usePadiStore.getState().onboarding;
    if (!profil.selesai) {
      setOnboarding({ ...profil, selesai: true, selesaiPada: hariIni() });
    }
  };

  const mulaiSesiPertama = async (): Promise<void> => {
    if (memulai) return;
    tandaiSelesai();
    if (!masalahPenutup) {
      // Tanpa masalah → guided discovery (jalur cadangan, US-0.2).
      navigasi('#/discovery');
      return;
    }
    const hasil = rankingUntukMasalah(masalahPenutup, frameworks, dipakaiIds);
    if (hasil.peringkat.length === 0) {
      // Masalah tanpa kriteria yang cocok → jelajahi Peta.
      navigasi('#/peta');
      return;
    }
    setMemulai(true);
    try {
      const sesi = await mulaiSesi({
        framework_id: hasil.peringkat[0].framework.id,
        masalah_id: masalahPenutup.id,
        jenis: 'penerapan',
        durasi_target_menit: 45,
      });
      setSesiBerjalan(sesi.id);
      navigasi(`#/sesi/${sesi.id}`);
    } finally {
      setMemulai(false);
    }
  };

  const toggleKriteria = (k: KriteriaMasalah): void => {
    setKriteria((sebelum) => {
      const baru = new Set(sebelum);
      if (baru.has(k)) baru.delete(k);
      else baru.add(k);
      return baru;
    });
  };

  const lanjut = (): void => setLangkah((l) => Math.min(l + 1, LANGKAH_PENUTUP));
  const mundur = (): void => setLangkah((l) => Math.max(l - 1, 0));
  const lewatiLangkah = (): void => {
    if (langkah === LANGKAH_PENUTUP - 1) {
      void selesaikanFase1(jawabanSaatIni());
    } else {
      lanjut();
    }
  };

  const tombolNavigasi = (
    <>
      <div className="baris-tombol">
        {langkah > 0 && (
          <button className="tombol-garis" type="button" onClick={mundur}>
            Kembali
          </button>
        )}
        <button
          className="tombol-utama"
          type="button"
          disabled={menyimpan}
          onClick={() => {
            if (langkah === LANGKAH_PENUTUP - 1) {
              void selesaikanFase1(jawabanSaatIni());
            } else {
              lanjut();
            }
          }}
        >
          {menyimpan
            ? 'Menyimpan…'
            : langkah === LANGKAH_PENUTUP - 1
              ? 'Lihat rekomendasi'
              : 'Lanjut'}
        </button>
        <button className="tombol-teks" type="button" onClick={lewatiLangkah}>
          Lewati
        </button>
      </div>
      {ulang && (
        <div className="baris-tombol">
          <a className="tombol-teks" href="#/progres">
            Batalkan (jawaban lama tetap tersimpan)
          </a>
        </div>
      )}
    </>
  );

  // --- Layar penutup (dokumen 04 §3.6) ---
  if (langkah === LANGKAH_PENUTUP) {
    return (
      <div>
        <p className="indikator-langkah">Selesai — rekomendasi pertamamu</p>
        <h1>
          Padi membantumu menyelesaikan masalah nyata dengan framework yang
          tepat — satu sesi 45 menit setiap kali.
        </h1>

        {masalahPenutup ? (
          <>
            <p>
              Masalah pertamamu: <strong>{masalahPenutup.judul}</strong>
            </p>
            <Ranking
              masalah={masalahPenutup}
              frameworks={frameworks}
              dipakaiIds={dipakaiIds}
              onMulaiSesi={tandaiSelesai}
            />
          </>
        ) : (
          <div className="kartu">
            <h2>Belum ada masalah — tidak apa-apa</h2>
            <p>
              Kamu belum menyatakan masalah. Padi akan membantumu menemukannya
              lewat guided discovery — beberapa pertanyaan tentang area
              hidup/kerjamu, lalu masalah dirumuskan dan framework yang cocok
              ditampilkan.
            </p>
            <div className="baris-tombol">
              <a className="tombol-garis" href="#/discovery">
                Temukan masalah
              </a>
            </div>
          </div>
        )}

        <h2>Cara Padi menilai sesi (rubrik 0–3)</h2>
        <p className="muted kecil">
          Setiap sesi dinilai sendiri dengan rubrik ini. Skor bukan nilai —
          skor mengukur seberapa jauh kamu bisa menerapkan.
        </p>
        {RUBRIK.map((r) => (
          <div key={r.skor} className="rubrik">
            <span className="skor">
              {r.skor} — {r.judul}
            </span>
            <p className="muted">{r.arti}</p>
          </div>
        ))}

        <div className="baris-tombol">
          <button
            className="tombol-utama"
            type="button"
            disabled={memulai}
            onClick={() => void mulaiSesiPertama()}
          >
            {memulai ? 'Memulai…' : 'Mulai Sesi Pertama'}
          </button>
          {ulang && (
            <a className="tombol-teks" href="#/progres">
              Kembali ke Progres
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="indikator-langkah">
        Pertanyaan {langkah + 1} dari {JUMLAH_PERTANYAAN} · kurang dari 5 menit
        · semua bisa dilewati
      </p>

      {langkah === 0 && (
        <>
          <h1>Sebut satu masalah nyata yang mau kamu selesaikan.</h1>
          <p className="muted">
            Satu kalimat cukup. Padi bekerja dari masalahmu — bukan dari daftar
            materi. Lewati kalau belum ada masalah; Padi akan membantumu
            menemukannya nanti.
          </p>
          <label htmlFor="onboarding-masalah">Masalah nyata</label>
          <textarea
            id="onboarding-masalah"
            value={masalah}
            onChange={(e) => setMasalah(e.target.value)}
            placeholder="Misal: startup saya tidak tahu harus fokus ke segmen pelanggan yang mana."
            autoFocus
          />
          <h2>Apa inti masalah ini?</h2>
          <p className="muted kecil">
            Opsional — membantu Padi memilih framework untuk masalahmu.
          </p>
          <div>
            {JENIS_MASALAH.map((k) => (
              <button
                key={k}
                type="button"
                className={`chip${kriteria.has(k) ? ' terpilih' : ''}`}
                onClick={() => toggleKriteria(k)}
              >
                {LABEL_KRITERIA[k]}
              </button>
            ))}
          </div>
          {tombolNavigasi}
          {!ulang && (
            <div className="baris-tombol">
              <button
                className="tombol-teks"
                type="button"
                disabled={menyimpan}
                onClick={() => void selesaikanFase1(jawabanKosong())}
              >
                Lewati onboarding
              </button>
            </div>
          )}
        </>
      )}

      {langkah === 1 && (
        <>
          <h1>
            Kalau 20 menit besok, kamu mau paham konsep baru, pakai konsep di
            pekerjaanmu, atau review yang sudah lupa?
          </h1>
          <p className="muted">
            Jawaban ini menentukan jalur awalmu: yang mau langsung memakai
            masuk ke problem-first, yang mau paham dulu ditawari guided
            discovery.
          </p>
          {PILIHAN_Q2.map((g) => (
            <button
              key={g}
              type="button"
              className={`pilihan${gayaBelajar === g ? ' terpilih' : ''}`}
              onClick={() => setGayaBelajar(g)}
            >
              {LABEL_GAYA_BELAJAR[g]}
            </button>
          ))}
          {tombolNavigasi}
        </>
      )}

      {langkah === 2 && (
        <>
          <h1>
            Sebut satu framework yang sudah kamu tahu — dan kapan terakhir
            kali kamu memakainya?
          </h1>
          <p className="muted">
            "Tahu" beda dengan "dikuasai". Framework yang sudah kamu tahu
            tidak akan ditawarkan sebagai materi baru — langsung ke penerapan.
          </p>
          <label htmlFor="onboarding-framework">Framework yang sudah tahu</label>
          <input
            id="onboarding-framework"
            type="text"
            value={frameworkDikenal}
            onChange={(e) => setFrameworkDikenal(e.target.value)}
            placeholder="Misal: PESTEL, Kanban, Business Model Canvas"
            autoFocus
          />
          <h2>Kapan terakhir kali memakainya?</h2>
          {PILIHAN_TERAKHIR.map((t) => (
            <button
              key={t}
              type="button"
              className={`pilihan${terakhirPakai === t ? ' terpilih' : ''}`}
              onClick={() => setTerakhirPakai(t)}
            >
              {LABEL_TERAKHIR_PAKAI[t]}
            </button>
          ))}
          {tombolNavigasi}
        </>
      )}

      {langkah === 3 && (
        <>
          <h1>
            Apa yang paling membosankan saat belajar: membaca, menonton,
            latihan, atau mengajar?
          </h1>
          <p className="muted">
            Jawaban ini menentukan bentuk artefak penerapanmu secara default —
            kamu tetap bisa mengubahnya setiap sesi.
          </p>
          {PILIHAN_Q4.map((m) => (
            <button
              key={m}
              type="button"
              className={`pilihan${membosankan === m ? ' terpilih' : ''}`}
              onClick={() => setMembosankan(m)}
            >
              {LABEL_MEMBOSANKAN[m]}
            </button>
          ))}
          {tombolNavigasi}
        </>
      )}

      {langkah === 4 && (
        <>
          <h1>
            Berapa kali kamu pernah gagal konsisten belajar dalam 2 minggu
            terakhir?
          </h1>
          <p className="muted">
            Jujur saja — angka ini membantu Padi memahami ritmemu, bukan
            menilaimu.
          </p>
          <label htmlFor="onboarding-gagal">Jumlah kegagalan (0–14)</label>
          <input
            id="onboarding-gagal"
            type="number"
            min={0}
            max={14}
            value={gagalKonsisten}
            onChange={(e) => setGagalKonsisten(e.target.value)}
            placeholder="Misal: 3"
            autoFocus
          />
          {tombolNavigasi}
        </>
      )}

      {langkah === 5 && (
        <>
          <h1>Apa yang biasanya bikin kamu berhenti di tengah sesi?</h1>
          {PILIHAN_Q6.map((p) => (
            <button
              key={p}
              type="button"
              className={`pilihan${penghenti === p ? ' terpilih' : ''}`}
              onClick={() => setPenghenti(p)}
            >
              {LABEL_PENGHENTI[p]}
            </button>
          ))}
          {tombolNavigasi}
        </>
      )}
    </div>
  );
}
