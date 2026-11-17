/**
 * Uji tata letak graph SVG (M3): modul murni graph-layout.ts.
 * Yang diuji adalah model render (posisi node + path edge) yang dipakai
 * GraphSvg: jumlah node/edge harus sama dengan graph.json, node tidak boleh
 * tumpang tindih, dan edge paralel harus tergambar terpisah.
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

  it('edge satu kolom melengkung (kurva Q), lintas kolom lurus (garis L)', () => {
    const satuKolom = layout.edges.find(
      (e) => e.dari === 'pestel' && e.ke === 'ansoff',
    )!;
    expect(satuKolom.d).toContain('Q');
    const lintasKolom = layout.edges.find(
      (e) => e.dari === 'porter-5f' && e.ke === 'bcg',
    )!;
    expect(lintasKolom.d).toContain('L');
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
