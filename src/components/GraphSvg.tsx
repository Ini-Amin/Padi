/**
 * Graph SVG interaktif (M3): visualisasi 22 framework / 35 edge, satu kolom
 * per tema. SVG murni tanpa library graph (tetap ramping, dokumen 05).
 *
 * Interaksi (inspirasi CourseViz, dokumen 04 §3.3):
 * - Hover/fokus node: node + tetangganya ber-outline, edge yang insiden
 *   menebal. Node lain tidak diredupkan saat hover.
 * - Klik/ketuk node (atau Enter/Spasi saat fokus): node dipilih — node
 *   yang tidak terkait meredup, strip di bawah peta menunjukkan prasyarat
 *   langsung ("Pelajari dulu") dan framework yang terbukanya ("Membuka").
 *   Klik node lain memindahkan pilihan; klik area kosong / Esc membatalkan.
 * - "Lihat jalur": hanya tampilkan transitive closure prasyarat pilihan
 *   (dua arah); node dan edge lain disembunyikan. Banner di atas peta
 *   menampilkan hitungan. "Tampilkan semua" / Esc keluar dari mode.
 *
 * Daftar bertema di bawahnya tetap ada sebagai fallback aksesibilitas
 * (dokumen 04 §3.3). Layar sempit: SVG disembunyikan di bawah 804px (CSS)
 * dan daftar bertema menjadi tampilan utama. Di layar lebar, wadah Peta
 * melebar sampai 1080px agar node mencapai target sentuh 44px dan label
 * terbaca.
 */
import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { usePadiStore } from '../store';
import { LABEL_STATUS, hitungProgres } from '../status';
import type { TipeEdge } from '../domain';
import { useGerakanAktif } from '../gerakan';
import {
  BATAS_LEGENDA,
  BATAS_PROGRES,
  DESKRIPSI_EDGE,
  GAYA_EDGE,
  LABEL_EDGE,
  LEBAR_KOLOM,
  LEBAR_MARKER_PANAH,
  LEBAR_MARKER_PANAH_KECIL,
  MARGIN_X,
  NAMA_PENDEK_TEMA,
  URUTAN_TEMA,
  WARNA_DOT_STATUS,
  hitungLayout,
  jalurPrasyarat,
  keadaanPeta,
} from '../graph-layout';

const URUTAN_LEGENDA: TipeEdge[] = [
  'prasyarat',
  'satu_tema',
  'dipakai_bersama',
  'kontras',
];

/** Tepi kiri legenda di dalam SVG (sama dengan tepi kiri kolom A). */
const LEGENDA_X = BATAS_LEGENDA.x0;

/**
 * Baris ringkasan progres (stacked bar + hitungan): urutan = urutan
 * segmen bar (kiri ke kanan) dan urutan baris hitungan (2 kolom × 2
 * baris). `dx`/`y` relatif terhadap BATAS_PROGRES.
 */
const BARIS_PROGRES = [
  { status: 'dipakai', label: 'dipakai', dx: 0, y: 396 },
  { status: 'dikuasai', label: 'dikuasai', dx: 140, y: 396 },
  { status: 'perlu_reuse', label: 'perlu re-use', dx: 0, y: 412 },
  { status: 'belum_dipakai', label: 'belum dipakai', dx: 140, y: 412 },
] as const;

export function GraphSvg(): React.JSX.Element {
  const frameworks = useLiveQuery(() => db.frameworks.toArray(), []);
  const edges = useLiveQuery(() => db.edges.toArray(), []);
  const gerakanAktif = useGerakanAktif();
  const tampilkanSatuTema = usePadiStore((s) => s.tampilkanSatuTema);
  const setTampilkanSatuTema = usePadiStore((s) => s.setTampilkanSatuTema);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [dipilihId, setDipilihId] = useState<string | null>(null);
  const [modeJalur, setModeJalur] = useState(false);

  // Esc: keluar mode jalur dulu, lalu batalkan pilihan.
  useEffect(() => {
    if (dipilihId === null && !modeJalur) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      if (modeJalur) setModeJalur(false);
      else setDipilihId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dipilihId, modeJalur]);

  if (frameworks === undefined || edges === undefined) {
    return <p className="muted">Memuat peta…</p>;
  }

  // Filter SEBELUM hitungLayout, supaya pewarnaan lajur berjalan pada
  // edge yang terlihat saja dan lajur tersisa menyebar ulang ke tengah
  // gutter (bukan lubang kosong di posisi lajur lama). Default sembunyi:
  // satu_tema redundan dengan pengelompokan kolom, dan 15 edge abu itu
  // yang membuat gutter A-B penuh (4 lajur → 3 saat disembunyikan).
  const edgesTampil = tampilkanSatuTema
    ? edges
    : edges.filter((e) => e.tipe !== 'satu_tema');
  const jumlahSembunyi = edges.length - edgesTampil.length;
  const layout = hitungLayout(frameworks, edgesTampil);
  const keadaan = keadaanPeta(layout, hoverId, dipilihId, modeJalur);
  const dipilih = dipilihId
    ? frameworks.find((f) => f.id === dipilihId)
    : undefined;
  const jalur = dipilihId ? jalurPrasyarat(edges, dipilihId) : null;
  const nama = (id: string): string =>
    frameworks.find((f) => f.id === id)?.nama ?? id;

  // Ringkasan progres (stacked bar di zona kanan bawah): segmen
  // dihitung dari status live; bila belum ada framework, lebar 0
  // (total || 1 menjaga pembagian tetap terdefinisi).
  const hitungan = hitungProgres(frameworks);
  const totalProgres = frameworks.length || 1;
  const lebarBarProgres = BATAS_PROGRES.x1 - BATAS_PROGRES.x0;
  const barisProgres = BARIS_PROGRES.map(({ status, label, dx, y }, i, arr) => {
    const jumlah = hitungan[status];
    // Posisi awal segmen = jumlah kumulatif baris sebelumnya (n=4,
    // O(n²) tidak masalah; tanpa variabel `let` yang dimutasi di map).
    const awal = arr
      .slice(0, i)
      .reduce((s, b) => s + hitungan[b.status], 0);
    const x = BATAS_PROGRES.x0 + (awal / totalProgres) * lebarBarProgres;
    const lebar = (jumlah / totalProgres) * lebarBarProgres;
    return { status, label, dx, y, jumlah, x, lebar };
  });

  /** Pilih node (klik ulang membatalkan); pindah pilihan tidak menutup mode jalur. */
  const pilih = (id: string): void => {
    if (id === dipilihId) {
      setDipilihId(null);
      setModeJalur(false);
    } else {
      setDipilihId(id);
    }
  };

  const batalkan = (): void => {
    setDipilihId(null);
    setModeJalur(false);
    setHoverId(null);
  };

  /** Daftar tautan framework, dipisah koma; "tidak ada" bila kosong. */
  const tautan = (ids: string[]): React.ReactNode =>
    ids.length === 0
      ? 'tidak ada'
      : ids.map((id, i) => (
          <span key={id}>
            {i > 0 ? ', ' : ''}
            <a href={`#/framework/${id}`}>{nama(id)}</a>
          </span>
        ));

  return (
    <div className={gerakanAktif ? 'gerakan-aktif' : undefined}>
      {modeJalur && jalur !== null && (
        <p className="kecil" role="status">
          {jalur.sebelum.size} sebelum dan {jalur.sesudah.size} sesudahnya.
          Lainnya disembunyikan.
        </p>
      )}
      {/* Checkbox native (aksesibilitas keyboard gratis). Perubahan
          tampil/sembunyi instan — tidak ada animasi yang perlu
          menghormati reduced-motion. Tersembunyi bersama graph di
          bawah 804px (CSS): tanpa graph, toggle tidak ada gunanya. */}
      <label className="peta-toggle">
        <input
          type="checkbox"
          checked={tampilkanSatuTema}
          onChange={(e) => setTampilkanSatuTema(e.target.checked)}
        />
        Tampilkan relasi satu tema
      </label>
      <div className="peta-gulir">
        <svg
          className="peta-svg"
          viewBox={layout.viewBox}
          role="group"
          aria-label={`Peta ${layout.nodes.length} framework dalam ${layout.edges.length} relasi${jumlahSembunyi > 0 ? `, ${jumlahSembunyi} relasi satu tema disembunyikan` : ''}, dikelompokkan per tema.`}
          onClick={batalkan}
        >
          <defs>
            <marker
              id="panah-prasyarat"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth={LEBAR_MARKER_PANAH}
              markerHeight={LEBAR_MARKER_PANAH}
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--hijau)" />
            </marker>
            {/* Marker kecil untuk panah pendek (12px): segitiga 8px,
                bukan 14px, supaya batangnya terlihat di atas segitiga. */}
            <marker
              id="panah-prasyarat-kecil"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth={LEBAR_MARKER_PANAH_KECIL}
              markerHeight={LEBAR_MARKER_PANAH_KECIL}
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--hijau)" />
            </marker>
          </defs>

          {URUTAN_TEMA.map((tema, kolom) => {
            const tengahX = MARGIN_X + kolom * LEBAR_KOLOM + LEBAR_KOLOM / 2;
            return (
              <g key={tema}>
                <text
                  x={tengahX}
                  y={14}
                  textAnchor="middle"
                  className="peta-kepala-tema"
                >
                  Tema {tema}
                </text>
                <text
                  x={tengahX}
                  y={28}
                  textAnchor="middle"
                  className="peta-subtema"
                >
                  {NAMA_PENDEK_TEMA[tema]}
                </text>
              </g>
            );
          })}

          {layout.edges.map((e, i) => {
            const gaya = GAYA_EDGE[e.tipe];
            return (
              <path
                key={`${e.dari}|${e.ke}|${e.tipe}|${i}`}
                d={e.d}
                fill="none"
                stroke={gaya.stroke}
                strokeWidth={gaya.lebar}
                strokeDasharray={gaya.dasharray ?? undefined}
                markerEnd={
                  e.panah
                    ? e.panahKecil
                      ? 'url(#panah-prasyarat-kecil)'
                      : 'url(#panah-prasyarat)'
                    : undefined
                }
                className={`peta-edge${keadaan.edgeTerkait.has(i) ? ' terkait' : ''}${keadaan.edgeRedup.has(i) ? ' redup' : ''}${keadaan.edgeSembunyi.has(i) ? ' tersembunyi' : ''}`}
              />
            );
          })}

          {layout.nodes.map((n) => {
            const tengahX = n.x + n.lebar / 2;
            const tengahY = n.y + n.tinggi / 2;
            const garisY =
              n.label.length === 1 ? [tengahY + 4] : [tengahY - 4, tengahY + 10];
            const dipilihNode = dipilihId === n.id;
            return (
              <a
                key={n.id}
                href={`#/framework/${n.id}`}
                className={`peta-node${keadaan.sorot.has(n.id) ? ' sorot' : ''}${dipilihNode ? ' dipilih' : ''}${keadaan.redup.has(n.id) ? ' redup' : ''}${keadaan.sembunyi.has(n.id) ? ' tersembunyi' : ''}`}
                aria-label={`${n.nama}: ${LABEL_STATUS[n.status]}${dipilihNode ? ', dipilih' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  pilih(n.id);
                }}
                onKeyDown={(e) => {
                  // Spasi tidak mengaktifkan tautan (hanya scroll), jadi
                  // tangani sendiri; Enter sudah memicu onClick.
                  if (e.key === ' ') {
                    e.preventDefault();
                    pilih(n.id);
                  }
                }}
                onMouseEnter={() => setHoverId(n.id)}
                onMouseLeave={() => setHoverId(null)}
                onFocus={() => setHoverId(n.id)}
                onBlur={() => setHoverId(null)}
              >
                <title>
                  {n.nama}: {LABEL_STATUS[n.status]}
                </title>
                <rect
                  x={n.x}
                  y={n.y}
                  width={n.lebar}
                  height={n.tinggi}
                  rx={8}
                  className="peta-kotak"
                />
                {/* Dot hanya bila statusnya bukan default: dot abu di
                    semua node tidak membawa informasi; dot yang muncul
                    berarti framework itu sudah dipakai/dikuasai/perlu
                    re-use. */}
                {n.status !== 'belum_dipakai' &&
                  n.status !== 'disembunyikan' && (
                    <circle
                      cx={n.x + 11}
                      cy={n.y + 11}
                      r={4}
                      fill={WARNA_DOT_STATUS[n.status]}
                    />
                  )}
                {n.label.map((baris, i) => (
                  <text
                    key={i}
                    x={tengahX}
                    y={garisY[i]}
                    textAnchor="middle"
                    className="peta-label"
                  >
                    {baris}
                  </text>
                ))}
              </a>
            );
          })}

          {/* Legenda di dalam SVG, mengisi zona mati kiri bawah
              (BATAS_LEGENDA, diverifikasi bebas edge oleh tes) supaya
              selalu terlihat bersama peta, bukan di bawah fold. */}
          <g className="peta-legenda-teks">
            {URUTAN_LEGENDA.map((tipe, i) => {
              const gaya = GAYA_EDGE[tipe];
              const y = 304 + i * 22;
              // Baris legenda meredup saat tipenya tidak tampil, supaya
              // legenda tidak mengklaim garis yang tidak ada di peta.
              const redup =
                tipe === 'satu_tema' && !tampilkanSatuTema;
              return (
                <g
                  key={tipe}
                  className={redup ? 'peta-legenda-redup' : undefined}
                >
                  <line
                    x1={LEGENDA_X}
                    y1={y - 4}
                    x2={LEGENDA_X + 28}
                    y2={y - 4}
                    stroke={gaya.stroke}
                    strokeWidth={gaya.lebar}
                    strokeDasharray={gaya.dasharray ?? undefined}
                  />
                  <text x={LEGENDA_X + 36} y={y}>
                    {LABEL_EDGE[tipe]}: {DESKRIPSI_EDGE[tipe]}
                  </text>
                </g>
              );
            })}
            <circle
              cx={LEGENDA_X + 4}
              cy={388}
              r={4}
              fill="var(--kuning-status)"
            />
            <circle
              cx={LEGENDA_X + 16}
              cy={388}
              r={4}
              fill="var(--hijau)"
            />
            <circle
              cx={LEGENDA_X + 28}
              cy={388}
              r={4}
              fill="var(--oranye)"
            />
            <text x={LEGENDA_X + 36} y={392}>
              Titik warna: pernah dipakai, dikuasai, perlu re-use
            </text>
          </g>

          {/* Ringkasan progres di zona mati kanan bawah (BATAS_PROGRES,
              diverifikasi bebas edge dan bebas node oleh tes): stacked
              bar + hitungan per status dari data live, bukan dekorasi. */}
          <g className="peta-legenda-teks peta-progres">
            <text x={BATAS_PROGRES.x0} y={360} className="peta-kepala-tema">
              Progres
            </text>
            {barisProgres
              .filter((b) => b.lebar > 0)
              .map((b) => (
                <rect
                  key={b.status}
                  x={b.x}
                  y={368}
                  width={b.lebar}
                  height={10}
                  fill={WARNA_DOT_STATUS[b.status]}
                />
              ))}
            {barisProgres.map((b) => (
              <g key={b.status}>
                <circle
                  cx={BATAS_PROGRES.x0 + b.dx + 4}
                  cy={b.y - 4}
                  r={4}
                  fill={WARNA_DOT_STATUS[b.status]}
                />
                <text x={BATAS_PROGRES.x0 + b.dx + 12} y={b.y}>
                  {b.jumlah} {b.label}
                </text>
              </g>
            ))}
          </g>
        </svg>
      </div>

      {dipilih !== undefined && (
        <div className="kartu" role="status">
          <p>
            <strong>{dipilih.nama}</strong>{' '}
            <span className="muted kecil">{LABEL_STATUS[dipilih.status]}</span>
          </p>
          <p className="kecil">
            Pelajari dulu:{' '}
            {tautan(
              edges
                .filter((e) => e.tipe === 'prasyarat' && e.ke === dipilih.id)
                .map((e) => e.dari),
            )}
          </p>
          <p className="kecil">
            Membuka:{' '}
            {tautan(
              edges
                .filter((e) => e.tipe === 'prasyarat' && e.dari === dipilih.id)
                .map((e) => e.ke),
            )}
          </p>
          <div className="baris-tombol">
            <a className="tombol-garis" href={`#/framework/${dipilih.id}`}>
              Lihat detail
            </a>
            <button
              className="tombol-garis"
              type="button"
              onClick={() => setModeJalur((m) => !m)}
            >
              {modeJalur ? 'Tampilkan semua' : 'Lihat jalur'}
            </button>
            <button className="tombol-teks" type="button" onClick={batalkan}>
              Tutup
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
