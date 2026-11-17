/**
 * State bersama (dokumen 05 §1): masalah aktif + sesi berjalan + profil onboarding.
 * Kecil dan sengaja minimal. Data progres hidup di IndexedDB, bukan di sini.
 * Masalah aktif dan profil onboarding di-persist ke localStorage (pengaturan
 * kecil, dokumen 05 §1). Data domain dari onboarding (masalah pertama)
 * hidup di Dexie, bukan di sini. Lihat db.ts.
 *
 * Persist dilakukan manual (bukan zustand/middleware `persist`, ~2 kB):
 * hanya tiga field yang disimpan, dan formatnya sama dengan zustand persist
 * (`{ state, version }`) supaya instalasi lama tetap terbaca. Merge
 * onboarding dilakukan per-field (bukan timpa mentah seperti merge
 * default zustand), jadi instalasi lama yang menyimpan profil tanpa
 * field baru tetap mendapat nilai awal untuk field itu.
 */
import { create } from 'zustand';
import {
  profilOnboardingAwal,
  type ProfilOnboarding,
} from './onboarding';

interface PadiStore {
  /** Masalah yang sedang dikerjakan user (null = belum ada). */
  masalahAktifId: string | null;
  setMasalahAktif: (id: string | null) => void;
  /** Sesi yang sedang berjalan (timer aktif). Tidak di-persist. Draft sesi
   *  hidup di IndexedDB dan dipulihkan dari sana saat app dibuka lagi. */
  sesiBerjalanId: string | null;
  setSesiBerjalan: (id: string | null) => void;
  /**
   * Profil onboarding (PRD M0): jawaban masalah pertama + flag selesai.
   * `selesai` hanya berubah false → true; mengulang onboarding dari layar
   * Progres memperbarui jawaban tanpa membuka gate lagi.
   */
  onboarding: ProfilOnboarding;
  setOnboarding: (profil: ProfilOnboarding) => void;
  /**
   * Tampilkan edge satu_tema di Peta (default SEMBUNYI = false).
   * satu_tema adalah informasi redundan — pengelompokan tema yang
   * sama sudah kelihatan dari kolomnya — dan menyembunyikannya
   * mengurangi lajur di gutter yang padat (A-B 4 → 3 lajur).
   * Pilihan user di-persist seperti pengaturan kecil lainnya.
   */
  tampilkanSatuTema: boolean;
  setTampilkanSatuTema: (tampil: boolean) => void;
}

const KUNCI_STORE = 'padi-store';

type SliceTersimpan = Pick<
  PadiStore,
  'masalahAktifId' | 'onboarding' | 'tampilkanSatuTema'
>;

/** Baca slice yang di-persist; rusak / tidak ada → kosong (pakai nilai awal). */
function bacaTersimpan(): Partial<SliceTersimpan> {
  try {
    const mentah = localStorage.getItem(KUNCI_STORE);
    if (!mentah) return {};
    const data = JSON.parse(mentah) as { state?: unknown };
    if (!data || typeof data !== 'object') return {};
    const state = data.state;
    if (!state || typeof state !== 'object') return {};
    const hasil: Partial<SliceTersimpan> = {};
    const { masalahAktifId, onboarding, tampilkanSatuTema } =
      state as Record<string, unknown>;
    if (typeof masalahAktifId === 'string' || masalahAktifId === null) {
      hasil.masalahAktifId = masalahAktifId;
    }
    if (typeof tampilkanSatuTema === 'boolean') {
      hasil.tampilkanSatuTema = tampilkanSatuTema;
    }
    if (onboarding && typeof onboarding === 'object') {
      hasil.onboarding = {
        ...profilOnboardingAwal(),
        ...(onboarding as Partial<ProfilOnboarding>),
      };
    }
    return hasil;
  } catch {
    return {};
  }
}

export const usePadiStore = create<PadiStore>()((set) => {
  const tersimpan = bacaTersimpan();
  return {
    masalahAktifId: tersimpan.masalahAktifId ?? null,
    setMasalahAktif: (id) => set({ masalahAktifId: id }),
    sesiBerjalanId: null,
    setSesiBerjalan: (id) => set({ sesiBerjalanId: id }),
    onboarding: tersimpan.onboarding ?? profilOnboardingAwal(),
    setOnboarding: (profil) => set({ onboarding: profil }),
    tampilkanSatuTema: tersimpan.tampilkanSatuTema ?? false,
    setTampilkanSatuTema: (tampil) => set({ tampilkanSatuTema: tampil }),
  };
});

// Tulis balik slice yang di-persist tiap ada perubahan state. Sesi
// berjalan tidak ikut ditulis (dipulihkan dari DB, bukan localStorage).
usePadiStore.subscribe((s) => {
  try {
    localStorage.setItem(
      KUNCI_STORE,
      JSON.stringify({
        state: {
          masalahAktifId: s.masalahAktifId,
          onboarding: s.onboarding,
          tampilkanSatuTema: s.tampilkanSatuTema,
        },
        version: 0,
      }),
    );
  } catch {
    // localStorage penuh / tidak tersedia: abaikan, state tetap jalan.
  }
});
