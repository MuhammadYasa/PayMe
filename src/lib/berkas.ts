import { MAKS_UKURAN_UNGGAH_BYTE } from "@/domain/batas";

// Pesan dipakai bersama oleh server (validasi akhir) dan formulir unggah (umpan balik langsung).
export const PESAN_FILE_KOSONG = "File kosong. Pilih file hasil mesin finger yang berisi data, lalu unggah lagi.";
export const PESAN_FILE_TERLALU_BESAR =
  "Ukuran file melebihi 5 MB. Hapus sheet atau kolom yang tidak dipakai di Excel, lalu unggah lagi.";
export const PESAN_FILE_RUSAK = "File tidak dapat dibuka. Pastikan file tidak rusak dan benar-benar berformat .xlsx, lalu unggah lagi.";

export function pesanFormatTidakDidukung(ekstensi: string): string {
  const disebut = ekstensi ? `.${ekstensi}` : "tanpa ekstensi";
  return `Format file tidak didukung (${disebut}). Unggah file Excel berformat .xlsx. Bila file Anda .xls atau .csv, buka di Excel lalu pilih Simpan Sebagai dan pilih Excel Workbook (.xlsx).`;
}

export function ekstensiBerkas(nama: string): string {
  const bagian = nama.trim().toLowerCase().split(".");
  return bagian.length > 1 ? (bagian[bagian.length - 1] ?? "") : "";
}

/** Pemeriksaan cepat di browser sebelum berkas dikirim. Mengembalikan pesan galat atau null bila lolos. */
export function periksaBerkasUnggahan(nama: string, ukuranByte: number): string | null {
  const ekstensi = ekstensiBerkas(nama);
  if (ekstensi !== "xlsx") return pesanFormatTidakDidukung(ekstensi);
  if (ukuranByte <= 0) return PESAN_FILE_KOSONG;
  if (ukuranByte > MAKS_UKURAN_UNGGAH_BYTE) return PESAN_FILE_TERLALU_BESAR;
  return null;
}
