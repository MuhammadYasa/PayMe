// Persentase diketik pengguna dengan koma atau titik desimal ("87,5") dan disimpan sebagai bilangan bulat:
// per mil (1000 = 100%) untuk ambang capaian, dan basis poin (10000 = 100%) untuk persen dari penjualan.

function uraiDesimal(teks: string, desimal: number, maks: number): number | null {
  const bersih = teks.trim().replace(/%$/, "").replace(/\s+/g, "");
  const pola = new RegExp(`^(\\d+)(?:[.,](\\d{1,${desimal}}))?$`);
  const cocok = pola.exec(bersih);
  if (!cocok) return null;
  const skala = 10 ** desimal;
  const nilai = Number(cocok[1]) * skala + Number((cocok[2] ?? "").padEnd(desimal, "0") || "0");
  return Number.isSafeInteger(nilai) && nilai <= maks * skala ? nilai : null;
}

function formatDesimal(nilai: number, desimal: number): string {
  const skala = 10 ** desimal;
  const bulat = Math.trunc(nilai / skala);
  const sisa = nilai % skala;
  if (sisa === 0) return String(bulat);
  return `${bulat},${String(sisa).padStart(desimal, "0").replace(/0+$/, "")}`;
}

/** "87,5" menjadi 875 per mil. Satu desimal, maksimum 1000%. */
export function parsePersenKePermil(teks: string): number | null {
  return uraiDesimal(teks, 1, 1000);
}

export function permilKeTeks(permil: number): string {
  return formatDesimal(permil, 1);
}

/** "2,5" menjadi 250 basis poin. Dua desimal, maksimum 100%. */
export function parsePersenKeBps(teks: string): number | null {
  return uraiDesimal(teks, 2, 100);
}

export function bpsKeTeks(bps: number): string {
  return formatDesimal(bps, 2);
}
