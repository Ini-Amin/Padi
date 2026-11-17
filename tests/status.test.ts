/**
 * Uji status framework: definisi "dikuasai" 3 syarat (dokumen 07 §3.1).
 * Semua 8 kombinasi syarat diuji eksplisit, ditambah property test.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { ISODate, Masalah, Pemakaian } from '../src/domain';
import {
  cekArtefakBerkualitas,
  cekSyaratDikuasai,
  cekTransfer,
  hitungStatus,
  masalahBerbeda,
  type KonteksStatus,
} from '../src/status';
import { buatArtefak, buatFramework, buatJadwal, buatMasalah, buatPemakaian } from './factories';

const HARI_INI = '2026-11-20' as ISODate;

function konteks(
  opts: {
    transfer?: boolean;
    artefakBerkualitas?: boolean;
    kemandirian?: boolean;
    adaPemakaian?: boolean;
    reuseJatuhTempo?: boolean;
    tidakRelevan?: boolean;
    diaktifkanKembali?: boolean;
  } = {},
): KonteksStatus {
  const masalahA = buatMasalah({ id: 'm-a', judul: 'Masalah A', kriteria: ['eksternal'] });
  const masalahB = buatMasalah({ id: 'm-b', judul: 'Masalah B', kriteria: ['persaingan'] });
  const masalahById = new Map<string, Masalah>([
    [masalahA.id, masalahA],
    [masalahB.id, masalahB],
  ]);

  let pemakaian: Pemakaian[] = [];
  if (opts.adaPemakaian ?? true) {
    pemakaian = [
      buatPemakaian({ masalah_id: masalahA.id, skor: 2 }),
      ...(opts.transfer
        ? [buatPemakaian({ masalah_id: masalahB.id, skor: 2 })]
        : [buatPemakaian({ masalah_id: masalahA.id, skor: 2 })]),
    ];
  }

  const artefak = opts.artefakBerkualitas
    ? [
        buatArtefak({
          kualitas_lengkap: true,
          kualitas_prioritasi: true,
          kualitas_rekomendasi: true,
          kualitas_terpenuhi: true,
        }),
      ]
    : [];

  const framework = buatFramework({
    kapan_tidak_pakai: opts.kemandirian ? 'PESTEL salah alat untuk masalah internal.' : null,
    tidak_relevan_pada: opts.tidakRelevan ? ('2026-11-19' as ISODate) : null,
    diaktifkan_pada: opts.diaktifkanKembali ? ('2026-11-20' as ISODate) : null,
  });

  const jadwal = opts.reuseJatuhTempo
    ? [buatJadwal({ status: 'terjadwal', jatuh_tempo: '2026-11-20' as ISODate })]
    : [];

  return { framework, pemakaian, artefak, jadwalReuse: jadwal, masalahById, hariIni: HARI_INI };
}

describe('hitungStatus: 8 kombinasi syarat "dikuasai"', () => {
  const kasus: Array<{
    nama: string;
    opts: Parameters<typeof konteks>[0];
    status: string;
  }> = [
    { nama: 'tidak ada syarat', opts: {}, status: 'dipakai' },
    { nama: 'transfer saja', opts: { transfer: true }, status: 'dipakai' },
    { nama: 'artefak saja', opts: { artefakBerkualitas: true }, status: 'dipakai' },
    { nama: 'kemandirian saja', opts: { kemandirian: true }, status: 'dipakai' },
    {
      nama: 'transfer + artefak (tanpa kemandirian)',
      opts: { transfer: true, artefakBerkualitas: true },
      status: 'dipakai',
    },
    {
      nama: 'transfer + kemandirian (tanpa artefak)',
      opts: { transfer: true, kemandirian: true },
      status: 'dipakai',
    },
    {
      nama: 'artefak + kemandirian (tanpa transfer)',
      opts: { artefakBerkualitas: true, kemandirian: true },
      status: 'dipakai',
    },
    {
      nama: 'ketiga syarat terpenuhi',
      opts: { transfer: true, artefakBerkualitas: true, kemandirian: true },
      status: 'dikuasai',
    },
  ];

  for (const k of kasus) {
    it(`${k.nama} → ${k.status}`, () => {
      expect(hitungStatus(konteks(k.opts))).toBe(k.status);
    });
  }
});

describe('hitungStatus: urutan prioritas', () => {
  it('tanpa pemakaian → belum_dipakai', () => {
    expect(hitungStatus(konteks({ adaPemakaian: false }))).toBe('belum_dipakai');
  });

  it('perlu_reuse mengalahkan dikuasai (ketiga syarat + re-use jatuh tempo → oranye)', () => {
    expect(
      hitungStatus(
        konteks({
          transfer: true,
          artefakBerkualitas: true,
          kemandirian: true,
          reuseJatuhTempo: true,
        }),
      ),
    ).toBe('perlu_reuse');
  });

  it('disembunyikan mengalahkan segalanya', () => {
    expect(
      hitungStatus(
        konteks({
          transfer: true,
          artefakBerkualitas: true,
          kemandirian: true,
          tidakRelevan: true,
        }),
      ),
    ).toBe('disembunyikan');
  });

  it('diaktifkan kembali setelah tidak relevan → status normal lagi', () => {
    expect(
      hitungStatus(
        konteks({
          transfer: true,
          artefakBerkualitas: true,
          kemandirian: true,
          tidakRelevan: true,
          diaktifkanKembali: true,
        }),
      ),
    ).toBe('dikuasai');
  });

  it('re-use yang jatuh tempo BESOK tidak membuat perlu_reuse', () => {
    const ctx = konteks({
      transfer: true,
      artefakBerkualitas: true,
      kemandirian: true,
    });
    ctx.jadwalReuse = [buatJadwal({ status: 'terjadwal', jatuh_tempo: '2026-11-21' as ISODate })];
    expect(hitungStatus(ctx)).toBe('dikuasai');
  });
});

describe('cekSyaratDikuasai: H+30 BUKAN syarat (v0.5, US-2.5)', () => {
  it('ketiga syarat terpenuhi tanpa re-use H+30 apa pun → semua: true', () => {
    const ctx = konteks({
      transfer: true,
      artefakBerkualitas: true,
      kemandirian: true,
    });
    const syarat = cekSyaratDikuasai(ctx.framework, ctx.pemakaian, ctx.artefak, ctx.masalahById);
    expect(syarat.semua).toBe(true);
  });
});

describe('masalahBerbeda: definisi transfer (dokumen 03 §7)', () => {
  it('judul + kriteria identik → TIDAK berbeda (transfer palsu dicegah)', () => {
    const a = buatMasalah({ judul: 'Fokus segmen?', kriteria: ['tidak_tahu_fokus'] });
    const b = buatMasalah({ judul: '  fokus SEGMEN? ', kriteria: ['tidak_tahu_fokus'] });
    expect(masalahBerbeda(a, b)).toBe(false);
  });

  it('urutan kriteria berbeda tidak membuat masalah berbeda', () => {
    const a = buatMasalah({ judul: 'X', kriteria: ['eksternal', 'persaingan'] });
    const b = buatMasalah({ judul: 'X', kriteria: ['persaingan', 'eksternal'] });
    expect(masalahBerbeda(a, b)).toBe(false);
  });

  it('judul berbeda → berbeda, meski kriteria sama', () => {
    const a = buatMasalah({ judul: 'Masalah satu', kriteria: ['eksternal'] });
    const b = buatMasalah({ judul: 'Masalah dua', kriteria: ['eksternal'] });
    expect(masalahBerbeda(a, b)).toBe(true);
  });

  it('kriteria berbeda → berbeda, meski judul sama', () => {
    const a = buatMasalah({ judul: 'Masalah yang sama', kriteria: ['eksternal'] });
    const b = buatMasalah({ judul: 'Masalah yang sama', kriteria: ['persaingan'] });
    expect(masalahBerbeda(a, b)).toBe(true);
  });
});

describe('cekTransfer', () => {
  it('2 pemakaian skor ≥2 untuk masalah identik → TIDAK transfer', () => {
    const m = buatMasalah({ id: 'm-1', judul: 'Sama', kriteria: ['eksternal'] });
    const byId = new Map([['m-1', m]]);
    const pemakaian = [
      buatPemakaian({ masalah_id: 'm-1', skor: 2 }),
      buatPemakaian({ masalah_id: 'm-1', skor: 3 }),
    ];
    expect(cekTransfer(pemakaian, byId)).toBe(false);
  });

  it('2 pemakaian skor ≥2 untuk 2 masalah berbeda → transfer', () => {
    const a = buatMasalah({ id: 'm-a', judul: 'A', kriteria: ['eksternal'] });
    const b = buatMasalah({ id: 'm-b', judul: 'B', kriteria: ['persaingan'] });
    const byId = new Map([
      ['m-a', a],
      ['m-b', b],
    ]);
    const pemakaian = [
      buatPemakaian({ masalah_id: 'm-a', skor: 2 }),
      buatPemakaian({ masalah_id: 'm-b', skor: 3 }),
    ];
    expect(cekTransfer(pemakaian, byId)).toBe(true);
  });

  it('skor <2 tidak dihitung untuk transfer', () => {
    const a = buatMasalah({ id: 'm-a', judul: 'A', kriteria: ['eksternal'] });
    const b = buatMasalah({ id: 'm-b', judul: 'B', kriteria: ['persaingan'] });
    const byId = new Map([
      ['m-a', a],
      ['m-b', b],
    ]);
    const pemakaian = [
      buatPemakaian({ masalah_id: 'm-a', skor: 2 }),
      buatPemakaian({ masalah_id: 'm-b', skor: 1 }),
    ];
    expect(cekTransfer(pemakaian, byId)).toBe(false);
  });
});

describe('cekArtefakBerkualitas', () => {
  it('ketiga checklist wajib: 2 dari 3 tidak cukup', () => {
    expect(
      cekArtefakBerkualitas(
        buatArtefak({ kualitas_lengkap: true, kualitas_prioritasi: true, kualitas_rekomendasi: false }),
      ),
    ).toBe(false);
    expect(
      cekArtefakBerkualitas(
        buatArtefak({ kualitas_lengkap: true, kualitas_prioritasi: true, kualitas_rekomendasi: true }),
      ),
    ).toBe(true);
  });
});

describe('property: dikuasai ⟺ ketiga syarat', () => {
  it('untuk semua kombinasi boolean, status dikuasai tepat saat ketiga syarat true', () => {
    fc.assert(
      fc.property(fc.boolean(), fc.boolean(), fc.boolean(), (t, a, k) => {
        const ctx = konteks({
          transfer: t,
          artefakBerkualitas: a,
          kemandirian: k,
        });
        const status = hitungStatus(ctx);
        expect(status === 'dikuasai').toBe(t && a && k);
      }),
    );
  });

  it('tanpa pemakaian, status tidak pernah dikuasai/dipakai/perlu_reuse', () => {
    fc.assert(
      fc.property(fc.boolean(), fc.boolean(), fc.boolean(), (t, a, k) => {
        const ctx = konteks({
          transfer: t,
          artefakBerkualitas: a,
          kemandirian: k,
          adaPemakaian: false,
        });
        expect(hitungStatus(ctx)).toBe('belum_dipakai');
      }),
    );
  });

  it('kualitas_terpenuhi ⟺ ketiga checklist (untuk semua kombinasi)', () => {
    fc.assert(
      fc.property(fc.boolean(), fc.boolean(), fc.boolean(), (l, p, r) => {
        const a = buatArtefak({
          kualitas_lengkap: l,
          kualitas_prioritasi: p,
          kualitas_rekomendasi: r,
        });
        expect(cekArtefakBerkualitas(a)).toBe(l && p && r);
      }),
    );
  });
});
