/**
 * Uji render server-side (tanpa DOM) untuk alur masuk baru 20 Nov 2026:
 * Beranda tanpa masalah aktif menampilkan form entri tertanam (bukan
 * kartu jalan buntu), dan Onboarding tidak lagi mewajibkan centang
 * kriteria manual (CTA aktif begitu teks terisi; kriteria ditebak
 * otomatis + akordeon opsional tertutup default). Pola mock sama
 * seperti dogfood-ui.test.ts / desain-contoh.test.ts: useLiveQuery
 * di-mock mengembalikan nilai per urutan pemanggilan hook, store
 * dihidrasi dari localStorage tiruan. Interaksi (ketik, klik simpan,
 * perpindahan Beranda setelah simpan) tidak bisa diuji lewat
 * renderToString — diverifikasi snapshot + cek live.
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

vi.mock('@formkit/auto-animate/react', () => ({
  useAutoAnimate: () => [() => {}],
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

async function mockQuery(nilai: unknown[]): Promise<void> {
  const { useLiveQuery } = await import('dexie-react-hooks');
  const mock = useLiveQuery as unknown as Mock;
  for (const n of nilai) {
    mock.mockImplementationOnce(() => n);
  }
}

function resetDenganStorage(isi: Record<string, string> = {}): void {
  vi.resetModules();
  vi.stubGlobal('localStorage', buatLocalStorage(isi));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

/** renderToString menyisipkan `<!-- -->` di batas ekspresi JSX; hapus. */
function bersih(html: string): string {
  return html.replaceAll('<!-- -->', '');
}

describe('Home tanpa masalah aktif: form entri tertanam', () => {
  async function render(): Promise<string> {
    resetDenganStorage();
    await mockQuery([
      graph.nodes, // Home: frameworks
      [], // Home: semuaMasalah (kosong → cabang tertanam)
      [], // Home: pemakaian
      [], // Home: jadwal
      [], // Home: sesiHariIni
      [], // Home: draft
      graph.nodes, // Onboarding tertanam: frameworks
      [], // Onboarding tertanam: pemakaian
    ]);
    const { Home } = await import('../src/components/Home');
    return bersih(renderToString(createElement(Home)));
  }

  it('menampilkan form masalah, bukan kartu "Belum ada masalah aktif"', async () => {
    const html = await render();
    expect(html).toContain('Masalah apa yang sedang kamu hadapi?');
    expect(html).not.toContain('Belum ada masalah aktif');
    expect(html).not.toContain('Mulai dari masalahmu');
  });

  it('judul form memakai h2 (h1 Beranda sudah dipakai sapaan)', async () => {
    const html = await render();
    expect(html).toContain('<h2>Masalah apa yang sedang kamu hadapi?</h2>');
  });

  it('CTA "Cari Framework" ada dan nonaktif saat textarea masih kosong', async () => {
    const html = await render();
    expect(html).toContain('Cari Framework');
    expect(html).not.toContain('Lihat framework yang cocok');
    expect(html).toContain('disabled');
  });

  it('tidak ada indikator langkah dan tidak ada Lewati di mode tertanam', async () => {
    const html = await render();
    expect(html).not.toContain('Langkah 1 dari 2');
    expect(html).not.toContain('Lewati');
  });
});

describe('Onboarding standalone: teks satu-satunya syarat', () => {
  async function render(props: { ulang?: boolean } = {}): Promise<string> {
    resetDenganStorage();
    await mockQuery([
      graph.nodes, // frameworks
      [], // pemakaian
    ]);
    const { Onboarding } = await import('../src/components/Onboarding');
    return bersih(renderToString(createElement(Onboarding, props)));
  }

  it('CTA "Cari Framework", tanpa gate "Pilih minimal satu"', async () => {
    const html = await render();
    expect(html).toContain('Cari Framework');
    expect(html).not.toContain('Lihat framework yang cocok');
    expect(html).not.toContain('Pilih minimal satu');
  });

  it('kriteria pindah ke akordeon tertutup default', async () => {
    const html = await render();
    expect(html).toContain('<details class="akordeon-utilitas">');
    expect(html).toContain('Kriteria tambahan (opsional)');
    expect(html).not.toContain('<details class="akordeon-utilitas" open');
  });

  it('textarea memakai kelas scratchpad', async () => {
    const html = await render();
    expect(html).toContain('class="scratchpad"');
  });

  it('mode biasa: judul h1 + indikator langkah + Lewati', async () => {
    const html = await render();
    expect(html).toContain('<h1>Masalah apa yang sedang kamu hadapi?</h1>');
    expect(html).toContain('Langkah 1 dari 2: masalahmu');
    expect(html).toContain('Lewati');
  });

  it('mode ulang: Batalkan, tanpa Lewati', async () => {
    const html = await render({ ulang: true });
    expect(html).toContain('Batalkan');
    expect(html).not.toContain('Lewati');
  });
});
