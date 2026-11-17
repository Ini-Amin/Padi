/**
 * Uji kelengkapan konten graph.json (dokumen 07 §3.1).
 * Fase 0 selesai: graph lengkap 22 framework / 35 edge (dokumen 03 §5).
 * Uji ini memvalidasi SEMUA node memenuhi kontrak konten.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { GraphData } from '../src/domain';
import { POLA_KE_KRITERIA } from '../src/matcher';

const DIR_TEST = dirname(fileURLToPath(import.meta.url));
const graph = JSON.parse(
  readFileSync(join(DIR_TEST, '../public/data/graph.json'), 'utf-8'),
) as GraphData;

const TEMA_VALID = new Set(['A', 'B', 'C', 'D', 'E', 'F', 'G']);

describe('graph.json: node seed', () => {
  it('memiliki 22 framework lengkap (Fase 0, dokumen 03 §5)', () => {
    expect(graph.nodes.map((n) => n.id).sort()).toEqual([
      'adkar',
      'agile-scrum',
      'aida',
      'ansoff',
      'balanced-scorecard',
      'bcg',
      'blue-ocean',
      'bmc',
      'core-competencies',
      'design-thinking',
      'dmaic',
      'kanban',
      'kotter-8-step',
      'lean-startup',
      'lewin',
      'mckinsey-3-horizons',
      'mckinsey-7s',
      'okrs',
      'pestel',
      'porter-5f',
      'value-chain',
      'vrio',
    ]);
  });

  it('setiap node punya 2–4 signature masalah', () => {
    for (const n of graph.nodes) {
      expect(n.signature_masalah.length).toBeGreaterThanOrEqual(2);
      expect(n.signature_masalah.length).toBeLessThanOrEqual(4);
    }
  });

  it('setiap pola signature dikenal oleh matcher (ada pemetaan kriterianya)', () => {
    for (const n of graph.nodes) {
      for (const pola of n.signature_masalah) {
        expect(
          POLA_KE_KRITERIA[pola],
          `pola "${pola}" di ${n.id} tidak punya entri POLA_KE_KRITERIA`,
        ).toBeDefined();
        expect(POLA_KE_KRITERIA[pola].length).toBeGreaterThan(0);
      }
    }
  });

  it('setiap node punya tepat 3 ide kunci + ringkasan ≥40 kata + sumber', () => {
    for (const n of graph.nodes) {
      expect(n.ide_kunci).toHaveLength(3);
      for (const ide of n.ide_kunci) expect(ide.trim().length).toBeGreaterThan(0);
      expect(n.ringkasan.split(/\s+/).length).toBeGreaterThanOrEqual(40);
      expect(n.sumber.trim().length).toBeGreaterThan(0);
      expect(n.keterbatasan.trim().length).toBeGreaterThan(0);
    }
  });

  it('ketiga lapis konten terisi (≥2 kalimat tiap lapis)', () => {
    for (const n of graph.nodes) {
      for (const lapis of [n.lapis_a_pemetaan, n.lapis_b_prosedur, n.lapis_c_kesalahan]) {
        expect(lapis.trim().length).toBeGreaterThan(0);
        // Minimal 2 kalimat (ditandai titik diikuti spasi/kalimat berikut).
        expect(lapis.split('.').filter((s) => s.trim().length > 0).length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('tema valid dan urutan_katalog unik', () => {
    const urutan = new Set<number>();
    for (const n of graph.nodes) {
      expect(TEMA_VALID.has(n.tema)).toBe(true);
      expect(urutan.has(n.urutan_katalog)).toBe(false);
      urutan.add(n.urutan_katalog);
    }
  });

  it('status awal semua node adalah belum_dipakai', () => {
    for (const n of graph.nodes) {
      expect(n.status).toBe('belum_dipakai');
      expect(n.diedit_user).toBe(false);
    }
  });
});

describe('graph.json: edge', () => {
  it('memiliki 35 edge (15 satu_tema + 20 lintas-tema terkurasi, dokumen 03 §5)', () => {
    expect(graph.edges).toHaveLength(35);
    const hitung = (tipe: string) =>
      graph.edges.filter((e) => e.tipe === tipe).length;
    expect(hitung('satu_tema')).toBe(15);
    expect(hitung('prasyarat')).toBe(6);
    expect(hitung('kontras')).toBe(4);
    expect(hitung('dipakai_bersama')).toBe(10);
  });

  it('semua edge merujuk node yang ada', () => {
    const ids = new Set(graph.nodes.map((n) => n.id));
    for (const e of graph.edges) {
      expect(ids.has(e.dari)).toBe(true);
      expect(ids.has(e.ke)).toBe(true);
    }
  });

  it('setiap node punya minimal 1 edge', () => {
    const terlibat = new Set<string>();
    for (const e of graph.edges) {
      terlibat.add(e.dari);
      terlibat.add(e.ke);
    }
    for (const n of graph.nodes) {
      expect(terlibat.has(n.id)).toBe(true);
    }
  });

  it('prasyarat/kontras/dipakai_bersama punya alasan; satu_tema alasan null', () => {
    for (const e of graph.edges) {
      if (e.tipe === 'satu_tema') {
        expect(e.alasan).toBeNull();
      } else {
        expect(e.alasan).not.toBeNull();
        expect(e.alasan!.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('edge prasyarat PESTEL → Porter ada (kurasi dokumen 03 §5 #1)', () => {
    expect(
      graph.edges.some(
        (e) => e.dari === 'pestel' && e.ke === 'porter-5f' && e.tipe === 'prasyarat',
      ),
    ).toBe(true);
  });

  it('subgraph prasyarat asiklik (syarat topological sort)', () => {
    const tetangga = new Map<string, string[]>();
    for (const e of graph.edges) {
      if (e.tipe !== 'prasyarat') continue;
      const daftar = tetangga.get(e.dari) ?? [];
      daftar.push(e.ke);
      tetangga.set(e.dari, daftar);
    }
    const WARNA = new Map<string, 'putih' | 'abu' | 'hitam'>();
    const adaSiklus = (node: string): boolean => {
      WARNA.set(node, 'abu');
      for (const ke of tetangga.get(node) ?? []) {
        const warna = WARNA.get(ke) ?? 'putih';
        if (warna === 'abu') return true;
        if (warna === 'putih' && adaSiklus(ke)) return true;
      }
      WARNA.set(node, 'hitam');
      return false;
    };
    for (const n of graph.nodes) {
      if ((WARNA.get(n.id) ?? 'putih') === 'putih') {
        expect(adaSiklus(n.id)).toBe(false);
      }
    }
  });
});
