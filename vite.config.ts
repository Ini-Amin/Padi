import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages (project site) menayangkan app di subpath /Padi/,
  // bukan di root domain — semua aset build memakai prefix ini.
  // (Besar-kecil huruf mengikuti nama repo persis.)
  base: '/Padi/',
  plugins: [react()],
})
