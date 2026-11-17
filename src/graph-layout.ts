/**
 * Tata letak graph SVG statis (M3): modul murni, tanpa dependensi browser.
 *
 * Layout: satu kolom per tema (A–G, kiri ke kanan), node di dalam kolom
 * diurutkan `urutan_katalog`. Node berukuran 136×64; celah antar kolom
 * 12px, celah antar baris 14px.
 *
 * Edge dirute HANYA lewat gutter (celah antar node), tidak pernah melewati
 * area kartu node lain, dan dipendekkan sampai tepi kotak di kedua ujungnya
 * (panah prasyarat berhenti 2px sebelum tepi agar ujung panah mendarat
 * tepat di tepi). Semua path berupa polyline siku (M/L), tanpa kurva:
 * - Satu kolom: keluar tepi kanan sumber, jog vertikal di gutter kanan
 *   kolom (tengah celah 12px), masuk tepi kanan target.
 * - Lintas kolom, sebaris, tanpa node antara di baris itu: garis lurus
 *   tepi-ke-tepi.
 * - Lintas kolom, kolom bersebelahan: jog vertikal di gutter bersama.
 * - Lintas kolom, sisanya: siku (elbow) lewat celah baris terdekat
 *   (tengah celah 14px): keluar, jog vertikal ke celah baris, jalan
 *   horizontal di celah itu, jog vertikal ke baris target, masuk.
 *
 * Edge yang berbagi satu gutter (paralel maupun pasangan berbeda yang
 * kebetulan memakai gutter yang sama) dipisahkan ke lajur berbeda lewat
 * pewarnaan greedy deterministik: tiap edge mendapat satu offset yang
 * dipakai di semua segmennya, |offset| ≤ 4,5px agar garis (lebar maks 2px)
 * tetap di dalam gutter tersempit (12px).
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
export const TINGGI_NODE = 64;
export const JARAK_BARIS = 78;
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
 * batas kata: 18 karakter ≈ 122px pada font 13px, muat di kotak 136px).
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
  kontras: { stroke: 'var(--merah)', dasharray: '3 3', lebar: 1.5, panah: false },
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
  /** Atribut `d` path SVG: polyline siku (hanya perintah M/L). */
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
 * vektor (dx, dy). Dipakai untuk ujung awal dan akhir semua edge agar
 * garis berhenti tepat di tepi kotak, bukan di pusat node.
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

/** Jarak tepi node ke tengah gutter vertikal (celah antar kolom 12px). */
const GUTTER_X = (LEBAR_KOLOM - LEBAR_NODE) / 2;
/** Jarak tepi node ke tengah gutter horizontal (celah antar baris 14px). */
const GUTTER_Y = (JARAK_BARIS - TINGGI_NODE) / 2;
/**
 * Panah prasyarat berhenti sejauh ini sebelum tepi kotak: ujung marker
 * (refX 8 dari 10, skala 0,7) menjorok ~1,4px melewati ujung path, jadi
 * ujung panah mendarat ~0,6px di luar tepi, tidak menusuk kotak.
 */
const MUNDUR_PANAH = 2;

interface Titik {
  x: number;
  y: number;
}

/**
 * Satu segmen axis-aligned yang memakai sebuah gutter. Dipakai untuk
 * mendeteksi dua edge yang berbagi gutter yang sama (pewarnaan lajur).
 */
interface SegmenGutter {
  /** 'x': segmen vertikal di gutter x tetap; 'y': segmen horizontal di gutter y tetap. */
  sumbu: 'x' | 'y';
  tetap: number;
  dari: number;
  ke: number;
}

/** Rute satu edge pada offset 0 (sebelum lajur diterapkan). */
interface RuteEdge {
  dari: string;
  ke: string;
  tipe: TipeEdge;
  panah: boolean;
  /** Waypoint polyline; titik pertama/terakhir di tepi kotak ujung. */
  titik: Titik[];
  segmen: SegmenGutter[];
}

function kolomNode(node: NodeTataLetak): number {
  return Math.round(
    (node.x - MARGIN_X - (LEBAR_KOLOM - LEBAR_NODE) / 2) / LEBAR_KOLOM,
  );
}

function barisNode(node: NodeTataLetak): number {
  return Math.round((node.y - NODE_Y_AWAL) / JARAK_BARIS);
}

/**
 * Rute satu edge lewat gutter saja (offset 0). Titik pertama/terakhir
 * dihitung dengan `titikBatasKotak` agar menempel di tepi kotak.
 */
function ruteEdge(
  dari: NodeTataLetak,
  ke: NodeTataLetak,
  tipe: TipeEdge,
  panah: boolean,
  terisi: ReadonlySet<string>,
  barisTerbawah: number,
): RuteEdge {
  const p1 = pusat(dari);
  const p2 = pusat(ke);
  const hw = LEBAR_NODE / 2;
  const segmen: SegmenGutter[] = [];
  let titik: Titik[];

  if (dari.x === ke.x) {
    // Satu kolom: keluar tepi kanan, jog vertikal di gutter kanan kolom,
    // masuk tepi kanan target.
    const keluar = titikBatasKotak(p1.x, p1.y, 1, 0, hw, TINGGI_NODE / 2);
    const masuk = titikBatasKotak(p2.x, p2.y, 1, 0, hw, TINGGI_NODE / 2);
    const gutterX = keluar.x + GUTTER_X;
    const akhirX = masuk.x + (panah ? MUNDUR_PANAH : 0);
    titik = [
      { x: keluar.x, y: p1.y },
      { x: gutterX, y: p1.y },
      { x: gutterX, y: p2.y },
      { x: akhirX, y: p2.y },
    ];
    segmen.push(
      { sumbu: 'y', tetap: p1.y, dari: keluar.x, ke: gutterX },
      { sumbu: 'x', tetap: gutterX, dari: p1.y, ke: p2.y },
      { sumbu: 'y', tetap: p2.y, dari: gutterX, ke: akhirX },
    );
    return { dari: dari.id, ke: ke.id, tipe, panah, titik, segmen };
  }

  const arah = p2.x > p1.x ? 1 : -1;
  const keluar = titikBatasKotak(p1.x, p1.y, arah, 0, hw, TINGGI_NODE / 2);
  const masuk = titikBatasKotak(p2.x, p2.y, -arah, 0, hw, TINGGI_NODE / 2);
  const gutterSumberX = keluar.x + arah * GUTTER_X;
  const gutterTargetX = masuk.x - arah * GUTTER_X;
  const akhirX = masuk.x - arah * (panah ? MUNDUR_PANAH : 0);

  const kolom1 = kolomNode(dari);
  const kolom2 = kolomNode(ke);
  const baris1 = barisNode(dari);
  const sebaris = p1.y === p2.y;
  const adaNodeAntara =
    sebaris &&
    (() => {
      for (
        let c = Math.min(kolom1, kolom2) + 1;
        c < Math.max(kolom1, kolom2);
        c++
      ) {
        if (terisi.has(`${c}|${baris1}`)) return true;
      }
      return false;
    })();

  if (sebaris && !adaNodeAntara) {
    // Sebaris tanpa node antara: garis lurus tepi-ke-tepi.
    titik = [
      { x: keluar.x, y: p1.y },
      { x: akhirX, y: p1.y },
    ];
    segmen.push({ sumbu: 'y', tetap: p1.y, dari: keluar.x, ke: akhirX });
    return { dari: dari.id, ke: ke.id, tipe, panah, titik, segmen };
  }

  if (gutterSumberX === gutterTargetX) {
    // Kolom bersebelahan: satu jog vertikal di gutter bersama.
    titik = [
      { x: keluar.x, y: p1.y },
      { x: gutterSumberX, y: p1.y },
      { x: gutterSumberX, y: p2.y },
      { x: akhirX, y: p2.y },
    ];
    segmen.push(
      { sumbu: 'y', tetap: p1.y, dari: keluar.x, ke: gutterSumberX },
      { sumbu: 'x', tetap: gutterSumberX, dari: p1.y, ke: p2.y },
      { sumbu: 'y', tetap: p2.y, dari: gutterSumberX, ke: akhirX },
    );
    return { dari: dari.id, ke: ke.id, tipe, panah, titik, segmen };
  }

  // Siku (elbow) lewat celah baris terdekat dari baris sumber.
  const hh = TINGGI_NODE / 2;
  let gutterY: number;
  if (p2.y > p1.y) gutterY = p1.y + hh + GUTTER_Y;
  else if (p2.y < p1.y) gutterY = p1.y - hh - GUTTER_Y;
  else if (baris1 < barisTerbawah) gutterY = p1.y + hh + GUTTER_Y;
  else if (baris1 > 0) gutterY = p1.y - hh - GUTTER_Y;
  else gutterY = p1.y + hh + GUTTER_Y; // degenerasi: hanya satu baris
  titik = [
    { x: keluar.x, y: p1.y },
    { x: gutterSumberX, y: p1.y },
    { x: gutterSumberX, y: gutterY },
    { x: gutterTargetX, y: gutterY },
    { x: gutterTargetX, y: p2.y },
    { x: akhirX, y: p2.y },
  ];
  segmen.push(
    { sumbu: 'y', tetap: p1.y, dari: keluar.x, ke: gutterSumberX },
    { sumbu: 'x', tetap: gutterSumberX, dari: p1.y, ke: gutterY },
    { sumbu: 'y', tetap: gutterY, dari: gutterSumberX, ke: gutterTargetX },
    { sumbu: 'x', tetap: gutterTargetX, dari: gutterY, ke: p2.y },
    { sumbu: 'y', tetap: p2.y, dari: gutterTargetX, ke: akhirX },
  );
  return { dari: dari.id, ke: ke.id, tipe, panah, titik, segmen };
}

/** Dua segmen bertabrakan bila memakai gutter yang sama dengan tumpang tindih > 0. */
function segmenBertabrakan(a: SegmenGutter, b: SegmenGutter): boolean {
  if (a.sumbu !== b.sumbu || a.tetap !== b.tetap) return false;
  const awal = Math.max(Math.min(a.dari, a.ke), Math.min(b.dari, b.ke));
  const akhir = Math.min(Math.max(a.dari, a.ke), Math.max(b.dari, b.ke));
  return awal < akhir;
}

function ruteBertabrakan(a: RuteEdge, b: RuteEdge): boolean {
  return a.segmen.some((sa) => b.segmen.some((sb) => segmenBertabrakan(sa, sb)));
}

/**
 * Pewarnaan lajur greedy yang deterministik: edge yang bertabrakan di satu
 * gutter mendapat lajur berbeda. Mengembalikan offset tiap edge (satu nilai
 * per edge, dipakai di semua segmennya), simetris di sekitar 0 dan selalu
 * |offset| ≤ 4,5 agar garis tetap di dalam gutter tersempit (12px).
 */
function hitungOffsetLajur(rute: RuteEdge[]): number[] {
  const urutan = rute
    .map((_, i) => i)
    .sort((a, b) => {
      const ka = `${rute[a].dari}|${rute[a].ke}|${rute[a].tipe}`;
      const kb = `${rute[b].dari}|${rute[b].ke}|${rute[b].tipe}`;
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
  const lajur = new Array<number>(rute.length).fill(-1);
  let jumlahLajur = 0;
  for (const i of urutan) {
    const dipakai = new Set<number>();
    for (let j = 0; j < rute.length; j++) {
      if (j !== i && lajur[j] >= 0 && ruteBertabrakan(rute[i], rute[j])) {
        dipakai.add(lajur[j]);
      }
    }
    let l = 0;
    while (dipakai.has(l)) l++;
    lajur[i] = l;
    jumlahLajur = Math.max(jumlahLajur, l + 1);
  }
  const langkah =
    jumlahLajur <= 1 ? 0 : Math.min(7, 9 / (jumlahLajur - 1));
  return lajur.map(
    (l) => Math.round(((l - (jumlahLajur - 1) / 2) * langkah) * 100) / 100,
  );
}

/**
 * Terapkan offset lajur ke waypoint: titik pertama/terakhir menempel di
 * tepi kotak sehingga hanya digeser sepanjang tepi (sumbu y); titik sudut
 * digeser di kedua sumbu agar segmen horizontal dan vertikal sama-sama
 * berada di lajurnya.
 */
function terapkanOffset(titik: Titik[], delta: number): Titik[] {
  return titik.map((t, i) => {
    if (i === 0 || i === titik.length - 1) return { x: t.x, y: t.y + delta };
    return { x: t.x + delta, y: t.y + delta };
  });
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

  // Sel terisi (kolom|baris), untuk memutuskan garis lurus tepi-ke-tepi
  // pada edge sebaris: lurus hanya bila tidak ada node antara di baris itu.
  const terisi = new Set(
    nodes.map((n) => `${kolomNode(n)}|${barisNode(n)}`),
  );
  const barisTerbawah = Math.max(0, maksBaris - 1);

  // Rute semua edge pada offset 0, lalu pisahkan yang berbagi gutter
  // ke lajur berbeda (pewarnaan greedy deterministik).
  const rute: RuteEdge[] = [];
  for (const e of edges) {
    const dari = byId.get(e.dari);
    const ke = byId.get(e.ke);
    if (!dari || !ke) continue;
    rute.push(
      ruteEdge(dari, ke, e.tipe, GAYA_EDGE[e.tipe].panah, terisi, barisTerbawah),
    );
  }
  const offset = hitungOffsetLajur(rute);

  const edgesLayout: EdgeTataLetak[] = rute.map((r, i) => {
    const titik = terapkanOffset(r.titik, offset[i]);
    const d = titik
      .map((t, j) => `${j === 0 ? 'M' : 'L'} ${t.x} ${t.y}`)
      .join(' ');
    return { dari: r.dari, ke: r.ke, tipe: r.tipe, d, panah: r.panah };
  });

  return {
    lebar,
    tinggi,
    viewBox: `0 0 ${lebar} ${tinggi}`,
    nodes,
    edges: edgesLayout,
  };
}
