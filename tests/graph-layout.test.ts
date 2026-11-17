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
  LEBAR_NODE,
  TINGGI_NODE,
  bungkusLabel,
  hitungLayout,
  labelNode,
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
      // Awal: di salah satu tepi vertikal kotak sumber.
      expect(
        awal.x === dari.x || awal.x === dari.x + dari.lebar,
        `${e.dari}→${e.ke}: awal x=${awal.x}`,
      ).toBe(true);
      expect(awal.y).toBeGreaterThanOrEqual(dari.y);
      expect(awal.y).toBeLessThanOrEqual(dari.y + dari.tinggi);
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
    // Segmen vertikal berada di gutter kanan kolom A (158..170).
    expect(titik[1].x).toBeGreaterThan(158);
    expect(titik[1].x).toBeLessThan(170);
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
    // Segmen vertikal (waypoint ke-2) berada di x berbeda.
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
