/**
 * Uji render server-side (tanpa DOM) untuk 8 proposal studi contoh desain
 * 18 Nov 2026: sapaan statis + kartu utama Beranda, jump-nav + CTA ganda
 * Detail framework, legenda HTML di bawah Peta, bar progres timer Sesi,
 * dan baris metrik Progres. Pola mock sama seperti dogfood-ui.test.ts:
 * useLiveQuery di-mock mengembalikan nilai per urutan pemanggilan hook,
 * store dihidrasi dari localStorage tiruan. Interaksi (klik lompat, klik
 * CTA) tidak bisa diuji lewat renderToString — diverifikasi snapshot.
 */
import 'fake-indexeddb/auto';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { GraphData, Sesi } from '../src/domain';
import { hariIni } from '../src/dates';
import { buatJadwal, buatMasalah } from './factories';

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
const pestel = graph.nodes.find((n) => n.id === 'pestel');
if (!pestel) throw new Error('PESTEL tidak ada di graph.json');

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

function buatSesi(overrides: Partial<Sesi> = {}): Sesi {
  return {
    id: 'sesi-1',
    framework_id: 'pestel',
    masalah_id: 'masalah-1',
    jenis: 'penerapan',
    tanggal: hariIni(),
    durasi_menit: 1,
    selesai: false,
    skor: null,
    catatan: '',
    artefak_ids: [],
    dimulai_pada_ms: null,
    durasi_target_menit: 45,
    ...overrides,
  };
}

describe('Home: sapaan statis + kartu masalah utama + satu tautan', () => {
  async function render(): Promise<string> {
    resetDenganStorage();
    const masalah1 = buatMasalah({ id: 'masalah-1', judul: 'Masalah pertama' });
    const masalah2 = buatMasalah({ id: 'masalah-2', judul: 'Masalah kedua' });
    // Satu re-use jatuh tempo hari ini supaya kartu "Re-use hari ini"
    // ikut ter-render; tanpa jadwal, kartu admin tidak ada.
    await mockQuery([
      graph.nodes, // frameworks
      [masalah1, masalah2], // semuaMasalah
      [], // pemakaian
      [buatJadwal({ jatuh_tempo: hariIni() })], // jadwal
      [], // sesiHariIni
      [], // draft
    ]);
    const { Home } = await import('../src/components/Home');
    return bersih(renderToString(createElement(Home)));
  }

  it('sapaan berupa h1 statis, tanpa pemecah huruf', async () => {
    const html = await render();
    expect(html).toContain('<h1>Selamat belajar.</h1>');
    expect(html).not.toContain('judul-animasi');
  });

  it('kartu masalah memakai perlakuan terkuat, kartu admin garis saja', async () => {
    const html = await render();
    expect(html).toContain('class="kartu kartu-utama"');
    expect(html).toContain('class="kartu kartu-garis"');
  });

  it('tiga tautan kartu masalah menjadi satu, penjelasan re-use satu kali', async () => {
    const html = await render();
    const tautan = html.match(/Lihat semua masalah \(2\)/g) ?? [];
    expect(tautan.length).toBe(1);
    expect(html).not.toContain('Lihat masalah');
    const penjelasan = html.match(/Re-use: memakai lagi/g) ?? [];
    expect(penjelasan.length).toBe(1);
  });
});

describe('FrameworkDetail: jump-nav + CTA di bawah ringkasan dan di bawah', () => {
  async function render(): Promise<string> {
    resetDenganStorage({
      'padi-store': JSON.stringify({
        state: { masalahAktifId: 'masalah-1' },
        version: 0,
      }),
    });
    const pestelDb = { ...pestel, dikenal_pada: null };
    const nodesDb = graph.nodes.map((n) => ({ ...n, dikenal_pada: null }));
    await mockQuery([
      pestelDb, // framework
      [], // pemakaian
      [], // artefak
      [], // jadwal
      [], // semuaMasalah
      nodesDb, // semuaFramework
      graph.edges, // edges
    ]);
    const { FrameworkDetail } = await import(
      '../src/components/FrameworkDetail'
    );
    return bersih(
      renderToString(createElement(FrameworkDetail, { id: 'pestel' })),
    );
  }

  it('jump-nav di bawah h1 dengan 5 tombol (tanpa Artefak bila kosong)', async () => {
    const html = await render();
    expect(html).toContain('<nav class="lompat-nav"');
    expect(html).toContain('aria-label="Lompat ke bagian"');
    for (const label of ['Pemetaan', 'Prosedur', 'Kesalahan', 'Syarat', 'Terkait']) {
      expect(html).toContain(`>${label}<`);
    }
    expect(html).not.toContain('>Artefak<');
    expect(html.indexOf('<h1>PESTEL Analysis</h1>')).toBeLessThan(
      html.indexOf('<nav class="lompat-nav"'),
    );
  });

  it('setiap tombol jump-nav punya bagian ber-id tujuan', async () => {
    const html = await render();
    for (const id of ['pemetaan', 'prosedur', 'kesalahan', 'syarat', 'terkait']) {
      expect(html).toContain(`id="${id}"`);
    }
  });

  it('CTA Pakai muncul dua kali: di bawah ringkasan dan di bawah halaman', async () => {
    const html = await render();
    const cta = html.match(/Pakai untuk masalah aktif/g) ?? [];
    expect(cta.length).toBe(2);
    expect(html.indexOf('Pakai untuk masalah aktif')).toBeLessThan(
      html.indexOf('id="pemetaan"'),
    );
    expect(html.lastIndexOf('Pakai untuk masalah aktif')).toBeGreaterThan(
      html.indexOf('id="terkait"'),
    );
  });

  it('STATUS strip dan HISTORY daftar, bukan kartu', async () => {
    const html = await render();
    expect(html).toContain('class="strip-status"');
    expect(html).toContain('class="daftar-riwayat"');
  });
});

describe('GraphSvg: legenda HTML di bawah peta, klaim + panduan di atas', () => {
  async function render(): Promise<string> {
    resetDenganStorage();
    await mockQuery([
      graph.nodes, // frameworks
      graph.edges, // edges
    ]);
    const { GraphSvg } = await import('../src/components/GraphSvg');
    return bersih(renderToString(createElement(GraphSvg)));
  }

  it('judul klaim + panduan baca di atas SVG', async () => {
    const html = await render();
    expect(html).toContain('22 framework dalam 7 tema');
    expect(html).toContain('garis tebal = prasyarat');
    expect(html).toContain('class="panduan-peta"');
    expect(html).toContain('Prasyarat = garis tebal hijau berpanah');
    expect(html.indexOf('panduan-peta')).toBeLessThan(html.indexOf('<svg'));
  });

  it('legenda HTML berada SETELAH </svg> (tetap tampil di bawah 804px)', async () => {
    const html = await render();
    expect(html).toContain('class="legenda-peta"');
    expect(html.indexOf('class="legenda-peta"')).toBeGreaterThan(
      html.indexOf('</svg>'),
    );
    for (const label of ['Prasyarat', 'Satu tema', 'Dipakai bersama', 'Kontras']) {
      expect(html).toContain(`>${label}<`);
    }
  });

  it('baris satu_tema meredup saat relasinya disembunyikan (default)', async () => {
    const html = await render();
    expect(html).toContain('peta-legenda-redup');
  });
});

describe('Session: bar progres di bawah timer dengan tick tahap', () => {
  async function render(sesi: Sesi): Promise<string> {
    resetDenganStorage();
    const masalah = buatMasalah({
      id: 'masalah-1',
      judul: 'Tidak tahu tujuan hidup',
    });
    await mockQuery([
      sesi, // sesi
      pestel, // framework
      masalah, // masalahSesi
      [masalah], // semuaMasalah
      [], // pemakaianFramework
      [], // artefakSesi
      [], // xpSesi
    ]);
    const { Session } = await import('../src/components/Session');
    return bersih(
      renderToString(createElement(Session, { id: 'sesi-1', reuseId: null })),
    );
  }

  it('sesi penerapan: progressbar + 3 tick di batas tahap', async () => {
    const html = await render(buatSesi({ jenis: 'penerapan', durasi_menit: 0 }));
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-label="Progres sesi: 0%"');
    const tick = html.match(/bar-progres-tick/g) ?? [];
    expect(tick.length).toBe(3);
    // Tick adalah tombol (klik membuka tahap panduan yang dimulai di sana).
    expect(html).toContain('<button type="button" class="bar-progres-tick"');
    // Bar berada di bawah timer, sebelum keterangan target.
    expect(html.indexOf('class="timer"')).toBeLessThan(
      html.indexOf('class="bar-progres-sesi"'),
    );
  });

  it('sesi re-use: progressbar polos tanpa tick', async () => {
    const html = await render(buatSesi({ jenis: 're_use' }));
    expect(html).toContain('role="progressbar"');
    expect(html).not.toContain('bar-progres-tick');
  });
});

describe('Progress: metrik sebagai baris berlabel, bukan grid hero', () => {
  async function render(): Promise<string> {
    resetDenganStorage();
    await mockQuery([
      [], // ledger
      [], // semuaSesi
      [], // pemakaian
      [], // semuaMasalah
      [], // jadwal
      graph.nodes, // frameworks
    ]);
    const { Progress } = await import('../src/components/Progress');
    return bersih(renderToString(createElement(Progress)));
  }

  it('metrik dirender sebagai baris, grid .metrik sudah tidak ada', async () => {
    const html = await render();
    expect(html).toContain('class="baris-metrik"');
    expect(html).not.toContain('class="metrik"');
  });
});
