/** Factory entitas untuk pengujian. Bukan file test — tidak dieksekusi vitest. */
import type {
  Artefak,
  Framework,
  ISODate,
  JadwalReuse,
  Masalah,
  Pemakaian,
} from '../src/domain';

let counter = 0;
function idUnik(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

export function buatMasalah(overrides: Partial<Masalah> = {}): Masalah {
  return {
    id: idUnik('masalah'),
    judul: 'Masalah contoh',
    deskripsi: '',
    kriteria: [],
    status: 'aktif',
    dibuat_pada: '2026-11-16' as ISODate,
    selesai_pada: null,
    ...overrides,
  };
}

export function buatPemakaian(overrides: Partial<Pemakaian> = {}): Pemakaian {
  return {
    id: idUnik('pemakaian'),
    framework_id: 'pestel',
    masalah_id: 'masalah-1',
    sesi_id: idUnik('sesi'),
    tanggal: '2026-11-16' as ISODate,
    skor: 2,
    ...overrides,
  };
}

export function buatFramework(overrides: Partial<Framework> = {}): Framework {
  return {
    id: 'pestel',
    nama: 'PESTEL Analysis',
    tema: 'A',
    urutan_katalog: 1,
    ringkasan: 'Ringkasan contoh.',
    ide_kunci: ['Satu', 'Dua', 'Tiga'],
    keterbatasan: 'Keterbatasan contoh.',
    signature_masalah: ['memecah_variabel_eksternal'],
    lapis_a_pemetaan: 'Lapis a.',
    lapis_b_prosedur: 'Lapis b.',
    lapis_c_kesalahan: 'Lapis c.',
    sumber: 'Sumber contoh.',
    diedit_user: false,
    status: 'belum_dipakai',
    skor_terakhir: null,
    dipakai_pertama_pada: null,
    dikuasai_pada: null,
    kapan_tidak_pakai: null,
    dikenal_pada: null,
    tidak_relevan_pada: null,
    diaktifkan_pada: null,
    artefak_ids: [],
    ...overrides,
  };
}

export function buatArtefak(overrides: Partial<Artefak> = {}): Artefak {
  return {
    id: idUnik('artefak'),
    framework_id: 'pestel',
    masalah_id: 'masalah-1',
    sesi_id: idUnik('sesi'),
    jenis: 'teks',
    judul: 'Artefak contoh',
    isi: 'Isi contoh.',
    perusahaan: null,
    kualitas_lengkap: false,
    kualitas_prioritasi: false,
    kualitas_rekomendasi: false,
    kualitas_terpenuhi: false,
    dibuat_pada: '2026-11-16' as ISODate,
    terakhir_dibuka: '2026-11-16' as ISODate,
    ...overrides,
  };
}

export function buatJadwal(overrides: Partial<JadwalReuse> = {}): JadwalReuse {
  return {
    id: idUnik('jadwal'),
    pemakaian_id: 'pemakaian-1',
    framework_id: 'pestel',
    jenis_reuse: 'H+1',
    jatuh_tempo: '2026-11-17' as ISODate,
    status: 'terjadwal',
    skor: null,
    sesi_id: null,
    reuse_asli_id: null,
    catch_up_group_id: null,
    ...overrides,
  };
}
