/**
 * Uji render server-side (tanpa DOM) untuk panduan sesi interaktif
 * 18 Nov: accordion 4 tahap sinkron timer, checklist prosedur yang
 * direstorasi dari rekaman sesi, catatan pertama kali di Recall, dan
 * fallback paragraf bila prosedur tidak bisa dipecah langkahnya.
 *
 * Pola mock sama seperti dogfood-ui.test.ts: useLiveQuery di-mock
 * mengembalikan nilai per urutan pemanggilan hook di komponen.
 * Interaksi (klik header/tick/centang, sinkronisasi ulang saat timer
 * melewati batas) tidak bisa diuji lewat renderToString — perilaku itu
 * diuji sebagai fungsi murni di sesi.test.ts (tahapDariElapsed,
 * tahapUntukTick) dan diverifikasi lewat snapshot CDP.
 */
import 'fake-indexeddb/auto';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { Framework, GraphData, Sesi } from '../src/domain';
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
    durasi_menit: 0,
    selesai: false,
    skor: null,
    catatan: '',
    artefak_ids: [],
    dimulai_pada_ms: null,
    durasi_target_menit: 45,
    ...overrides,
  };
}

async function renderPanduan(opts: {
  durasiMenit?: number;
  sesiSelesai?: number;
  framework?: Framework;
  checklist?: string[];
  jenis?: Sesi['jenis'];
}): Promise<string> {
  resetDenganStorage();
  const masalah = buatMasalah({
    id: 'masalah-1',
    judul: 'Tidak tahu tujuan hidup',
  });
  await mockQuery([
    buatSesi({
      durasi_menit: opts.durasiMenit ?? 0,
      checklist_prosedur: opts.checklist,
      jenis: opts.jenis ?? 'penerapan',
    }),
    opts.framework ?? pestel,
    masalah,
    [masalah],
    [],
    [],
    [],
    opts.sesiSelesai ?? 0,
  ]);
  const { Session } = await import('../src/components/Session');
  return bersih(
    renderToString(createElement(Session, { id: 'sesi-1', reuseId: null })),
  );
}

/** Tahap i terbuka (class saat-ini + atribut open), tahap lain tertutup. */
function expectTahapTerbuka(html: string, i: number): void {
  expect(html).toContain(
    `id="tahap-panduan-${i}" class="tahap-panduan saat-ini" open=""`,
  );
  for (let j = 0; j < 4; j++) {
    if (j === i) continue;
    expect(html).toContain(`id="tahap-panduan-${j}" class="tahap-panduan"`);
  }
}

describe('Session: accordion panduan sinkron timer', () => {
  it('elapsed 0 menit → Recall terbuka', async () => {
    const html = await renderPanduan({ durasiMenit: 0 });
    expectTahapTerbuka(html, 0);
    expect(html).toContain('Tahap 1: Recall');
  });

  it('elapsed 7 menit → Prosedur terbuka', async () => {
    const html = await renderPanduan({ durasiMenit: 7 });
    expectTahapTerbuka(html, 1);
    expect(html).toContain('Tahap 2: Prosedur');
  });

  it('elapsed 25 menit → Penerapan terbuka', async () => {
    const html = await renderPanduan({ durasiMenit: 25 });
    expectTahapTerbuka(html, 2);
    expect(html).toContain('Tahap 3: Penerapan');
  });

  it('elapsed 40 menit → Artefak terbuka', async () => {
    const html = await renderPanduan({ durasiMenit: 40 });
    expectTahapTerbuka(html, 3);
    expect(html).toContain('Tahap 4: Artefak');
  });

  it('sesi re-use tidak menampilkan panduan penerapan', async () => {
    const html = await renderPanduan({ durasiMenit: 5, jenis: 're_use' });
    expect(html).not.toContain('Panduan 4 tahap');
    expect(html).not.toContain('tahap-panduan-0');
  });
});

describe('Session: catatan pertama kali di Recall', () => {
  it('belum ada sesi selesai → catatan tampil + tombol lompat Prosedur', async () => {
    const html = await renderPanduan({ durasiMenit: 0, sesiSelesai: 0 });
    expect(html).toContain(
      'Pertama kali memakai framework ini — belum ada yang perlu di-recall; mulai dari',
    );
    expect(html).toContain('>Prosedur</button>');
  });

  it('sudah ada sesi selesai → catatan tidak tampil', async () => {
    const html = await renderPanduan({ durasiMenit: 0, sesiSelesai: 1 });
    expect(html).not.toContain('Pertama kali memakai framework ini');
  });
});

describe('Session: checklist prosedur', () => {
  it('langkah yang tersimpan di rekaman sesi dirender tercentang', async () => {
    const langkah1 = 'Tulis pertanyaan keputusan yang ingin dijawab.';
    const html = await renderPanduan({
      durasiMenit: 7,
      checklist: [langkah1],
    });
    // Tepat satu checkbox tercentang (langkah 1); empat lainnya tidak.
    expect(html.match(/checked=""/g)?.length).toBe(1);
    expect(html).toContain(langkah1);
  });

  it('kunci teks usang (langkah tidak ada lagi) diabaikan — tidak ada yang tercentang', async () => {
    const html = await renderPanduan({
      durasiMenit: 7,
      checklist: ['Langkah yang sudah dihapus dari konten.'],
    });
    expect(html).not.toContain('checked=""');
  });

  it('prosedur tanpa langkah bernomor → fallback paragraf, tanpa checklist', async () => {
    const tanpaLangkah: Framework = {
      ...pestel,
      lapis_b_prosedur:
        'Lakukan analisis secara menyeluruh dan tulis kesimpulanmu.',
    };
    const html = await renderPanduan({
      durasiMenit: 7,
      framework: tanpaLangkah,
    });
    expect(html).not.toContain('checklist-prosedur');
    expect(html).toContain(
      'Lakukan analisis secara menyeluruh dan tulis kesimpulanmu.',
    );
  });
});
