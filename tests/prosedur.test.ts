/**
 * Uji pecahLangkahProsedur: pemecah teks prosedur "1) ... 2) ..." menjadi
 * daftar langkah untuk <ol> di FrameworkDetail.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pecahLangkahProsedur } from '../src/prosedur';
import type { GraphData } from '../src/domain';

const DIR_TEST = dirname(fileURLToPath(import.meta.url));
const graph = JSON.parse(
  readFileSync(join(DIR_TEST, '../public/data/graph.json'), 'utf-8'),
) as GraphData;

describe('pecahLangkahProsedur', () => {
  it('memecah prosedur berurutan menjadi langkah tanpa penanda angka', () => {
    expect(pecahLangkahProsedur('1) Pertama. 2) Kedua. 3) Ketiga.')).toEqual([
      'Pertama.',
      'Kedua.',
      'Ketiga.',
    ]);
  });

  it('mengabaikan angka di dalam isi langkah (kasus VRIO)', () => {
    const vrio = graph.nodes.find((n) => n.id === 'vrio');
    expect(vrio).toBeDefined();
    const langkah = pecahLangkahProsedur(vrio?.lapis_b_prosedur ?? '');
    expect(langkah?.length).toBe(6);
    expect(langkah?.[0]).toContain('Pilih satu sumber daya');
    // "(lolos 4)" di dalam langkah 6 bukan penanda langkah baru.
    expect(langkah?.[5]).toContain('(lolos 4)');
  });

  it('mengurai semua 22 prosedur di graph.json menjadi >=2 langkah', () => {
    for (const node of graph.nodes) {
      const langkah = pecahLangkahProsedur(node.lapis_b_prosedur);
      expect(langkah, node.id).not.toBeNull();
      expect(langkah?.length, node.id).toBeGreaterThanOrEqual(2);
    }
  });

  it('kembalikan null bila teks bukan prosedur bernomor', () => {
    expect(pecahLangkahProsedur('Lapis b.')).toBeNull();
    expect(pecahLangkahProsedur('1) Hanya satu langkah.')).toBeNull();
    expect(pecahLangkahProsedur('')).toBeNull();
  });
});
