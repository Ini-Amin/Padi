/**
 * Uji persist manual store.ts (pengganti zustand/middleware `persist`):
 * baca format zustand (`{ state, version }`) supaya instalasi lama
 * tetap terbaca, tulis balik tiap perubahan, dan jatuh ke nilai awal
 * bila data rusak. Store adalah singleton modul, jadi tiap kasus
 * memuat ulang modul dengan `vi.resetModules()`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { profilOnboardingAwal } from '../src/onboarding';

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

async function muatStore(isi: Record<string, string> = {}) {
  vi.resetModules();
  const ls = buatLocalStorage(isi);
  vi.stubGlobal('localStorage', ls);
  const { usePadiStore } = await import('../src/store');
  return { usePadiStore, ls };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('store: persist manual', () => {
  it('nilai awal saat localStorage kosong', async () => {
    const { usePadiStore } = await muatStore();
    const s = usePadiStore.getState();
    expect(s.masalahAktifId).toBeNull();
    expect(s.sesiBerjalanId).toBeNull();
    expect(s.onboarding.selesai).toBe(false);
    expect(s.onboarding).toEqual(profilOnboardingAwal());
  });

  it('menghidrasi dari format zustand persist instalasi lama', async () => {
    const profil = {
      ...profilOnboardingAwal(),
      selesai: true,
      masalahId: 'm1',
    };
    const { usePadiStore } = await muatStore({
      'padi-store': JSON.stringify({
        state: { masalahAktifId: 'm1', onboarding: profil },
        version: 0,
      }),
    });
    const s = usePadiStore.getState();
    expect(s.masalahAktifId).toBe('m1');
    expect(s.onboarding).toEqual(profil);
    // Sesi berjalan tidak pernah di-persist.
    expect(s.sesiBerjalanId).toBeNull();
  });

  it('menulis balik format yang sama tiap perubahan (tanpa sesi berjalan)', async () => {
    const { usePadiStore, ls } = await muatStore();
    usePadiStore.getState().setMasalahAktif('m2');
    usePadiStore.getState().setSesiBerjalan('s9');
    const tersimpan = JSON.parse(ls.getItem('padi-store') ?? '{}') as {
      state: Record<string, unknown>;
      version: number;
    };
    expect(tersimpan.version).toBe(0);
    expect(tersimpan.state.masalahAktifId).toBe('m2');
    expect(tersimpan.state.onboarding).toEqual(profilOnboardingAwal());
    expect(tersimpan.state).not.toHaveProperty('sesiBerjalanId');
  });

  it('JSON rusak jatuh ke nilai awal tanpa throw', async () => {
    const { usePadiStore } = await muatStore({
      'padi-store': '{bukan json',
    });
    const s = usePadiStore.getState();
    expect(s.masalahAktifId).toBeNull();
    expect(s.onboarding).toEqual(profilOnboardingAwal());
  });

  it('instalasi lama tanpa kunci onboarding memakai nilai awal', async () => {
    const { usePadiStore } = await muatStore({
      'padi-store': JSON.stringify({
        state: { masalahAktifId: 'm3' },
        version: 0,
      }),
    });
    const s = usePadiStore.getState();
    expect(s.masalahAktifId).toBe('m3');
    expect(s.onboarding).toEqual(profilOnboardingAwal());
  });

  it('profil tersimpan tanpa field baru dilengkapi nilai awal', async () => {
    const { masalahId: _buang, ...profilLama } = {
      ...profilOnboardingAwal(),
      selesai: true,
    };
    const { usePadiStore } = await muatStore({
      'padi-store': JSON.stringify({
        state: { masalahAktifId: null, onboarding: profilLama },
        version: 0,
      }),
    });
    const s = usePadiStore.getState();
    expect(s.onboarding.selesai).toBe(true);
    expect(s.onboarding.masalahId).toBeNull();
  });

  it('tampilkanSatuTema default false (sembunyi) saat localStorage kosong', async () => {
    const { usePadiStore } = await muatStore();
    expect(usePadiStore.getState().tampilkanSatuTema).toBe(false);
  });

  it('menghidrasi tampilkanSatuTema true dari instalasi lama', async () => {
    const { usePadiStore } = await muatStore({
      'padi-store': JSON.stringify({
        state: {
          masalahAktifId: null,
          onboarding: profilOnboardingAwal(),
          tampilkanSatuTema: true,
        },
        version: 0,
      }),
    });
    expect(usePadiStore.getState().tampilkanSatuTema).toBe(true);
  });

  it('instalasi lama tanpa kunci tampilkanSatuTema memakai default false', async () => {
    const { usePadiStore } = await muatStore({
      'padi-store': JSON.stringify({
        state: { masalahAktifId: null, onboarding: profilOnboardingAwal() },
        version: 0,
      }),
    });
    expect(usePadiStore.getState().tampilkanSatuTema).toBe(false);
  });

  it('menulis balik tampilkanSatuTema tiap perubahan', async () => {
    const { usePadiStore, ls } = await muatStore();
    usePadiStore.getState().setTampilkanSatuTema(true);
    const tersimpan = JSON.parse(ls.getItem('padi-store') ?? '{}') as {
      state: Record<string, unknown>;
      version: number;
    };
    expect(tersimpan.version).toBe(0);
    expect(tersimpan.state.tampilkanSatuTema).toBe(true);
    // Nilai bukan boolean diabaikan (jatuh ke default false).
    const { usePadiStore: toko2 } = await muatStore({
      'padi-store': JSON.stringify({
        state: { tampilkanSatuTema: 'ya' },
        version: 0,
      }),
    });
    expect(toko2.getState().tampilkanSatuTema).toBe(false);
  });
});
