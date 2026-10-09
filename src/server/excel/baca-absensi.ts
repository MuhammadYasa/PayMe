import "server-only";
import ExcelJS from "exceljs";
import { jamDariPecahanHari, parseJam } from "@/domain/jam";
import { kunciNama, rapikanNama } from "@/domain/nama";
import { berisiTanggal } from "@/domain/periode";
import { type TanggalISO, adalahTanggalValid, dariNomorHari } from "@/domain/tanggal";
import { tidakValid } from "@/server/errors";

/** Nomor kolom Excel berbasis 1. */
export interface Pemetaan {
  nama: number;
  tanggal: number;
  jamMasuk: number | null;
  jamPulang: number | null;
}

export interface InfoSheet {
  nama: string;
  jumlahBaris: number;
  barisHeader: number;
  header: string[];
  contoh: string[][];
  tebakan: Pemetaan | null;
}

export interface BacaanBerkas {
  sheet: InfoSheet[];
  /** Sheet yang disarankan dipakai. Sheet gabungan seperti "All Depo" dipilih sendirian agar data tidak ganda. */
  disarankan: string[];
}

export interface BarisAbsensi {
  sheet: string;
  baris: number;
  nama: string;
  kunci: string;
  tanggal: TanggalISO;
  jamMasuk: string | null;
  jamPulang: string | null;
  adaScan: boolean;
}

export interface BarisBermasalah {
  sheet: string;
  baris: number;
  /** Mis. "jam masuk tidak dapat dibaca". Tampilan lengkap: `Baris ${baris}: ${alasan}`. */
  alasan: string;
}

export interface HasilUrai {
  baris: BarisAbsensi[];
  tidakValid: BarisBermasalah[];
  totalBaris: number;
  diLuarPeriode: number;
  duplikat: number;
  tanpaScan: number;
}

const MAKS_BARIS_PER_SHEET = 100_000;
const MAKS_KOLOM = 40;
const BARIS_PINDAI_HEADER = 15;

export async function muatWorkbook(isi: Buffer): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(isi as unknown as Parameters<typeof wb.xlsx.load>[0]);
  } catch {
    throw tidakValid(
      "File tidak dapat dibuka. Pastikan file tidak rusak dan benar-benar berformat .xlsx, lalu unggah lagi.",
      undefined,
      "FILE_RUSAK",
    );
  }
  if (wb.worksheets.length === 0) {
    throw tidakValid("File tidak memiliki sheet. Buka file di Excel, pastikan ada datanya, lalu unggah lagi.", undefined, "FILE_KOSONG");
  }
  return wb;
}

function nilaiSel(nilai: ExcelJS.CellValue): ExcelJS.CellValue {
  if (nilai && typeof nilai === "object" && !(nilai instanceof Date) && "result" in nilai) {
    return (nilai as { result?: ExcelJS.CellValue }).result ?? null;
  }
  return nilai;
}

function teksSel(mentah: ExcelJS.CellValue): string {
  const nilai = nilaiSel(mentah);
  if (nilai === null || nilai === undefined) return "";
  if (typeof nilai === "string") return nilai.trim();
  if (typeof nilai === "number" || typeof nilai === "boolean") return String(nilai);
  if (nilai instanceof Date) return nilai.toISOString();
  if (typeof nilai === "object") {
    if ("richText" in nilai) return nilai.richText.map((r) => r.text).join("").trim();
    if ("text" in nilai) return String(nilai.text).trim();
  }
  return "";
}

const BATAS_TAHUN_MIN = 1900;
const BATAS_TAHUN_MAKS = 2200;

function tanggalDariKomponen(tahun: number, bulan: number, hari: number): TanggalISO | null {
  const iso = `${String(tahun).padStart(4, "0")}-${String(bulan).padStart(2, "0")}-${String(hari).padStart(2, "0")}`;
  return tahun >= BATAS_TAHUN_MIN && tahun <= BATAS_TAHUN_MAKS && adalahTanggalValid(iso) ? iso : null;
}

/**
 * Membaca tanggal dari sel: teks "24/08/2026" (dd/mm/yyyy, format mesin finger), "24-08-26", "2026-08-24",
 * angka serial Excel, atau sel bertipe tanggal.
 */
export function parseTanggalSel(mentah: ExcelJS.CellValue): TanggalISO | null {
  const nilai = nilaiSel(mentah);
  if (nilai instanceof Date) {
    if (Number.isNaN(nilai.getTime())) return null;
    return tanggalDariKomponen(nilai.getUTCFullYear(), nilai.getUTCMonth() + 1, nilai.getUTCDate());
  }
  if (typeof nilai === "number") {
    // Serial Excel (sistem 1900): hari 25569 setara 1970-01-01.
    if (!Number.isFinite(nilai) || nilai < 20_000 || nilai > 80_000) return null;
    const iso = dariNomorHari(Math.floor(nilai) - 25_569);
    return adalahTanggalValid(iso) ? iso : null;
  }
  if (typeof nilai === "string") {
    const teks = nilai.trim();
    const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/.exec(teks);
    if (iso) return tanggalDariKomponen(Number(iso[1]), Number(iso[2]), Number(iso[3]));
    const lokal = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(teks);
    if (lokal) {
      const tahun = lokal[3].length === 2 ? 2000 + Number(lokal[3]) : Number(lokal[3]);
      return tanggalDariKomponen(tahun, Number(lokal[2]), Number(lokal[1]));
    }
  }
  return null;
}

/** Hasil `jam` null berarti sel kosong (tidak ada scan); `valid: false` berarti ada isinya tetapi tidak terbaca. */
export function parseJamSel(mentah: ExcelJS.CellValue): { valid: boolean; jam: string | null } {
  const nilai = nilaiSel(mentah);
  if (nilai === null || nilai === undefined || nilai === "") return { valid: true, jam: null };
  if (nilai instanceof Date) {
    if (Number.isNaN(nilai.getTime())) return { valid: false, jam: null };
    return {
      valid: true,
      jam: `${String(nilai.getUTCHours()).padStart(2, "0")}:${String(nilai.getUTCMinutes()).padStart(2, "0")}`,
    };
  }
  if (typeof nilai === "number") {
    const jam = jamDariPecahanHari(nilai);
    return jam ? { valid: true, jam } : { valid: false, jam: null };
  }
  const hasil = parseJam(teksSel(nilai));
  return hasil.valid ? { valid: true, jam: hasil.nilai } : { valid: false, jam: null };
}

const normalisasiHeader = (teks: string) => teks.toLowerCase().replace(/[^a-z0-9]/g, "");

function skorKolom(header: string, jenis: keyof Pemetaan): number {
  const h = normalisasiHeader(header);
  if (!h) return 0;
  switch (jenis) {
    case "nama":
      if (/^(nama|name|namakaryawan|namapegawai|employeename|nmkaryawan)$/.test(h)) return 10;
      return h.includes("nama") || h.includes("name") ? 4 : 0;
    case "tanggal":
      if (/^(tanggal|tgl|date|tanggalabsen|tglabsen|tanggalabsensi)$/.test(h)) return 10;
      return h.includes("tanggal") || h.includes("tgl") || h.includes("date") ? 4 : 0;
    case "jamMasuk":
      // "Scan Masuk" adalah kehadiran sebenarnya; "Jam Masuk" pada ekspor mesin finger adalah jadwal shift.
      if (/^(scanmasuk|clockin|checkin|absenmasuk|scanin|masukscan)$/.test(h)) return 10;
      if (/^(masuk|in|jammasuk)$/.test(h)) return h === "jammasuk" ? 3 : 5;
      return 0;
    case "jamPulang":
      if (/^(scanpulang|scankeluar|clockout|checkout|absenpulang|scanout|pulangscan)$/.test(h)) return 10;
      if (/^(pulang|keluar|out|jampulang)$/.test(h)) return h === "jampulang" ? 3 : 5;
      return 0;
  }
}

/** Menebak pemetaan kolom dari header. Mengembalikan null bila kolom nama atau tanggal tidak ditemukan. */
export function tebakPemetaan(header: string[]): Pemetaan | null {
  const dipakai = new Set<number>();
  const pilih = (jenis: keyof Pemetaan): number | null => {
    let terbaik = 0;
    let skorTerbaik = 0;
    header.forEach((h, i) => {
      if (dipakai.has(i + 1)) return;
      const skor = skorKolom(h, jenis);
      if (skor > skorTerbaik) {
        skorTerbaik = skor;
        terbaik = i + 1;
      }
    });
    if (terbaik > 0) dipakai.add(terbaik);
    return terbaik > 0 ? terbaik : null;
  };
  const nama = pilih("nama");
  const tanggal = pilih("tanggal");
  if (!nama || !tanggal) return null;
  return { nama, tanggal, jamMasuk: pilih("jamMasuk"), jamPulang: pilih("jamPulang") };
}

function bacaTeksBaris(ws: ExcelJS.Worksheet, nomor: number, jumlahKolom: number): string[] {
  const row = ws.getRow(nomor);
  return Array.from({ length: jumlahKolom }, (_, i) => teksSel(row.getCell(i + 1).value));
}

function cariBarisHeader(ws: ExcelJS.Worksheet, jumlahKolom: number): number {
  let terbaik = 0;
  let skorTerbaik = 0;
  const batas = Math.min(ws.rowCount, BARIS_PINDAI_HEADER);
  for (let n = 1; n <= batas; n++) {
    const baris = bacaTeksBaris(ws, n, jumlahKolom);
    const jenis: (keyof Pemetaan)[] = ["nama", "tanggal", "jamMasuk", "jamPulang"];
    const skor = jenis.filter((j) => baris.some((h) => skorKolom(h, j) >= 4)).length;
    if (skor > skorTerbaik) {
      skorTerbaik = skor;
      terbaik = n;
    }
  }
  return skorTerbaik >= 2 ? terbaik : 0;
}

/** Ringkasan semua sheet: header, contoh isi, dan tebakan pemetaan untuk ditinjau HRD sebelum impor. */
export function bacaInfoBerkas(wb: ExcelJS.Workbook): BacaanBerkas {
  const sheet: InfoSheet[] = wb.worksheets.map((ws) => {
    const jumlahKolom = Math.min(Math.max(ws.columnCount, 1), MAKS_KOLOM);
    const barisHeader = cariBarisHeader(ws, jumlahKolom);
    const header = barisHeader ? bacaTeksBaris(ws, barisHeader, jumlahKolom) : [];
    const contoh: string[][] = [];
    if (barisHeader) {
      for (let n = barisHeader + 1; n <= Math.min(ws.rowCount, barisHeader + 5); n++) contoh.push(bacaTeksBaris(ws, n, jumlahKolom));
    }
    return {
      nama: ws.name,
      jumlahBaris: Math.max(0, ws.rowCount - barisHeader),
      barisHeader,
      header,
      contoh,
      tebakan: barisHeader ? tebakPemetaan(header) : null,
    };
  });

  const gabungan = sheet.find((s) => s.tebakan && /^(all|semua|gabungan|total)\b/i.test(s.nama));
  const disarankan = gabungan ? [gabungan.nama] : sheet.filter((s) => s.tebakan).map((s) => s.nama);
  return { sheet, disarankan };
}

/** Mengurai baris absensi dari sheet terpilih. Baris bermasalah dicatat dan tidak menghentikan baris lain. */
export function uraiBaris(
  wb: ExcelJS.Workbook,
  namaSheet: readonly string[],
  pemetaan: Pemetaan,
  periode: { tanggalAwal: TanggalISO; tanggalAkhir: TanggalISO },
): HasilUrai {
  const hasil: HasilUrai = { baris: [], tidakValid: [], totalBaris: 0, diLuarPeriode: 0, duplikat: 0, tanpaScan: 0 };
  const terbaik = new Map<string, BarisAbsensi>();

  for (const nama of namaSheet) {
    const ws = wb.getWorksheet(nama);
    if (!ws) throw tidakValid(`Sheet "${nama}" tidak ada di file ini. Pilih sheet dari daftar yang tersedia.`, { sheet: "Sheet tidak ditemukan." });
    if (ws.rowCount > MAKS_BARIS_PER_SHEET) {
      throw tidakValid(
        `Sheet "${nama}" terlalu besar (lebih dari ${MAKS_BARIS_PER_SHEET.toLocaleString("id-ID")} baris). Pisahkan per periode lalu unggah lagi.`,
        { file: "Sheet terlalu besar." },
        "FILE_TERLALU_BESAR",
      );
    }
    const jumlahKolom = Math.min(Math.max(ws.columnCount, 1), MAKS_KOLOM);
    const barisHeader = cariBarisHeader(ws, jumlahKolom) || 1;

    ws.eachRow({ includeEmpty: false }, (row, nomor) => {
      if (nomor <= barisHeader) return;
      const selNama = row.getCell(pemetaan.nama).value;
      const selTanggal = row.getCell(pemetaan.tanggal).value;
      const selMasuk = pemetaan.jamMasuk ? row.getCell(pemetaan.jamMasuk).value : null;
      const selPulang = pemetaan.jamPulang ? row.getCell(pemetaan.jamPulang).value : null;

      const teksNama = rapikanNama(teksSel(selNama));
      if (!teksNama && !teksSel(selTanggal) && !teksSel(selMasuk) && !teksSel(selPulang)) return;
      hasil.totalBaris++;

      if (!teksNama) {
        hasil.tidakValid.push({ sheet: nama, baris: nomor, alasan: "nama karyawan kosong" });
        return;
      }
      const tanggal = parseTanggalSel(selTanggal);
      if (!tanggal) {
        hasil.tidakValid.push({ sheet: nama, baris: nomor, alasan: "tanggal tidak dapat dibaca" });
        return;
      }
      if (!berisiTanggal(periode, tanggal)) {
        hasil.diLuarPeriode++;
        return;
      }
      const masuk = parseJamSel(selMasuk);
      const pulang = parseJamSel(selPulang);
      if (!masuk.valid || !pulang.valid) {
        if (!masuk.valid) hasil.tidakValid.push({ sheet: nama, baris: nomor, alasan: "jam masuk tidak dapat dibaca" });
        if (!pulang.valid) hasil.tidakValid.push({ sheet: nama, baris: nomor, alasan: "jam pulang tidak dapat dibaca" });
        return;
      }

      const baris: BarisAbsensi = {
        sheet: nama,
        baris: nomor,
        nama: teksNama,
        kunci: kunciNama(teksNama),
        tanggal,
        jamMasuk: masuk.jam,
        jamPulang: pulang.jam,
        adaScan: masuk.jam !== null || pulang.jam !== null,
      };
      const kunciBaris = `${baris.kunci}|${tanggal}`;
      const lama = terbaik.get(kunciBaris);
      if (lama) {
        hasil.duplikat++;
        const skor = (b: BarisAbsensi) => (b.jamMasuk ? 1 : 0) + (b.jamPulang ? 1 : 0);
        if (skor(baris) > skor(lama)) terbaik.set(kunciBaris, baris);
      } else {
        terbaik.set(kunciBaris, baris);
      }
    });
  }

  hasil.baris = [...terbaik.values()];
  hasil.tanpaScan = hasil.baris.filter((b) => !b.adaScan).length;
  return hasil;
}
