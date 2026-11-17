/**
 * Tata letak graph SVG statis (M3): modul murni, tanpa dependensi browser.
 *
 * Layout: satu kolom per tema (A–G, kiri ke kanan), node di dalam kolom
 * diurutkan `urutan_katalog`. Node berukuran 136×64; celah antar kolom
 * 12px, celah antar baris 14px.
 *
 * Edge dirute HANYA lewat gutter (celah antar node), tidak pernah melewati
 * area kartu node lain dan tidak pernah memakai margin luar viewBox.
 * Semua path berupa polyline siku (M/L), tanpa kurva:
 * - Satu kolom, baris bersebelahan: garis lurus vertikal 14px lewat
 *   celah baris, tanpa jog (panah duduk di batang lurus yang panjang).
 * - Satu kolom, baris tidak bersebelahan: keluar tepi samping sumber,
 *   jog vertikal di gutter samping kolom, masuk tepi samping target.
 *   Sisi gutter dipilih penyeimbang (gutter paling lengang); kolom G
 *   selalu memakai gutter kiri (celah F-G), kolom A selalu kanan.
 * - Lintas kolom, sebaris, tanpa node antara di baris itu: garis lurus
 *   tepi-ke-tepi.
 * - Lintas kolom, kolom bersebelahan: jog vertikal di gutter bersama.
 * - Lintas kolom, sisanya: siku (elbow) lewat celah baris terdekat
 *   (tengah celah 14px): keluar, jog vertikal ke celah baris, jalan
 *   horizontal di celah itu, jog vertikal ke baris target, masuk.
 *
 * Edge yang berbagi satu gutter dipisahkan ke lajur berbeda lewat
 * pewarnaan greedy deterministik (satu offset per edge, |offset| ≤ 3px,
 * jadi semua garis tetap di 6px tengah gutter). Edge berpanah diproses
 * lebih dulu dan memilih lajur yang memanjangkan segmen terakhirnya,
 * supaya marker panah (7px, 5,6px di belakang endpoint) selalu duduk
 * di atas batang lurus. Batas geometri: stub horizontal maksimal 9px
 * (gutter 12px) dan stub vertikal maksimal 10px (celah 14px), jadi
 * segmen pertama/terakhir edge berjog tidak bisa 10px semua; yang
 * dijamin adalah tidak ada segmen berbalik arah dan segmen terakhir
 * panah ≥ 6px.
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
  /**
   * Arah offset yang memanjangkan segmen terakhir (hanya untuk edge
   * berpanah yang berjog; 0 bila tidak ada preferensi). -1 berarti
   * segmen terakhir memanjang bila offset negatif, +1 sebaliknya.
   */
  preferensi: -1 | 0 | 1;
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
 * `sisi` hanya berlaku untuk edge satu kolom tak bersebelahan: gutter
 * samping yang dipakai ('kanan' default; 'kiri' untuk kolom G).
 */
function ruteEdge(
  dari: NodeTataLetak,
  ke: NodeTataLetak,
  tipe: TipeEdge,
  panah: boolean,
  terisi: ReadonlySet<string>,
  barisTerbawah: number,
  sisi: 'kanan' | 'kiri' = 'kanan',
): RuteEdge {
  const p1 = pusat(dari);
  const p2 = pusat(ke);
  const hw = LEBAR_NODE / 2;
  const hh = TINGGI_NODE / 2;
  const segmen: SegmenGutter[] = [];
  let titik: Titik[];
  let preferensi: -1 | 0 | 1 = 0;

  if (dari.x === ke.x) {
    const baris1 = barisNode(dari);
    const baris2 = barisNode(ke);
    if (Math.abs(baris1 - baris2) === 1) {
      // Baris bersebelahan: garis lurus vertikal lewat celah baris
      // (14px), tanpa jog. Panah (bila ada) duduk di batang 12px.
      const keBawah = p2.y > p1.y;
      const awal = { x: p1.x, y: keBawah ? p1.y + hh : p1.y - hh };
      const akhir = {
        x: p2.x,
        y: keBawah
          ? p2.y - hh - (panah ? MUNDUR_PANAH : 0)
          : p2.y + hh + (panah ? MUNDUR_PANAH : 0),
      };
      titik = [awal, akhir];
      segmen.push({ sumbu: 'x', tetap: p1.x, dari: awal.y, ke: akhir.y });
      return { dari: dari.id, ke: ke.id, tipe, panah, titik, segmen, preferensi };
    }
    // Baris tidak bersebelahan: keluar tepi samping, jog vertikal di
    // gutter samping kolom, masuk tepi samping target. Sisi gutter
    // dipilih penyeimbang di hitungLayout (kolom G selalu kiri).
    const arah = sisi === 'kanan' ? 1 : -1;
    const keluar = titikBatasKotak(p1.x, p1.y, arah, 0, hw, hh);
    const masuk = titikBatasKotak(p2.x, p2.y, arah, 0, hw, hh);
    const gutterX = keluar.x + arah * GUTTER_X;
    const akhirX = masuk.x + arah * (panah ? MUNDUR_PANAH : 0);
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
    // Segmen terakhir: 4+delta (sisi kanan) atau 4-delta (sisi kiri).
    if (panah) preferensi = sisi === 'kanan' ? 1 : -1;
    return { dari: dari.id, ke: ke.id, tipe, panah, titik, segmen, preferensi };
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
    return { dari: dari.id, ke: ke.id, tipe, panah, titik, segmen, preferensi };
  }

  // Edge berjog yang berpanah: segmen terakhir 4-delta (bergerak ke
  // kanan) atau 4+delta (bergerak ke kiri); preferensi lajur menjaga
  // marker 7px tetap duduk di batang lurus.
  if (panah) preferensi = arah === 1 ? -1 : 1;

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
    return { dari: dari.id, ke: ke.id, tipe, panah, titik, segmen, preferensi };
  }

  // Siku (elbow) lewat celah baris terdekat dari baris sumber.
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
  return { dari: dari.id, ke: ke.id, tipe, panah, titik, segmen, preferensi };
}

/**
 * Kedalaman maksimum tumpukan interval [dari, ke) (setengah terbuka:
 * interval yang hanya bersentuhan di satu titik tidak dihitung
 * bertumpuk, konsisten dengan `segmenBertabrakan`). Dipakai penyeimbang
 * sisi gutter: kedalaman = jumlah lajur yang dibutuhkan gutter itu.
 */
function kedalamanMaks(runs: { dari: number; ke: number }[]): number {
  const kejadian: [number, number][] = [];
  for (const r of runs) {
    const awal = Math.min(r.dari, r.ke);
    const akhir = Math.max(r.dari, r.ke);
    if (akhir > awal) kejadian.push([awal, 1], [akhir, -1]);
  }
  // Di y yang sama, akhir (-1) diproses sebelum awal (+1).
  kejadian.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let berjalan = 0;
  let maks = 0;
  for (const [, d] of kejadian) {
    berjalan += d;
    maks = Math.max(maks, berjalan);
  }
  return maks;
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
 * gutter mendapat lajur berbeda. Edge berpanah diproses lebih dulu dan
 * memilih lajur yang memanjangkan segmen terakhirnya (preferensi negatif
 * mengambil lajur terendah, positif mengambil lajur tertinggi yang bebas),
 * supaya marker panah tidak menutupi jog. Offset simetris di sekitar 0
 * dan selalu |offset| ≤ 3, jadi semua garis tetap di 6px tengah gutter
 * (tidak lebih dekat dari 2px ke tepi kartu, menghitung lebar garis 2px).
 */
function hitungOffsetLajur(rute: RuteEdge[]): number[] {
  const kunci = (r: RuteEdge): string => `${r.dari}|${r.ke}|${r.tipe}`;
  const fase = (r: RuteEdge): number =>
    r.preferensi < 0 ? 0 : r.preferensi === 0 ? 1 : 2;
  const urutan = rute
    .map((_, i) => i)
    .sort((a, b) => {
      const fa = fase(rute[a]);
      const fb = fase(rute[b]);
      if (fa !== fb) return fa - fb;
      const ka = kunci(rute[a]);
      const kb = kunci(rute[b]);
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
    let l: number;
    if (rute[i].preferensi > 0) {
      // Lajur tertinggi yang bebas; bila semua terpakai, buka lajur baru.
      l = jumlahLajur;
      for (let c = jumlahLajur - 1; c >= 0; c--) {
        if (!dipakai.has(c)) {
          l = c;
          break;
        }
      }
    } else {
      l = 0;
      while (dipakai.has(l)) l++;
    }
    lajur[i] = l;
    jumlahLajur = Math.max(jumlahLajur, l + 1);
  }
  const langkah = jumlahLajur <= 1 ? 0 : 6 / (jumlahLajur - 1);
  return lajur.map(
    (l) => Math.round(((l - (jumlahLajur - 1) / 2) * langkah) * 100) / 100,
  );
}

/**
 * Terapkan offset lajur ke waypoint. Titik pertama/terakhir menempel di
 * tepi kotak sehingga hanya digeser sepanjang tepi (tegak lurus segmen
 * ujung: sumbu y untuk segmen horizontal, sumbu x untuk vertikal);
 * titik sudut digeser di kedua sumbu agar segmen horizontal dan vertikal
 * sama-sama berada di lajurnya.
 */
function terapkanOffset(titik: Titik[], delta: number): Titik[] {
  return titik.map((t, i) => {
    if (i === 0) {
      const vertikal = titik[1].x === t.x;
      return vertikal ? { x: t.x + delta, y: t.y } : { x: t.x, y: t.y + delta };
    }
    if (i === titik.length - 1) {
      const vertikal = titik[i - 1].x === t.x;
      return vertikal ? { x: t.x + delta, y: t.y } : { x: t.x, y: t.y + delta };
    }
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
  //
  // Fase 1: edge lintas kolom (rutenya tetap). Kumpulkan run vertikal
  // per gutter untuk penyeimbang sisi di fase 2.
  const rutePerIndeks = new Map<number, RuteEdge>();
  const vertikalPerGutter = new Map<number, { dari: number; ke: number }[]>();
  const catatVertikal = (r: RuteEdge): void => {
    for (const s of r.segmen) {
      if (s.sumbu !== 'x') continue;
      const daftar = vertikalPerGutter.get(s.tetap) ?? [];
      daftar.push({ dari: s.dari, ke: s.ke });
      vertikalPerGutter.set(s.tetap, daftar);
    }
  };
  edges.forEach((e, i) => {
    const dari = byId.get(e.dari);
    const ke = byId.get(e.ke);
    if (!dari || !ke || dari.x === ke.x) return;
    const r = ruteEdge(
      dari,
      ke,
      e.tipe,
      GAYA_EDGE[e.tipe].panah,
      terisi,
      barisTerbawah,
    );
    rutePerIndeks.set(i, r);
    catatVertikal(r);
  });

  // Fase 2: edge satu kolom tak bersebelahan — pilih sisi gutter yang
  // paling lengang (kedalaman tumpukan terkecil), supaya lajur tidak
  // menumpuk sampai menempel kartu. Kolom A hanya kanan dan kolom G
  // hanya kiri: margin luar viewBox tidak pernah dipakai.
  const sebar = edges
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => {
      const dari = byId.get(e.dari);
      const ke = byId.get(e.ke);
      return (
        dari !== undefined &&
        ke !== undefined &&
        dari.x === ke.x &&
        Math.abs(barisNode(dari) - barisNode(ke)) > 1
      );
    })
    .sort((a, b) => {
      const ka = `${a.e.dari}|${a.e.ke}|${a.e.tipe}`;
      const kb = `${b.e.dari}|${b.e.ke}|${b.e.tipe}`;
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
  for (const { e, i } of sebar) {
    const dari = byId.get(e.dari)!;
    const ke = byId.get(e.ke)!;
    const kolom = kolomNode(dari);
    const p1 = pusat(dari);
    const p2 = pusat(ke);
    const calon = { dari: p1.y, ke: p2.y };
    let sisi: 'kanan' | 'kiri';
    if (kolom === 0) sisi = 'kanan';
    else if (kolom === URUTAN_TEMA.length - 1) sisi = 'kiri';
    else {
      const gutterKanan = dari.x + dari.lebar + GUTTER_X;
      const gutterKiri = dari.x - GUTTER_X;
      const dKanan = kedalamanMaks([
        ...(vertikalPerGutter.get(gutterKanan) ?? []),
        calon,
      ]);
      const dKiri = kedalamanMaks([
        ...(vertikalPerGutter.get(gutterKiri) ?? []),
        calon,
      ]);
      sisi = dKiri < dKanan ? 'kiri' : 'kanan';
    }
    const r = ruteEdge(
      dari,
      ke,
      e.tipe,
      GAYA_EDGE[e.tipe].panah,
      terisi,
      barisTerbawah,
      sisi,
    );
    rutePerIndeks.set(i, r);
    catatVertikal(r);
  }

  // Fase 3: edge satu kolom bersebelahan (lurus vertikal).
  edges.forEach((e, i) => {
    if (rutePerIndeks.has(i)) return;
    const dari = byId.get(e.dari);
    const ke = byId.get(e.ke);
    if (!dari || !ke) return;
    rutePerIndeks.set(
      i,
      ruteEdge(
        dari,
        ke,
        e.tipe,
        GAYA_EDGE[e.tipe].panah,
        terisi,
        barisTerbawah,
      ),
    );
  });
  const rute = edges
    .map((_, i) => rutePerIndeks.get(i))
    .filter((r): r is RuteEdge => r !== undefined);
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
