/**
 * Uji DB onboarding problem-first (PRD M0 revisi 17 Nov 2026):
 * `terapkanHasilOnboarding()` di db.ts membuat masalah dari langkah
 * pertama, dan `tandaiDikenal()` menandai framework dari detail framework.
 * IndexedDB dipalsukan dengan fake-indexeddb; tidak ada jaringan atau
 * browser.
 */
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, tandaiDikenal, terapkanHasilOnboarding } from '../src/db';
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

describe('terapkanHasilOnboarding: masalah pertama dibuat', () => {
  it('masalah dijawab → 1 masalah aktif dibuat dengan judul ter-trim + kriteria', async () => {
    const hasil = await terapkanHasilOnboarding({
      ...jawabanKosong(),
      masalah: '  Startup saya bingung fokus  ',
      kriteria: ['tidak_tahu_fokus', 'pertumbuhan'],
    });
    expect(hasil.masalah).not.toBeNull();
    expect(hasil.masalah?.judul).toBe('Startup saya bingung fokus');
    expect(hasil.masalah?.status).toBe('aktif');
    expect(hasil.masalah?.kriteria).toEqual(['tidak_tahu_fokus', 'pertumbuhan']);
    expect(await db.masalah.count()).toBe(1);
  });

  it('masalah dilewati ("Lewati") → tidak ada masalah yang dibuat', async () => {
    const hasil = await terapkanHasilOnboarding(jawabanKosong());
    expect(hasil.masalah).toBeNull();
    expect(await db.masalah.count()).toBe(0);
  });

  it('masalah hanya spasi → tidak ada masalah yang dibuat', async () => {
    const hasil = await terapkanHasilOnboarding({
      ...jawabanKosong(),
      masalah: '   ',
    });
    expect(hasil.masalah).toBeNull();
    expect(await db.masalah.count()).toBe(0);
  });
});

describe('tandaiDikenal: dari detail framework', () => {
  it('menandai dikenal → dikenal_pada = hari ini, yang lain tetap null', async () => {
    await tandaiDikenal('pestel');
    const pestel = await db.frameworks.get('pestel');
    const kanban = await db.frameworks.get('kanban');
    expect(pestel?.dikenal_pada).toBe(hariIni());
    expect(kanban?.dikenal_pada).toBeNull();
  });

  it('menandai dikenal TIDAK mengubah status framework (tetap belum_dipakai)', async () => {
    await tandaiDikenal('kanban');
    const kanban = await db.frameworks.get('kanban');
    expect(kanban?.dikenal_pada).toBe(hariIni());
    expect(kanban?.status).toBe('belum_dipakai');
  });

  it('idempotent: memanggil dua kali hanya memperbarui tanggal', async () => {
    await tandaiDikenal('bmc');
    await tandaiDikenal('bmc');
    const bmc = await db.frameworks.get('bmc');
    expect(bmc?.dikenal_pada).toBe(hariIni());
    expect(await db.frameworks.count()).toBe(3);
  });
});
