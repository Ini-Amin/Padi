/**
 * Tata letak graph SVG statis (M3) — modul murni, tanpa dependensi browser.
 *
 * Layout: satu kolom per tema (A–G, kiri ke kanan), node di dalam kolom
 * diurutkan `urutan_katalog`. Edge digambar dari pusat node ke pusat node
 * (node digambar di atas garis, jadi ujung garis tersembunyi di balik kotak)
 * — kecuali edge prasyarat, yang dipendekkan sampai tepi kotak target agar
 * panahnya terlihat.
 *
 * Edge paralel (pasangan node yang sama punya 2 tipe edge, misal
 * PESTEL → Porter adalah prasyarat SEKALIGUS satu_tema) digeser tegak lurus
 * garisnya supaya keduanya terlihat, bukan saling menimpa.
 */
import type { Edge, Framework, StatusFramework, Tema, TipeEdge } from './domain';

export const URUTAN_TEMA: readonly Tema[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

/** Nama tema versi pendek untuk kepala kolom (nama penuh ada di daftar). */
export const NAMA_PENDEK_TEMA: Record<Tema, string> = {
  A: 'Eksternal',
  B: 'Internal',
  C: 'Posisi',
  D: 'Keputusan',
  E: 'Eksekusi',
  F: 'Perubahan',
  G: 'Pengukuran',
};

export const LEBAR_KOLOM = 148;
export const LEBAR_NODE = 136;
export const TINGGI_NODE = 46;
export const JARAK_BARIS = 60;
export const MARGIN_X = 16;
export const MARGIN_BAWAH = 16;
export const NODE_Y_AWAL = 40;

/** Label pendek untuk node (nama penuh terlalu panjang untuk kotak 136px). */
const LABEL_PENDEK: Record<string, string> = {
  pestel: 'PESTEL',
  'porter-5f': 'Porter 5 Forces',
  ansoff: 'Ansoff Matrix',
  'value-chain': 'Value Chain',
  vrio: 'VRIO',
  'core-competencies': 'Core Competencies',
  bcg: 'BCG Matrix',
  'blue-ocean': 'Blue Ocean',
  'mckinsey-3-horizons': '3 Horizons',
  'mckinsey-7s': 'McKinsey 7S',
  bmc: 'Business Model Canvas',
  'lean-startup': 'Lean Startup',
  'design-thinking': 'Design Thinking',
  'agile-scrum': 'Agile Scrum',
  kanban: 'Kanban',
  dmaic: 'Six Sigma DMAIC',
  lewin: 'Lewin',
  'kotter-8-step': 'Kotter 8-Step',
  adkar: 'ADKAR',
  'balanced-scorecard': 'Balanced Scorecard',
  okrs: 'OKRs',
  aida: 'AIDA',
};

/** Label yang tampil di node: pendek bila ada, nama penuh bila tidak. */
export function labelNode(framework: Framework): string {
  return LABEL_PENDEK[framework.id] ?? framework.nama;
}

const MAKS_KARAKTER_BARIS = 18;

/**
 * Bagi label menjadi maksimal 2 baris (≤18 karakter per baris, dipotong di
 * batas kata — 18 karakter ≈ 114px pada font 12px, muat di kotak 136px).
 * Satu kata yang lebih panjang dari batas dipotong dengan "…".
 */
export function bungkusLabel(label: string): string[] {
  if (label.length <= MAKS_KARAKTER_BARIS) return [label];
  const kata = label.split(' ');
  const baris: string[] = [];
  let saatIni = '';
  for (const k of kata) {
    const calon = saatIni ? `${saatIni} ${k}` : k;
    if (calon.length <= MAKS_KARAKTER_BARIS) {
      saatIni = calon;
    } else {
      if (saatIni) baris.push(saatIni);
      saatIni =
        k.length > MAKS_KARAKTER_BARIS
          ? `${k.slice(0, MAKS_KARAKTER_BARIS - 1)}…`
          : k;
    }
  }
  if (saatIni) baris.push(saatIni);
  // Lebih dari 2 baris: gabungkan sisanya ke baris kedua (dipotong).
  if (baris.length > 2) {
    const sisa = baris.slice(1).join(' ');
    baris.length = 1;
    baris.push(
      sisa.length > MAKS_KARAKTER_BARIS
        ? `${sisa.slice(0, MAKS_KARAKTER_BARIS - 1)}…`
        : sisa,
    );
  }
  return baris;
}

/** Warna dot status di node (variabel CSS, sadar dark mode). */
export const WARNA_DOT_STATUS: Record<StatusFramework, string> = {
  belum_dipakai: 'var(--abu)',
  disembunyikan: 'var(--abu)',
  dipakai: 'var(--kuning-status)',
  dikuasai: 'var(--hijau)',
  perlu_reuse: 'var(--oranye)',
};

export interface GayaEdge {
  stroke: string;
  dasharray: string | null;
  lebar: number;
  /** Hanya prasyarat berpanah (relasi berarah). */
  panah: boolean;
}

/** Gaya garis per tipe edge (variabel CSS, sadar dark mode). */
export const GAYA_EDGE: Record<TipeEdge, GayaEdge> = {
  prasyarat: { stroke: 'var(--hijau)', dasharray: null, lebar: 2, panah: true },
  satu_tema: { stroke: 'var(--abu-garis)', dasharray: null, lebar: 1.5, panah: false },
  dipakai_bersama: { stroke: 'var(--biru)', dasharray: '6 3', lebar: 1.5, panah: false },
  kontras: { stroke: 'var(--merah)', dasharray: '2 3', lebar: 1.5, panah: false },
};

export const LABEL_EDGE: Record<TipeEdge, string> = {
  prasyarat: 'Prasyarat',
  satu_tema: 'Satu tema',
  dipakai_bersama: 'Dipakai bersama',
  kontras: 'Kontras',
};

export const DESKRIPSI_EDGE: Record<TipeEdge, string> = {
  prasyarat: 'pelajari yang pertama dulu',
  satu_tema: 'satu kelompok tema',
  dipakai_bersama: 'sering dipakai dalam satu masalah',
  kontras: 'pendekatan berlawanan',
};

export interface NodeTataLetak {
  id: string;
  nama: string;
  label: string[];
  tema: Tema;
  status: StatusFramework;
  x: number;
  y: number;
  lebar: number;
  tinggi: number;
}

export interface EdgeTataLetak {
  dari: string;
  ke: string;
  tipe: TipeEdge;
  /** Atribut `d` path SVG (garis lurus atau kurva kuadratik). */
  d: string;
  panah: boolean;
}

export interface TataLetakGraf {
  lebar: number;
  tinggi: number;
  viewBox: string;
  nodes: NodeTataLetak[];
  edges: EdgeTataLetak[];
}

/**
 * Titik di tepi kotak (lebar 2*hw, tinggi 2*hh) dari pusatnya, searah
 * vektor (dx, dy). Dipakai agar panah prasyarat berhenti di tepi node.
 */
function titikBatasKotak(
  pusatX: number,
  pusatY: number,
  dx: number,
  dy: number,
  hw: number,
  hh: number,
): { x: number; y: number } {
  const tX = dx !== 0 ? hw / Math.abs(dx) : Number.POSITIVE_INFINITY;
  const tY = dy !== 0 ? hh / Math.abs(dy) : Number.POSITIVE_INFINITY;
  const t = Math.min(tX, tY);
  return { x: pusatX + dx * t, y: pusatY + dy * t };
}

function pusat(node: NodeTataLetak): { x: number; y: number } {
  return { x: node.x + node.lebar / 2, y: node.y + node.tinggi / 2 };
}

/**
 * Hitung posisi semua node dan path semua edge. Deterministik: input yang
 * sama selalu menghasilkan layout yang sama (tidak ada force simulation).
 * Edge yang merujuk node yang tidak ada dilewati (tidak menggagalkan render).
 */
export function hitungLayout(
  frameworks: Framework[],
  edges: Edge[],
): TataLetakGraf {
  const perTema = new Map<Tema, Framework[]>();
  for (const tema of URUTAN_TEMA) perTema.set(tema, []);
  for (const f of frameworks) {
    perTema.get(f.tema)?.push(f);
  }

  const nodes: NodeTataLetak[] = [];
  let maksBaris = 0;
  URUTAN_TEMA.forEach((tema, kolom) => {
    const daftar = [...(perTema.get(tema) ?? [])].sort(
      (a, b) => a.urutan_katalog - b.urutan_katalog,
    );
    maksBaris = Math.max(maksBaris, daftar.length);
    daftar.forEach((f, baris) => {
      nodes.push({
        id: f.id,
        nama: f.nama,
        label: bungkusLabel(labelNode(f)),
        tema: f.tema,
        status: f.status,
        x: MARGIN_X + kolom * LEBAR_KOLOM + (LEBAR_KOLOM - LEBAR_NODE) / 2,
        y: NODE_Y_AWAL + baris * JARAK_BARIS,
        lebar: LEBAR_NODE,
        tinggi: TINGGI_NODE,
      });
    });
  });

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const lebar = MARGIN_X * 2 + URUTAN_TEMA.length * LEBAR_KOLOM;
  const tinggi =
    NODE_Y_AWAL +
    Math.max(0, maksBaris - 1) * JARAK_BARIS +
    TINGGI_NODE +
    MARGIN_BAWAH;

  // Kelompokkan edge paralel (pasangan node yang sama) untuk digeser.
  const kelompok = new Map<string, Edge[]>();
  for (const e of edges) {
    if (!byId.has(e.dari) || !byId.has(e.ke)) continue;
    const kunci = [e.dari, e.ke].sort().join('|');
    const daftar = kelompok.get(kunci) ?? [];
    daftar.push(e);
    kelompok.set(kunci, daftar);
  }

  const edgesLayout: EdgeTataLetak[] = [];
  for (const daftar of kelompok.values()) {
    daftar.forEach((e, idx) => {
      const dari = byId.get(e.dari)!;
      const ke = byId.get(e.ke)!;
      const p1 = pusat(dari);
      const p2 = pusat(ke);
      // Geser simetris di sekitar 0: -7, 0, +7 untuk 3 edge paralel, dst.
      const geser = (idx - (daftar.length - 1) / 2) * 7;
      const panah = GAYA_EDGE[e.tipe].panah;
      let d: string;

      if (dari.x === ke.x) {
        // Satu kolom: kurva melengkung ke kanan kolom agar tidak menimpa
        // node di antara kedua ujungnya.
        const kendaliX = p1.x + 44 + geser * 2;
        const kendaliY = (p1.y + p2.y) / 2;
        let akhir = p2;
        if (panah) {
          // Panah berhenti di tepi kotak, searah dari titik kendali.
          akhir = titikBatasKotak(
            p2.x,
            p2.y,
            p2.x - kendaliX,
            p2.y - kendaliY,
            LEBAR_NODE / 2 + 2,
            TINGGI_NODE / 2 + 2,
          );
        }
        d = `M ${p1.x} ${p1.y} Q ${kendaliX} ${kendaliY} ${akhir.x} ${akhir.y}`;
      } else {
        // Lintas kolom: garis lurus, digeser tegak lurus bila paralel.
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const panjang = Math.hypot(dx, dy);
        const nx = -dy / panjang;
        const ny = dx / panjang;
        const awal = { x: p1.x + nx * geser, y: p1.y + ny * geser };
        let akhir = { x: p2.x + nx * geser, y: p2.y + ny * geser };
        if (panah) {
          akhir = titikBatasKotak(
            p2.x + nx * geser,
            p2.y + ny * geser,
            dx,
            dy,
            LEBAR_NODE / 2 + 2,
            TINGGI_NODE / 2 + 2,
          );
        }
        d = `M ${awal.x} ${awal.y} L ${akhir.x} ${akhir.y}`;
      }
      edgesLayout.push({ dari: e.dari, ke: e.ke, tipe: e.tipe, d, panah });
    });
  }

  return {
    lebar,
    tinggi,
    viewBox: `0 0 ${lebar} ${tinggi}`,
    nodes,
    edges: edgesLayout,
  };
}
