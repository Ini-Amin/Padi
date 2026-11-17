import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages (project site) menayangkan app di subpath /Padi/,
  // bukan di root domain — semua aset build memakai prefix ini.
  // (Besar-kecil huruf mengikuti nama repo persis.)
  base: '/Padi/',
  plugins: [react()],
  resolve: {
    // Diet bundle: paksa semua import 'dexie' (termasuk dari
    // dexie-react-hooks) ke build ESM, supaya Rollup bisa tree-shake.
    // Tanpa alias, import-wrapper.mjs menarik build CJS (dexie.js)
    // yang tidak bisa di-tree-shake. Hemat terukur ~0,85 kB.
    // Satu salinan tetap terjaga karena SEMUA import dialihkan ke
    // modul ESM yang sama (tidak ada dual-package hazard).
    alias: [{ find: /^dexie$/, replacement: 'dexie/dist/dexie.mjs' }],
  },
  build: {
    // modulepreload didukung semua browser modern (Chrome 66+, Firefox
    // 115+, Safari 17+); polyfill 1,2 kB tidak perlu.
    modulePreload: { polyfill: false },
    // Target modern (Chrome 94+, Safari 16.4+): output sedikit lebih kecil.
    target: 'es2022',
  },
})
