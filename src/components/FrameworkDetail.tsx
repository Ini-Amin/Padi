/**
 * Detail framework (dokumen 04 §3.4): ringkasan, 3 ide kunci, keterbatasan,
 * 3 lapis, indikator 3 syarat "dikuasai", kolom "kapan tidak pakai",
 * jadwal re-use, artefak, masalah yang pernah memakai, framework terkait.
 */
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, aktifkanKembali, mulaiSesi, simpanKapanTidakPakai, tandaiDikenal, tandaiTidakRelevan } from '../db';
import { usePadiStore } from '../store';
import { NAMA_TEMA } from '../domain';
import { formatTanggal } from '../dates';
import {
  cekSyaratDikuasai,
  hitungMasalahBerbeda,
  LABEL_STATUS,
  WARNA_STATUS,
} from '../status';
import { navigasi } from '../App';
import { pecahLangkahProsedur } from '../prosedur';

export function FrameworkDetail({ id }: { id: string }): React.JSX.Element {
  const framework = useLiveQuery(() => db.frameworks.get(id), [id]);
  const pemakaian = useLiveQuery(
    () => db.pemakaian.where('framework_id').equals(id).toArray(),
    [id],
  );
  const artefak = useLiveQuery(
    () => db.artefak.where('framework_id').equals(id).toArray(),
    [id],
  );
  const jadwal = useLiveQuery(
    () => db.jadwal_reuse.where('framework_id').equals(id).sortBy('jatuh_tempo'),
    [id],
  );
  const semuaMasalah = useLiveQuery(() => db.masalah.toArray(), []);
  const semuaFramework = useLiveQuery(() => db.frameworks.toArray(), []);
  const edges = useLiveQuery(() => db.edges.toArray(), []);
  const masalahAktifId = usePadiStore((s) => s.masalahAktifId);

  const [teksKapan, setTeksKapan] = useState<string | null>(null);
  const [menyimpan, setMenyimpan] = useState(false);
  const [konfirmasi, setKonfirmasi] = useState(false);

  if (
    framework === undefined ||
    pemakaian === undefined ||
    artefak === undefined ||
    jadwal === undefined ||
    semuaMasalah === undefined ||
    semuaFramework === undefined ||
    edges === undefined
  ) {
    return <p className="muted">Memuat…</p>;
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

  const masalahById = new Map(semuaMasalah.map((m) => [m.id, m]));
  const frameworkById = new Map(semuaFramework.map((f) => [f.id, f]));
  const syarat = cekSyaratDikuasai(framework, pemakaian, artefak, masalahById);
  const jumlahMasalah = hitungMasalahBerbeda(pemakaian, masalahById);
  const masalahDipakai = [...new Set(pemakaian.map((p) => p.masalah_id))]
    .map((mid) => masalahById.get(mid))
    .filter((m) => m !== undefined);
  const terkait = edges.filter((e) => e.dari === id || e.ke === id);
  // Kelompokkan per framework terkait: satu framework bisa terhubung lewat
  // lebih dari satu relasi (mis. PESTEL–Porter: prasyarat + satu tema).
  const terkaitPerFramework = new Map<string, typeof terkait>();
  for (const e of terkait) {
    const lainId = e.dari === id ? e.ke : e.dari;
    const daftar = terkaitPerFramework.get(lainId) ?? [];
    daftar.push(e);
    terkaitPerFramework.set(lainId, daftar);
  }
  const langkahProsedur = pecahLangkahProsedur(framework.lapis_b_prosedur);

  const simpanKapan = async (): Promise<void> => {
    if (teksKapan === null || menyimpan) return;
    setMenyimpan(true);
    try {
      await simpanKapanTidakPakai(id, teksKapan);
    } finally {
      setMenyimpan(false);
    }
  };

  /** Mulai sesi penerapan untuk masalah aktif (dipakai CTA atas + bawah). */
  const pakaiUntukMasalahAktif = (): void => {
    if (!masalahAktifId) return;
    void (async () => {
      const sesi = await mulaiSesi({
        framework_id: id,
        masalah_id: masalahAktifId,
        jenis: 'penerapan',
        durasi_target_menit: 45,
      });
      navigasi(`#/sesi/${sesi.id}`);
    })();
  };

  /** Lompat ke bagian (tombol, bukan anchor: hash adalah rute app). */
  const lompat = (bagian: string): void => {
    document.getElementById(bagian)?.scrollIntoView();
  };

  const lompatKe: Array<[string, string]> = [
    ['pemetaan', 'Pemetaan'],
    ['prosedur', 'Prosedur'],
    ['kesalahan', 'Kesalahan'],
    ['syarat', 'Syarat'],
  ];
  if (artefak.length > 0) lompatKe.push(['artefak', 'Artefak']);
  if (terkait.length > 0) lompatKe.push(['terkait', 'Terkait']);

  const bisaPakai = masalahAktifId && framework.status !== 'disembunyikan';

  const syaratBaris: Array<[boolean, string]> = [
    [
      syarat.transfer,
      `Transfer: dipakai untuk ${jumlahMasalah} dari 2 masalah berbeda (skor ≥2).`,
    ],
    [
      syarat.artefakBerkualitas,
      'Artefak berkualitas: minimal 1 artefak yang lengkap + ada prioritasi + ada rekomendasi.',
    ],
    [
      syarat.kemandirian,
      'Kemandirian: menulis kapan framework ini salah alat.',
    ],
  ];

  return (
    <div>
      <a className="tombol-teks" href="#/peta">
        ← Kembali ke Peta
      </a>
      <h1>{framework.nama}</h1>
      <nav className="lompat-nav" aria-label="Lompat ke bagian">
        {lompatKe.map(([bagian, label]) => (
          <button
            key={bagian}
            className="tombol-teks"
            type="button"
            onClick={() => lompat(bagian)}
          >
            {label}
          </button>
        ))}
      </nav>
      <p className="muted">
        Tema {framework.tema}: {NAMA_TEMA[framework.tema]} · Katalog #{framework.urutan_katalog}
      </p>
      <p>
        <span className={`dot-status ${WARNA_STATUS[framework.status]}`} />
        {LABEL_STATUS[framework.status]}
        {framework.skor_terakhir !== null && ` · skor terakhir ${framework.skor_terakhir}`}
        {framework.dipakai_pertama_pada &&
          ` · pertama dipakai ${formatTanggal(framework.dipakai_pertama_pada)}`}
        {framework.dikuasai_pada && ` · dikuasai ${formatTanggal(framework.dikuasai_pada)}`}
      </p>
      {framework.dikenal_pada === null ? (
        <p>
          <button
            className="tombol-teks"
            type="button"
            onClick={() => void tandaiDikenal(id)}
          >
            Saya sudah tahu framework ini
          </button>{' '}
          <span className="muted kecil">
            Menandai framework ini sudah kamu kenal; framework yang dikenal
            tidak muncul di slot eksplorasi.
          </span>
        </p>
      ) : (
        <p className="muted kecil">
          Sudah kamu kenal sejak {formatTanggal(framework.dikenal_pada)}.
        </p>
      )}

      <p>{framework.ringkasan}</p>
      <h2>Ide kunci</h2>
      <ol>
        {framework.ide_kunci.map((ide) => (
          <li key={ide}>{ide}</li>
        ))}
      </ol>
      <p className="muted">
        <strong>Keterbatasan:</strong> {framework.keterbatasan}
      </p>
      <p className="muted kecil">Sumber: {framework.sumber}</p>

      {bisaPakai && (
        <div className="baris-tombol">
          <button
            className="tombol-utama"
            type="button"
            onClick={pakaiUntukMasalahAktif}
          >
            Pakai untuk masalah aktif (45&prime;)
          </button>
        </div>
      )}

      <div className="kartu" id="pemetaan">
        <h2>Pemetaan masalah: kapan dipakai</h2>
        <p>{framework.lapis_a_pemetaan}</p>
      </div>
      <div className="kartu" id="prosedur">
        <h2>Prosedur: cara memakai</h2>
        {langkahProsedur ? (
          <ol>
            {langkahProsedur.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ol>
        ) : (
          <p>{framework.lapis_b_prosedur}</p>
        )}
      </div>
      <div className="kartu" id="kesalahan">
        <h2>Kesalahan umum: kapan salah alat</h2>
        <p>{framework.lapis_c_kesalahan}</p>
      </div>

      <div className="strip-status" id="syarat">
        <h2>Syarat "dikuasai"</h2>
        <p className="muted kecil">
          Dikuasai berarti kamu bisa memakai framework ini dengan baik.
          Transfer: memakai framework yang sama untuk masalah yang berbeda.
        </p>
        {syaratBaris.map(([ok, teks]) => (
          <div className="baris-legenda" key={teks}>
            <span className={ok ? 'teks-hijau' : ''}>
              {ok ? 'Terpenuhi' : 'Belum'}. {teks}
            </span>
          </div>
        ))}
      </div>

      <div className="kartu">
        <h2>Kapan framework ini salah alat?</h2>
        <p className="muted kecil">
          Tulis 1–2 kalimat. Ini salah satu syarat "dikuasai", dan bukti kamu
          memahami batas framework ini. Contoh pemandu dari kesalahan umum di
          atas.
        </p>
        <label className="sr-only" htmlFor="kapan-tidak-pakai">
          Kapan framework ini salah alat?
        </label>
        <textarea
          id="kapan-tidak-pakai"
          value={teksKapan ?? framework.kapan_tidak_pakai ?? ''}
          onChange={(e) => setTeksKapan(e.target.value)}
          placeholder="Misal: PESTEL salah alat saat masalahnya internal: kekuatan tim atau proses, bukan faktor luar."
        />
        <div className="baris-tombol">
          <button
            className="tombol-garis"
            type="button"
            disabled={menyimpan || teksKapan === null}
            onClick={() => void simpanKapan()}
          >
            {menyimpan ? 'Menyimpan…' : 'Simpan'}
          </button>
        </div>
      </div>

      {jadwal.length > 0 && (
        <div className="daftar-riwayat">
          <h2>Jadwal re-use</h2>
          {jadwal.map((j) => (
            <div className="baris-daftar" key={j.id}>
              <span>
                <span className="lencana">{j.jenis_reuse}</span>{' '}
                {formatTanggal(j.jatuh_tempo)}
              </span>
              <span className="muted kecil">{j.status}</span>
            </div>
          ))}
        </div>
      )}

      {artefak.length > 0 && (
        <div className="daftar-riwayat" id="artefak">
          <h2>Artefak</h2>
          {artefak.map((a) => (
            <div key={a.id} className="artefak-item">
              <p>
                <strong>{a.judul}</strong>{' '}
                {a.kualitas_terpenuhi && (
                  <span className="lencana berkualitas">berkualitas</span>
                )}{' '}
                <span className="muted kecil">{formatTanggal(a.dibuat_pada)}</span>
              </p>
              <pre className="isi-artefak">{a.isi}</pre>
            </div>
          ))}
        </div>
      )}

      {masalahDipakai.length > 0 && (
        <div className="daftar-riwayat">
          <h2>Masalah yang pernah memakai framework ini</h2>
          {masalahDipakai.map((m) => (
            <div className="baris-daftar" key={m.id}>
              <span>
                <a href={`#/masalah/${m.id}`}>{m.judul}</a>
              </span>
            </div>
          ))}
        </div>
      )}

      {terkait.length > 0 && (
        <div className="daftar-riwayat" id="terkait">
          <h2>Framework terkait</h2>
          {[...terkaitPerFramework.entries()].map(([lainId, daftarEdge]) => {
            const lain = frameworkById.get(lainId);
            const alasan = daftarEdge
              .map((e) => e.alasan)
              .filter((a): a is string => a !== null);
            return (
              <div className="baris-daftar" key={lainId}>
                <span>
                  <a href={`#/framework/${lainId}`}>{lain?.nama ?? lainId}</a>{' '}
                  {daftarEdge.map((e) => (
                    <span key={e.tipe} className="lencana">
                      {e.tipe.replaceAll('_', ' ')}
                    </span>
                  ))}
                  {alasan.length > 0 && (
                    <span className="muted">: {alasan.join('; ')}</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="baris-tombol">
        {bisaPakai && (
          <button
            className="tombol-utama"
            type="button"
            onClick={pakaiUntukMasalahAktif}
          >
            Pakai untuk masalah aktif (45&prime;)
          </button>
        )}
        {framework.status === 'disembunyikan' ? (
          <button
            className="tombol-garis"
            type="button"
            onClick={() => void aktifkanKembali(id)}
          >
            Aktifkan kembali
          </button>
        ) : !konfirmasi ? (
          <button className="tombol-teks" type="button" onClick={() => setKonfirmasi(true)}>
            Tandai tidak relevan
          </button>
        ) : (
          <span>
            <span className="kecil">
              {framework.nama} tidak relevan. Node akan tampak abu-abu. Re-use
              yang masih terjadwal dibatalkan. Tidak muncul di ranking matching.
              Bisa diaktifkan kapan pun.{' '}
            </span>
            <button
              className="tombol-garis"
              type="button"
              onClick={() => void tandaiTidakRelevan(id)}
            >
              Ya, tandai tidak relevan
            </button>{' '}
            <button className="tombol-teks" type="button" onClick={() => setKonfirmasi(false)}>
              Batal
            </button>
          </span>
        )}
      </div>
    </div>
  );
}
