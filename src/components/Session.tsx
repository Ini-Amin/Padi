/**
 * Layar Sesi + Layar Penilaian (dokumen 04 §3.2): dua tahap terpisah.
 * Timer berbasis delta Date.now() (interval 1 detik + autosave 30 detik).
 * Sesi re-use meminta masalah BARU dan tidak menampilkan catatan lama
 * (retrieval practice, Prinsip 5a).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, selesaikanSesi } from '../db';
import type { Artefak, ISODate, Masalah, Sesi, Skor } from '../domain';
import { formatTanggal } from '../dates';
import { RUBRIK } from '../rubrik';
import {
  formatDurasi,
  judulArtefakDefault,
  labelJenisSesi,
  perluKonfirmasiDini,
  perluPilihMasalah,
  tahapDariElapsed,
  tahapUntukTick,
} from '../sesi';
import { pecahLangkahProsedur } from '../prosedur';
import { useGerakanAktif } from '../gerakan';
import { totalXp } from '../gamification';
import { navigasi } from '../App';

const JENIS_ARTEFAK: Array<{ nilai: Artefak['jenis']; label: string }> = [
  { nilai: 'teks', label: 'Teks' },
  { nilai: 'diagram', label: 'Diagram (deskripsi teks)' },
  { nilai: 'memo', label: 'Memo' },
  { nilai: 'analisis_perusahaan', label: 'Analisis perusahaan' },
];

type Tahap = 'pilih-masalah' | 'sesi' | 'nilai' | 'selesai';

/** Empat tahap panduan sesi penerapan (dokumen 03 §7). */
const TAHAP_PANDUAN: Array<{ nama: string; rentang: string }> = [
  { nama: 'Recall', rentang: '0–5′' },
  { nama: 'Prosedur', rentang: '5–20′' },
  { nama: 'Penerapan', rentang: '20–35′' },
  { nama: 'Artefak', rentang: '35–45′' },
];

export function Session({ id, reuseId }: { id: string; reuseId: string | null }): React.JSX.Element {
  const sesi = useLiveQuery(() => db.sesi.get(id), [id]);
  const framework = useLiveQuery(
    () => (sesi ? db.frameworks.get(sesi.framework_id) : undefined),
    [sesi?.framework_id],
  );
  const masalahSesi = useLiveQuery(
    () => (sesi?.masalah_id ? db.masalah.get(sesi.masalah_id) : undefined),
    [sesi?.masalah_id],
  );
  const semuaMasalah = useLiveQuery(() => db.masalah.toArray(), []);
  const pemakaianFramework = useLiveQuery(
    () => (sesi ? db.pemakaian.where('framework_id').equals(sesi.framework_id).toArray() : []),
    [sesi?.framework_id],
  );
  // Artefak + XP sesi ini (untuk tampilan selesai). Diletakkan SETELAH
  // query di atas agar urutan hook tidak berubah bagi tes yang sudah ada.
  // Sengaja tidak masuk penjaga "Memuat…": tampilan selesai menunggu
  // keduanya sendiri (lihat RingkasanSelesai), layar lain tidak butuh.
  const artefakSesi = useLiveQuery(
    () => db.artefak.where('sesi_id').equals(id).toArray(),
    [id],
  );
  const xpSesi = useLiveQuery(
    () => db.xp_ledger.where('sesi_id').equals(id).toArray(),
    [id],
  );
  // Jumlah sesi SELESAI untuk framework ini (untuk catatan pertama kali
  // di tahap Recall). Sengaja memakai sesi selesai, bukan pemakaian:
  // pemakaian hanya tercatat bila skor ≥ 1, padahal sesi selesai skor 0
  // (dengan artefak atau ≥30′) tetap berarti "pernah memakai".
  const sesiSelesaiFramework = useLiveQuery(
    () =>
      sesi
        ? db.sesi
            .where('framework_id')
            .equals(sesi.framework_id)
            .filter((s) => s.selesai)
            .count()
        : 0,
    [sesi?.framework_id],
  );

  const [tahap, setTahap] = useState<Tahap>('sesi');
  // Inisialisasi malas dari sesi bila sudah tersedia di render pertama
  // (di browser useLiveQuery selalu mengembalikan undefined dulu, jadi
  // nilainya null dan efek init di bawah yang mengisi — perilaku sama;
  // inisialisasi ini terutama membuat render server-side pada tes
  // melihat elapsed/checklist yang benar).
  const [elapsedDetik, setElapsedDetik] = useState<number | null>(() =>
    sesi ? sesi.durasi_menit * 60 : null,
  );
  const [berjalan, setBerjalan] = useState(false);
  const [catatan, setCatatan] = useState<string | null>(() =>
    sesi ? sesi.catatan : null,
  );
  const [skor, setSkor] = useState<Skor | null>(null);
  const [adaArtefak, setAdaArtefak] = useState(false);
  const [judulArtefak, setJudulArtefak] = useState('');
  const [isiArtefak, setIsiArtefak] = useState('');
  // Jenis artefak default (bisa diubah di form).
  const [jenisArtefak, setJenisArtefak] = useState<Artefak['jenis']>('teks');
  const [kLengkap, setKLengkap] = useState(false);
  const [kPrioritasi, setKPrioritasi] = useState(false);
  const [kRekomendasi, setKRekomendasi] = useState(false);
  const [reuseBerikutnya, setReuseBerikutnya] = useState<ISODate | null>(null);
  const [menyimpan, setMenyimpan] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [konfirmasiDini, setKonfirmasiDini] = useState(false);
  const [statusSimpan, setStatusSimpan] = useState<'idle' | 'menyimpan' | 'tersimpan'>('idle');
  const [waktuSimpan, setWaktuSimpan] = useState<string | null>(null);
  // Panduan interaktif (penerapan saja): override manual accordion +
  // langkah prosedur yang dicentang (kunci = teks langkah).
  // Override ditandai tahap saat dibuat: bila timer pindah tahap, tanda
  // tidak cocok lagi dan accordion kembali mengikuti timer — jadi tidak
  // butuh efek sinkronisasi, dan pilihan manual bertahan dalam satu
  // periode tahap.
  const [tahapManual, setTahapManual] = useState<{
    tahap: number;
    buka: number | null;
  } | null>(null);
  const [checklist, setChecklist] = useState<Set<string> | null>(() =>
    sesi ? new Set(sesi.checklist_prosedur ?? []) : null,
  );
  const gerakanAktif = useGerakanAktif();

  const elapsedRef = useRef(0);
  const catatanRef = useRef('');
  const refPanduan = useRef<HTMLDetailsElement | null>(null);

  // Tahap panduan dari waktu berjalan — dihitung di sini (bukan setelah
  // early return) agar turunan accordion bisa memakainya.
  const tahapSaatIni =
    sesi?.jenis === 'penerapan'
      ? tahapDariElapsed(
          elapsedDetik ?? 0,
          (sesi.durasi_target_menit ?? 45) * 60,
        )
      : 0;
  // Tahap yang terbuka: override manual bila dibuat dalam periode tahap
  // ini, kalau tidak ikuti timer (termasuk saat mount dan saat pindah
  // tahap — inilah "sinkronisasi ulang" tanpa efek).
  const tahapTerbuka =
    tahapManual !== null && tahapManual.tahap === tahapSaatIni
      ? tahapManual.buka
      : tahapSaatIni;

  useEffect(() => {
    if (!sesi) return;
    if (perluPilihMasalah(sesi.jenis, sesi.masalah_id)) {
      setTahap((t) => (t === 'sesi' ? 'pilih-masalah' : t));
    }
    if (elapsedDetik === null) {
      elapsedRef.current = sesi.durasi_menit * 60;
      setElapsedDetik(sesi.durasi_menit * 60);
    }
    if (catatan === null) {
      catatanRef.current = sesi.catatan;
      setCatatan(sesi.catatan);
    }
    if (checklist === null) {
      setChecklist(new Set(sesi.checklist_prosedur ?? []));
    }
  }, [sesi, elapsedDetik, catatan, checklist]);

  useEffect(() => {
    if (!berjalan) return;
    const t = setInterval(() => {
      elapsedRef.current += 1;
      setElapsedDetik(elapsedRef.current);
    }, 1000);
    return () => clearInterval(t);
  }, [berjalan]);

  // Simpan catatan + durasi ke DB, dengan indikator status untuk user.
  // Hanya memakai ref + setState stabil, jadi identitasnya hanya berubah
  // bila id sesi berubah — aman dipakai di efek autosave.
  const simpanCatatan = useCallback(async (): Promise<void> => {
    setStatusSimpan('menyimpan');
    await db.sesi.update(id, {
      catatan: catatanRef.current,
      durasi_menit: Math.floor(elapsedRef.current / 60),
    });
    setWaktuSimpan(
      new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    );
    setStatusSimpan('tersimpan');
  }, [id]);

  // Autosave catatan + durasi tiap 30 detik saat timer berjalan.
  useEffect(() => {
    if (!berjalan) return;
    const t = setInterval(() => {
      void simpanCatatan();
    }, 30_000);
    return () => clearInterval(t);
  }, [berjalan, id, simpanCatatan]);

  useEffect(() => {
    return () => {
      void db.sesi.update(id, {
        catatan: catatanRef.current,
        durasi_menit: Math.floor(elapsedRef.current / 60),
      });
    };
  }, [id]);

  if (sesi === undefined || framework === undefined || semuaMasalah === undefined) {
    return <p className="muted">Memuat…</p>;
  }
  if (!sesi) {
    return (
      <div>
        <p>Sesi tidak ditemukan.</p>
        <a className="tombol-garis" href="#/">
          Kembali ke Beranda
        </a>
      </div>
    );
  }
  if (!framework) {
    return (
      <div>
        <p>Framework tidak ditemukan.</p>
        <a className="tombol-garis" href="#/">
          Kembali ke Beranda
        </a>
      </div>
    );
  }
  if (sesi.selesai && tahap !== 'selesai') {
    if (artefakSesi === undefined || xpSesi === undefined) {
      return <p className="muted">Memuat…</p>;
    }
    return (
      <RingkasanSelesai
        frameworkNama={framework.nama}
        masalah={masalahSesi}
        sesi={sesi}
        artefak={artefakSesi}
        xp={totalXp(xpSesi)}
      />
    );
  }

  const targetDetik = sesi.durasi_target_menit * 60;
  const elapsed = elapsedDetik ?? 0;
  const persenSesi = Math.min(100, (elapsed / targetDetik) * 100);
  const sisa = Math.max(0, targetDetik - (elapsedDetik ?? 0));
  const menit = Math.floor(sisa / 60);
  const detik = sisa % 60;
  const waktuHabis = (elapsedDetik ?? 0) >= targetDetik;

  // Langkah prosedur (penerapan saja; null = <2 langkah → paragraf).
  const langkahProsedur =
    sesi.jenis === 'penerapan'
      ? pecahLangkahProsedur(framework.lapis_b_prosedur)
      : null;

  const jeda = async (): Promise<void> => {
    setBerjalan(false);
    await simpanCatatan();
  };

  /** Buka satu tahap panduan (dari tick bar progres / tombol lompat). */
  const bukaTahap = (i: number): void => {
    // Bila seluruh panduan ditutup user, buka dulu wadahnya.
    if (refPanduan.current && !refPanduan.current.open) {
      refPanduan.current.open = true;
    }
    setTahapManual({ tahap: tahapSaatIni, buka: i });
    // Scroll setelah expand ter-render (2 rAF: commit React lalu layout).
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.getElementById(`tahap-panduan-${i}`)?.scrollIntoView({
          behavior: gerakanAktif ? 'smooth' : 'auto',
          block: 'nearest',
        });
      });
    });
  };

  /** Centang/batalkan satu langkah prosedur; tersimpan di rekaman sesi. */
  const toggleLangkahProsedur = async (langkah: string): Promise<void> => {
    const berikut = new Set(checklist ?? []);
    if (berikut.has(langkah)) berikut.delete(langkah);
    else berikut.add(langkah);
    setChecklist(berikut);
    await db.sesi.update(id, { checklist_prosedur: [...berikut] });
  };

  const pilihMasalahReuse = async (masalahId: string): Promise<void> => {
    await db.sesi.update(id, { masalah_id: masalahId });
    setTahap('sesi');
  };

  const kePenilaian = async (): Promise<void> => {
    await jeda();
    setTahap('nilai');
  };

  const kirimPenilaian = async (): Promise<void> => {
    if (skor === null || menyimpan) return;
    if (adaArtefak && (judulArtefak.trim().length === 0 || isiArtefak.trim().length === 0)) {
      setError('Artefak butuh judul dan isi.');
      return;
    }
    setMenyimpan(true);
    setError(null);
    try {
      const durasiMenit = Math.floor(elapsedRef.current / 60);
      const hasil = await selesaikanSesi(id, durasiMenit, {
        skor,
        artefak: adaArtefak
          ? {
              judul: judulArtefak,
              isi: isiArtefak,
              jenis: jenisArtefak,
              kualitas_lengkap: kLengkap,
              kualitas_prioritasi: kPrioritasi,
              kualitas_rekomendasi: kRekomendasi,
            }
          : undefined,
        jadwal_reuse_id: reuseId ?? undefined,
      });
      setReuseBerikutnya(hasil.reuseBerikutnya);
      setTahap('selesai');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Tidak bisa menyimpan penilaian.');
    } finally {
      setMenyimpan(false);
    }
  };

  // --- Tahap pilih masalah (re-use) ---
  if (tahap === 'pilih-masalah') {
    const sudahDipakai = new Set((pemakaianFramework ?? []).map((p) => p.masalah_id));
    const kandidat = (semuaMasalah ?? []).filter(
      (m) => m.status === 'aktif' && !sudahDipakai.has(m.id),
    );
    return (
      <div>
        <h1>Pakai {framework.nama} untuk masalah lain</h1>
        <p className="muted">
          {labelJenisSesi(sesi.jenis)} menguji penguasaanmu: terapkan framework
          ini ke masalah yang belum pernah memakai framework ini. Catatan lama
          tidak ditampilkan. Kerjakan dari ingatan.
        </p>
        {kandidat.length === 0 ? (
          <p>
            Semua masalah aktifmu sudah pernah memakai {framework.nama}. Nyatakan
            masalah baru untuk re-use ini.
          </p>
        ) : (
          kandidat.map((m) => (
            <button
              key={m.id}
              type="button"
              className="pilihan"
              onClick={() => void pilihMasalahReuse(m.id)}
            >
              {m.judul}
            </button>
          ))
        )}
        <div className="baris-tombol">
          <a className="tombol-garis" href="#/masalah/baru">
            Nyatakan masalah baru
          </a>
          <a className="tombol-teks" href="#/">
            Batal
          </a>
        </div>
      </div>
    );
  }

  // --- Tahap selesai (konfirmasi) ---
  if (tahap === 'selesai') {
    if (artefakSesi === undefined || xpSesi === undefined) {
      return <p className="muted">Memuat…</p>;
    }
    return (
      <RingkasanSelesai
        frameworkNama={framework.nama}
        masalah={masalahSesi}
        sesi={sesi}
        artefak={artefakSesi}
        xp={totalXp(xpSesi)}
        reuseBerikutnya={reuseBerikutnya}
        tunjukkanCatchUp={sesi.jenis === 'catch_up'}
      />
    );
  }

  // --- Tahap penilaian ---
  if (tahap === 'nilai') {
    return (
      <div>
        <h1>Nilai sesi ini</h1>
        <p className="muted">
          {framework.nama} · {masalahSesi?.judul ?? ''} ·{' '}
          {formatDurasi(Math.floor(elapsedRef.current / 60))}
        </p>

        <h2>Apakah sesi ini menghasilkan artefak?</h2>
        <label className="cek">
          <input
            type="checkbox"
            checked={adaArtefak}
            onChange={(e) => {
              const nyala = e.target.checked;
              setAdaArtefak(nyala);
              // Dicentang: isi form dari catatan sesi (bisa diedit).
              // Hanya mengisi field yang masih kosong — jangan menimpa
              // tulisan user bila kotak dicentang ulang.
              if (nyala) {
                if (judulArtefak.trim().length === 0) {
                  setJudulArtefak(
                    judulArtefakDefault(
                      framework.nama,
                      masalahSesi?.judul ?? null,
                    ),
                  );
                }
                if (
                  isiArtefak.trim().length === 0 &&
                  (catatan ?? '').trim().length > 0
                ) {
                  setIsiArtefak(catatan ?? '');
                }
              }
            }}
          />
          <span>Ya, ada artefak yang dihasilkan.</span>
        </label>
        <p className="muted kecil">
          Artefak adalah hasil tertulis penerapan framework ke masalahmu — yang
          dinilai dan bisa kamu buka lagi nanti.
        </p>
        {adaArtefak && (
          <>
            <label htmlFor="judul-artefak">Judul artefak</label>
            <input
              id="judul-artefak"
              type="text"
              value={judulArtefak}
              onChange={(e) => {
                setJudulArtefak(e.target.value);
                setError(null);
              }}
              placeholder="Misal: Analisis PESTEL untuk segmen pelajar"
            />
            <label htmlFor="jenis-artefak">Jenis artefak</label>
            <select
              id="jenis-artefak"
              value={jenisArtefak}
              onChange={(e) => setJenisArtefak(e.target.value as Artefak['jenis'])}
            >
              {JENIS_ARTEFAK.map((j) => (
                <option key={j.nilai} value={j.nilai}>
                  {j.label}
                </option>
              ))}
            </select>
            <label htmlFor="isi-artefak">Isi artefak (Markdown)</label>
            <textarea
              id="isi-artefak"
              value={isiArtefak}
              onChange={(e) => {
                setIsiArtefak(e.target.value);
                setError(null);
              }}
              placeholder="Tulis penerapan framework ke masalahmu di sini."
            />
            <h3>Checklist kualitas</h3>
            <p className="muted kecil">
              Artefak yang memenuhi ketiganya ditandai "berkualitas". Itu salah
              satu syarat "dikuasai".
            </p>
            <label className="cek">
              <input type="checkbox" checked={kLengkap} onChange={(e) => setKLengkap(e.target.checked)} />
              <span>Lengkap: semua elemen framework terisi.</span>
            </label>
            <label className="cek">
              <input type="checkbox" checked={kPrioritasi} onChange={(e) => setKPrioritasi(e.target.checked)} />
              <span>Ada prioritasi: temuan diurutkan/diutamakan, bukan sekadar daftar.</span>
            </label>
            <label className="cek">
              <input type="checkbox" checked={kRekomendasi} onChange={(e) => setKRekomendasi(e.target.checked)} />
              <span>Ada rekomendasi: minimal 1 rekomendasi konkret.</span>
            </label>
          </>
        )}

        <h2>Seberapa jauh kamu bisa menerapkan?</h2>
        <p className="muted kecil">
          Skor 3 biasanya baru tercapai setelah memakai framework ini untuk
          masalah lain.
        </p>
        <div
          role="radiogroup"
          aria-label="Skor penerapan"
          onKeyDown={(e) => {
            if (
              e.key !== 'ArrowDown' &&
              e.key !== 'ArrowUp' &&
              e.key !== 'ArrowRight' &&
              e.key !== 'ArrowLeft'
            ) {
              return;
            }
            e.preventDefault();
            const arah =
              e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1;
            const berikut = (((skor ?? 0) + arah) % 4 + 4) % 4 as Skor;
            setSkor(berikut);
            document
              .querySelector<HTMLElement>(`[data-skor="${berikut}"]`)
              ?.focus();
          }}
        >
          {RUBRIK.map((r) => (
            <div
              key={r.skor}
              data-skor={r.skor}
              className={`rubrik${skor === r.skor ? ' terpilih' : ''}`}
              onClick={() => setSkor(r.skor)}
              role="radio"
              aria-checked={skor === r.skor}
              tabIndex={
                skor === r.skor || (skor === null && r.skor === 0) ? 0 : -1
              }
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  setSkor(r.skor);
                }
              }}
            >
              <span className="skor">{r.skor}. {r.judul}</span>
              <p className="muted">{r.arti}</p>
            </div>
          ))}
        </div>

        {error && (
          <div className="pesan-error" role="alert">
            {error}
          </div>
        )}
        <div className="baris-tombol">
          <button
            className="tombol-utama"
            type="button"
            disabled={skor === null || menyimpan}
            onClick={() => void kirimPenilaian()}
          >
            {menyimpan ? 'Menyimpan…' : 'Simpan penilaian'}
          </button>
          <button className="tombol-garis" type="button" onClick={() => setTahap('sesi')}>
            Kembali ke sesi
          </button>
        </div>
      </div>
    );
  }

  // --- Tahap sesi (timer) ---
  return (
    <div>
      <a className="tombol-teks" href="#/">
        ← Kembali ke Beranda
      </a>
      <h1>{framework.nama}</h1>
      <p className="muted">
        {labelJenisSesi(sesi.jenis)} untuk &quot;{masalahSesi?.judul ?? 'Memuat masalah…'}&quot;
      </p>
      {(sesi.jenis === 're_use' || sesi.jenis === 'catch_up') && (
        <p className="muted">
          Terapkan {framework.nama} ke masalah ini dari ingatan. Catatan lama
          tidak ditampilkan.
        </p>
      )}

      <div className="timer">
        {String(menit).padStart(2, '0')}:{String(detik).padStart(2, '0')}
      </div>
      {/* Bar progres: garis tipis di bawah timer. Sesi penerapan
        mendapat tick di batas tahap panduan (5/20/35 menit); jenis
        lain bar polos. */}
      <div
        className="bar-progres-sesi"
        role="progressbar"
        aria-label={`Progres sesi: ${Math.round(persenSesi)}%`}
        aria-valuenow={Math.round(persenSesi)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="bar-progres-isi" style={{ width: `${persenSesi}%` }} />
        {sesi.jenis === 'penerapan' &&
          [5, 20, 35].map((m) => (
            <button
              key={m}
              type="button"
              className="bar-progres-tick"
              style={{ left: `${((m * 60) / targetDetik) * 100}%` }}
              aria-label={`Buka tahap ${TAHAP_PANDUAN[tahapUntukTick(m)].nama} (mulai menit ke-${m})`}
              onClick={() => bukaTahap(tahapUntukTick(m))}
            />
          ))}
      </div>
      <p className="muted tengah">
        {waktuHabis
          ? 'Waktu target habis. Lanjutkan bila perlu.'
          : `dari ${sesi.durasi_target_menit} menit target`}
      </p>
      <div className="baris-tombol tengah-baris">
        {berjalan ? (
          <button className="tombol-garis" type="button" onClick={() => void jeda()}>
            Jeda
          </button>
        ) : (
          <button className="tombol-utama tombol-hijau" type="button" onClick={() => setBerjalan(true)}>
            {elapsedDetik === 0 ? 'Mulai timer' : 'Lanjutkan'}
          </button>
        )}
        <button
          className="tombol-garis"
          type="button"
          disabled={(elapsedDetik ?? 0) === 0}
          onClick={() => {
            if (perluKonfirmasiDini(elapsedDetik ?? 0, targetDetik)) {
              setKonfirmasiDini(true);
            } else {
              void kePenilaian();
            }
          }}
        >
          Selesai &amp; Nilai
        </button>
      </div>
      {(elapsedDetik ?? 0) === 0 && (
        <p className="muted kecil tengah">
          Tombol aktif setelah timer berjalan.
        </p>
      )}
      {konfirmasiDini && (
        <div className="kartu" role="alert">
          <p>
            Kamu baru{' '}
            {elapsed < 60
              ? `${elapsed} detik`
              : `${Math.floor(elapsed / 60)} menit`}{' '}
            dari target {sesi.durasi_target_menit} menit. Tetap selesaikan?
          </p>
          <div className="baris-tombol">
            <button
              className="tombol-utama"
              type="button"
              onClick={() => void kePenilaian()}
            >
              Ya, selesaikan
            </button>
            <button
              className="tombol-garis"
              type="button"
              onClick={() => setKonfirmasiDini(false)}
            >
              Lanjut sesi
            </button>
          </div>
        </div>
      )}

      {sesi.jenis === 'penerapan' && (
        <details className="kartu" open ref={refPanduan}>
          <summary>
            <strong>Panduan 4 tahap (opsional)</strong>
            <span className="muted kecil">
              {' '}
              — Tahap {tahapSaatIni + 1}: {TAHAP_PANDUAN[tahapSaatIni].nama}
            </span>
          </summary>
          {/* Pengumuman pergantian tahap (hanya berubah saat tahap
            berubah; tidak pernah mencuri fokus). */}
          <p className="sr-only" aria-live="polite">
            Tahap {tahapSaatIni + 1} dari 4: {TAHAP_PANDUAN[tahapSaatIni].nama}
          </p>
          {TAHAP_PANDUAN.map((t, i) => (
            <details
              key={t.nama}
              id={`tahap-panduan-${i}`}
              className={`tahap-panduan${tahapSaatIni === i ? ' saat-ini' : ''}`}
              open={tahapTerbuka === i}
              onToggle={(e) => {
                // `toggle` juga menyala saat React mengubah `open`
                // (sinkronisasi timer) — abaikan bila DOM sudah sesuai
                // turunan, catat override hanya untuk klik user.
                const terbuka = e.currentTarget.open;
                if (terbuka === (tahapTerbuka === i)) return;
                setTahapManual({
                  tahap: tahapSaatIni,
                  buka: terbuka ? i : null,
                });
              }}
            >
              <summary>
                <span className="judul-tahap">
                  {t.nama} ({t.rentang})
                </span>
                {tahapSaatIni === i && (
                  <span className="lencana">Tahap ini</span>
                )}
              </summary>
              {i === 0 && (
                <>
                  <p>
                    Tutup catatan. Apa yang kamu ingat dari {framework.nama}?
                  </p>
                  {sesiSelesaiFramework === 0 && (
                    <p className="catatan-pertama">
                      Pertama kali memakai framework ini — belum ada yang
                      perlu di-recall; mulai dari{' '}
                      <button
                        type="button"
                        className="tombol-teks"
                        onClick={() => bukaTahap(1)}
                      >
                        Prosedur
                      </button>
                      .
                    </p>
                  )}
                </>
              )}
              {i === 1 &&
                (langkahProsedur !== null ? (
                  <ul className="checklist-prosedur">
                    {langkahProsedur.map((langkah, j) => (
                      <li key={`${j}-${langkah}`}>
                        <label className="cek">
                          <input
                            type="checkbox"
                            checked={checklist?.has(langkah) ?? false}
                            onChange={() => void toggleLangkahProsedur(langkah)}
                          />
                          <span>
                            {langkah}
                            <span className="sr-only">
                              {' '}
                              (langkah {j + 1} dari {langkahProsedur.length})
                            </span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>{framework.lapis_b_prosedur}</p>
                ))}
              {i === 2 && (
                <p>
                  Terapkan ke masalahmu. {framework.lapis_a_pemetaan}
                </p>
              )}
              {i === 3 && (
                <p>
                  Tulis hasil penerapanmu dan catat kapan framework ini salah
                  alat. {framework.lapis_c_kesalahan}
                </p>
              )}
            </details>
          ))}
        </details>
      )}

      <label htmlFor="catatan">
        Catatan (disimpan otomatis tiap 30 detik)
        {statusSimpan === 'menyimpan' && (
          <span className="muted kecil"> · Menyimpan…</span>
        )}
        {statusSimpan === 'tersimpan' && waktuSimpan !== null && (
          <span className="muted kecil"> · Tersimpan {waktuSimpan}</span>
        )}
      </label>
      <textarea
        id="catatan"
        value={catatan ?? ''}
        onChange={(e) => {
          catatanRef.current = e.target.value;
          setCatatan(e.target.value);
          setStatusSimpan('idle');
        }}
        placeholder="Tulis temuanmu selagi menerapkan framework ini."
      />

      <div className="baris-tombol">
        <button
          className="tombol-teks"
          type="button"
          onClick={() => {
            void jeda();
            navigasi('#/');
          }}
        >
          Simpan draft &amp; keluar
        </button>
      </div>
    </div>
  );
}

/**
 * Ringkasan sesi yang sudah dinilai: skor + label rubrik, XP yang dicatat
 * di ledger untuk sesi ini, tautan ke artefak (di halaman framework, yang
 * menampilkan isi lengkapnya), dan langkah lanjut. Dipakai dua tempat:
 * kunjungan ulang ke sesi selesai, dan konfirmasi sesudah menilai.
 * `reuseBerikutnya` hanya diketahui di konfirmasi (undefined = jangan
 * tampilkan baris re-use).
 */
function RingkasanSelesai({
  frameworkNama,
  masalah,
  sesi,
  artefak,
  xp,
  reuseBerikutnya,
  tunjukkanCatchUp = false,
}: {
  frameworkNama: string;
  masalah: Masalah | undefined;
  sesi: Sesi;
  artefak: Artefak[];
  xp: number;
  reuseBerikutnya?: ISODate | null;
  tunjukkanCatchUp?: boolean;
}): React.JSX.Element {
  const rubrik =
    sesi.skor !== null
      ? RUBRIK.find((r) => r.skor === sesi.skor)
      : undefined;
  const artefakUtama = artefak[0];
  return (
    <div>
      <h1>{labelJenisSesi(sesi.jenis)} selesai.</h1>
      <p className="muted">
        {frameworkNama}
        {masalah ? ` untuk "${masalah.judul}"` : ''} · {formatDurasi(sesi.durasi_menit)}
      </p>
      {rubrik !== undefined && (
        <p>
          Skor: <strong>{rubrik.skor} — {rubrik.judul}</strong>
        </p>
      )}
      <p>
        XP dari sesi ini: <strong>{xp} XP</strong>
      </p>
      {artefakUtama ? (
        <p>
          Artefak:{' '}
          <a href={`#/framework/${sesi.framework_id}`}>{artefakUtama.judul}</a>
        </p>
      ) : (
        <p className="muted">Tidak ada artefak dari sesi ini.</p>
      )}
      {reuseBerikutnya !== undefined &&
        (reuseBerikutnya ? (
          <p>
            Re-use berikutnya: {formatTanggal(reuseBerikutnya)}. Pakai{' '}
            {frameworkNama} untuk masalah lain.
          </p>
        ) : (
          <p>Tidak ada re-use berikutnya yang terjadwal.</p>
        ))}
      <div className="baris-tombol">
        <a className="tombol-utama" href="#/progres">
          Lihat Progres
        </a>
        {masalah ? (
          <a className="tombol-garis" href={`#/masalah/${masalah.id}`}>
            Kembali ke masalah
          </a>
        ) : (
          <a className="tombol-garis" href="#/">
            Kembali ke Beranda
          </a>
        )}
        {tunjukkanCatchUp && (
          <a className="tombol-garis" href="#/catch-up">
            Kembali ke Catch-up
          </a>
        )}
      </div>
    </div>
  );
}
