import { type TanggalISO, hariMinggu, rentangTanggal } from "./tanggal";

export const STATUS_ABSENSI = ["HADIR", "IZIN", "SAKIT", "CUTI", "LIBUR", "LAINNYA"] as const;
export type StatusAbsensi = (typeof STATUS_ABSENSI)[number];

export const LABEL_STATUS: Record<StatusAbsensi, string> = {
  HADIR: "Hadir",
  IZIN: "Izin",
  SAKIT: "Sakit",
  CUTI: "Cuti",
  LIBUR: "Libur",
  LAINNYA: "Lainnya",
};

/** Hari kerja mingguan bawaan: Senin sampai Sabtu (0 = Minggu). */
export const HARI_KERJA_BAWAAN: readonly number[] = [1, 2, 3, 4, 5, 6];

export interface CatatanHarian {
  tanggal: TanggalISO;
  status: StatusAbsensi;
}

export interface RingkasanAbsensi {
  jumlahHariPeriode: number;
  liburMingguan: number;
  /** Tanggal berstatus LIBUR yang bukan libur mingguan. */
  liburTercatat: number;
  totalLibur: number;
  hariKerja: number;
  hadir: number;
  izin: number;
  sakit: number;
  cuti: number;
  lainnya: number;
  tanggalKosong: TanggalISO[];
  jumlahKosong: number;
}

export function adalahStatusAbsensi(nilai: unknown): nilai is StatusAbsensi {
  return typeof nilai === "string" && (STATUS_ABSENSI as readonly string[]).includes(nilai);
}

export function adalahLiburMingguan(tanggal: TanggalISO, hariKerjaMingguan: readonly number[]): boolean {
  return !hariKerjaMingguan.includes(hariMinggu(tanggal));
}

/**
 * Meringkas absensi seorang karyawan pada satu periode.
 * - Hari libur mingguan tidak dianggap kosong dan tidak butuh catatan.
 * - Tanggal merah atau libur individual (status LIBUR) tidak dihitung dua kali bila jatuh pada libur mingguan.
 * - Hari kerja = hari dalam periode - total libur. Status lain hanya dihitung pada hari kerja.
 */
export function ringkasAbsensi(args: {
  tanggalAwal: TanggalISO;
  tanggalAkhir: TanggalISO;
  catatan: readonly CatatanHarian[];
  hariKerjaMingguan: readonly number[];
}): RingkasanAbsensi {
  const semuaTanggal = rentangTanggal(args.tanggalAwal, args.tanggalAkhir);
  const statusPerTanggal = new Map<TanggalISO, StatusAbsensi>();
  for (const c of args.catatan) statusPerTanggal.set(c.tanggal, c.status);

  const hasil: RingkasanAbsensi = {
    jumlahHariPeriode: semuaTanggal.length,
    liburMingguan: 0,
    liburTercatat: 0,
    totalLibur: 0,
    hariKerja: 0,
    hadir: 0,
    izin: 0,
    sakit: 0,
    cuti: 0,
    lainnya: 0,
    tanggalKosong: [],
    jumlahKosong: 0,
  };

  for (const tanggal of semuaTanggal) {
    if (adalahLiburMingguan(tanggal, args.hariKerjaMingguan)) {
      hasil.liburMingguan++;
      continue;
    }
    const status = statusPerTanggal.get(tanggal);
    if (status === "LIBUR") {
      hasil.liburTercatat++;
      continue;
    }
    if (!status) {
      hasil.tanggalKosong.push(tanggal);
      continue;
    }
    if (status === "HADIR") hasil.hadir++;
    else if (status === "IZIN") hasil.izin++;
    else if (status === "SAKIT") hasil.sakit++;
    else if (status === "CUTI") hasil.cuti++;
    else hasil.lainnya++;
  }

  hasil.totalLibur = hasil.liburMingguan + hasil.liburTercatat;
  hasil.hariKerja = hasil.jumlahHariPeriode - hasil.totalLibur;
  hasil.jumlahKosong = hasil.tanggalKosong.length;
  return hasil;
}

export interface HasilPerluasanRentang {
  /** Tanggal kerja di dalam periode yang akan dicatat. */
  tanggal: TanggalISO[];
  /** Tanggal libur (mingguan atau tercatat) di dalam rentang yang dilewati. */
  dilewatiLibur: TanggalISO[];
  /** Jumlah tanggal pada rentang yang jatuh di luar periode dan dibuang. */
  diLuarPeriode: number;
}

/**
 * Menguraikan rentang izin, sakit, atau cuti menjadi tanggal per hari.
 * Hari libur dalam rentang dilewati dan tanggal di luar periode dipotong.
 */
export function perluasRentang(args: {
  dari: TanggalISO;
  sampai: TanggalISO;
  periode: { tanggalAwal: TanggalISO; tanggalAkhir: TanggalISO };
  hariKerjaMingguan: readonly number[];
  tanggalLibur: ReadonlySet<TanggalISO>;
}): HasilPerluasanRentang {
  const hasil: HasilPerluasanRentang = { tanggal: [], dilewatiLibur: [], diLuarPeriode: 0 };
  for (const tanggal of rentangTanggal(args.dari, args.sampai)) {
    if (tanggal < args.periode.tanggalAwal || tanggal > args.periode.tanggalAkhir) {
      hasil.diLuarPeriode++;
    } else if (adalahLiburMingguan(tanggal, args.hariKerjaMingguan) || args.tanggalLibur.has(tanggal)) {
      hasil.dilewatiLibur.push(tanggal);
    } else {
      hasil.tanggal.push(tanggal);
    }
  }
  return hasil;
}
