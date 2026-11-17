/**
 * Uji PWA — pwa.ts + manifest + service worker.
 * Registrasi dijaga agar tidak pernah merusak lingkungan tanpa service
 * worker (test Node di sini); manifest dan sw.js diperiksa sebagai file.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  daftarkanServiceWorker,
  serviceWorkerDidukung,
} from '../src/pwa';

const DIR_TEST = dirname(fileURLToPath(import.meta.url));
const DIR_PUBLIC = join(DIR_TEST, '../public');

interface IkonManifest {
  src: string;
  sizes: string;
  type: string;
  purpose?: string;
}

interface Manifest {
  name: string;
  short_name: string;
  lang: string;
  start_url: string;
  display: string;
  theme_color: string;
  background_color: string;
  icons: IkonManifest[];
}

const manifest = JSON.parse(
  readFileSync(join(DIR_PUBLIC, 'manifest.webmanifest'), 'utf-8'),
) as Manifest;

const sw = readFileSync(join(DIR_PUBLIC, 'sw.js'), 'utf-8');

describe('registrasi service worker (lingkungan tanpa SW)', () => {
  it('serviceWorkerDidukung() false di Node (tanpa navigator)', () => {
    expect(serviceWorkerDidukung()).toBe(false);
  });

  it('daftarkanServiceWorker() tidak melempar dan mengembalikan false di Node', async () => {
    await expect(daftarkanServiceWorker()).resolves.toBe(false);
  });
});

describe('manifest.webmanifest', () => {
  it('identitas Padi lengkap dan berbahasa Indonesia', () => {
    expect(manifest.name).toContain('Padi');
    expect(manifest.short_name).toBe('Padi');
    expect(manifest.lang).toBe('id');
    expect(manifest.start_url).toBe('./');
    expect(manifest.display).toBe('standalone');
  });

  it('warna tema = kuning aksen app, latar = warna latar app', () => {
    expect(manifest.theme_color).toBe('#F5D90A');
    expect(manifest.background_color).toBe('#FBFBF8');
  });

  it('menyediakan ikon PNG 192 dan 512 + maskable + SVG, semua src relatif', () => {
    const ukuran = manifest.icons.map((i) => `${i.sizes}|${i.purpose ?? 'any'}`);
    expect(ukuran).toContain('192x192|any');
    expect(ukuran).toContain('512x512|any');
    expect(ukuran).toContain('512x512|maskable');
    expect(manifest.icons.some((i) => i.type === 'image/svg+xml')).toBe(true);
    for (const ikon of manifest.icons) {
      expect(ikon.src.startsWith('/')).toBe(false);
    }
  });

  it('semua file ikon yang dirujuk manifest ada di public/', () => {
    for (const ikon of manifest.icons) {
      expect(
        existsSync(join(DIR_PUBLIC, ikon.src)),
        `ikon ${ikon.src} tidak ada`,
      ).toBe(true);
    }
  });
});

describe('sw.js', () => {
  it('memakai cache berversi + skipWaiting + clients.claim', () => {
    expect(sw).toMatch(/const CACHE = 'padi-v\d+'/);
    expect(sw).toContain('skipWaiting');
    expect(sw).toContain('clients.claim');
  });

  it('menangani fetch: navigasi network-first, aset cache-first', () => {
    expect(sw).toContain("addEventListener('fetch'");
    expect(sw).toContain("request.mode === 'navigate'");
    expect(sw).toContain('caches.match');
  });

  it('precache mencakup app shell + graph.json', () => {
    for (const aset of ['index.html', 'data/graph.json', 'manifest.webmanifest']) {
      expect(sw).toContain(`'${aset}'`);
    }
  });

  it('hanya menyentuh request GET same-origin', () => {
    expect(sw).toContain("request.method !== 'GET'");
    expect(sw).toContain('url.origin !== self.location.origin');
  });
});
