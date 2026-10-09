import ExcelJS from "exceljs";
import { type TanggalISO, hariMinggu, rentangTanggal, uraiTanggal } from "@/domain/tanggal";

export type PolaScan = "penuh" | "hanyaMasuk" | "hanyaPulang" | "kosong";

export interface KaryawanFixture {
  /** Ditulis persis seperti di file mesin finger, mis. "Budi.Santoso". */
  nama: string;
  /** Nama sheet cabang tempat baris karyawan ini ditulis. */
  cabang: string;
  empNo?: number;
  pola?: (tanggal: TanggalISO, hariMinggu: number) => PolaScan;
}

export interface InfoBaris {
  nama: string;
  tanggal: TanggalISO;
  sheet: string;
}

export interface OpsiFixture {
  awal: TanggalISO;
  akhir: TanggalISO;
  karyawan: KaryawanFixture[];
  /** Nama sheet gabungan seluruh cabang seperti "All Depo" pada file asli. false untuk tanpa sheet gabungan. */
  sheetGabungan?: string | false;
  /** Mengubah satu baris sebelum ditulis, untuk menyisipkan data rusak. */
  ubahBaris?: (baris: string[], info: InfoBaris) => string[];
}

export const HEADER_MESIN = [
  "Emp No.",
  "NIK",
  "Nama",
  "Tanggal",
  "Jam Kerja",
  "Jam Masuk",
  "Jam Pulang",
  "Scan Masuk",
  "Scan Pulang",
  "Jml Jam Kerja",
  "Waktu Scan",
];

/** Senin sampai Sabtu hadir penuh, Minggu tanpa scan, sama seperti pola pada file asli. */
export const polaBiasa = (_tanggal: TanggalISO, dow: number): PolaScan => (dow === 0 ? "kosong" : "penuh");

export function ddmmyyyy(tanggal: TanggalISO): string {
  const { tahun, bulan, hari } = uraiTanggal(tanggal);
  return `${String(hari).padStart(2, "0")}/${String(bulan).padStart(2, "0")}/${tahun}`;
}

// Menit scan dibuat deterministik agar tes dapat diulang.
function jamScan(dasar: number, benih: number): string {
  const menit = (benih * 7) % 50;
  return `${String(dasar).padStart(2, "0")}.${String(menit).padStart(2, "0")}`;
}

function bangunBaris(k: KaryawanFixture, indeks: number, tanggal: TanggalISO): string[] {
  const dow = hariMinggu(tanggal);
  const pola = (k.pola ?? polaBiasa)(tanggal, dow);
  const benih = indeks * 31 + Number(tanggal.slice(8));
  const masuk = pola === "penuh" || pola === "hanyaMasuk" ? jamScan(7, benih) : "";
  const pulang = pola === "penuh" || pola === "hanyaPulang" ? jamScan(16, benih + 3) : "";
  const jumlahJam = pola === "penuh" ? "08.00" : pola === "kosong" ? "" : "07.00";
  return [
    String(k.empNo ?? 1000 + indeks),
    String(4000 + indeks),
    k.nama,
    ddmmyyyy(tanggal),
    dow === 6 ? "sabtu_staff" : "SENIN-JUMAT_STAFF",
    "08.00",
    dow === 6 ? "14.00" : "16.00",
    masuk,
    pulang,
    jumlahJam,
    [masuk, pulang].filter(Boolean).join(" "),
  ];
}

/** Membuat berkas .xlsx berformat mesin finger: semua sel berupa teks, tanggal dd/mm/yyyy, jam HH.MM. */
export async function buatFixtureAbsensi(opsi: OpsiFixture): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const sheetCabang = new Map<string, ExcelJS.Worksheet>();
  const namaGabungan = opsi.sheetGabungan === false ? null : (opsi.sheetGabungan ?? "All Depo");

  for (const k of opsi.karyawan) {
    if (!sheetCabang.has(k.cabang)) {
      const ws = wb.addWorksheet(k.cabang);
      ws.addRow(HEADER_MESIN);
      sheetCabang.set(k.cabang, ws);
    }
  }
  const gabungan = namaGabungan ? wb.addWorksheet(namaGabungan) : null;
  gabungan?.addRow(HEADER_MESIN);

  const tanggalPeriode = rentangTanggal(opsi.awal, opsi.akhir);
  opsi.karyawan.forEach((k, indeks) => {
    for (const tanggal of tanggalPeriode) {
      const dasar = bangunBaris(k, indeks, tanggal);
      const barisCabang = opsi.ubahBaris ? opsi.ubahBaris(dasar, { nama: k.nama, tanggal, sheet: k.cabang }) : dasar;
      sheetCabang.get(k.cabang)!.addRow(barisCabang);
      if (gabungan) {
        const barisGabungan = opsi.ubahBaris ? opsi.ubahBaris(dasar, { nama: k.nama, tanggal, sheet: namaGabungan! }) : dasar;
        gabungan.addRow(barisGabungan);
      }
    }
  });

  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** Daftar karyawan sintetis untuk uji performa: "Karyawan001.Uji", dibagi ke beberapa cabang. */
export function karyawanSintetis(jumlah: number, cabang = ["Surabaya", "Malang", "Bandung", "Jakarta"]): KaryawanFixture[] {
  return Array.from({ length: jumlah }, (_, i) => ({
    nama: `Karyawan${String(i + 1).padStart(3, "0")}.Uji`,
    cabang: cabang[i % cabang.length],
    empNo: 2000 + i,
  }));
}
