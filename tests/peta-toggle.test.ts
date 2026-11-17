/**
 * Uji toggle satu_tema di komponen Peta: render server-side (tanpa DOM)
 * dengan useLiveQuery yang di-mock mengembalikan data graph.json, dan
 * store yang dihidrasi dari localStorage tiruan (pola store.test.ts).
 * Tanpa testing-library di repo ini, renderToString + mock adalah cara
 * menguji render sebenarnya (bukan hanya state memuat seperti
 * peta-interaksi.test.ts).
 *
 * Yang diuji: default sembunyi saat pertama dibuka; toggle mengubah
 * render (edge satu_tema hilang/muncul); baris legenda meredup saat
 * sembunyi; hitungan relasi benar di kedua state; pilihan persist
 * antar reload (store segar membaca localStorage).
 */
import 'fake-indexeddb/auto';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { GraphData } from '../src/domain';

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: vi.fn(),
}));

const DIR_TEST = dirname(fileURLToPath(import.meta.url));
const graph = JSON.parse(
  readFileSync(join(DIR_TEST, '../public/data/graph.json'), 'utf-8'),
) as GraphData;

function buatLocalStorage(isi: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(isi));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
    removeItem: (k: string) => {
      data.delete(k);
    },
    clear: () => {
      data.clear();
    },
    key: (i: number) => [...data.keys()][i] ?? null,
    get length() {
      return data.size;
    },
  } as Storage;
}

/**
 * Render GraphSvg segar (modul di-reset, store membaca localStorage
 * tiruan ini). useLiveQuery di-mock mengembalikan data graph.json:
 * panggilan pertama frameworks, kedua edges (urutan hook di komponen).
 */
async function renderPeta(
  isiLocalStorage: Record<string, string> = {},
): Promise<string> {
  vi.resetModules();
  vi.stubGlobal('localStorage', buatLocalStorage(isiLocalStorage));
  const { useLiveQuery } = await import('dexie-react-hooks');
  (useLiveQuery as unknown as Mock)
    .mockImplementationOnce(() => graph.nodes)
    .mockImplementationOnce(() => graph.edges);
  const { GraphSvg } = await import('../src/components/GraphSvg');
  return renderToString(createElement(GraphSvg));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

/** Jumlah <path> edge satu_tema (stroke abu-garis; legenda memakai <line>). */
function hitungPathSatuTema(html: string): number {
  return (html.match(/<path[^>]*stroke="var\(--abu-garis\)"/g) ?? []).length;
}

/** Jumlah semua <path> (edge + 2 marker panah). */
function hitungSemuaPath(html: string): number {
  return (html.match(/<path /g) ?? []).length;
}

describe('GraphSvg: toggle satu_tema', () => {
  it('default sembunyi saat pertama dibuka (localStorage kosong)', async () => {
    const h = await renderPeta();
    expect(h).toContain('Tampilkan relasi satu tema');
    expect(hitungPathSatuTema(h)).toBe(0);
    // 20 edge terlihat + 2 marker panah.
    expect(hitungSemuaPath(h)).toBe(22);
    expect(h).toContain('peta-legenda-redup');
    expect(h).toContain('20 relasi');
    expect(h).toContain('15 relasi satu tema disembunyikan');
    // Checkbox tidak tercentang.
    expect(h).not.toContain('checked');
  });

  it('menampilkan edge satu_tema bila pilihan tersimpan true (persist antar reload)', async () => {
    const html = await renderPeta({
      'padi-store': JSON.stringify({
        state: { tampilkanSatuTema: true },
        version: 0,
      }),
    });
    expect(hitungPathSatuTema(html)).toBe(15);
    // 35 edge terlihat + 2 marker panah.
    expect(hitungSemuaPath(html)).toBe(37);
    expect(html).not.toContain('peta-legenda-redup');
    expect(html).toContain('35 relasi');
    expect(html).not.toContain('disembunyikan');
    // Checkbox tercentang.
    expect(html).toContain('checked=""');
  });

  it('checkbox dan label tampil di kedua state', async () => {
    const isiState: Record<string, string>[] = [
      {},
      {
        'padi-store': JSON.stringify({
          state: { tampilkanSatuTema: true },
          version: 0,
        }),
      },
    ];
    for (const isi of isiState) {
      const html = await renderPeta(isi);
      expect(html).toContain('peta-toggle');
      expect(html).toContain('Tampilkan relasi satu tema');
      expect(html).toContain('type="checkbox"');
    }
  });
});
