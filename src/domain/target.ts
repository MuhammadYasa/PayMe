import type { TingkatBonus } from "./pengaturan";

/**
 * Persentase capaian dalam per mil (1000 = 100,0%), dibulatkan setengah ke atas pada satu desimal.
 * Mengembalikan null bila tidak ada target, tanpa pembagian dengan nol.
 * Hitungan memakai BigInt agar tepat untuk penjualan bernilai miliaran.
 */
export function persenCapaianPermil(nominal: number, target: number): number | null {
  if (!Number.isSafeInteger(nominal) || nominal < 0) throw new RangeError("Nominal penjualan harus bilangan bulat tidak negatif.");
  if (!Number.isSafeInteger(target) || target <= 0) return null;
  const n = BigInt(nominal);
  const t = BigInt(target);
  return Number((n * 2000n + t) / (2n * t));
}

export interface HasilBonusTarget {
  tingkat: TingkatBonus | null;
  bonus: number;
}

/**
 * Bonus target: tingkat tertinggi yang ambangnya terpenuhi, bukan jumlah dari semua tingkat.
 * Penentuan tingkat memakai capaian tanpa pembulatan, jadi 99,96% yang tampil sebagai "100,0%"
 * tetap belum memenuhi ambang 100%.
 */
export function hitungBonusTarget(nominal: number, target: number, tingkat: readonly TingkatBonus[]): HasilBonusTarget {
  if (!Number.isSafeInteger(nominal) || nominal < 0) throw new RangeError("Nominal penjualan harus bilangan bulat tidak negatif.");
  if (!Number.isSafeInteger(target) || target <= 0) return { tingkat: null, bonus: 0 };

  const n = BigInt(nominal);
  const t = BigInt(target);
  let terpilih: TingkatBonus | null = null;
  for (const kandidat of tingkat) {
    const terpenuhi = n * 1000n >= BigInt(kandidat.ambangPermil) * t;
    if (terpenuhi && (!terpilih || kandidat.ambangPermil > terpilih.ambangPermil)) terpilih = kandidat;
  }
  if (!terpilih) return { tingkat: null, bonus: 0 };

  const bonus = terpilih.jenis === "tetap" ? terpilih.nilai : Number((n * BigInt(terpilih.nilai)) / 10_000n);
  return { tingkat: terpilih, bonus };
}
