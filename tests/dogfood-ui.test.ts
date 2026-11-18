/**
 * Uji render server-side (tanpa DOM) untuk perbaikan dogfood 18 Nov:
 * ringkasan sesi selesai (skor/XP/artefak/langkah lanjut), petunjuk tombol
 * nonaktif + panduan terbuka, penjelasan kriteria/eksplorasi/Ganti di
 * Ranking, stepper bernomor + petunjuk wizard, penjelasan jargon di Beranda
 * dan Detail framework, legenda XP di Progres, dan penunjuk checkbox di
 * aria-label Peta.
 *
 * Pola mock sama seperti impeccable-ui.test.ts: useLiveQuery di-mock
 * mengembalikan nilai per urutan pemanggilan hook di komponen, dan store
 * dihidrasi dari localStorage tiruan. Interaksi (klik/centang/ketik) tidak
 * bisa diuji lewat renderToString — perilaku itu diuji sebagai fungsi murni
 * di sesi.test.ts (perluKonfirmasiDini, judulArtefakDefault) dan
 * diverifikasi lewat snapshot.
 */
import 'fake-indexeddb/auto';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type {
  Framework,
  GraphData,
  Sesi,
  XpLedgerEntry,
} from '../src/domain';
import { hariIni } from '../src/dates';
import { buatArtefak, buatMasalah } from './factories';

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

describe('Session: ringkasan sesi selesai menggantikan jalan buntu', () => {
  async function render(
    sesi: Sesi,
    artefak: ReturnType<typeof buatArtefak>[] = [],
    xp: XpLedgerEntry[] = [],
  ): Promise<string> {
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
      artefak, // artefakSesi
      xp, // xpSesi
    ]);
    const { Session } = await import('../src/components/Session');
    const html = renderToString(
      createElement(Session, { id: 'sesi-1', reuseId: null }),
    );
    return bersih(html);
  }

  it('menampilkan skor + label, XP dari ledger, artefak, dan langkah lanjut', async () => {
    const html = await render(
      buatSesi({ selesai: true, skor: 2, artefak_ids: ['artefak-1'] }),
      [buatArtefak({ id: 'artefak-1', judul: 'PESTEL untuk segmen pelajar', sesi_id: 'sesi-1' })],
      [
        { id: 'xp-1', sesi_id: 'sesi-1', jenis: 'penerapan', jumlah: 100, dibuat_pada: hariIni() },
        { id: 'xp-2', sesi_id: 'sesi-1', jenis: 'artefak_berkualitas', jumlah: 50, dibuat_pada: hariIni() },
      ],
    );
    expect(html).toContain('Skor:');
    expect(html).toContain('2 — Bisa menerapkan');
    expect(html).toContain('150 XP');
    expect(html).toContain('PESTEL untuk segmen pelajar');
    expect(html).toContain('href="#/framework/pestel"');
    expect(html).toContain('Lihat Progres');
    expect(html).toContain('href="#/progres"');
    expect(html).toContain('Kembali ke masalah');
    expect(html).toContain('href="#/masalah/masalah-1"');
    expect(html).not.toContain('Sesi ini sudah selesai dinilai.');
  });

  it('tanpa artefak: menampilkan teks kosong, bukan tautan', async () => {
    const html = await render(
      buatSesi({ selesai: true, skor: 1, durasi_menit: 30 }),
      [],
      [
        { id: 'xp-1', sesi_id: 'sesi-1', jenis: 'penerapan', jumlah: 100, dibuat_pada: hariIni() },
      ],
    );
    expect(html).toContain('Tidak ada artefak dari sesi ini.');
    expect(html).toContain('100 XP');
    expect(html).toContain('1 — Paham konsep');
  });
});

describe('Session: petunjuk tombol nonaktif + panduan terbuka', () => {
  async function render(): Promise<string> {
    resetDenganStorage();
    const masalah = buatMasalah({
      id: 'masalah-1',
      judul: 'Tidak tahu tujuan hidup',
    });
    await mockQuery([
      buatSesi({ durasi_menit: 0 }),
      pestel,
      masalah,
      [masalah],
      [],
      [],
      [],
      0, // sesiSelesaiFramework (pertama kali memakai framework ini)
    ]);
    const { Session } = await import('../src/components/Session');
    const html = renderToString(
      createElement(Session, { id: 'sesi-1', reuseId: null }),
    );
    return bersih(html);
  }

  it('menjelaskan kenapa "Selesai & Nilai" nonaktif', async () => {
    const html = await render();
    expect(html).toContain('Tombol aktif setelah timer berjalan.');
  });

  it('panduan 4 tahap: accordion, tahap berjalan terbuka + ditandai', async () => {
    const html = await render();
    expect(html).toContain('<details class="kartu" open="">');
    // Empat tahap sebagai <details> dengan judul per tahap.
    expect(html).toContain('Recall (0–5′)');
    expect(html).toContain('Prosedur (5–20′)');
    expect(html).toContain('Penerapan (20–35′)');
    expect(html).toContain('Artefak (35–45′)');
    // Elapsed 0 → Recall terbuka + ditandai "Tahap ini", yang lain tertutup.
    expect(html).toContain(
      'id="tahap-panduan-0" class="tahap-panduan saat-ini" open=""',
    );
    expect(html).toContain('Tahap ini');
    expect(html).toContain('id="tahap-panduan-1" class="tahap-panduan"');
    expect(html).toContain('Tahap 1: Recall');
    // Tick bar progres adalah tombol dengan aria-label penanda tahap.
    expect(html).toContain(
      'aria-label="Buka tahap Prosedur (mulai menit ke-5)"',
    );
    expect(html).toContain(
      'aria-label="Buka tahap Artefak (mulai menit ke-35)"',
    );
    // Checklist prosedur dirender (5 langkah PESTEL).
    expect(html).toContain('checklist-prosedur');
    expect(html).toContain('Tulis pertanyaan keputusan yang ingin dijawab.');
    // Catatan pertama kali (belum ada sesi selesai untuk framework ini).
    expect(html).toContain('Pertama kali memakai framework ini');
  });
});

describe('Ranking: kriteria, eksplorasi, dan Ganti vs Tidak cocok dijelaskan', () => {
  async function render(): Promise<string> {
    resetDenganStorage();
    const masalah = buatMasalah({
      kriteria: ['tidak_tahu_fokus', 'jangka_panjang'],
    });
    const { Ranking } = await import('../src/components/Ranking');
    return bersih(
      renderToString(
        createElement(Ranking, {
          masalah,
          frameworks: graph.nodes as Framework[],
          dipakaiIds: new Set<string>(),
        }),
      ),
    );
  }

  it('menampilkan kriteria yang dipakai pencocokan', async () => {
    const html = await render();
    expect(html).toContain('Kriteriamu:');
    expect(html).toContain('tidak tahu harus fokus ke mana');
    expect(html).toContain('dampak jangka panjang');
  });

  it('menjelaskan label eksplorasi dan perbedaan Ganti vs Tidak cocok', async () => {
    const html = await render();
    expect(html).toContain(
      'Eksplorasi: framework yang belum pernah kamu pakai',
    );
    expect(html).toContain('Ganti menampilkan peringkat 4–6.');
    expect(html).toContain(
      'Tidak cocok mencatat umpan balikmu dan menampilkan alternatif.',
    );
  });
});

describe('ProblemFlow: stepper bernomor + petunjuk judul', () => {
  async function render(): Promise<string> {
    resetDenganStorage();
    const { ProblemFlow } = await import('../src/components/ProblemFlow');
    return bersih(renderToString(createElement(ProblemFlow)));
  }

  it('stepper menampilkan nomor tiap langkah', async () => {
    const html = await render();
    expect(html).toContain('1. Judul masalah');
    expect(html).toContain('2. Jenis masalah');
    expect(html).toContain('3. Tekanan waktu');
    expect(html).toContain('4. Sumber daya');
    expect(html).toContain('5. Apa yang sudah dicoba');
    expect(html).toContain('langkah-aktif');
  });

  it('langkah 1 menjelaskan kenapa Lanjut nonaktif', async () => {
    const html = await render();
    expect(html).toContain('Isi judul dulu untuk lanjut.');
  });
});

describe('Home: tautan semua masalah + jargon dijelaskan', () => {
  async function render(): Promise<string> {
    resetDenganStorage();
    const masalah1 = buatMasalah({ id: 'masalah-1', judul: 'Masalah pertama' });
    const masalah2 = buatMasalah({ id: 'masalah-2', judul: 'Masalah kedua' });
    await mockQuery([
      graph.nodes, // frameworks
      [masalah1, masalah2], // semuaMasalah
      [], // pemakaian
      [], // jadwal
      [], // sesiHariIni
      [], // draft
    ]);
    const { Home } = await import('../src/components/Home');
    return bersih(renderToString(createElement(Home)));
  }

  it('kartu masalah aktif menaut ke semua masalah dengan hitungan', async () => {
    const html = await render();
    expect(html).toContain('Lihat semua masalah (2)');
  });

  it('"sesi draft" dijelaskan dengan kata biasa', async () => {
    const html = await render();
    expect(html).toContain('sesi yang dimulai tapi belum dinilai tidak dihitung');
    expect(html).not.toContain('sesi draft');
  });

  it('footer memakai "pengulangan terjadwal", bukan jargon re-use', async () => {
    const html = await render();
    expect(html).toContain('Tidak ada pengulangan terjadwal hari ini.');
  });
});

describe('FrameworkDetail: dikuasai/transfer dan tombol dikenal dijelaskan', () => {
  async function render(): Promise<string> {
    resetDenganStorage();
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

  it('seksi syarat menjelaskan dikuasai dan transfer', async () => {
    const html = await render();
    expect(html).toContain('Dikuasai berarti kamu bisa memakai framework ini dengan baik.');
    expect(html).toContain(
      'Transfer: memakai framework yang sama untuk masalah yang berbeda.',
    );
  });

  it('tombol dikenal menjelaskan efeknya pada slot eksplorasi', async () => {
    const html = await render();
    expect(html).toContain('Saya sudah tahu framework ini');
    expect(html).toContain('tidak muncul di slot eksplorasi');
  });
});

describe('Progress: rumus XP sebagai legenda', () => {
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

  it('menampilkan "Cara dapat XP:" sebelum rumus', async () => {
    const html = await render();
    expect(html).toContain('Cara dapat XP:');
    expect(html).toContain('+100 per sesi penerapan');
  });
});

describe('GraphSvg: aria-label menunjuk ke checkbox relasi satu tema', () => {
  async function render(): Promise<string> {
    resetDenganStorage();
    await mockQuery([
      graph.nodes, // frameworks
      graph.edges, // edges
    ]);
    const { GraphSvg } = await import('../src/components/GraphSvg');
    return bersih(renderToString(createElement(GraphSvg)));
  }

  it('hitungan sembunyi disertai petunjuk centang', async () => {
    const html = await render();
    expect(html).toContain('15 relasi satu tema disembunyikan');
    expect(html).toContain('di atas untuk melihatnya');
  });
});
