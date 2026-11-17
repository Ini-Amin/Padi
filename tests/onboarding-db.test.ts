/**
 * Uji DB onboarding (PRD M0): `terapkanHasilOnboarding()` di db.ts —
 * Q1 membuat masalah, Q3 menandai framework dikenal. IndexedDB dipalsukan
 * dengan fake-indexeddb; tidak ada jaringan atau browser.
 */
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, terapkanHasilOnboarding } from '../src/db';
import { hariIni } from '../src/dates';
import { jawabanKosong } from '../src/onboarding';
import { buatFramework } from './factories';

beforeEach(async () => {
  await db.delete();
  await db.open();
  await db.frameworks.bulkAdd([
    buatFramework({ id: 'pestel', nama: 'PESTEL Analysis', urutan_katalog: 1 }),
    buatFramework({ id: 'kanban', nama: 'Kanban', urutan_katalog: 15 }),
    buatFramework({ id: 'bmc', nama: 'Business Model Canvas', urutan_katalog: 11 }),
  ]);
});

describe('terapkanHasilOnboarding — Q1 membuat masalah', () => {
  it('Q1 dijawab → 1 masalah aktif dibuat dengan judul ter-trim + kriteria', async () => {
    const hasil = await terapkanHasilOnboarding(
      {
        ...jawabanKosong(),
        masalah: '  Startup saya bingung fokus  ',
        kriteria: ['tidak_tahu_fokus', 'pertumbuhan'],
      },
      await db.frameworks.toArray(),
    );
    expect(hasil.masalah).not.toBeNull();
    expect(hasil.masalah?.judul).toBe('Startup saya bingung fokus');
    expect(hasil.masalah?.status).toBe('aktif');
    expect(hasil.masalah?.kriteria).toEqual(['tidak_tahu_fokus', 'pertumbuhan']);
    expect(await db.masalah.count()).toBe(1);
  });

  it('Q1 dilewati → tidak ada masalah yang dibuat', async () => {
    const hasil = await terapkanHasilOnboarding(
      jawabanKosong(),
      await db.frameworks.toArray(),
    );
    expect(hasil.masalah).toBeNull();
    expect(await db.masalah.count()).toBe(0);
  });

  it('Q1 hanya spasi → tidak ada masalah yang dibuat', async () => {
    const hasil = await terapkanHasilOnboarding(
      { ...jawabanKosong(), masalah: '   ' },
      await db.frameworks.toArray(),
    );
    expect(hasil.masalah).toBeNull();
    expect(await db.masalah.count()).toBe(0);
  });
});

describe('terapkanHasilOnboarding — Q3 menandai framework dikenal', () => {
  it("Q3 'PESTEL' → pestel dikenal_pada = hari ini, yang lain tetap null", async () => {
    const hasil = await terapkanHasilOnboarding(
      { ...jawabanKosong(), frameworkDikenal: 'PESTEL' },
      await db.frameworks.toArray(),
    );
    expect(hasil.frameworkDikenalId).toBe('pestel');
    const pestel = await db.frameworks.get('pestel');
    const kanban = await db.frameworks.get('kanban');
    expect(pestel?.dikenal_pada).toBe(hariIni());
    expect(kanban?.dikenal_pada).toBeNull();
  });

  it('menandai dikenal TIDAK mengubah status framework (tetap belum_dipakai)', async () => {
    await terapkanHasilOnboarding(
      { ...jawabanKosong(), frameworkDikenal: 'kanban' },
      await db.frameworks.toArray(),
    );
    const kanban = await db.frameworks.get('kanban');
    expect(kanban?.dikenal_pada).toBe(hariIni());
    expect(kanban?.status).toBe('belum_dipakai');
  });

  it("Q3 teks di luar katalog ('SWOT') → tidak ada framework yang ditandai", async () => {
    const hasil = await terapkanHasilOnboarding(
      { ...jawabanKosong(), frameworkDikenal: 'SWOT' },
      await db.frameworks.toArray(),
    );
    expect(hasil.frameworkDikenalId).toBeNull();
    const semua = await db.frameworks.toArray();
    expect(semua.every((f) => f.dikenal_pada === null)).toBe(true);
  });

  it('Q1 + Q3 dijawab bersamaan → masalah dibuat DAN framework ditandai', async () => {
    const hasil = await terapkanHasilOnboarding(
      {
        ...jawabanKosong(),
        masalah: 'Fokus segmen?',
        kriteria: ['tidak_tahu_fokus'],
        frameworkDikenal: 'bmc',
      },
      await db.frameworks.toArray(),
    );
    expect(hasil.masalah?.judul).toBe('Fokus segmen?');
    expect(hasil.frameworkDikenalId).toBe('bmc');
    expect((await db.frameworks.get('bmc'))?.dikenal_pada).toBe(hariIni());
  });

  it('lewati semua → tidak ada masalah, tidak ada framework yang ditandai', async () => {
    const hasil = await terapkanHasilOnboarding(
      jawabanKosong(),
      await db.frameworks.toArray(),
    );
    expect(hasil.masalah).toBeNull();
    expect(hasil.frameworkDikenalId).toBeNull();
    expect(await db.masalah.count()).toBe(0);
    const semua = await db.frameworks.toArray();
    expect(semua.every((f) => f.dikenal_pada === null)).toBe(true);
  });
});
