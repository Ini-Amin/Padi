/**
 * Uji tata letak graph SVG (M3): modul murni graph-layout.ts.
 * Yang diuji adalah model render (posisi node + path edge) yang dipakai
 * GraphSvg: jumlah node/edge harus sama dengan graph.json, node tidak boleh
 * tumpang tindih, edge paralel harus tergambar terpisah, dan SETIAP edge
 * hanya lewat gutter (tidak ada titik path yang jatuh di dalam node
 * bukan ujung).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { GraphData } from '../src/domain';
import {
  BATAS_LEGENDA,
  BATAS_PROGRES,
  GAYA_EDGE,
  LEBAR_NODE,
  PANJANG_MARKER_PANAH_KECIL,
  TINGGI_NODE,
  bungkusLabel,
  hitungLayout,
  jalurPrasyarat,
  keadaanPeta,
  labelNode,
  tetangga,
} from '../src/graph-layout';
import { buatFramework } from './factories';

const DIR_TEST = dirname(fileURLToPath(import.meta.url));
const graph = JSON.parse(
  readFileSync(join(DIR_TEST, '../public/data/graph.json'), 'utf-8'),
) as GraphData;

const layout = hitungLayout(graph.nodes, graph.edges);

describe('hitungLayout: jumlah dan kelengkapan', () => {
  it('merender 22 node dan 35 edge, sama dengan graph.json', () => {
    expect(layout.nodes).toHaveLength(graph.nodes.length);
    expect(layout.nodes).toHaveLength(22);
    expect(layout.edges).toHaveLength(graph.edges.length);
    expect(layout.edges).toHaveLength(35);
  });

  it('setiap node graph.json punya posisi', () => {
    const ids = new Set(layout.nodes.map((n) => n.id));
    for (const n of graph.nodes) expect(ids.has(n.id)).toBe(true);
  });

  it('setiap edge merujuk node yang ada', () => {
    const ids = new Set(layout.nodes.map((n) => n.id));
    for (const e of layout.edges) {
      expect(ids.has(e.dari)).toBe(true);
      expect(ids.has(e.ke)).toBe(true);
      expect(e.d.length).toBeGreaterThan(0);
    }
  });

  it('edge yang merujuk node tidak ada dilewati, bukan menggagalkan render', () => {
    const hasil = hitungLayout(graph.nodes, [
      ...graph.edges,
      { dari: 'tidak-ada', ke: 'pestel', tipe: 'satu_tema', alasan: null },
    ]);
    expect(hasil.edges).toHaveLength(35);
  });
});

describe('hitungLayout: geometri', () => {
  it('semua node berada di dalam viewBox', () => {
    for (const n of layout.nodes) {
      expect(n.x).toBeGreaterThanOrEqual(0);
      expect(n.y).toBeGreaterThanOrEqual(0);
      expect(n.x + n.lebar).toBeLessThanOrEqual(layout.lebar);
      expect(n.y + n.tinggi).toBeLessThanOrEqual(layout.tinggi);
    }
    expect(layout.viewBox).toBe(`0 0 ${layout.lebar} ${layout.tinggi}`);
  });

  it('tidak ada dua node yang tumpang tindih', () => {
    for (let i = 0; i < layout.nodes.length; i++) {
      for (let j = i + 1; j < layout.nodes.length; j++) {
        const a = layout.nodes[i];
        const b = layout.nodes[j];
        const tumpang =
          a.x < b.x + b.lebar &&
          a.x + a.lebar > b.x &&
          a.y < b.y + b.tinggi &&
          a.y + a.tinggi > b.y;
        expect(tumpang, `${a.id} tumpang dengan ${b.id}`).toBe(false);
      }
    }
  });

  it('kolom terurut tema A–G dari kiri ke kanan', () => {
    const xTema = new Map<string, number>();
    for (const n of layout.nodes) xTema.set(n.tema, n.x);
    const xs = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((t) => xTema.get(t)!);
    for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThan(xs[i - 1]);
  });

  it('node dalam satu kolom terurut urutan_katalog dari atas ke bawah', () => {
    const kolomA = layout.nodes
      .filter((n) => n.tema === 'A')
      .sort((a, b) => a.y - b.y);
    expect(kolomA.map((n) => n.id)).toEqual([
      'pestel',
      'porter-5f',
      'ansoff',
    ]);
  });
});

describe('hitungLayout: edge', () => {
  it('hanya edge prasyarat yang berpanah', () => {
    for (const e of layout.edges) {
      expect(e.panah).toBe(e.tipe === 'prasyarat');
    }
    expect(layout.edges.filter((e) => e.panah)).toHaveLength(6);
  });

  it('edge paralel (pasangan node sama) punya path berbeda', () => {
    // PESTEL → Porter ada dua kali: prasyarat + satu_tema.
    const pasangan = layout.edges.filter(
      (e) =>
        (e.dari === 'pestel' && e.ke === 'porter-5f') ||
        (e.dari === 'porter-5f' && e.ke === 'pestel'),
    );
    expect(pasangan).toHaveLength(2);
    expect(pasangan[0].d).not.toBe(pasangan[1].d);
  });

  it('semua path berupa polyline siku (hanya M/L, tanpa kurva Q)', () => {
    for (const e of layout.edges) {
      expect(e.d).not.toContain('Q');
      expect(e.d).toMatch(/^M -?[\d.]+ -?[\d.]+( L -?[\d.]+ -?[\d.]+)+$/);
    }
  });

  it('semua edge dimulai dan berakhir di tepi kotak node ujungnya', () => {
    const byId = new Map(layout.nodes.map((n) => [n.id, n]));
    for (const e of layout.edges) {
      const dari = byId.get(e.dari)!;
      const ke = byId.get(e.ke)!;
      const titik = uraianTitik(e.d);
      const awal = titik[0];
      const akhir = titik[titik.length - 1];
      // Awal: di salah satu tepi vertikal kotak sumber, atau di tepi
      // atas/bawah (edge satu kolom baris bersebelahan keluar lurus).
      const awalDiTepiTegak =
        (awal.x === dari.x || awal.x === dari.x + dari.lebar) &&
        awal.y >= dari.y &&
        awal.y <= dari.y + dari.tinggi;
      const awalDiTepiDatar =
        (awal.y === dari.y || awal.y === dari.y + dari.tinggi) &&
        awal.x >= dari.x &&
        awal.x <= dari.x + dari.lebar;
      expect(
        awalDiTepiTegak || awalDiTepiDatar,
        `${e.dari}→${e.ke}: awal x=${awal.x} y=${awal.y}`,
      ).toBe(true);
      // Akhir: di tepi kotak target, atau ≤2px di luarnya bila berpanah.
      const dx = Math.max(ke.x - akhir.x, 0, akhir.x - (ke.x + ke.lebar));
      const dy = Math.max(ke.y - akhir.y, 0, akhir.y - (ke.y + ke.tinggi));
      expect(Math.hypot(dx, dy)).toBeLessThanOrEqual(e.panah ? 2.01 : 0.01);
    }
  });

  it('edge satu kolom lewat gutter kanan kolom (pestel→ansoff)', () => {
    const pestel = layout.nodes.find((n) => n.id === 'pestel')!;
    const ansoff = layout.nodes.find((n) => n.id === 'ansoff')!;
    const edge = layout.edges.find(
      (e) => e.dari === 'pestel' && e.ke === 'ansoff',
    )!;
    const titik = uraianTitik(edge.d);
    // Mulai di tepi kanan pestel, berakhir di tepi kanan ansoff.
    expect(titik[0].x).toBe(pestel.x + pestel.lebar);
    expect(titik[titik.length - 1].x).toBe(ansoff.x + ansoff.lebar);
    // Segmen vertikal berada di gutter kanan kolom A (160..176).
    expect(titik[1].x).toBeGreaterThan(160);
    expect(titik[1].x).toBeLessThan(176);
    expect(titik[1].x).toBe(titik[2].x);
  });

  it('edge lintas kolom berupa siku lewat celah baris (porter-5f→bcg)', () => {
    const porter = layout.nodes.find((n) => n.id === 'porter-5f')!;
    const bcg = layout.nodes.find((n) => n.id === 'bcg')!;
    const edge = layout.edges.find(
      (e) => e.dari === 'porter-5f' && e.ke === 'bcg',
    )!;
    const titik = uraianTitik(edge.d);
    // Keluar tepi kanan porter, masuk tepi kiri bcg (bukan panah).
    expect(titik[0].x).toBe(porter.x + porter.lebar);
    expect(titik[titik.length - 1].x).toBe(bcg.x);
    // Ada segmen horizontal panjang di celah baris antara baris 0 dan 1
    // (celah y 104..118, tengah 111).
    const adaJalan = titik.some(
      (t, i) =>
        i > 0 &&
        t.y === titik[i - 1].y &&
        t.y > 104 &&
        t.y < 118 &&
        Math.abs(t.x - titik[i - 1].x) > 50,
    );
    expect(adaJalan).toBe(true);
  });

  it('edge berbeda yang berbagi gutter baris mendapat lajur berbeda', () => {
    // porter-5f→bcg dan bcg→ansoff sama-sama memakai celah baris y=111.
    const e1 = layout.edges.find(
      (e) => e.dari === 'porter-5f' && e.ke === 'bcg',
    )!;
    const e2 = layout.edges.find(
      (e) => e.dari === 'bcg' && e.ke === 'ansoff',
    )!;
    expect(jalanTerpanjangY(e1.d)).not.toBe(jalanTerpanjangY(e2.d));
  });
});

/** Urai path `d` (M/L) menjadi waypoint. */
function uraianTitik(d: string): { x: number; y: number }[] {
  const token = d.match(/[ML]|-?\d+(?:\.\d+)?/g) ?? [];
  const titik: { x: number; y: number }[] = [];
  for (let i = 0; i < token.length; i++) {
    if (token[i] === 'M' || token[i] === 'L') {
      titik.push({ x: Number(token[i + 1]), y: Number(token[i + 2]) });
      i += 2;
    }
  }
  return titik;
}

/** Y dari segmen horizontal terpanjang (jalan di celah baris). */
function jalanTerpanjangY(d: string): number {
  const titik = uraianTitik(d);
  let terbaik = { y: 0, panjang: 0 };
  for (let i = 1; i < titik.length; i++) {
    if (titik[i].y === titik[i - 1].y) {
      const panjang = Math.abs(titik[i].x - titik[i - 1].x);
      if (panjang > terbaik.panjang) terbaik = { y: titik[i].y, panjang };
    }
  }
  return terbaik.y;
}

/**
 * Sampling titik-titik sepanjang path `d` (M/L/Q) tiap ≤2px. Dipakai
 * property test: titik-titik inilah yang harus bebas dari node bukan ujung.
 */
function samplingPath(d: string): { x: number; y: number }[] {
  const token = d.match(/[MLQ]|-?\d+(?:\.\d+)?/g) ?? [];
  const titik: { x: number; y: number }[] = [];
  let saatIni = { x: 0, y: 0 };
  const dorongGaris = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const panjang = Math.hypot(b.x - a.x, b.y - a.y);
    const langkah = Math.max(1, Math.ceil(panjang / 2));
    for (let k = 0; k <= langkah; k++) {
      const t = k / langkah;
      titik.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  };
  let i = 0;
  while (i < token.length) {
    const cmd = token[i++];
    if (cmd === 'M') {
      saatIni = { x: Number(token[i++]), y: Number(token[i++]) };
      titik.push({ ...saatIni });
    } else if (cmd === 'L') {
      const tujuan = { x: Number(token[i++]), y: Number(token[i++]) };
      dorongGaris(saatIni, tujuan);
      saatIni = tujuan;
    } else if (cmd === 'Q') {
      const kendali = { x: Number(token[i++]), y: Number(token[i++]) };
      const tujuan = { x: Number(token[i++]), y: Number(token[i++]) };
      for (let k = 0; k <= 50; k++) {
        const t = k / 50;
        const u = 1 - t;
        titik.push({
          x: u * u * saatIni.x + 2 * u * t * kendali.x + t * t * tujuan.x,
          y: u * u * saatIni.y + 2 * u * t * kendali.y + t * t * tujuan.y,
        });
      }
      saatIni = tujuan;
    }
  }
  return titik;
}

describe('hitungLayout: edge hanya lewat gutter (property test)', () => {
  it('tidak ada titik edge yang jatuh di dalam node bukan ujung (data nyata)', () => {
    for (const e of layout.edges) {
      const ujung = new Set([e.dari, e.ke]);
      const pelanggaran: string[] = [];
      for (const p of samplingPath(e.d)) {
        for (const n of layout.nodes) {
          if (ujung.has(n.id)) continue;
          // Toleransi 1px di tepi: titik tepat di batas kotak bukan pelanggaran.
          const diDalam =
            p.x > n.x + 1 &&
            p.x < n.x + n.lebar - 1 &&
            p.y > n.y + 1 &&
            p.y < n.y + n.tinggi - 1;
          if (diDalam) {
            pelanggaran.push(
              `(${p.x.toFixed(1)}, ${p.y.toFixed(1)}) di dalam ${n.id}`,
            );
          }
        }
      }
      expect(
        pelanggaran.slice(0, 5),
        `edge ${e.dari}→${e.ke} (${e.tipe}): ${pelanggaran.length} titik melanggar`,
      ).toEqual([]);
    }
  });

  it('tidak ada titik edge yang jatuh di zona legenda (data nyata)', () => {
    // Legenda dirender di dalam SVG, di zona mati kiri bawah
    // (BATAS_LEGENDA). Bila routing berubah dan ada edge yang masuk
    // ke zona ini, tes ini gagal — legenda akan tertutup garis.
    for (const e of layout.edges) {
      const pelanggaran: string[] = [];
      for (const p of samplingPath(e.d)) {
        const diDalam =
          p.x > BATAS_LEGENDA.x0 &&
          p.x < BATAS_LEGENDA.x1 &&
          p.y > BATAS_LEGENDA.y0 &&
          p.y < BATAS_LEGENDA.y1;
        if (diDalam) {
          pelanggaran.push(`(${p.x.toFixed(1)}, ${p.y.toFixed(1)})`);
        }
      }
      expect(
        pelanggaran.slice(0, 5),
        `edge ${e.dari}→${e.ke} (${e.tipe}): ${pelanggaran.length} titik masuk zona legenda`,
      ).toEqual([]);
    }
  });

  it('zona legenda berada di dalam viewBox dan di bawah baris ke-2', () => {
    expect(BATAS_LEGENDA.x0).toBeGreaterThanOrEqual(0);
    expect(BATAS_LEGENDA.y0).toBeGreaterThanOrEqual(0);
    expect(BATAS_LEGENDA.x1).toBeLessThanOrEqual(layout.lebar);
    expect(BATAS_LEGENDA.y1).toBeLessThanOrEqual(layout.tinggi);
  });

  it('tidak ada titik edge yang jatuh di zona progres (data nyata)', () => {
    // Ringkasan progres dirender di dalam SVG, di zona mati kanan bawah
    // (BATAS_PROGRES). Sama seperti zona legenda: bila routing berubah
    // dan ada edge yang masuk, tes ini gagal.
    for (const e of layout.edges) {
      const pelanggaran: string[] = [];
      for (const p of samplingPath(e.d)) {
        const diDalam =
          p.x > BATAS_PROGRES.x0 &&
          p.x < BATAS_PROGRES.x1 &&
          p.y > BATAS_PROGRES.y0 &&
          p.y < BATAS_PROGRES.y1;
        if (diDalam) {
          pelanggaran.push(`(${p.x.toFixed(1)}, ${p.y.toFixed(1)})`);
        }
      }
      expect(
        pelanggaran.slice(0, 5),
        `edge ${e.dari}→${e.ke} (${e.tipe}): ${pelanggaran.length} titik masuk zona progres`,
      ).toEqual([]);
    }
  });

  it('zona progres berada di dalam viewBox dan bebas node', () => {
    expect(BATAS_PROGRES.x0).toBeGreaterThanOrEqual(0);
    expect(BATAS_PROGRES.y0).toBeGreaterThanOrEqual(0);
    expect(BATAS_PROGRES.x1).toBeLessThanOrEqual(layout.lebar);
    expect(BATAS_PROGRES.y1).toBeLessThanOrEqual(layout.tinggi);
    // Zona di kanan Kanban (tepi kanan x=768) dan di bawah ADKAR
    // (tepi bawah y=338); tidak ada node yang tumpang tindih.
    for (const n of layout.nodes) {
      const tumpang =
        n.x < BATAS_PROGRES.x1 &&
        n.x + n.lebar > BATAS_PROGRES.x0 &&
        n.y < BATAS_PROGRES.y1 &&
        n.y + n.tinggi > BATAS_PROGRES.y0;
      expect(tumpang, `node ${n.id} tumpang tindih zona progres`).toBe(
        false,
      );
    }
  });
});

describe('GAYA_EDGE: hierarki visual', () => {
  it('prasyarat paling tebal, satu_tema paling tipis', () => {
    // Prasyarat adalah satu-satunya seri yang menonjol (jalur belajar);
    // satu_tema paling pendiam karena informasinya sudah terbaca dari
    // pengelompokan kolom.
    expect(GAYA_EDGE.prasyarat.lebar).toBeGreaterThan(
      GAYA_EDGE.dipakai_bersama.lebar,
    );
    expect(GAYA_EDGE.prasyarat.lebar).toBeGreaterThan(
      GAYA_EDGE.kontras.lebar,
    );
    expect(GAYA_EDGE.satu_tema.lebar).toBeLessThan(
      GAYA_EDGE.dipakai_bersama.lebar,
    );
    expect(GAYA_EDGE.satu_tema.lebar).toBeLessThan(GAYA_EDGE.kontras.lebar);
    expect(GAYA_EDGE.satu_tema.lebar).toBeLessThan(
      GAYA_EDGE.prasyarat.lebar,
    );
  });
});

describe('hitungLayout: putaran 2 (panah, margin luar, lajur)', () => {
  it('edge prasyarat baris bersebelahan lurus vertikal 12px (panah di batang lurus)', () => {
    // 5 dari 6 panah adalah satu kolom baris bersebelahan; semuanya
    // harus berupa garis lurus 2 titik sepanjang 12px (celah 14px
    // dikurangi mundur panah 2px), bukan jog dengan segmen 0,5px.
    for (const [dari, ke] of [
      ['pestel', 'porter-5f'],
      ['value-chain', 'vrio'],
      ['vrio', 'core-competencies'],
      ['lewin', 'kotter-8-step'],
      ['balanced-scorecard', 'okrs'],
    ] as const) {
      const edge = layout.edges.find(
        (e) => e.dari === dari && e.ke === ke && e.panah,
      )!;
      const titik = uraianTitik(edge.d);
      expect(titik, `${dari}→${ke}`).toHaveLength(2);
      expect(titik[0].x).toBe(titik[1].x);
      expect(Math.abs(titik[1].y - titik[0].y)).toBe(12);
    }
  });

  it('panah siku terakhir (ansoff→mckinsey-3-horizons) duduk di batang ≥6px', () => {
    const edge = layout.edges.find(
      (e) => e.dari === 'ansoff' && e.ke === 'mckinsey-3-horizons',
    )!;
    const titik = uraianTitik(edge.d);
    const terakhir = Math.hypot(
      titik[titik.length - 1].x - titik[titik.length - 2].x,
      titik[titik.length - 1].y - titik[titik.length - 2].y,
    );
    // Ambang 6px menjaga segmen terakhir bukan stub kecil; marker normal
    // (14px, 11,2px di belakang endpoint) menjorok melewati sudut,
    // tetapi cek visual putaran 2 memastikan tampilannya benar.
    expect(terakhir).toBeGreaterThanOrEqual(6);
  });

  it('edge satu kolom kolom G lewat gutter kiri, bukan margin kanan', () => {
    const aida = layout.nodes.find((n) => n.id === 'aida')!;
    const edge = layout.edges.find(
      (e) => e.dari === 'balanced-scorecard' && e.ke === 'aida',
    )!;
    const titik = uraianTitik(edge.d);
    // Keluar tepi kiri balanced-scorecard, masuk tepi kiri AIDA.
    expect(titik[0].x).toBe(936);
    expect(titik[titik.length - 1].x).toBe(aida.x);
    // Run vertikal di celah F-G (920..936), bukan di margin kanan
    // (tepi kanan kartu G = 1072).
    expect(titik[1].x).toBeGreaterThanOrEqual(920);
    expect(titik[1].x).toBeLessThanOrEqual(936);
    expect(titik[1].x).toBe(titik[2].x);
  });

  it('tidak ada waypoint di margin luar viewBox (semua di dalam kotak node 24..1072 / 40..416)', () => {
    for (const e of layout.edges) {
      for (const t of uraianTitik(e.d)) {
        expect(t.x, `${e.dari}→${e.ke} x=${t.x}`).toBeGreaterThanOrEqual(24);
        expect(t.x, `${e.dari}→${e.ke} x=${t.x}`).toBeLessThanOrEqual(1072);
        expect(t.y, `${e.dari}→${e.ke} y=${t.y}`).toBeGreaterThanOrEqual(40);
        expect(t.y, `${e.dari}→${e.ke} y=${t.y}`).toBeLessThanOrEqual(416);
      }
    }
  });

  it('segmen pertama/terakhir tidak berbalik arah dan ≥2,9px; segmen terakhir panah ≥5,9px', () => {
    // Batas geometri: stub horizontal nominal 8px (gutter 16px)
    // dikurangi offset lajur tetangga (maksimal 5px) = minimal 3px;
    // stub vertikal maksimal 10px (celah 14px). Segmen terakhir panah
    // memakai lajur ekstrem berpreferensi (≥ ±3,33px, grid minimal 3),
    // jadi aktualnya ≥ 9,33px (stub nominal 6px + 3,33px); ambang 5,9px
    // di sini adalah jaring pengaman, bukan nilai aktual.
    for (const e of layout.edges) {
      const t = uraianTitik(e.d);
      const pertama = Math.hypot(t[1].x - t[0].x, t[1].y - t[0].y);
      const terakhir = Math.hypot(
        t[t.length - 1].x - t[t.length - 2].x,
        t[t.length - 1].y - t[t.length - 2].y,
      );
      expect(pertama, `${e.dari}→${e.ke} segmen pertama`).toBeGreaterThanOrEqual(2.9);
      expect(terakhir, `${e.dari}→${e.ke} segmen terakhir`).toBeGreaterThanOrEqual(2.9);
      if (e.panah) {
        expect(terakhir, `${e.dari}→${e.ke} segmen terakhir panah`).toBeGreaterThanOrEqual(5.9);
      }
    }
  });

  it('semua lajur di band tengah gutter (offset ≤5px sumbu x, ≤4px sumbu y)', () => {
    // Tengah gutter antar kolom: 168+152k; tengah node: 92+152k.
    const pusatX = [...Array(6)].map((_, k) => 168 + 152 * k)
      .concat([...Array(7)].map((_, k) => 92 + 152 * k));
    // Tengah baris: 72+78r; tengah celah baris: 111+78r.
    const pusatY = [...Array(5)].map((_, r) => 72 + 78 * r)
      .concat([...Array(4)].map((_, r) => 111 + 78 * r));
    for (const e of layout.edges) {
      const t = uraianTitik(e.d);
      for (let i = 1; i < t.length; i++) {
        if (t[i].x === t[i - 1].x) {
          const jarak = Math.min(...pusatX.map((c) => Math.abs(t[i].x - c)));
          expect(jarak, `${e.dari}→${e.ke} run vertikal x=${t[i].x}`).toBeLessThanOrEqual(5.01);
        } else {
          const jarak = Math.min(...pusatY.map((c) => Math.abs(t[i].y - c)));
          expect(jarak, `${e.dari}→${e.ke} run horizontal y=${t[i].y}`).toBeLessThanOrEqual(4.01);
        }
      }
    }
  });
});

describe('hitungLayout: putaran 3 (lajur per segmen, marker kecil)', () => {
  // Segmen axis-aligned hasil uraian path `d` (geometri akhir).
  interface SegmenAkhir {
    edge: string;
    vertikal: boolean;
    tetap: number;
    awal: number;
    akhir: number;
  }

  function segmenLayout(): SegmenAkhir[] {
    const hasil: SegmenAkhir[] = [];
    for (const e of layout.edges) {
      const t = uraianTitik(e.d);
      for (let i = 1; i < t.length; i++) {
        const a = t[i - 1];
        const b = t[i];
        if (a.x === b.x) {
          hasil.push({
            edge: `${e.dari}→${e.ke}`,
            vertikal: true,
            tetap: a.x,
            awal: Math.min(a.y, b.y),
            akhir: Math.max(a.y, b.y),
          });
        } else {
          hasil.push({
            edge: `${e.dari}→${e.ke}`,
            vertikal: false,
            tetap: a.y,
            awal: Math.min(a.x, b.x),
            akhir: Math.max(a.x, b.x),
          });
        }
      }
    }
    return hasil;
  }

  // Tengah gutter antar kolom (168+152k) dan tengah node (92+152k);
  // tengah baris (72+78r) dan tengah celah baris (111+78r).
  const PUSAT_X = [...Array(6)]
    .map((_, k) => 168 + 152 * k)
    .concat([...Array(7)].map((_, k) => 92 + 152 * k));
  const PUSAT_Y = [...Array(5)]
    .map((_, r) => 72 + 78 * r)
    .concat([...Array(4)].map((_, r) => 111 + 78 * r));

  function grupGutter(): Map<string, SegmenAkhir[]> {
    const grup = new Map<string, SegmenAkhir[]>();
    for (const s of segmenLayout()) {
      const pusat = s.vertikal ? PUSAT_X : PUSAT_Y;
      const tengah = pusat.reduce((a, b) =>
        Math.abs(s.tetap - a) < Math.abs(s.tetap - b) ? a : b,
      );
      const k = `${s.vertikal ? 'x' : 'y'}:${tengah}`;
      const daftar = grup.get(k) ?? [];
      daftar.push(s);
      grup.set(k, daftar);
    }
    return grup;
  }

  it('tidak ada dua segmen yang berimpit di gutter yang sama', () => {
    // Dua segmen segaris yang tumpang tindih (>0px) harus berada di
    // lajur berbeda (jarak >0,5px; jarak lajur terkecil pada data nyata
    // adalah 3,33px — langkah lajur seragam, kecuali grid yang dibatasi
    // span maksimum).
    let pasangan = 0;
    for (const [k, daftar] of grupGutter()) {
      for (let i = 0; i < daftar.length; i++) {
        for (let j = i + 1; j < daftar.length; j++) {
          const a = daftar[i];
          const b = daftar[j];
          const tumpang =
            Math.min(a.akhir, b.akhir) - Math.max(a.awal, b.awal);
          if (tumpang <= 0) continue;
          pasangan++;
          expect(
            Math.abs(a.tetap - b.tetap),
            `gutter ${k}: ${a.edge} dan ${b.edge} berimpit (${tumpang.toFixed(2)}px)`,
          ).toBeGreaterThan(0.5);
        }
      }
    }
    // Sanity: ada pasangan yang tumpang tindih untuk diuji.
    expect(pasangan).toBeGreaterThan(10);
  });

  it('pewarnaan dua-pass: lajur A-B 4, E-F 3, F-G 2 (optimal)', () => {
    // Pass 1 (interval diperlebar ±5px) membuat lajur yang sebenarnya
    // tidak perlu. Pass 2 mengukur ulang dari geometri final tanpa
    // perluasan; jumlah lajur kini sama dengan kedalaman tumpang
    // tindih akhir (tidak bisa kurang lagi tanpa mengubah rute).
    const grup = grupGutter();
    const lajur = (k: string): number[] => {
      const daftar = grup.get(k);
      expect(daftar, `gutter ${k} tidak ditemukan`).toBeDefined();
      return [...new Set(daftar!.map((s) => s.tetap))].sort((a, b) => a - b);
    };
    const ab = lajur('x:168');
    const ef = lajur('x:776');
    const fg = lajur('x:928');
    expect(ab).toHaveLength(4);
    expect(ef).toHaveLength(3);
    expect(fg).toHaveLength(2);
    // Jarak antar lajur A-B kini 3,33px (sebelumnya 2px pada gutter 12px).
    for (let i = 1; i < ab.length; i++) {
      expect(ab[i] - ab[i - 1]).toBeGreaterThanOrEqual(3.3);
    }
  });

  it('lajur berpasangan mengelompok di tengah gutter (±1,7px untuk 2 segmen)', () => {
    // Gutter berpreferensi panah memakai grid lebih lebar (C-D: 1 segmen
    // di -3,33px), jadi tes ini hanya berlaku untuk gutter dengan tepat
    // 2 segmen — tidak ada gutter 2-segmen berpreferensi pada data nyata.
    let grupDua = 0;
    for (const [k, daftar] of grupGutter()) {
      if (daftar.length !== 2) continue;
      grupDua++;
      const tengah = Number(k.split(':')[1]);
      for (const s of daftar) {
        expect(
          Math.abs(s.tetap - tengah),
          `gutter ${k}: ${s.edge} di ${s.tetap}`,
        ).toBeLessThanOrEqual(1.7);
      }
    }
    expect(grupDua).toBeGreaterThan(0);
  });

  it('panah pendek memakai marker kecil dengan batang terlihat ≥3px', () => {
    const pendek: [string, string][] = [
      ['pestel', 'porter-5f'],
      ['value-chain', 'vrio'],
      ['vrio', 'core-competencies'],
      ['lewin', 'kotter-8-step'],
      ['balanced-scorecard', 'okrs'],
    ];
    expect(layout.edges.filter((e) => e.panahKecil)).toHaveLength(5);
    for (const [dari, ke] of pendek) {
      const edge = layout.edges.find(
        (e) => e.dari === dari && e.ke === ke && e.panah,
      )!;
      expect(edge.panahKecil, `${dari}→${ke}`).toBe(true);
      const t = uraianTitik(edge.d);
      const panjang = t.reduce((total, p, i) => {
        if (i === 0) return 0;
        return total + Math.abs(p.x - t[i - 1].x) + Math.abs(p.y - t[i - 1].y);
      }, 0);
      // Batang yang terlihat = panjang path dikurangi segitiga marker
      // kecil di belakang endpoint (6,4px).
      expect(
        panjang - PANJANG_MARKER_PANAH_KECIL,
        `${dari}→${ke}: panjang ${panjang}`,
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it('panah panjang tetap memakai marker normal', () => {
    const edge = layout.edges.find(
      (e) => e.dari === 'ansoff' && e.ke === 'mckinsey-3-horizons',
    )!;
    expect(edge.panah).toBe(true);
    expect(edge.panahKecil).toBe(false);
    for (const e of layout.edges) {
      if (!e.panah) expect(e.panahKecil, `${e.dari}→${e.ke}`).toBe(false);
    }
  });
});

describe('hitungLayout: routing fixture', () => {
  // Kolom A 3 node, kolom B 1 node (hanya baris 0), kolom C 3 node.
  const fw = [
    buatFramework({ id: 'a0', nama: 'A0', tema: 'A', urutan_katalog: 1 }),
    buatFramework({ id: 'a1', nama: 'A1', tema: 'A', urutan_katalog: 2 }),
    buatFramework({ id: 'a2', nama: 'A2', tema: 'A', urutan_katalog: 3 }),
    buatFramework({ id: 'b0', nama: 'B0', tema: 'B', urutan_katalog: 4 }),
    buatFramework({ id: 'c0', nama: 'C0', tema: 'C', urutan_katalog: 5 }),
    buatFramework({ id: 'c1', nama: 'C1', tema: 'C', urutan_katalog: 6 }),
    buatFramework({ id: 'c2', nama: 'C2', tema: 'C', urutan_katalog: 7 }),
  ];

  it('edge sebaris tanpa node antara lurus tepi-ke-tepi (a2→c2)', () => {
    const hasil = hitungLayout(fw, [
      { dari: 'a2', ke: 'c2', tipe: 'dipakai_bersama', alasan: null },
    ]);
    expect(hasil.edges).toHaveLength(1);
    const titik = uraianTitik(hasil.edges[0].d);
    expect(titik).toHaveLength(2);
    expect(titik[0].y).toBe(titik[1].y);
  });

  it('edge sebaris dengan node antara memakai siku, bukan lurus (a0→c0)', () => {
    const hasil = hitungLayout(fw, [
      { dari: 'a0', ke: 'c0', tipe: 'dipakai_bersama', alasan: null },
    ]);
    const titik = uraianTitik(hasil.edges[0].d);
    expect(titik.length).toBeGreaterThan(2);
  });

  it('edge paralel satu kolom terpisah di gutter (dua edge a0→a1)', () => {
    const hasil = hitungLayout(fw, [
      { dari: 'a0', ke: 'a1', tipe: 'prasyarat', alasan: null },
      { dari: 'a0', ke: 'a1', tipe: 'satu_tema', alasan: null },
    ]);
    expect(hasil.edges).toHaveLength(2);
    const [d1, d2] = hasil.edges.map((e) => uraianTitik(e.d));
    // Baris bersebelahan: garis lurus vertikal 2 titik lewat celah
    // baris; kedua edge terpisah di x oleh lajur berbeda, dan titik
    // akhir panah berhenti 2px sebelum tepi (jadi y-nya berbeda).
    expect(d1).toHaveLength(2);
    expect(d2).toHaveLength(2);
    expect(d1[1].x).not.toBe(d2[1].x);
    expect(d1[1].y).not.toBe(d2[1].y);
  });

  it('property test juga berlaku untuk fixture', () => {
    const hasil = hitungLayout(fw, [
      { dari: 'a2', ke: 'c2', tipe: 'dipakai_bersama', alasan: null },
      { dari: 'a0', ke: 'c0', tipe: 'kontras', alasan: null },
      { dari: 'a0', ke: 'a1', tipe: 'prasyarat', alasan: null },
      { dari: 'a0', ke: 'a1', tipe: 'satu_tema', alasan: null },
      { dari: 'b0', ke: 'c2', tipe: 'prasyarat', alasan: null },
    ]);
    for (const e of hasil.edges) {
      const ujung = new Set([e.dari, e.ke]);
      const pelanggaran: string[] = [];
      for (const p of samplingPath(e.d)) {
        for (const n of hasil.nodes) {
          if (ujung.has(n.id)) continue;
          if (
            p.x > n.x + 1 &&
            p.x < n.x + n.lebar - 1 &&
            p.y > n.y + 1 &&
            p.y < n.y + n.tinggi - 1
          ) {
            pelanggaran.push(`(${p.x.toFixed(1)}, ${p.y.toFixed(1)}) di ${n.id}`);
          }
        }
      }
      expect(pelanggaran.slice(0, 5)).toEqual([]);
    }
  });
});

describe('label node', () => {
  it('labelNode memakai nama pendek bila ada', () => {
    expect(labelNode(buatFramework({ id: 'pestel' }))).toBe('PESTEL');
    expect(labelNode(buatFramework({ id: 'kotter-8-step' }))).toBe('Kotter 8-Step');
  });

  it('labelNode memakai nama penuh bila id tidak dikenal', () => {
    expect(
      labelNode(buatFramework({ id: 'baru', nama: 'Framework Baru' })),
    ).toBe('Framework Baru');
  });

  it('bungkusLabel membagi label panjang di batas kata (maks 2 baris)', () => {
    expect(bungkusLabel('Business Model Canvas')).toEqual([
      'Business Model',
      'Canvas',
    ]);
    expect(bungkusLabel('Porter 5 Forces')).toEqual(['Porter 5 Forces']);
    expect(bungkusLabel('Kanban')).toEqual(['Kanban']);
  });

  it('label 17–18 karakter tetap satu baris (muat di kotak 136px)', () => {
    expect(bungkusLabel('Core Competencies')).toEqual(['Core Competencies']);
    expect(bungkusLabel('Balanced Scorecard')).toEqual(['Balanced Scorecard']);
  });

  it('setiap label node hasil layout muat di kotaknya (≤2 baris)', () => {
    for (const n of layout.nodes) {
      expect(n.label.length).toBeLessThanOrEqual(2);
      for (const baris of n.label) {
        expect(baris.length).toBeLessThanOrEqual(18);
      }
      expect(n.lebar).toBe(LEBAR_NODE);
      expect(n.tinggi).toBe(TINGGI_NODE);
    }
  });
});

describe('tetangga: tetangga lewat semua tipe edge', () => {
  it('tetangga dua arah, semua tipe (vrio: value-chain + core-competencies)', () => {
    expect([...tetangga(graph.edges, 'vrio')].sort()).toEqual([
      'core-competencies',
      'value-chain',
    ]);
  });

  it('tetangga pestel: porter-5f + ansoff (prasyarat dan satu_tema)', () => {
    expect([...tetangga(graph.edges, 'pestel')].sort()).toEqual([
      'ansoff',
      'porter-5f',
    ]);
  });

  it('node tanpa edge tidak punya tetangga', () => {
    expect(tetangga([], 'pestel').size).toBe(0);
    expect(
      tetangga([{ dari: 'a', ke: 'b', tipe: 'satu_tema' }], 'pestel').size,
    ).toBe(0);
  });
});

describe('jalurPrasyarat: transitive closure prasyarat', () => {
  it('rantai transitif dua arah (data nyata: value-chain → vrio → core-competencies)', () => {
    expect(jalurPrasyarat(graph.edges, 'core-competencies')).toEqual({
      sebelum: new Set(['vrio', 'value-chain']),
      sesudah: new Set(),
    });
    expect(jalurPrasyarat(graph.edges, 'value-chain')).toEqual({
      sebelum: new Set(),
      sesudah: new Set(['vrio', 'core-competencies']),
    });
    expect(jalurPrasyarat(graph.edges, 'vrio')).toEqual({
      sebelum: new Set(['value-chain']),
      sesudah: new Set(['core-competencies']),
    });
  });

  it('rantai satu langkah (pestel → porter-5f)', () => {
    expect(jalurPrasyarat(graph.edges, 'pestel')).toEqual({
      sebelum: new Set(),
      sesudah: new Set(['porter-5f']),
    });
    expect(jalurPrasyarat(graph.edges, 'porter-5f')).toEqual({
      sebelum: new Set(['pestel']),
      sesudah: new Set(),
    });
  });

  it('hanya edge prasyarat yang diikuti, tipe lain diabaikan', () => {
    const edges = [
      { dari: 'a', ke: 'b', tipe: 'satu_tema' },
      { dari: 'a', ke: 'c', tipe: 'prasyarat' },
      { dari: 'c', ke: 'd', tipe: 'dipakai_bersama' },
    ] as const;
    expect(jalurPrasyarat(edges, 'a')).toEqual({
      sebelum: new Set(),
      sesudah: new Set(['c']),
    });
  });

  it('tahan siklus: a → b → c → a + a → d berhenti dan lengkap', () => {
    const edges = [
      { dari: 'a', ke: 'b', tipe: 'prasyarat' },
      { dari: 'b', ke: 'c', tipe: 'prasyarat' },
      { dari: 'c', ke: 'a', tipe: 'prasyarat' },
      { dari: 'a', ke: 'd', tipe: 'prasyarat' },
    ] as const;
    expect(jalurPrasyarat(edges, 'a')).toEqual({
      sebelum: new Set(['b', 'c']),
      sesudah: new Set(['b', 'c', 'd']),
    });
    // Node awal tidak pernah masuk himpunannya sendiri.
    expect(jalurPrasyarat(edges, 'a').sebelum.has('a')).toBe(false);
    expect(jalurPrasyarat(edges, 'a').sesudah.has('a')).toBe(false);
  });

  it('node yang tidak ada di graph: kedua himpunan kosong', () => {
    expect(jalurPrasyarat(graph.edges, 'tidak-ada')).toEqual({
      sebelum: new Set(),
      sesudah: new Set(),
    });
  });
});

describe('keadaanPeta: sorot, redup, mode jalur', () => {
  it('tanpa hover/pilihan: semua himpunan kosong', () => {
    expect(keadaanPeta(layout, null, null, false)).toEqual({
      sorot: new Set(),
      redup: new Set(),
      sembunyi: new Set(),
      edgeTerkait: new Set(),
      edgeRedup: new Set(),
      edgeSembunyi: new Set(),
    });
  });

  it('hover saja: sorot fokus + tetangga, tanpa redup', () => {
    const k = keadaanPeta(layout, 'vrio', null, false);
    expect(k.sorot).toEqual(
      new Set(['vrio', 'value-chain', 'core-competencies']),
    );
    // 4 edge insiden vrio (2 prasyarat + 2 satu_tema paralel).
    expect(k.edgeTerkait.size).toBe(4);
    expect(k.redup.size).toBe(0);
    expect(k.edgeRedup.size).toBe(0);
    expect(k.sembunyi.size).toBe(0);
    expect(k.edgeSembunyi.size).toBe(0);
  });

  it('pilihan saja: yang tidak terkait meredup', () => {
    const k = keadaanPeta(layout, null, 'vrio', false);
    expect(k.sorot).toEqual(
      new Set(['vrio', 'value-chain', 'core-competencies']),
    );
    expect(k.edgeTerkait.size).toBe(4);
    // 22 node − 3 terkait = 19 meredup; 35 edge − 4 insiden = 31 meredup.
    expect(k.redup.size).toBe(19);
    expect(k.edgeRedup.size).toBe(31);
    expect(k.sembunyi.size).toBe(0);
    expect(k.edgeSembunyi.size).toBe(0);
  });

  it('hover mengalahkan pilihan untuk sorot, redup tetap mengikuti pilihan', () => {
    const k = keadaanPeta(layout, 'pestel', 'vrio', false);
    expect(k.sorot).toEqual(new Set(['pestel', 'porter-5f', 'ansoff']));
    // Sorot (3) tidak meredup meski bukan tetangga pilihan: 22 − 3 − 3 = 16.
    expect(k.redup.size).toBe(16);
    // Edge terkait mengikuti hover (3 edge pestel); edge redup 35 − 4 − 3 = 28.
    expect(k.edgeTerkait.size).toBe(3);
    expect(k.edgeRedup.size).toBe(28);
  });

  it('mode jalur: hanya closure prasyarat yang tampil', () => {
    const k = keadaanPeta(layout, null, 'core-competencies', true);
    // Tampil: core-competencies + vrio + value-chain; 19 node disembunyikan.
    expect(k.sembunyi.size).toBe(19);
    expect(k.sembunyi.has('core-competencies')).toBe(false);
    expect(k.sembunyi.has('vrio')).toBe(false);
    expect(k.sembunyi.has('value-chain')).toBe(false);
    // Tampil hanya 2 edge prasyarat antar node closure; 33 disembunyikan.
    expect(k.edgeSembunyi.size).toBe(33);
    // Mode jalur tidak meredupkan (yang tidak tampil disembunyikan).
    expect(k.redup.size).toBe(0);
    expect(k.edgeRedup.size).toBe(0);
  });

  it('mode jalur tanpa pilihan: tidak ada yang disembunyikan', () => {
    const k = keadaanPeta(layout, null, null, true);
    expect(k.sembunyi.size).toBe(0);
    expect(k.edgeSembunyi.size).toBe(0);
  });
});
