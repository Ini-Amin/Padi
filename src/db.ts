/**
 * Penyimpanan local-first via Dexie (IndexedDB) (dokumen 05 §3).
 * Database `padi`, versi 1. Satu object store per entitas (dokumen 03 §2).
 *
 * Aturan yang ditegakkan di sini:
 * - Seed memakai upsert by `id`: konten yang sudah diedit user
 *   (`diedit_user = true`) TIDAK PERNAH ditimpa seed.
 * - Status framework hanya ditulis oleh `refreshFrameworkStatus()`, yang
 *   memanggil `hitungStatus()` murni, tidak ada penulis status lain.
 * - Satu transaksi per operasi; semua `await` di luar transaksi.
 * - `total_xp` dihitung dari xp_ledger, bukan disimpan.
 */
import Dexie from 'dexie';
import type { Table } from 'dexie';
import type {
  Artefak,
  Capstone,
  Edge,
  Framework,
  GraphData,
  ISODate,
  JadwalReuse,
  JenisSesi,
  KriteriaMasalah,
  Masalah,
  Pemakaian,
  Progres,
  Sesi,
  Skor,
  UmpanBalikMatching,
  XpLedgerEntry,
} from './domain';
import { hariIni } from './dates';
import { jadwalDariPemakaian, jadwalBerikutnya, jadwalTambahan } from './scheduler';
import { hitungStatus } from './status';
import { sesiSelesai, xpUntukSesi } from './gamification';
import {
  masalahDariJawaban,
  type JawabanOnboarding,
} from './onboarding';

export class PadiDB extends Dexie {
  frameworks!: Table<Framework, string>;
  edges!: Table<Edge, number>;
  masalah!: Table<Masalah, string>;
  pemakaian!: Table<Pemakaian, string>;
  sesi!: Table<Sesi, string>;
  artefak!: Table<Artefak, string>;
  jadwal_reuse!: Table<JadwalReuse, string>;
  progres!: Table<Progres, string>;
  xp_ledger!: Table<XpLedgerEntry, string>;
  capstone!: Table<Capstone, string>;
  umpan_balik_matching!: Table<UmpanBalikMatching, string>;

  constructor() {
    super('padi');
    this.version(1).stores({
      frameworks: 'id, tema, status',
      edges: '++id, dari, ke, tipe',
      masalah: 'id, status, dibuat_pada',
      pemakaian: 'id, framework_id, masalah_id, tanggal',
      sesi: 'id, framework_id, masalah_id, tanggal, jenis',
      artefak: 'id, framework_id, masalah_id, sesi_id',
      jadwal_reuse: 'id, framework_id, pemakaian_id, jatuh_tempo, status',
      progres: 'id',
      xp_ledger: 'id, sesi_id, dibuat_pada',
      capstone: 'id, masalah_id',
      umpan_balik_matching: 'id, masalah_id, dibuat_pada',
    });
  }
}

export const db = new PadiDB();

const PROGRES_ID = 'utama';

function uuid(): string {
  return crypto.randomUUID();
}

/**
 * Seed dari graph.json (sumber kebenaran konten). Upsert by id; konten yang
 * diedit user tidak ditimpa. Idempotent: aman dipanggil setiap buka app.
 */
export async function seedDatabase(): Promise<void> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/graph.json`);
  if (!res.ok) throw new Error(`Gagal memuat graph.json (${res.status})`);
  const data = (await res.json()) as GraphData;
  await db.transaction('rw', db.frameworks, db.edges, async () => {
    for (const node of data.nodes) {
      const ada = await db.frameworks.get(node.id);
      if (!ada) {
        // graph.json (seed konten) belum punya `dikenal_pada`, default null.
        await db.frameworks.add({ ...node, dikenal_pada: null });
      } else if (!ada.diedit_user) {
        // Perbaikan konten pasca-rilis: timpa konten seed, pertahankan progres.
        await db.frameworks.put({ ...node, ...progresFramework(ada) });
      }
    }
    const edgesAda = await db.edges.toArray();
    const kunciAda = new Set(edgesAda.map((e) => `${e.dari}|${e.ke}|${e.tipe}`));
    for (const edge of data.edges) {
      if (!kunciAda.has(`${edge.dari}|${edge.ke}|${edge.tipe}`)) {
        await db.edges.add(edge);
      }
    }
  });
  const progres = await db.progres.get(PROGRES_ID);
  if (!progres) {
    await db.progres.add({
      id: PROGRES_ID,
      streak_hari: 0,
      terakhir_aktif: null,
      riwayat_harian: {},
      terakhir_ekspor_pada: null,
    });
  }
}

/** Field progres user yang tidak boleh ditimpa seed konten. */
function progresFramework(f: Framework): Pick<
  Framework,
  | 'status'
  | 'skor_terakhir'
  | 'dipakai_pertama_pada'
  | 'dikuasai_pada'
  | 'kapan_tidak_pakai'
  | 'dikenal_pada'
  | 'tidak_relevan_pada'
  | 'diaktifkan_pada'
  | 'artefak_ids'
  | 'diedit_user'
> {
  return {
    status: f.status,
    skor_terakhir: f.skor_terakhir,
    dipakai_pertama_pada: f.dipakai_pertama_pada,
    dikuasai_pada: f.dikuasai_pada,
    kapan_tidak_pakai: f.kapan_tidak_pakai,
    // Baris lama (sebelum field ini ada) tidak punya nilai → null.
    dikenal_pada: f.dikenal_pada ?? null,
    tidak_relevan_pada: f.tidak_relevan_pada,
    diaktifkan_pada: f.diaktifkan_pada,
    artefak_ids: f.artefak_ids,
    diedit_user: f.diedit_user,
  };
}

/**
 * SATU-SATUNYA penulis status framework. Hitung ulang dari data mentah
 * (pemakaian, artefak, jadwal) dan simpan. Mengisi `dikuasai_pada` saat
 * status baru menjadi `dikuasai`.
 */
export async function refreshFrameworkStatus(frameworkId: string): Promise<void> {
  const framework = await db.frameworks.get(frameworkId);
  if (!framework) return;
  const [pemakaian, artefak, jadwalReuse, semuaMasalah] = await Promise.all([
    db.pemakaian.where('framework_id').equals(frameworkId).toArray(),
    db.artefak.where('framework_id').equals(frameworkId).toArray(),
    db.jadwal_reuse.where('framework_id').equals(frameworkId).toArray(),
    db.masalah.toArray(),
  ]);
  const masalahById = new Map(semuaMasalah.map((m) => [m.id, m]));
  const statusBaru = hitungStatus({
    framework,
    pemakaian,
    artefak,
    jadwalReuse,
    masalahById,
    hariIni: hariIni(),
  });
  const perubahan: Partial<Framework> = { status: statusBaru };
  if (statusBaru === 'dikuasai' && framework.dikuasai_pada === null) {
    perubahan.dikuasai_pada = hariIni();
  }
  if (pemakaian.length > 0 && framework.dipakai_pertama_pada === null) {
    const pertama = pemakaian
      .map((p) => p.tanggal)
      .sort((a, b) => (a < b ? -1 : 1))[0];
    perubahan.dipakai_pertama_pada = pertama;
  }
  await db.frameworks.update(frameworkId, perubahan);
}

/** Buat masalah baru dari flow pertanyaan terbimbing. */
export async function buatMasalah(input: {
  judul: string;
  deskripsi: string;
  kriteria: KriteriaMasalah[];
}): Promise<Masalah> {
  const masalah: Masalah = {
    id: uuid(),
    judul: input.judul.trim(),
    deskripsi: input.deskripsi.trim(),
    kriteria: [...new Set(input.kriteria)],
    status: 'aktif',
    dibuat_pada: hariIni(),
    selesai_pada: null,
  };
  await db.masalah.add(masalah);
  return masalah;
}

/** Mulai sesi baru (draft, `selesai` false sampai dinilai). */
export async function mulaiSesi(input: {
  framework_id: string;
  masalah_id: string | null;
  jenis: JenisSesi;
  durasi_target_menit: number;
}): Promise<Sesi> {
  const sesi: Sesi = {
    id: uuid(),
    framework_id: input.framework_id,
    masalah_id: input.masalah_id,
    jenis: input.jenis,
    tanggal: hariIni(),
    durasi_menit: 0,
    selesai: false,
    skor: null,
    catatan: '',
    artefak_ids: [],
    dimulai_pada_ms: Date.now(),
    durasi_target_menit: input.durasi_target_menit,
  };
  await db.sesi.add(sesi);
  return sesi;
}

/** Input penilaian sesi (layar penilaian terpisah, dokumen 04 §3.2). */
export interface PenilaianSesi {
  skor: Skor;
  /** Artefak opsional. Tanpa artefak, sesi penerapan tetap bisa selesai via durasi. */
  artefak?: {
    judul: string;
    isi: string;
    jenis: Artefak['jenis'];
    kualitas_lengkap: boolean;
    kualitas_prioritasi: boolean;
    kualitas_rekomendasi: boolean;
  };
  /** ID jadwal re-use yang diselesaikan sesi ini (untuk sesi re-use). */
  jadwal_reuse_id?: string;
}

/**
 * Selesaikan sesi dalam satu transaksi: simpan skor + artefak (jika ada),
 * buat pemakaian (skor ≥1), jadwalkan re-use H+1/H+3/H+7/H+30 dari pemakaian
 * (atau rantai berikutnya untuk re-use), catat XP, perbarui status framework.
 * Idempotent per sesi: memanggil dua kali untuk sesi yang sama tidak
 * menggandakan pemakaian/XP (dijaga flag `selesai` + pengecekan pemakaian).
 */
export async function selesaikanSesi(
  sesiId: string,
  durasiMenit: number,
  penilaian: PenilaianSesi,
): Promise<{ pemakaian: Pemakaian | null; reuseBerikutnya: ISODate | null }> {
  const sesi = await db.sesi.get(sesiId);
  if (!sesi) throw new Error('Sesi tidak ditemukan.');
  if (sesi.selesai) throw new Error('Sesi ini sudah selesai dinilai.');

  const tanggal: ISODate = hariIni();
  let artefakId: string | null = null;
  let artefakBerkualitas = false;

  await db.transaction(
    'rw',
    [db.sesi, db.artefak, db.pemakaian, db.jadwal_reuse, db.xp_ledger, db.progres, db.frameworks],
    async () => {
      // 1. Artefak (jika ada): kualitas_terpenuhi dihitung, bukan diinput.
      if (penilaian.artefak && sesi.masalah_id) {
        artefakBerkualitas =
          penilaian.artefak.kualitas_lengkap &&
          penilaian.artefak.kualitas_prioritasi &&
          penilaian.artefak.kualitas_rekomendasi;
        const artefak: Artefak = {
          id: uuid(),
          framework_id: sesi.framework_id,
          masalah_id: sesi.masalah_id,
          sesi_id: sesi.id,
          jenis: penilaian.artefak.jenis,
          judul: penilaian.artefak.judul.trim(),
          isi: penilaian.artefak.isi,
          perusahaan: null,
          kualitas_lengkap: penilaian.artefak.kualitas_lengkap,
          kualitas_prioritasi: penilaian.artefak.kualitas_prioritasi,
          kualitas_rekomendasi: penilaian.artefak.kualitas_rekomendasi,
          kualitas_terpenuhi: artefakBerkualitas,
          dibuat_pada: tanggal,
          terakhir_dibuka: tanggal,
        };
        await db.artefak.add(artefak);
        artefakId = artefak.id;
      }

      // 2. Tutup sesi. `selesai` dihitung dari aturan, bukan dari input.
      const sesiTutup: Sesi = {
        ...sesi,
        durasi_menit: durasiMenit,
        skor: penilaian.skor,
        artefak_ids: artefakId ? [artefakId] : [],
        dimulai_pada_ms: null,
        selesai: false, // dihitung di bawah, setelah artefak_ids final
      };
      sesiTutup.selesai = sesiSelesai(sesiTutup);
      await db.sesi.put(sesiTutup);

      // Sesi yang tidak memenuhi definisi selesai (skor 0 tanpa artefak dan
      // durasi <30') tidak membuat pemakaian dan tidak memberi XP (US-1.5).
      if (!sesiTutup.selesai) return;

      // 3. Pemakaian (satu per sesi selesai dengan skor ≥1).
      let pemakaianBaru: Pemakaian | null = null;
      if (penilaian.skor >= 1 && sesi.masalah_id) {
        pemakaianBaru = {
          id: uuid(),
          framework_id: sesi.framework_id,
          masalah_id: sesi.masalah_id,
          sesi_id: sesi.id,
          tanggal,
          skor: penilaian.skor,
        };
        await db.pemakaian.add(pemakaianBaru);
      }

      // 4. Jadwal re-use.
      if (penilaian.jadwal_reuse_id) {
        // Sesi re-use: tandai jadwal lama selesai, buat rantai berikutnya
        // dari tanggal DISELESAIKAN (bukan jatuh tempo asli).
        const jadwalLama = await db.jadwal_reuse.get(penilaian.jadwal_reuse_id);
        if (jadwalLama) {
          await db.jadwal_reuse.update(jadwalLama.id, {
            status: 'selesai',
            skor: penilaian.skor,
            sesi_id: sesi.id,
          });
          const berikut = jadwalBerikutnya(jadwalLama.jenis_reuse, tanggal);
          if (berikut && pemakaianBaru) {
            await db.jadwal_reuse.add({
              id: uuid(),
              pemakaian_id: pemakaianBaru.id,
              framework_id: sesi.framework_id,
              jenis_reuse: berikut.jenis_reuse,
              jatuh_tempo: berikut.jatuh_tempo,
              status: 'terjadwal',
              skor: null,
              sesi_id: null,
              reuse_asli_id: null,
              catch_up_group_id: null,
            });
          }
          // Skor re-use <2 → re-use tambahan H+7 (US-2.4).
          if (penilaian.skor < 2 && pemakaianBaru) {
            const tambahan = jadwalTambahan(tanggal);
            await db.jadwal_reuse.add({
              id: uuid(),
              pemakaian_id: pemakaianBaru.id,
              framework_id: sesi.framework_id,
              jenis_reuse: tambahan.jenis_reuse,
              jatuh_tempo: tambahan.jatuh_tempo,
              status: 'terjadwal',
              skor: null,
              sesi_id: null,
              reuse_asli_id: jadwalLama.id,
              catch_up_group_id: null,
            });
          }
        }
      } else if (pemakaianBaru) {
        // Sesi penerapan baru: jadwalkan H+1/H+3/H+7/H+30 dari pemakaian.
        for (const j of jadwalDariPemakaian(tanggal)) {
          await db.jadwal_reuse.add({
            id: uuid(),
            pemakaian_id: pemakaianBaru.id,
            framework_id: sesi.framework_id,
            jenis_reuse: j.jenis_reuse,
            jatuh_tempo: j.jatuh_tempo,
            status: 'terjadwal',
            skor: null,
            sesi_id: null,
            reuse_asli_id: null,
            catch_up_group_id: null,
          });
        }
      }

      // 5. XP ledger (total_xp dihitung dari sini).
      const xp = xpUntukSesi(sesi.jenis, penilaian.skor, artefakBerkualitas);
      for (const item of xp) {
        await db.xp_ledger.add({
          id: uuid(),
          sesi_id: sesi.id,
          jenis: item.jenis,
          jumlah: item.jumlah,
          dibuat_pada: tanggal,
        });
      }

      // 6. Riwayat harian (streak dihitung dari record sesi, ini hanya cache).
      const progres = await db.progres.get(PROGRES_ID);
      if (progres) {
        await db.progres.update(PROGRES_ID, {
          terakhir_aktif: tanggal,
          riwayat_harian: { ...progres.riwayat_harian, [tanggal]: true },
        });
      }

      // 7. Cache artefak_ids framework (hanya dari sesi selesai).
      if (artefakId) {
        const fw = await db.frameworks.get(sesi.framework_id);
        if (fw && !fw.artefak_ids.includes(artefakId)) {
          await db.frameworks.update(sesi.framework_id, {
            artefak_ids: [...fw.artefak_ids, artefakId],
            skor_terakhir: penilaian.skor,
          });
        }
      } else {
        await db.frameworks.update(sesi.framework_id, {
          skor_terakhir: penilaian.skor,
        });
      }
    },
  );

  // Status dihitung ulang setelah transaksi (baca data terbaru).
  await refreshFrameworkStatus(sesi.framework_id);
  const pemakaian = pemakaianIdTerakhir(sesi.id);
  const reuseBerikutnya = await db.jadwal_reuse
    .where('framework_id')
    .equals(sesi.framework_id)
    .filter((j) => j.status === 'terjadwal')
    .sortBy('jatuh_tempo');
  return {
    pemakaian: await pemakaian,
    reuseBerikutnya: reuseBerikutnya[0]?.jatuh_tempo ?? null,
  };
}

async function pemakaianIdTerakhir(sesiId: string): Promise<Pemakaian | null> {
  // `.filter`, bukan `.where('sesi_id')`: pemakaian tidak mengindeks
  // sesi_id (skema v1) dan `.where` pada keyPath tanpa indeks melempar
  // SchemaError — bug ini membuat selesaikanSesi selalu melempar
  // SETELAH transaksi commit (sesi tertutup, tapi layar penilaian
  // menampilkan pesan error mentah). Tabel pemakaian kecil (satu baris
  // per sesi selesai), jadi pemindaian penuh tidak masalah.
  const daftar = await db.pemakaian.filter((p) => p.sesi_id === sesiId).toArray();
  return daftar[0] ?? null;
}

/** Tandai framework "tidak relevan": batalkan re-use terjadwal/terlewat. */
export async function tandaiTidakRelevan(frameworkId: string): Promise<void> {
  const tanggal = hariIni();
  await db.transaction('rw', db.frameworks, db.jadwal_reuse, async () => {
    await db.frameworks.update(frameworkId, { tidak_relevan_pada: tanggal });
    const terbuka = await db.jadwal_reuse
      .where('framework_id')
      .equals(frameworkId)
      .filter((j) => j.status === 'terjadwal' || j.status === 'terlewat')
      .toArray();
    for (const j of terbuka) {
      await db.jadwal_reuse.update(j.id, { status: 'dibatalkan' });
    }
  });
  await refreshFrameworkStatus(frameworkId);
}

/** Aktifkan kembali framework yang tidak relevan. */
export async function aktifkanKembali(frameworkId: string): Promise<void> {
  await db.frameworks.update(frameworkId, { diaktifkan_pada: hariIni() });
  await refreshFrameworkStatus(frameworkId);
}

/** Simpan tulisan "kapan tidak pakai" (syarat kemandirian). */
export async function simpanKapanTidakPakai(
  frameworkId: string,
  teks: string,
): Promise<void> {
  await db.frameworks.update(frameworkId, { kapan_tidak_pakai: teks.trim() || null });
  await refreshFrameworkStatus(frameworkId);
}

/**
 * Tandai framework "sudah dikenal" (dari detail framework). Bukan status.
 * Status tetap dihitung dari pemakaian, jadi tidak memanggil
 * refreshFrameworkStatus. Idempotent: memanggil dua kali hanya memperbarui
 * tanggalnya.
 */
export async function tandaiDikenal(frameworkId: string): Promise<void> {
  await db.frameworks.update(frameworkId, { dikenal_pada: hariIni() });
}

/**
 * Terapkan jawaban onboarding ke domain (PRD M0): buat masalah dari
 * langkah pertama (jika dijawab). Jawaban mentah + flag selesai disimpan
 * terpisah di store.ts. Idempotensi penyelesaian dijaga di komponen lewat
 * `bolehSelesaikan()`. Fungsi ini sendiri sengaja tidak tahu apakah
 * onboarding sudah selesai.
 */
export async function terapkanHasilOnboarding(
  jawaban: JawabanOnboarding,
): Promise<{ masalah: Masalah | null }> {
  const inputMasalah = masalahDariJawaban(jawaban);
  const masalah = inputMasalah ? await buatMasalah(inputMasalah) : null;
  return { masalah };
}

/** Perbarui status re-use yang sudah lewat jatuh tempo menjadi `terlewat`. */
export async function tandaiReuseTerlewat(): Promise<void> {
  const tanggal = hariIni();
  const lewat = await db.jadwal_reuse
    .where('status')
    .equals('terjadwal')
    .filter((j) => j.jatuh_tempo < tanggal)
    .toArray();
  for (const j of lewat) {
    await db.jadwal_reuse.update(j.id, { status: 'terlewat' });
  }
}

/** Ekspor semua data (whitelist field, tidak ada kunci API di app ini). */
export async function eksporData(): Promise<string> {
  const data = {
    versi: 1,
    diekspor_pada: new Date().toISOString(),
    frameworks: await db.frameworks.toArray(),
    edges: await db.edges.toArray(),
    masalah: await db.masalah.toArray(),
    pemakaian: await db.pemakaian.toArray(),
    sesi: await db.sesi.toArray(),
    artefak: await db.artefak.toArray(),
    jadwal_reuse: await db.jadwal_reuse.toArray(),
    progres: await db.progres.toArray(),
    xp_ledger: await db.xp_ledger.toArray(),
    capstone: await db.capstone.toArray(),
    umpan_balik_matching: await db.umpan_balik_matching.toArray(),
  };
  return JSON.stringify(data, null, 2);
}
