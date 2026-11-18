/**
 * Uji render server-side (tanpa DOM) untuk perubahan pass Impeccable
 * 18 Nov: dedup framework terkait, daftar prosedur, gate tombol sesi,
 * copy ranking untuk masalah tanpa kriteria, log sesi ber-nama, tombol
 * "Jadikan masalah aktif" kondisional, dan label "Ke Beranda".
 *
 * Pola mock sama seperti peta-toggle.test.ts: useLiveQuery di-mock
 * mengembalikan nilai per urutan pemanggilan hook di komponen, dan store
 * dihidrasi dari localStorage tiruan. AutoAnimate di-mock (ref tidak
 * pernah dipanggil di renderToString).
 */
import 'fake-indexeddb/auto';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { Framework, GraphData, Masalah, Sesi } from '../src/domain';
import { hariIni } from '../src/dates';
import { buatMasalah } from './factories';

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

describe('FrameworkDetail: dedup terkait + prosedur + navigasi', () => {
  async function render(): Promise<string> {
    resetDenganStorage();
    // graph.json mentah belum punya `dikenal_pada` (ditambah seed db sebagai
    // null); tanpa ini komponen mengambil cabang "sudah dikenal" dan
    // formatTanggal(undefined) melempar RangeError.
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
    const { FrameworkDetail } = await import('../src/components/FrameworkDetail');
    const html = renderToString(createElement(FrameworkDetail, { id: 'pestel' }));
    // Hapus `<!-- -->` batas ekspresi JSX (lihat helper Session).
    return html.replaceAll('<!-- -->', '');
  }

  it('Porter muncul sekali walau terhubung dua relasi (prasyarat + satu tema)', async () => {
    const html = await render();
    const tautanPorter = html.match(/href="#\/framework\/porter-5f"/g) ?? [];
    expect(tautanPorter.length).toBe(1);
    // Kedua relasi tetap terlihat sebagai lencana di baris yang sama.
    expect(html).toContain('>prasyarat<');
    expect(html).toContain('>satu tema<');
  });

  it('prosedur dirender sebagai daftar bernomor, bukan satu paragraf', async () => {
    const html = await render();
    expect(html).toContain('<li>Tulis pertanyaan keputusan yang ingin dijawab.</li>');
  });

  it('ada tautan kembali ke Peta dan baris tema di bawah h1', async () => {
    const html = await render();
    expect(html).toContain('Kembali ke Peta');
    expect(html.indexOf('<h1>PESTEL Analysis</h1>')).toBeLessThan(
      html.indexOf('Tema A:'),
    );
  });
});

describe('Session: heading framework + gate Selesai & Nilai', () => {
  async function render(): Promise<string> {
    resetDenganStorage();
    const masalah = buatMasalah({
      id: 'masalah-1',
      judul: 'Tidak tahu tujuan hidup',
    });
    const sesi: Sesi = {
      id: 'sesi-1',
      framework_id: 'pestel',
      masalah_id: 'masalah-1',
      jenis: 'penerapan',
      tanggal: hariIni(),
      durasi_menit: 0,
      selesai: false,
      skor: null,
      catatan: '',
      artefak_ids: [],
      dimulai_pada_ms: null,
      durasi_target_menit: 45,
    };
    await mockQuery([
      sesi,
      pestel,
      masalah,
      [masalah],
      [],
    ]);
    const { Session } = await import('../src/components/Session');
    const html = renderToString(createElement(Session, { id: 'sesi-1', reuseId: null }));
    // renderToString menyisipkan `<!-- -->` di batas ekspresi JSX; hapus agar
    // asersi teks ("Penerapan untuk ...") membaca isi sebenarnya.
    return html.replaceAll('<!-- -->', '');
  }

  it('h1 adalah nama framework, masalah jadi keterangan di bawahnya', async () => {
    const html = await render();
    expect(html).toContain('<h1>PESTEL Analysis</h1>');
    expect(html).toContain('Penerapan untuk');
    expect(html).toContain('Tidak tahu tujuan hidup');
    expect(html).toContain('Kembali ke Beranda');
  });

  it('"Selesai & Nilai" nonaktif sebelum timer berjalan', async () => {
    const html = await render();
    expect(html).toMatch(
      /<button[^>]*disabled="">Selesai &amp; Nilai<\/button>/,
    );
  });
});

describe('Ranking: empty state membedakan masalah tanpa kriteria', () => {
  async function render(masalah: Masalah, frameworks: Framework[] = graph.nodes): Promise<string> {
    resetDenganStorage();
    const { Ranking } = await import('../src/components/Ranking');
    return renderToString(
      createElement(Ranking, {
        masalah,
        frameworks,
        dipakaiIds: new Set<string>(),
      }),
    );
  }

  it('masalah tanpa kriteria mendapat penjelasan, bukan saran ganti kriteria', async () => {
    const html = await render(buatMasalah({ kriteria: [] }));
    expect(html).toContain('belum punya kriteria');
    expect(html).toContain('Jelajahi Peta');
  });

  it('masalah berkriteria tanpa kecocokan memakai copy lama', async () => {
    // Setiap kriteria cocok dengan minimal satu framework lewat
    // signature_masalah, jadi cabang ini hanya tercapai saat daftar
    // framework kosong (mis. semua disembunyikan).
    const html = await render(buatMasalah({ kriteria: ['berwaktu'] }), []);
    expect(html).toContain(
      'Belum ada framework yang cocok dengan kriteria masalah ini.',
    );
    expect(html).not.toContain('belum punya kriteria');
  });
});

describe('Progress: log sesi ber-nama + metrik tenang + legenda hari', () => {
  async function render(): Promise<string> {
    resetDenganStorage();
    const masalah = buatMasalah({
      id: 'masalah-1',
      judul: 'Tidak tahu tujuan hidup',
    });
    const sesi: Sesi = {
      id: 'sesi-1',
      framework_id: 'pestel',
      masalah_id: 'masalah-1',
      jenis: 'penerapan',
      tanggal: hariIni(),
      durasi_menit: 45,
      selesai: true,
      skor: 3,
      catatan: '',
      artefak_ids: [],
      dimulai_pada_ms: null,
      durasi_target_menit: 45,
    };
    await mockQuery([
      [], // ledger
      [sesi], // semuaSesi
      [], // pemakaian
      [masalah], // semuaMasalah
      [], // jadwal
      [pestel], // frameworks
    ]);
    const { Progress } = await import('../src/components/Progress');
    return renderToString(createElement(Progress));
  }

  it('entri log menyebut framework + masalah dan tertaut ke sesi', async () => {
    const html = await render();
    expect(html).toContain('PESTEL Analysis');
    expect(html).toContain('Tidak tahu tujuan hidup');
    expect(html).toContain('href="#/sesi/sesi-1"');
  });

  it('transfer rate tanpa penyebut memakai teks tenang, bukan angka besar', async () => {
    const html = await render();
    expect(html).toContain('angka-kosong');
    expect(html).not.toContain('<div class="angka">Belum ada</div>');
  });

  it('grafik 7 hari menjelaskan arti kotak kuning', async () => {
    const html = await render();
    expect(html).toContain('Kotak kuning = ada sesi hari itu.');
  });
});

describe('ProblemDetail: tombol aktif kondisional + tautan kembali', () => {
  async function render(masalahAktifId: string | null): Promise<string> {
    const isi: Record<string, string> = masalahAktifId
      ? {
          'padi-store': JSON.stringify({
            state: { masalahAktifId },
            version: 0,
          }),
        }
      : {};
    resetDenganStorage(isi);
    const masalah = buatMasalah({
      id: 'masalah-1',
      judul: 'Tidak tahu tujuan hidup',
      kriteria: ['tidak_tahu_fokus'],
    });
    await mockQuery([
      masalah,
      graph.nodes,
      [],
      [],
      [],
    ]);
    const { ProblemDetail } = await import('../src/components/ProblemDetail');
    return renderToString(createElement(ProblemDetail, { id: 'masalah-1' }));
  }

  it('sembunyikan "Jadikan masalah aktif" bila masalah ini sudah aktif', async () => {
    const html = await render('masalah-1');
    expect(html).not.toContain('Jadikan masalah aktif');
    expect(html).toContain('Kembali ke Masalah saya');
  });

  it('tampilkan "Jadikan masalah aktif" bila masalah lain yang aktif', async () => {
    const html = await render('masalah-lain');
    expect(html).toContain('Jadikan masalah aktif');
  });
});

describe('ProblemList: "Lanjutkan" menjadi "Ke Beranda"', () => {
  it('tombol ke Beranda memakai label jujur', async () => {
    resetDenganStorage();
    const masalah = buatMasalah({
      id: 'masalah-1',
      judul: 'Tidak tahu tujuan hidup',
      status: 'aktif',
    });
    await mockQuery([[masalah], [], graph.nodes]);
    const { ProblemList } = await import('../src/components/ProblemList');
    const html = renderToString(createElement(ProblemList));
    expect(html).toContain('Ke Beranda');
    expect(html).not.toContain('Lanjutkan');
  });
});
