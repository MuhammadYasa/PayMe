import type { RingkasanAbsensi } from "./absensi";
import type { AturanPotonganAbsensi, StatusBerpotongan } from "./pengaturan";
import { STATUS_BERPOTONGAN } from "./pengaturan";
import { formatRupiah } from "./uang";

export type AbsensiUntukGaji = Pick<
  RingkasanAbsensi,
  "hariKerja" | "hadir" | "izin" | "sakit" | "cuti" | "lainnya" | "totalLibur"
>;

export interface InputBonusTarget {
  bonus: number;
  penjualan: number;
  target: number;
  persenCapaianPermil: number | null;
}

export interface InputGaji {
  karyawan: {
    id: string;
    namaLengkap: string;
    jabatan: string;
    cabang: string;
    nomorRekening: string;
    gajiPokok: number;
    tunjangan: number;
  };
  absensi: AbsensiUntukGaji;
  aturanPotongan: AturanPotonganAbsensi;
  insentif: readonly { jenis: string; nominal: number }[];
  bonusTarget: InputBonusTarget | null;
  denda: readonly { dendaId: string; alasan: string; nominal: number }[];
  pajak: number;
  asuransi: number;
}

export interface PotonganAbsensiRinci {
  status: StatusBerpotongan;
  hari: number;
  nominal: number;
}

export interface RincianGaji {
  karyawanId: string;
  namaLengkap: string;
  jabatan: string;
  cabang: string;
  /** Rekening yang berlaku saat gaji dihitung. Ikut tersimpan pada snapshot. */
  nomorRekening: string;
  absensi: AbsensiUntukGaji;
  gajiPokok: number;
  tunjangan: number;
  insentif: { total: number; rinci: { jenis: string; nominal: number }[] };
  bonusTarget: InputBonusTarget;
  potonganAbsensi: { total: number; rinci: PotonganAbsensiRinci[] };
  denda: { total: number; rinci: { dendaId: string; alasan: string; nominal: number }[] };
  pajak: number;
  asuransi: number;
  totalPendapatan: number;
  totalPotongan: number;
  totalBersih: number;
  peringatan: string[];
}

function pastikanBulat(nilai: number, nama: string, bolehNegatif = false): void {
  if (!Number.isSafeInteger(nilai) || (!bolehNegatif && nilai < 0)) {
    throw new RangeError(`${nama} harus bilangan bulat tidak negatif, diterima ${String(nilai)}.`);
  }
}

function jumlahkan(nilai: readonly number[]): number {
  return nilai.reduce((total, n) => total + n, 0);
}

export function hitungPotonganAbsensi(
  absensi: AbsensiUntukGaji,
  gajiPokok: number,
  aturan: AturanPotonganAbsensi,
): { total: number; rinci: PotonganAbsensiRinci[] } {
  const rinci: PotonganAbsensiRinci[] = [];
  for (const status of STATUS_BERPOTONGAN) {
    const hari = absensi[status];
    const rumus = aturan[status];
    if (hari <= 0 || rumus.mode === "tidak") continue;

    let nominal = 0;
    if (rumus.mode === "per_hari") {
      nominal = hari * rumus.nominal;
    } else if (absensi.hariKerja > 0) {
      // Gaji harian = gaji pokok / hari kerja. Satu kali pembulatan ke bawah di akhir.
      nominal = Math.floor((hari * gajiPokok * rumus.persen) / (absensi.hariKerja * 100));
    }
    if (nominal > 0) rinci.push({ status, hari, nominal });
  }
  return { total: jumlahkan(rinci.map((r) => r.nominal)), rinci };
}

/**
 * Gaji bersih = gaji pokok + tunjangan + insentif + bonus target - denda - potongan absensi - pajak - asuransi.
 * Fungsi murni: input yang sama selalu menghasilkan rincian yang sama.
 */
export function hitungGaji(input: InputGaji): RincianGaji {
  const { karyawan } = input;
  pastikanBulat(karyawan.gajiPokok, "Gaji pokok");
  pastikanBulat(karyawan.tunjangan, "Tunjangan");
  pastikanBulat(input.pajak, "Pajak");
  pastikanBulat(input.asuransi, "Asuransi");
  for (const i of input.insentif) pastikanBulat(i.nominal, "Insentif");
  for (const d of input.denda) pastikanBulat(d.nominal, "Potongan denda");
  if (input.bonusTarget) pastikanBulat(input.bonusTarget.bonus, "Bonus target");

  const insentifRinci = input.insentif.map((i) => ({ jenis: i.jenis, nominal: i.nominal }));
  const totalInsentif = jumlahkan(insentifRinci.map((i) => i.nominal));
  const bonusTarget: InputBonusTarget = {
    bonus: input.bonusTarget?.bonus ?? 0,
    penjualan: input.bonusTarget?.penjualan ?? 0,
    target: input.bonusTarget?.target ?? 0,
    persenCapaianPermil: input.bonusTarget?.persenCapaianPermil ?? null,
  };
  const potonganAbsensi = hitungPotonganAbsensi(input.absensi, karyawan.gajiPokok, input.aturanPotongan);
  const dendaRinci = input.denda.map((d) => ({ dendaId: d.dendaId, alasan: d.alasan, nominal: d.nominal }));
  const totalDenda = jumlahkan(dendaRinci.map((d) => d.nominal));

  const totalPendapatan = karyawan.gajiPokok + karyawan.tunjangan + totalInsentif + bonusTarget.bonus;
  const totalPotongan = totalDenda + potonganAbsensi.total + input.pajak + input.asuransi;
  const totalBersih = totalPendapatan - totalPotongan;

  const peringatan: string[] = [];
  if (totalBersih < 0) {
    peringatan.push(
      `Gaji bersih negatif (${formatRupiah(totalBersih)}) karena potongan melebihi pendapatan. ` +
        "Periksa denda, potongan absensi, pajak, dan asuransi, lalu putuskan apakah tetap disimpan.",
    );
  }

  return {
    karyawanId: karyawan.id,
    namaLengkap: karyawan.namaLengkap,
    jabatan: karyawan.jabatan,
    cabang: karyawan.cabang,
    nomorRekening: karyawan.nomorRekening,
    absensi: { ...input.absensi },
    gajiPokok: karyawan.gajiPokok,
    tunjangan: karyawan.tunjangan,
    insentif: { total: totalInsentif, rinci: insentifRinci },
    bonusTarget,
    potonganAbsensi,
    denda: { total: totalDenda, rinci: dendaRinci },
    pajak: input.pajak,
    asuransi: input.asuransi,
    totalPendapatan,
    totalPotongan,
    totalBersih,
    peringatan,
  };
}

export interface TotalGaji {
  jumlahKaryawan: number;
  jumlahBermasalah: number;
  gajiPokok: number;
  tunjangan: number;
  insentif: number;
  bonusTarget: number;
  potonganAbsensi: number;
  denda: number;
  pajak: number;
  asuransi: number;
  totalPendapatan: number;
  totalPotongan: number;
  totalBersih: number;
}

/** Jumlah per kolom. Dipakai layar, riwayat, dan baris total pada ekspor Excel agar angkanya selalu sama. */
export function jumlahkanGaji(daftar: readonly RincianGaji[]): TotalGaji {
  const total: TotalGaji = {
    jumlahKaryawan: daftar.length,
    jumlahBermasalah: 0,
    gajiPokok: 0,
    tunjangan: 0,
    insentif: 0,
    bonusTarget: 0,
    potonganAbsensi: 0,
    denda: 0,
    pajak: 0,
    asuransi: 0,
    totalPendapatan: 0,
    totalPotongan: 0,
    totalBersih: 0,
  };
  for (const r of daftar) {
    if (r.peringatan.length > 0) total.jumlahBermasalah++;
    total.gajiPokok += r.gajiPokok;
    total.tunjangan += r.tunjangan;
    total.insentif += r.insentif.total;
    total.bonusTarget += r.bonusTarget.bonus;
    total.potonganAbsensi += r.potonganAbsensi.total;
    total.denda += r.denda.total;
    total.pajak += r.pajak;
    total.asuransi += r.asuransi;
    total.totalPendapatan += r.totalPendapatan;
    total.totalPotongan += r.totalPotongan;
    total.totalBersih += r.totalBersih;
  }
  return total;
}
