/**
 * Status framework: modul murni, SATU-SATUNYA tempat logika status
 * (dokumen 03 §2.3, fungsi `hitungStatus`).
 *
 * Definisi "dikuasai" v0.5 (tiga syarat, semuanya wajib):
 * (a) Transfer: dipakai untuk ≥2 masalah berbeda dengan skor ≥2.
 * (b) Artefak berkualitas: ≥1 artefak dengan checklist lengkap.
 * (c) Kemandirian: kolom `kapan_tidak_pakai` terisi.
 *
 * Catatan: re-use H+30 BUKAN syarat "dikuasai" di v0.5 (US-2.5). H+30
 * adalah ukuran retensi, bukan syarat status. Definisi dua tingkat v0.4
 * (termasuk lencana H+30) sudah dihapus oleh pivot.
 */
import type {
  Artefak,
  Framework,
  ISODate,
  JadwalReuse,
  Masalah,
  Pemakaian,
  StatusFramework,
} from './domain';

/** Normalisasi judul masalah untuk perbandingan kesamaan. */
function normalisasiJudul(judul: string): string {
  return judul.trim().toLowerCase();
}

/** Kriteria sebagai himpunan terurut (urutan penulisan tidak berpengaruh). */
function kunciKriteria(kriteria: string[]): string {
  return [...kriteria].sort().join('|');
}

/**
 * Dua masalah dihitung BERBEDA jika judul ATAU kriterianya berbeda
 * (dokumen 03 §7). Masalah dengan judul dan kriteria identik dihitung satu:
 * mencegah "transfer palsu" dari masalah yang sama ditulis ulang.
 */
export function masalahBerbeda(a: Masalah, b: Masalah): boolean {
  return (
    normalisasiJudul(a.judul) !== normalisasiJudul(b.judul) ||
    kunciKriteria(a.kriteria) !== kunciKriteria(b.kriteria)
  );
}

/**
 * Syarat transfer: ada pemakaian untuk ≥2 masalah BERBEDA dengan skor ≥2.
 * `masalahById` memetakan masalah_id → Masalah (untuk uji kesamaan).
 */
export function cekTransfer(
  pemakaian: Pemakaian[],
  masalahById: ReadonlyMap<string, Masalah>,
): boolean {
  const masalahLayak: Masalah[] = [];
  for (const p of pemakaian) {
    if (p.skor < 2) continue;
    const m = masalahById.get(p.masalah_id);
    if (!m) continue;
    if (!masalahLayak.some((sudah) => !masalahBerbeda(sudah, m))) {
      masalahLayak.push(m);
    }
    if (masalahLayak.length >= 2) return true;
  }
  return false;
}

/** Jumlah masalah berbeda (skor ≥2), untuk tampilan indikator progres. */
export function hitungMasalahBerbeda(
  pemakaian: Pemakaian[],
  masalahById: ReadonlyMap<string, Masalah>,
): number {
  const masalahLayak: Masalah[] = [];
  for (const p of pemakaian) {
    if (p.skor < 2) continue;
    const m = masalahById.get(p.masalah_id);
    if (!m) continue;
    if (!masalahLayak.some((sudah) => !masalahBerbeda(sudah, m))) {
      masalahLayak.push(m);
    }
  }
  return masalahLayak.length;
}

/** Artefak berkualitas = ketiga checklist terpenuhi (dokumen 03 §7). */
export function cekArtefakBerkualitas(a: Artefak): boolean {
  return a.kualitas_lengkap && a.kualitas_prioritasi && a.kualitas_rekomendasi;
}

/** Kemandirian: kolom "kapan tidak pakai" terisi (bukan kosong/spasi). */
export function cekKemandirian(f: Framework): boolean {
  return (f.kapan_tidak_pakai ?? '').trim().length > 0;
}

/**
 * Framework adalah "materi baru" jika belum pernah dipakai DI APP dan belum
 * dikenal user sebelumnya (ditandai dari detail framework, `dikenal_pada`).
 * Dipakai matcher untuk slot eksplorasi "coba yang belum pernah". Framework
 * yang sudah dikenal user langsung ke penerapan, bukan ditawarkan sebagai
 * materi baru.
 * `== null` sengaja: baris lama (sebelum field ini ada) tidak punya nilai
 * dan harus tetap dihitung "belum dikenal".
 */
export function materiBaru(
  framework: Framework,
  pernahDipakai: boolean,
): boolean {
  return !pernahDipakai && framework.dikenal_pada == null;
}

export interface SyaratDikuasai {
  transfer: boolean;
  artefakBerkualitas: boolean;
  kemandirian: boolean;
  /** Ketiganya terpenuhi. */
  semua: boolean;
}

export function cekSyaratDikuasai(
  framework: Framework,
  pemakaian: Pemakaian[],
  artefak: Artefak[],
  masalahById: ReadonlyMap<string, Masalah>,
): SyaratDikuasai {
  const transfer = cekTransfer(pemakaian, masalahById);
  const artefakBerkualitas = artefak.some(cekArtefakBerkualitas);
  const kemandirian = cekKemandirian(framework);
  return {
    transfer,
    artefakBerkualitas,
    kemandirian,
    semua: transfer && artefakBerkualitas && kemandirian,
  };
}

export interface KonteksStatus {
  framework: Framework;
  pemakaian: Pemakaian[];
  artefak: Artefak[];
  jadwalReuse: JadwalReuse[];
  masalahById: ReadonlyMap<string, Masalah>;
  hariIni: ISODate;
}

/**
 * Satu-satunya fungsi penentu status (dokumen 03 §2.3). Urutan penting:
 * disembunyikan > belum_dipakai > perlu_reuse > dikuasai > dipakai.
 * Perlu_reuse mengalahkan dikuasai: framework yang dikuasai tapi punya
 * re-use jatuh tempo tampil oranye, bukan hijau.
 */
export function hitungStatus(ctx: KonteksStatus): StatusFramework {
  const f = ctx.framework;
  const tidakRelevanAktif =
    f.tidak_relevan_pada !== null &&
    (f.diaktifkan_pada === null || f.tidak_relevan_pada > f.diaktifkan_pada);
  if (tidakRelevanAktif) return 'disembunyikan';
  if (ctx.pemakaian.length === 0) return 'belum_dipakai';
  const adaReuseJatuhTempo = ctx.jadwalReuse.some(
    (j) =>
      (j.status === 'terjadwal' || j.status === 'terlewat') &&
      j.jatuh_tempo <= ctx.hariIni,
  );
  if (adaReuseJatuhTempo) return 'perlu_reuse';
  const syarat = cekSyaratDikuasai(f, ctx.pemakaian, ctx.artefak, ctx.masalahById);
  if (syarat.semua) return 'dikuasai';
  return 'dipakai';
}

/** Warna node (dokumen 04 §2) untuk tiap status. */
export const WARNA_STATUS: Record<StatusFramework, string> = {
  belum_dipakai: 'abu-abu',
  disembunyikan: 'abu-abu',
  dipakai: 'kuning',
  dikuasai: 'hijau',
  perlu_reuse: 'oranye',
};

export const LABEL_STATUS: Record<StatusFramework, string> = {
  belum_dipakai: 'Belum dipakai',
  dipakai: 'Pernah dipakai',
  dikuasai: 'Dikuasai',
  perlu_reuse: 'Perlu re-use',
  disembunyikan: 'Tidak relevan',
};
