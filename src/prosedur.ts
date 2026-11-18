/**
 * Pecah teks prosedur "1) ... 2) ... 3) ..." (lapis_b_prosedur di graph.json)
 * menjadi daftar langkah untuk dirender sebagai <ol>.
 *
 * Hanya penanda bernomor BERURUTAN (1, lalu 2, lalu 3, ...) yang diterima —
 * angka di dalam isi langkah (mis. VRIO "(lolos 4)") diabaikan. Kembalikan
 * null bila kurang dari 2 langkah terurai (pemanggil memakai paragraf biasa).
 */
export function pecahLangkahProsedur(teks: string): string[] | null {
  const langkah: string[] = [];
  let diharapkan = 1;
  let posisiAwal = -1;
  const pola = /(\d+)\)\s/g;
  let cocok: RegExpExecArray | null;
  while ((cocok = pola.exec(teks)) !== null) {
    if (Number(cocok[1]) !== diharapkan) continue;
    if (posisiAwal >= 0) {
      langkah.push(teks.slice(posisiAwal, cocok.index).trim());
    }
    posisiAwal = cocok.index + cocok[0].length;
    diharapkan += 1;
  }
  if (posisiAwal < 0) return null;
  langkah.push(teks.slice(posisiAwal).trim());
  const bersih = langkah.filter((l) => l.length > 0);
  return bersih.length >= 2 ? bersih : null;
}
