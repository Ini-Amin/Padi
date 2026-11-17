/**
 * State bersama (dokumen 05 §1): masalah aktif + sesi berjalan + profil onboarding.
 * Kecil dan sengaja minimal — data progres hidup di IndexedDB, bukan di sini.
 * Masalah aktif dan profil onboarding di-persist ke localStorage (pengaturan
 * kecil, dokumen 05 §1). Data domain dari onboarding (masalah Q1, framework
 * dikenal Q3) hidup di Dexie, bukan di sini — lihat db.ts.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  profilOnboardingAwal,
  type ProfilOnboarding,
} from './onboarding';

interface PadiStore {
  /** Masalah yang sedang dikerjakan user (null = belum ada). */
  masalahAktifId: string | null;
  setMasalahAktif: (id: string | null) => void;
  /** Sesi yang sedang berjalan (timer aktif). Tidak di-persist — draft sesi
   *  hidup di IndexedDB dan dipulihkan dari sana saat app dibuka lagi. */
  sesiBerjalanId: string | null;
  setSesiBerjalan: (id: string | null) => void;
  /**
   * Profil onboarding (PRD M0): jawaban 6 pertanyaan + flag selesai.
   * `selesai` hanya berubah false → true; mengulang onboarding dari layar
   * Progres memperbarui jawaban tanpa membuka gate lagi.
   */
  onboarding: ProfilOnboarding;
  setOnboarding: (profil: ProfilOnboarding) => void;
}

export const usePadiStore = create<PadiStore>()(
  persist(
    (set) => ({
      masalahAktifId: null,
      setMasalahAktif: (id) => set({ masalahAktifId: id }),
      sesiBerjalanId: null,
      setSesiBerjalan: (id) => set({ sesiBerjalanId: id }),
      onboarding: profilOnboardingAwal(),
      setOnboarding: (profil) => set({ onboarding: profil }),
    }),
    {
      name: 'padi-store',
      // Hanya masalah aktif + profil onboarding yang di-persist; sesi
      // berjalan dipulihkan dari DB. Instalasi lama tanpa kunci `onboarding`
      // memakai nilai awal (belum selesai) dari merge zustand.
      partialize: (s) => ({
        masalahAktifId: s.masalahAktifId,
        onboarding: s.onboarding,
      }),
    },
  ),
);
