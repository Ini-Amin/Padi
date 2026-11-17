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
 * (dokumen 04 §3.3). Layar sempit: SVG disembunyikan di bawah 720px (CSS)
 * dan daftar bertema menjadi tampilan utama. Di layar lebar, wadah Peta
 * melebar sampai 1080px agar node mencapai target sentuh 44px dan label
 * terbaca.
 */
import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { LABEL_STATUS } from '../status';
import type { TipeEdge } from '../domain';
import { useGerakanAktif } from '../gerakan';
import {
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

export function GraphSvg(): React.JSX.Element {
  const frameworks = useLiveQuery(() => db.frameworks.toArray(), []);
  const edges = useLiveQuery(() => db.edges.toArray(), []);
  const gerakanAktif = useGerakanAktif();
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

  const layout = hitungLayout(frameworks, edges);
  const keadaan = keadaanPeta(layout, hoverId, dipilihId, modeJalur);
  const dipilih = dipilihId
    ? frameworks.find((f) => f.id === dipilihId)
    : undefined;
  const jalur = dipilihId ? jalurPrasyarat(edges, dipilihId) : null;
  const nama = (id: string): string =>
    frameworks.find((f) => f.id === id)?.nama ?? id;

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
      <div className="peta-gulir">
        <svg
          className="peta-svg"
          viewBox={layout.viewBox}
          role="group"
          aria-label={`Peta ${layout.nodes.length} framework dalam ${layout.edges.length} relasi, dikelompokkan per tema.`}
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
                <circle
                  cx={n.x + 11}
                  cy={n.y + 11}
                  r={4}
                  fill={WARNA_DOT_STATUS[n.status]}
                />
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

      <div className="legenda">
        {URUTAN_LEGENDA.map((tipe) => {
          const gaya = GAYA_EDGE[tipe];
          return (
            <div className="legenda-baris" key={tipe}>
              <svg width="28" height="10" aria-hidden="true">
                <line
                  x1="0"
                  y1="5"
                  x2="28"
                  y2="5"
                  stroke={gaya.stroke}
                  strokeWidth={gaya.lebar}
                  strokeDasharray={gaya.dasharray ?? undefined}
                />
              </svg>
              <span>
                <strong>{LABEL_EDGE[tipe]}</strong>{' '}
                <span className="muted kecil">: {DESKRIPSI_EDGE[tipe]}</span>
              </span>
            </div>
          );
        })}
        <p className="muted kecil">
          Dot warna di tiap node menunjukkan status: abu-abu belum dipakai,
          kuning pernah dipakai, hijau dikuasai, oranye perlu re-use.
        </p>
      </div>
    </div>
  );
}
