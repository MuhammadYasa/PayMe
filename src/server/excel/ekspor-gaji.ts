import "server-only";
import ExcelJS from "exceljs";
import { type RincianGaji, jumlahkanGaji } from "@/domain/gaji";
import { labelPeriode } from "@/domain/periode";
import type { TanggalISO } from "@/domain/tanggal";

/**
 * Teks yang diawali = + - @ (atau tab dan CR) dapat dibaca Excel sebagai rumus bila berkas diubah menjadi CSV
 * atau ditempel ulang. Diberi awalan apostrof agar selalu diperlakukan sebagai teks.
 */
export function amankanSelTeks(nilai: string): string {
  return /^[=+\-@\t\r]/.test(nilai) ? `'${nilai}` : nilai;
}

export function namaBerkasGaji(periode: { tanggalAwal: TanggalISO; tanggalAkhir: TanggalISO }): string {
  return `PayMe_${periode.tanggalAwal}_${periode.tanggalAkhir}.xlsx`;
}

interface Kolom {
  judul: string;
  lebar: number;
  angka: boolean;
  nilai: (r: RincianGaji) => string | number;
}

const KOLOM: Kolom[] = [
  { judul: "Nama", lebar: 28, angka: false, nilai: (r) => amankanSelTeks(r.namaLengkap) },
  { judul: "Jabatan", lebar: 20, angka: false, nilai: (r) => amankanSelTeks(r.jabatan) },
  { judul: "Cabang", lebar: 16, angka: false, nilai: (r) => amankanSelTeks(r.cabang) },
  { judul: "No. Rekening", lebar: 18, angka: false, nilai: (r) => amankanSelTeks(r.nomorRekening) },
  { judul: "Hari Kerja", lebar: 11, angka: true, nilai: (r) => r.absensi.hariKerja },
  { judul: "Hadir", lebar: 8, angka: true, nilai: (r) => r.absensi.hadir },
  { judul: "Izin", lebar: 8, angka: true, nilai: (r) => r.absensi.izin },
  { judul: "Sakit", lebar: 8, angka: true, nilai: (r) => r.absensi.sakit },
  { judul: "Cuti", lebar: 8, angka: true, nilai: (r) => r.absensi.cuti },
  { judul: "Lainnya", lebar: 9, angka: true, nilai: (r) => r.absensi.lainnya },
  { judul: "Gaji Pokok", lebar: 15, angka: true, nilai: (r) => r.gajiPokok },
  { judul: "Tunjangan", lebar: 14, angka: true, nilai: (r) => r.tunjangan },
  { judul: "Insentif", lebar: 14, angka: true, nilai: (r) => r.insentif.total },
  { judul: "Bonus Target", lebar: 14, angka: true, nilai: (r) => r.bonusTarget.bonus },
  { judul: "Potongan Absensi", lebar: 17, angka: true, nilai: (r) => r.potonganAbsensi.total },
  { judul: "Denda", lebar: 14, angka: true, nilai: (r) => r.denda.total },
  { judul: "Pajak", lebar: 14, angka: true, nilai: (r) => r.pajak },
  { judul: "Asuransi", lebar: 14, angka: true, nilai: (r) => r.asuransi },
  { judul: "Total Pendapatan", lebar: 17, angka: true, nilai: (r) => r.totalPendapatan },
  { judul: "Total Potongan", lebar: 16, angka: true, nilai: (r) => r.totalPotongan },
  { judul: "Gaji Bersih", lebar: 16, angka: true, nilai: (r) => r.totalBersih },
  { judul: "Catatan", lebar: 40, angka: false, nilai: (r) => amankanSelTeks(r.peringatan.join(" ")) },
];

/** Indeks kolom yang dijumlahkan pada baris total, dipetakan ke field TotalGaji. */
const KOLOM_TOTAL: Record<string, keyof ReturnType<typeof jumlahkanGaji>> = {
  "Gaji Pokok": "gajiPokok",
  Tunjangan: "tunjangan",
  Insentif: "insentif",
  "Bonus Target": "bonusTarget",
  "Potongan Absensi": "potonganAbsensi",
  Denda: "denda",
  Pajak: "pajak",
  Asuransi: "asuransi",
  "Total Pendapatan": "totalPendapatan",
  "Total Potongan": "totalPotongan",
  "Gaji Bersih": "totalBersih",
};

const BARIS_HEADER = 4;

/**
 * Berkas Excel hasil penggajian. Angka ditulis sebagai angka (bukan teks) dan nomor rekening sebagai teks supaya
 * nol di depan tidak hilang. Baris total memakai fungsi penjumlahan yang sama dengan tampilan layar.
 */
export async function buatBerkasGaji(periode: { tanggalAwal: TanggalISO; tanggalAkhir: TanggalISO }, hasil: RincianGaji[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "PayMe";
  const ws = wb.addWorksheet("Gaji", { views: [{ state: "frozen", ySplit: BARIS_HEADER, xSplit: 1 }] });

  ws.getCell("A1").value = "Rekap Gaji Karyawan";
  ws.getCell("A1").font = { bold: true, size: 14 };
  ws.getCell("A2").value = `Periode: ${labelPeriode(periode)}`;

  const header = ws.getRow(BARIS_HEADER);
  KOLOM.forEach((k, i) => {
    const sel = header.getCell(i + 1);
    sel.value = k.judul;
    sel.font = { bold: true, color: { argb: "FFFFFFFF" } };
    sel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1D4ED8" } };
    sel.alignment = { vertical: "middle", horizontal: k.angka ? "right" : "left", wrapText: true };
    ws.getColumn(i + 1).width = k.lebar;
  });
  header.height = 30;

  hasil.forEach((r, indeks) => {
    const baris = ws.getRow(BARIS_HEADER + 1 + indeks);
    KOLOM.forEach((k, i) => {
      const sel = baris.getCell(i + 1);
      sel.value = k.nilai(r);
      if (k.angka) sel.numFmt = "#,##0";
      if (k.judul === "No. Rekening") sel.numFmt = "@";
    });
  });

  const total = jumlahkanGaji(hasil);
  const barisTotal = ws.getRow(BARIS_HEADER + 1 + hasil.length);
  barisTotal.getCell(1).value = "TOTAL";
  KOLOM.forEach((k, i) => {
    const sel = barisTotal.getCell(i + 1);
    const bidang = KOLOM_TOTAL[k.judul];
    if (bidang) {
      sel.value = total[bidang];
      sel.numFmt = "#,##0";
    }
    sel.font = { bold: true };
    sel.border = { top: { style: "medium" } };
  });

  ws.autoFilter = { from: { row: BARIS_HEADER, column: 1 }, to: { row: BARIS_HEADER + hasil.length, column: KOLOM.length } };
  return Buffer.from(await wb.xlsx.writeBuffer());
}
