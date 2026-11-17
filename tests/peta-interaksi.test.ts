/**
 * Smoke test komponen Peta: render server-side (tanpa DOM) hanya memastikan
 * komponen mount tanpa crash dan menampilkan state memuat — Dexie belum
 * resolve di SSR karena efek tidak berjalan. Logika interaksi (sorot,
 * redup, closure prasyarat) diuji murni di graph-layout.test.ts.
 * Tidak ada testing-library di repo ini.
 */
import 'fake-indexeddb/auto';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GraphSvg } from '../src/components/GraphSvg';
import { MapList } from '../src/components/MapList';

describe('GraphSvg: smoke render', () => {
  it('render tanpa crash, menampilkan state memuat', () => {
    const html = renderToString(createElement(GraphSvg));
    expect(html).toContain('Memuat peta');
  });
});

describe('MapList: smoke render', () => {
  it('render tanpa crash, menampilkan state memuat', () => {
    const html = renderToString(createElement(MapList));
    expect(html).toContain('Memuat');
  });
});
