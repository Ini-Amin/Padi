/**
 * Uji DB panduan interaktif 18 Nov: field checklist_prosedur (tanpa
 * indeks, tanpa bump versi Dexie) tersimpan + tidak tertimpa autosave,
 * dan invarian pemakaian (mulaiSesi tidak membuat baris; selesaikanSesi
 * membuat tepat satu bila sesi memenuhi definisi selesai).
 * IndexedDB dipalsukan dengan fake-indexeddb; tidak ada jaringan atau
 * browser.
 */
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, mulaiSesi, selesaikanSesi } from '../src/db';
import { buatFramework, buatMasalah } from './factories';

beforeEach(async () => {
  await db.delete();
  await db.open();
  await db.frameworks.bulkAdd([
    buatFramework({ id: 'pestel', nama: 'PESTEL Analysis', urutan_katalog: 1 }),
  ]);
  await db.masalah.add(buatMasalah({ id: 'masalah-1' }));
});

async function buatSesiPenerapan(): Promise<string> {
  const sesi = await mulaiSesi({
    framework_id: 'pestel',
    masalah_id: 'masalah-1',
    jenis: 'penerapan',
    durasi_target_menit: 45,
  });
  return sesi.id;
}

describe('checklist_prosedur: field tanpa indeks, tanpa bump versi', () => {
  it('update checklist tersimpan dan terbaca kembali', async () => {
    const id = await buatSesiPenerapan();
    await db.sesi.update(id, {
      checklist_prosedur: ['Langkah satu.', 'Langkah dua.'],
    });
    const sesi = await db.sesi.get(id);
    expect(sesi?.checklist_prosedur).toEqual(['Langkah satu.', 'Langkah dua.']);
  });

  it('update bentuk autosave (catatan + durasi) tidak menimpa checklist', async () => {
    const id = await buatSesiPenerapan();
    await db.sesi.update(id, { checklist_prosedur: ['Langkah satu.'] });
    // Bentuk tulisan autosave + cleanup unmount di Session.tsx.
    await db.sesi.update(id, { catatan: 'catatan baru', durasi_menit: 7 });
    const sesi = await db.sesi.get(id);
    expect(sesi?.checklist_prosedur).toEqual(['Langkah satu.']);
    expect(sesi?.catatan).toBe('catatan baru');
    expect(sesi?.durasi_menit).toBe(7);
  });

  it('sesi lama tanpa field terbaca sebagai undefined (bukan error)', async () => {
    const id = await buatSesiPenerapan();
    const sesi = await db.sesi.get(id);
    expect(sesi?.checklist_prosedur).toBeUndefined();
  });
});

describe('pemakaian: invarian mulai vs selesai', () => {
  it('mulaiSesi tidak membuat pemakaian; selesaikanSesi (skor 2, 45 menit) membuat 1', async () => {
    const id = await buatSesiPenerapan();
    expect(await db.pemakaian.count()).toBe(0);
    await selesaikanSesi(id, 45, { skor: 2 });
    expect(await db.pemakaian.count()).toBe(1);
    const sesiSelesai = await db.sesi
      .where('framework_id')
      .equals('pestel')
      .filter((s) => s.selesai)
      .count();
    expect(sesiSelesai).toBe(1);
  });

  it('skor 0 tanpa artefak dan <30 menit: tidak selesai, tidak ada pemakaian', async () => {
    const id = await buatSesiPenerapan();
    await selesaikanSesi(id, 10, { skor: 0 });
    const sesi = await db.sesi.get(id);
    expect(sesi?.selesai).toBe(false);
    expect(await db.pemakaian.count()).toBe(0);
    const sesiSelesai = await db.sesi
      .where('framework_id')
      .equals('pestel')
      .filter((s) => s.selesai)
      .count();
    expect(sesiSelesai).toBe(0);
  });
});
