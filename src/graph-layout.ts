/**
 * Tata letak graph SVG statis (M3): modul murni, tanpa dependensi browser.
 *
 * Layout: satu kolom per tema (A–G, kiri ke kanan), node di dalam kolom
 * diurutkan `urutan_katalog`. Node berukuran 136×64; celah antar kolom
 * 16px, celah antar baris 14px.
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
 * Lajur dihitung PER SEGMEN PER GUTTER dalam DUA PASS: pass 1 mewarnai
 * dari interval offset-0 yang diperlebar ±5px (aman, tapi konservatif);
 * pass 2 mengukur ulang interval dari geometri final pass 1 tanpa
 * perluasan, lalu mewarnai ulang — hanya segmen yang benar-benar
 * tumpang tindih di geometri akhir yang mendapat lajur berbeda
 * (jumlah lajur akhir: A-B 4, B-C 3, C-D 1, D-E 2, E-F 3, F-G 2 —
 * masing-masing sama dengan kedalaman tumpang tindih akhir). Untuk tiap gutter
 * (sumbu + koordinat tetap), semua segmen yang berjalan di sana
 * diwarnai dengan pewarnaan interval greedy deterministik, jadi dua
 * segmen yang tumpang tindih di satu gutter selalu mendapat lajur
 * berbeda, sementara segmen yang tidak tumpang tindih boleh berbagi
 * lajur. Lajur mengelompok di tengah gutter dengan langkah alami
 * 10/3 ≈ 3,33px, dibatasi span maksimum per sumbu (10px untuk segmen
 * vertikal di gutter kolom 16px, 8px untuk segmen horizontal di celah
 * baris 14px): N=2 → ±1,67px, N=3 → ±3,33px, N=4 di gutter kolom →
 * ±5px; tepi garis 2px selalu ≥2px dari kartu. Langkah 2px yang lama
 * masih menyatu jadi satu strip pada zoom 100% (cek live 22:19 WIB),
 * langkah 3,33px memberi celah antar tepi garis ~1,6px. Edge
 * berpanah yang berjog meminta lajur ekstrem di gutter segmen vertikal
 * sebelum segmen terakhirnya, supaya segmen terakhirnya ≥ 6px; gutter
 * yang memuat segmen berpreferensi memakai grid minimal 3 lajur
 * (ekstrem ±3,33px, segmen terakhir panah ≥ 9,33px). Batas geometri:
 * stub horizontal nominal 8px (gutter 16px), minimal 3px bila lajur
 * tetangganya di ekstrem berlawanan; stub vertikal maksimal 10px
 * (celah 14px); yang dijamin adalah tidak ada segmen berbalik arah
 * dan segmen terakhir panah ≥ 5,9px (aktual ≥ 9,33px).
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

export const LEBAR_KOLOM = 152;
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

/**
 * Gaya garis per tipe edge (variabel CSS, sadar dark mode). Hierarki
 * visual: prasyarat adalah satu-satunya seri yang menonjol (2px, panah);
 * satu_tema paling pendiam (1px) karena informasinya sudah terbaca dari
 * pengelompokan kolom — garisnya hanya konteks, bukan argumen peta.
 */
export const GAYA_EDGE: Record<TipeEdge, GayaEdge> = {
  prasyarat: { stroke: 'var(--hijau)', dasharray: null, lebar: 2, panah: true },
  satu_tema: { stroke: 'var(--abu-garis)', dasharray: null, lebar: 1, panah: false },
  dipakai_bersama: { stroke: 'var(--biru)', dasharray: '6 3', lebar: 1.5, panah: false },
  kontras: { stroke: 'var(--merah)', dasharray: '3 3', lebar: 1.5, panah: false },
};

/**
 * Batas zona kiri bawah di dalam SVG (di bawah baris ke-2 kolom A–D
 * yang kosong karena tema-tema itu hanya punya 2–3 node). Dulu zona
 * legenda; sejak legenda pindah ke HTML di bawah peta, zona ini ruang
 * kosong yang tetap diverifikasi bebas edge oleh tes (ruang putih
 * diagram, bukan lubang untuk diisi).
 */
export const BATAS_LEGENDA = { x0: 16, y0: 285, x1: 460, y1: 420 };

/**
 * Batas zona ringkasan progres di dalam SVG (kanan bawah: kolom F baris
 * 4 dan kolom G baris 3-4 kosong). Diverifikasi bebas edge DAN bebas node
 * oleh tes, seperti zona legenda. Isinya massa nyata (hitungan framework
 * per status + stacked bar), bukan copy — Hallmark gate 77/79.
 * x0 = 786 memberi jarak 10px dari tengah gutter E-F (776; lajur
 * terluar 779,33 + setengah lebar garis ≈ 780); y0 = 344 memberi jarak
 * 6px dari bawah ADKAR (y=338); x1 = 1080 = lebar viewBox − 16.
 */
export const BATAS_PROGRES = { x0: 786, y0: 344, x1: 1080, y1: 420 };

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
  /**
   * Panah pendek (total panjang path < BATAS_PANAH_KECIL) memakai marker
   * kecil, supaya batangnya terlihat di atas segitiganya. Panah berjog
   * memakai marker normal.
   */
  panahKecil: boolean;
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

/** Jarak tepi node ke tengah gutter vertikal (celah antar kolom 16px). */
const GUTTER_X = (LEBAR_KOLOM - LEBAR_NODE) / 2;
/** Jarak tepi node ke tengah gutter horizontal (celah antar baris 14px). */
const GUTTER_Y = (JARAK_BARIS - TINGGI_NODE) / 2;
/**
 * Ukuran marker panah (satuan markerWidth/markerHeight SVG). markerUnits
 * default adalah strokeWidth, jadi segitiga yang dirender berukuran
 * lebar × lebar garis prasyarat (2px): normal 14px, kecil 8px.
 */
export const LEBAR_MARKER_PANAH = 7;
export const LEBAR_MARKER_PANAH_KECIL = 4;
/**
 * Panjang segitiga marker di belakang endpoint (px): lebar marker ×
 * lebar garis × refX 8/10. Normal 11,2px, kecil 6,4px. Dipakai tes
 * untuk memastikan batang panah terlihat di luar segitiga.
 */
export const PANJANG_MARKER_PANAH =
  (LEBAR_MARKER_PANAH * GAYA_EDGE.prasyarat.lebar * 8) / 10;
export const PANJANG_MARKER_PANAH_KECIL =
  (LEBAR_MARKER_PANAH_KECIL * GAYA_EDGE.prasyarat.lebar * 8) / 10;
/** Panah dengan total panjang path di bawah ini memakai marker kecil. */
export const BATAS_PANAH_KECIL = 20;

/**
 * Panah prasyarat berhenti sejauh ini sebelum tepi kotak. Ujung marker
 * normal menjorok 2,8px melewati ujung path (2 dari 10 unit × 14px),
 * jadi ujungnya masuk ~0,8px ke dalam kotak — tertutup kartu, sehingga
 * ujung tampak menempel di tepi. Marker kecil menjorok 1,6px, jadi
 * ujungnya berhenti 0,4px sebelum tepi.
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
  /**
   * Segmen gutter, SEURUTAN dengan segmen path: segmen[i] adalah segmen
   * titik[i]→titik[i+1]. Penugasan lajur per segmen bergantung pada ini.
   */
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

/** Dua interval setengah-terbuka [awal, akhir) bertabrakan bila tumpang tindih > 0. */
function intervalBertabrakan(
  a: { awal: number; akhir: number },
  b: { awal: number; akhir: number },
): boolean {
  return a.awal < b.akhir && b.awal < a.akhir;
}

/** Satu segmen path dalam satu grup gutter, untuk penugasan lajur. */
interface SegmenLajur {
  /** Indeks edge dalam daftar rute. */
  edge: number;
  /** Indeks segmen dalam rute (segmen i: titik[i]→titik[i+1]). */
  segmen: number;
  awal: number;
  akhir: number;
  /**
   * Preferensi panah (-1/0/+1), hanya pada segmen vertikal sebelum
   * segmen terakhir panah berjog.
   */
  preferensi: -1 | 0 | 1;
  lajur: number;
}

/** Pembulatan simetris ke 2 desimal (agar ±x tetap simetris). */
function bulat2(v: number): number {
  return (Math.sign(v) * Math.round(Math.abs(v) * 100)) / 100;
}

/**
 * Perluasan interval untuk pewarnaan lajur pass 1 (px). Sudut path
 * bergeser mengikuti offset segmen tetangganya (maksimal 5px), jadi
 * interval segmen pada offset 0 diperlebar 5px di tiap ujung saat
 * menguji tumpang tindih — dua segmen yang hanya bersentuhan di offset
 * 0 tetap mendapat lajur berbeda bila sudutnya bisa bergeser sampai
 * tumpang tindih di geometri akhir. Perluasan ini konservatif: ia
 * membuat lajur yang sebenarnya tidak perlu. Karena itu
 * hitungOffsetSegmen menjalankan pass 2 yang mengukur ulang interval
 * dari geometri final pass 1 tanpa perluasan.
 */
const PERLUASAN_INTERVAL = 5;

/**
 * Langkah alami antar lajur (px). Gutter kolom 16px memberi ruang
 * untuk langkah lebih lebar dari 2,25px yang lama: pada zoom 100%
 * (skala tampil ~1x), lajur berjarak 2px masih menyatu jadi satu
 * strip (cek live 22:19 WIB); langkah 10/3 ≈ 3,33px memberi celah
 * antar tepi garis ~1,6px untuk garis 1,5–2px, cukup untuk terpisah
 * secara visual.
 */
const LANGKAH_LAJUR = 10 / 3;

/**
 * Span maksimum lajur per sumbu (px). Segmen vertikal di gutter kolom
 * 16px: |offset| ≤ 5 menjaga tepi garis 2px sejauh ≥2px dari kartu
 * (8 − 5 − 1 = 2). Segmen horizontal di celah baris 14px: |offset| ≤ 4
 * (7 − 4 − 1 = 2).
 */
const SPAN_LAJUR_X = 10;
const SPAN_LAJUR_Y = 8;

/**
 * Pewarnaan lajur PER SEGMEN PER GUTTER dari interval yang diukur
 * pemanggil. Mengembalikan offset tegak lurus tiap segmen:
 * offset[edge][segmen].
 *
 * Tiap grup gutter (sumbu + koordinat tetap) diwarnai terpisah dengan
 * pewarnaan interval greedy deterministik (urut awal interval, lalu
 * kunci edge): dua segmen yang tumpang tindih selalu mendapat lajur
 * berbeda, segmen yang tidak tumpang tindih boleh berbagi lajur.
 * Lajur mengelompok di tengah gutter dengan langkah alami 10/3 px,
 * dibatasi span maksimum per sumbu (10px untuk segmen vertikal di
 * gutter kolom, 8px untuk segmen horizontal di celah baris), jadi
 * |offset| ≤ 5 (sumbu x) / ≤ 4 (sumbu y) — tepi garis 2px tidak lebih
 * dekat dari 2px ke tepi kartu.
 *
 * Segmen berpreferensi (panah berjog) ditempatkan di lajur ekstrem:
 * preferensi negatif di terbawah, positif di teratas, dan grup yang
 * memuatnya memakai grid minimal 3 lajur supaya ekstrem mencapai
 * ±3,33px (segmen terakhir panah jadi ≥ 9,33px: stub nominal 6px
 * ditambah ekstrem). Batasan: dua panah berpreferensi sama yang
 * tumpang tindih di satu gutter tidak bisa keduanya duduk di lajur
 * ekstrem (hanya satu yang mendapatnya); kasus itu tidak terjadi
 * pada data nyata maupun fixture.
 */
function warnaiLajur(
  rute: RuteEdge[],
  ukur: (r: RuteEdge, edge: number, segmen: number) => {
    awal: number;
    akhir: number;
  },
): number[][] {
  const kunci = (r: RuteEdge): string => `${r.dari}|${r.ke}|${r.tipe}`;
  const offset: number[][] = rute.map((r) =>
    new Array<number>(r.segmen.length).fill(0),
  );

  // Kelompokkan segmen per gutter (sumbu + koordinat tetap).
  const grup = new Map<string, { sumbu: 'x' | 'y'; daftar: SegmenLajur[] }>();
  rute.forEach((r, edge) => {
    r.segmen.forEach((s, segmen) => {
      const kritis = r.preferensi !== 0 && segmen === r.segmen.length - 2;
      const { awal, akhir } = ukur(r, edge, segmen);
      const entri: SegmenLajur = {
        edge,
        segmen,
        awal,
        akhir,
        preferensi: kritis ? r.preferensi : 0,
        lajur: -1,
      };
      const k = `${s.sumbu}:${s.tetap}`;
      const g = grup.get(k) ?? { sumbu: s.sumbu, daftar: [] };
      g.daftar.push(entri);
      grup.set(k, g);
    });
  });

  for (const { sumbu, daftar } of grup.values()) {
    const urut = [...daftar].sort((a, b) => {
      if (a.awal !== b.awal) return a.awal - b.awal;
      const ka = kunci(rute[a.edge]);
      const kb = kunci(rute[b.edge]);
      if (ka !== kb) return ka < kb ? -1 : 1;
      return a.segmen - b.segmen;
    });
    const biasa = urut.filter((s) => s.preferensi === 0);
    const negatif = urut.filter((s) => s.preferensi < 0);
    const positif = urut.filter((s) => s.preferensi > 0);

    // Segmen biasa: pewarnaan interval greedy dari lajur 0 ke atas.
    let jumlahBiasa = 0;
    for (const s of biasa) {
      let l = 0;
      while (
        biasa.some((t) => t !== s && t.lajur === l && intervalBertabrakan(s, t))
      ) {
        l++;
      }
      s.lajur = l;
      jumlahBiasa = Math.max(jumlahBiasa, l + 1);
    }
    // Preferensi negatif: lajur di bawah 0 (-1, -2, …), supaya setelah
    // normalisasi mereka menempati lajur terbawah.
    for (const s of negatif) {
      let l = -1;
      while (
        negatif.some(
          (t) => t !== s && t.lajur === l && intervalBertabrakan(s, t),
        )
      ) {
        l--;
      }
      s.lajur = l;
    }
    // Preferensi positif: lajur di atas lajur biasa.
    for (const s of positif) {
      let l = jumlahBiasa;
      while (
        positif.some(
          (t) => t !== s && t.lajur === l && intervalBertabrakan(s, t),
        )
      ) {
        l++;
      }
      s.lajur = l;
    }

    // Normalisasi: geser semua lajur supaya minimumnya 0.
    const minLajur = Math.min(...daftar.map((s) => s.lajur));
    for (const s of daftar) s.lajur -= minLajur;
    const jumlahLajur = Math.max(...daftar.map((s) => s.lajur)) + 1;

    // Gutter berpreferensi memakai grid minimal 3 lajur, supaya lajur
    // ekstrem mencapai ±3,33px (segmen terakhir panah jadi ≥ 9,33px).
    const adaPreferensi = negatif.length + positif.length > 0;
    const grid = adaPreferensi ? Math.max(jumlahLajur, 3) : jumlahLajur;
    // Bila grid diperlebar, geser segmen berpreferensi positif ke lajur
    // teratas grid (segmen negatif sudah di terbawah setelah normalisasi).
    if (grid > jumlahLajur && positif.length > 0) {
      const geser = grid - jumlahLajur;
      for (const s of positif) s.lajur += geser;
    }

    // Langkah alami 10/3 px, dibatasi span maksimum sumbu ini (10px
    // untuk gutter kolom, 8px untuk celah baris).
    const cap = sumbu === 'x' ? SPAN_LAJUR_X : SPAN_LAJUR_Y;
    const langkah =
      grid <= 1 ? 0 : Math.min(cap, LANGKAH_LAJUR * (grid - 1)) / (grid - 1);
    for (const s of daftar) {
      offset[s.edge][s.segmen] = bulat2((s.lajur - (grid - 1) / 2) * langkah);
    }
  }
  return offset;
}

/**
 * Hitung offset lajur dalam DUA PASS.
 *
 * Pass 1 mewarnai dari interval offset-0 yang diperlebar ±5px
 * (PERLUASAN_INTERVAL): aman, tapi konservatif — lajur yang
 * sebenarnya tidak perlu ikut dibuat (perluasan menutupi pergeseran
 * sudut maksimal 5px).
 *
 * Pass 2 menerapkan offset pass 1, mengukur interval SEBENARNYA dari
 * geometri final itu (tanpa perluasan), lalu mewarnai ulang. Dua
 * segmen yang berbagi lajur di pass 2 benar-benar tidak tumpang
 * tindih di geometri pass 1; celah kritis dipertahankan karena lajur
 * segmen horizontal yang menentukan ujung-ujung itu tidak berubah
 * antar-pass (kunci urut yang sama, interval yang tetap tumpang
 * tindih). Hasil akhir tetap dijaga tes geometri ("tidak ada dua
 * segmen yang berimpit" pada geometri final): bila data berubah dan
 * pass 2 menciptakan impitan, tes itu gagal dan skema ini perlu
 * ditinjau.
 *
 * Hasil pada data nyata: lajur akhir A-B 4 (jarak 3,33px), E-F 3,
 * F-G 2 — masing-masing sama dengan kedalaman tumpang tindih akhir.
 */
function hitungOffsetSegmen(rute: RuteEdge[]): number[][] {
  const offset1 = warnaiLajur(rute, (r, _edge, segmen) => {
    const s = r.segmen[segmen];
    return {
      awal: Math.min(s.dari, s.ke) - PERLUASAN_INTERVAL,
      akhir: Math.max(s.dari, s.ke) + PERLUASAN_INTERVAL,
    };
  });
  const final = rute.map((r, i) => terapkanOffsetSegmen(r.titik, offset1[i]));
  return warnaiLajur(rute, (r, edge, segmen) => {
    const [a, b] = [final[edge][segmen], final[edge][segmen + 1]];
    const [p, q] =
      r.segmen[segmen].sumbu === 'x' ? [a.y, b.y] : [a.x, b.x];
    return { awal: Math.min(p, q), akhir: Math.max(p, q) };
  });
}

/**
 * Terapkan offset per segmen ke waypoint. Titik ujung hanya digeser
 * sepanjang tepi kotak (tegak lurus segmen ujungnya); titik sudut
 * digeser di kedua sumbu (x dari segmen vertikal tetangganya, y dari
 * segmen horizontal tetangganya). Segmen yang berurutan selalu berganti
 * arah (polyline siku), jadi tiap sudut punya tepat satu tetangga
 * vertikal dan satu horizontal.
 */
function terapkanOffsetSegmen(titik: Titik[], offset: number[]): Titik[] {
  return titik.map((t, i) => {
    if (i === 0) {
      const vertikal = titik[1].x === t.x;
      return vertikal
        ? { x: t.x + offset[0], y: t.y }
        : { x: t.x, y: t.y + offset[0] };
    }
    if (i === titik.length - 1) {
      const vertikal = titik[i - 1].x === t.x;
      const o = offset[i - 1];
      return vertikal ? { x: t.x + o, y: t.y } : { x: t.x, y: t.y + o };
    }
    const sebelumVertikal = titik[i - 1].x === t.x;
    const dx = sebelumVertikal ? offset[i - 1] : offset[i];
    const dy = sebelumVertikal ? offset[i] : offset[i - 1];
    return { x: t.x + dx, y: t.y + dy };
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
  const offset = hitungOffsetSegmen(rute);

  const edgesLayout: EdgeTataLetak[] = rute.map((r, i) => {
    const titik = terapkanOffsetSegmen(r.titik, offset[i]);
    const d = titik
      .map((t, j) => `${j === 0 ? 'M' : 'L'} ${t.x} ${t.y}`)
      .join(' ');
    // Panjang total path (segmen axis-aligned, jadi jarak Manhattan).
    const panjang = r.titik.reduce((total, t, j) => {
      if (j === 0) return 0;
      return (
        total +
        Math.abs(t.x - r.titik[j - 1].x) +
        Math.abs(t.y - r.titik[j - 1].y)
      );
    }, 0);
    return {
      dari: r.dari,
      ke: r.ke,
      tipe: r.tipe,
      d,
      panah: r.panah,
      panahKecil: r.panah && panjang < BATAS_PANAH_KECIL,
    };
  });

  return {
    lebar,
    tinggi,
    viewBox: `0 0 ${lebar} ${tinggi}`,
    nodes,
    edges: edgesLayout,
  };
}

/**
 * Interaksi Peta (inspirasi CourseViz): traversal graf murni untuk sorot
 * hover/pilih dan mode "Lihat jalur". Tanpa dependensi browser, dites di
 * tests/graph-layout.test.ts.
 */

/** Field edge yang dipakai traversal (Edge domain maupun EdgeTataLetak). */
export type EdgeGraf = Pick<Edge, 'dari' | 'ke' | 'tipe'>;

/** Tetangga satu node lewat edge tipe apa pun, dua arah. */
export function tetangga(
  edges: readonly EdgeGraf[],
  id: string,
): Set<string> {
  const hasil = new Set<string>();
  for (const e of edges) {
    if (e.dari === id) hasil.add(e.ke);
    else if (e.ke === id) hasil.add(e.dari);
  }
  return hasil;
}

/**
 * Transitive closure sepanjang edge PRASYARAT saja, dua arah.
 * `sebelum`: framework yang harus dipelajari dulu (transitif);
 * `sesudah`: framework yang terbuka sesudahnya (transitif).
 * Tahan siklus: node yang sudah dikunjungi tidak diproses lagi
 * (graph seharusnya DAG, tapi kodenya tidak mengasumsikan itu).
 */
export function jalurPrasyarat(
  edges: readonly EdgeGraf[],
  id: string,
): { sebelum: Set<string>; sesudah: Set<string> } {
  const prasyarat = edges.filter((e) => e.tipe === 'prasyarat');
  const jalan = (mundur: boolean): Set<string> => {
    const ketemu = new Set<string>();
    const dikunjungi = new Set([id]);
    const antre = [id];
    while (antre.length > 0) {
      const cur = antre.pop()!;
      for (const e of prasyarat) {
        const tetanggaId = mundur
          ? e.ke === cur
            ? e.dari
            : null
          : e.dari === cur
            ? e.ke
            : null;
        if (tetanggaId !== null && !dikunjungi.has(tetanggaId)) {
          dikunjungi.add(tetanggaId);
          ketemu.add(tetanggaId);
          antre.push(tetanggaId);
        }
      }
    }
    return ketemu;
  };
  return { sebelum: jalan(true), sesudah: jalan(false) };
}

/** Keadaan visual tiap node/edge untuk satu hover/pilihan. */
export interface KeadaanPeta {
  /** Node ber-outline: fokus (hover diutamakan) + tetangganya. */
  sorot: Set<string>;
  /** Node meredup: tidak terkait pilihan (kosong tanpa pilihan). */
  redup: Set<string>;
  /** Node disembunyikan: mode jalur, di luar closure prasyarat. */
  sembunyi: Set<string>;
  /** Indeks edge yang menebal: insiden ke fokus. */
  edgeTerkait: Set<number>;
  /** Indeks edge yang meredup: tidak insiden ke pilihan. */
  edgeRedup: Set<number>;
  /** Indeks edge yang disembunyikan: mode jalur, bukan jalur prasyarat. */
  edgeSembunyi: Set<number>;
}

/**
 * Turunkan keadaan visual peta dari hover/pilihan/mode. Aturan:
 * - Fokus sorot = node hover bila ada, bila tidak node pilihan.
 * - Pilihan meredupkan node/edge yang tidak terkait (tipe apa pun);
 *   yang disorot tidak pernah meredup.
 * - Mode jalur hanya menampilkan closure prasyarat pilihan (dua arah)
 *   beserta edge prasyarat antar node closure; sisanya disembunyikan.
 */
export function keadaanPeta(
  layout: TataLetakGraf,
  hoverId: string | null,
  dipilihId: string | null,
  modeJalur: boolean,
): KeadaanPeta {
  const sorot = new Set<string>();
  const redup = new Set<string>();
  const sembunyi = new Set<string>();
  const edgeTerkait = new Set<number>();
  const edgeRedup = new Set<number>();
  const edgeSembunyi = new Set<number>();
  const fokus = hoverId ?? dipilihId;
  if (fokus !== null) {
    sorot.add(fokus);
    for (const t of tetangga(layout.edges, fokus)) sorot.add(t);
    layout.edges.forEach((e, i) => {
      if (e.dari === fokus || e.ke === fokus) edgeTerkait.add(i);
    });
  }
  if (dipilihId !== null && !modeJalur) {
    const terkait = new Set([dipilihId, ...tetangga(layout.edges, dipilihId)]);
    for (const n of layout.nodes) {
      if (!terkait.has(n.id) && !sorot.has(n.id)) redup.add(n.id);
    }
    layout.edges.forEach((e, i) => {
      if (
        !edgeTerkait.has(i) &&
        e.dari !== dipilihId &&
        e.ke !== dipilihId
      ) {
        edgeRedup.add(i);
      }
    });
  }
  if (dipilihId !== null && modeJalur) {
    const { sebelum, sesudah } = jalurPrasyarat(layout.edges, dipilihId);
    const tampil = new Set([dipilihId, ...sebelum, ...sesudah]);
    for (const n of layout.nodes) {
      if (!tampil.has(n.id)) sembunyi.add(n.id);
    }
    layout.edges.forEach((e, i) => {
      if (
        !(e.tipe === 'prasyarat' && tampil.has(e.dari) && tampil.has(e.ke))
      ) {
        edgeSembunyi.add(i);
      }
    });
  }
  return { sorot, redup, sembunyi, edgeTerkait, edgeRedup, edgeSembunyi };
}
