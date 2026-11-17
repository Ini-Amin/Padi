/**
 * Graph SVG statis (M3) — visualisasi 22 framework / 35 edge, satu kolom
 * per tema. SVG murni tanpa library graph (tetap ramping, dokumen 05).
 * Klik node membuka detail framework. Daftar bertema di bawahnya tetap ada
 * sebagai fallback aksesibilitas (dokumen 04 §3.3).
 *
 * Mobile: SVG punya lebar minimum 700px di dalam wadah yang bisa digeser
 * horizontal — halaman tidak pernah meluber, dan label tetap terbaca.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { LABEL_STATUS } from '../status';
import type { TipeEdge } from '../domain';
import {
  DESKRIPSI_EDGE,
  GAYA_EDGE,
  LABEL_EDGE,
  LEBAR_KOLOM,
  MARGIN_X,
  NAMA_PENDEK_TEMA,
  URUTAN_TEMA,
  WARNA_DOT_STATUS,
  hitungLayout,
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

  if (frameworks === undefined || edges === undefined) {
    return <p className="muted">Memuat peta…</p>;
  }

  const layout = hitungLayout(frameworks, edges);

  return (
    <div>
      <div className="peta-gulir">
        <svg
          className="peta-svg"
          viewBox={layout.viewBox}
          role="img"
          aria-label={`Peta ${layout.nodes.length} framework dalam ${layout.edges.length} relasi, dikelompokkan per tema. Klik node untuk melihat detail framework.`}
        >
          <defs>
            <marker
              id="panah-prasyarat"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="7"
              markerHeight="7"
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
                markerEnd={e.panah ? 'url(#panah-prasyarat)' : undefined}
              />
            );
          })}

          {layout.nodes.map((n) => {
            const tengahX = n.x + n.lebar / 2;
            const tengahY = n.y + n.tinggi / 2;
            const garisY =
              n.label.length === 1 ? [tengahY + 4] : [tengahY - 4, tengahY + 10];
            return (
              <a
                key={n.id}
                href={`#/framework/${n.id}`}
                className="peta-node"
                aria-label={`${n.nama} — ${LABEL_STATUS[n.status]}`}
              >
                <title>
                  {n.nama} — {LABEL_STATUS[n.status]}
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
                <span className="muted kecil">— {DESKRIPSI_EDGE[tipe]}</span>
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
