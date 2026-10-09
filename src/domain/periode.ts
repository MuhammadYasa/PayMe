import {
  type TanggalISO,
  formatTanggal,
  rentangTanggal,
  selisihHari,
  tambahBulan,
  tambahHari,
  adalahTanggalValid,
} from "./tanggal";

export interface RentangPeriode {
  tanggalAwal: TanggalISO;
  tanggalAkhir: TanggalISO;
  jumlahHari: number;
}

/**
 * Periode gaji satu bulan kalender: tanggal akhir = tanggal awal + 1 bulan - 1 hari.
 * Bila bulan berikutnya tidak punya tanggal yang sama (mulai 31 Jan), tanggal awal + 1 bulan
 * dikoreksi ke akhir bulan, lalu dikurangi 1 hari (31 Jan 2025 berakhir 27 Feb 2025).
 */
export function hitungPeriode(tanggalAwal: TanggalISO): RentangPeriode {
  if (!adalahTanggalValid(tanggalAwal)) throw new RangeError(`Tanggal awal tidak valid: ${String(tanggalAwal)}`);
  const tanggalAkhir = tambahHari(tambahBulan(tanggalAwal, 1), -1);
  return { tanggalAwal, tanggalAkhir, jumlahHari: selisihHari(tanggalAwal, tanggalAkhir) + 1 };
}

export function periodeBertabrakan(
  a: Pick<RentangPeriode, "tanggalAwal" | "tanggalAkhir">,
  b: Pick<RentangPeriode, "tanggalAwal" | "tanggalAkhir">,
): boolean {
  return a.tanggalAwal <= b.tanggalAkhir && b.tanggalAwal <= a.tanggalAkhir;
}

export function tanggalDalamPeriode(rentang: Pick<RentangPeriode, "tanggalAwal" | "tanggalAkhir">): TanggalISO[] {
  return rentangTanggal(rentang.tanggalAwal, rentang.tanggalAkhir);
}

export function berisiTanggal(rentang: Pick<RentangPeriode, "tanggalAwal" | "tanggalAkhir">, tanggal: TanggalISO): boolean {
  return tanggal >= rentang.tanggalAwal && tanggal <= rentang.tanggalAkhir;
}

/** "26 Jan 2025 sampai 25 Feb 2025" */
export function labelPeriode(rentang: Pick<RentangPeriode, "tanggalAwal" | "tanggalAkhir">): string {
  return `${formatTanggal(rentang.tanggalAwal)} sampai ${formatTanggal(rentang.tanggalAkhir)}`;
}

/** "Periode: 26 Jan 2025 sampai 25 Feb 2025 (31 hari)" */
export function pratinjauPeriode(rentang: RentangPeriode): string {
  return `Periode: ${labelPeriode(rentang)} (${rentang.jumlahHari} hari)`;
}
