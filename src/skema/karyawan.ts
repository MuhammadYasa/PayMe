import { z } from "zod";
import { MAKS_NOMINAL_GAJI } from "@/domain/batas";

const rapikanSpasi = (nilai: string) => nilai.replace(/\s+/g, " ").trim();

function teksWajib(label: string, maks: number, petunjuk: string) {
  const kapital = label.charAt(0).toUpperCase() + label.slice(1);
  return z
    .string({ error: `Isi ${label}. ${petunjuk}` })
    .transform(rapikanSpasi)
    .pipe(
      z
        .string()
        .min(1, `Isi ${label}. ${petunjuk}`)
        .max(maks, `${kapital} terlalu panjang. Gunakan paling banyak ${maks} karakter.`),
    );
}

export const nomorRekeningSkema = z
  .string({ error: "Isi nomor rekening. Salin dari buku tabungan atau slip bank karyawan." })
  .transform((nilai) => nilai.replace(/\s+/g, ""))
  .pipe(
    z
      .string()
      .min(1, { error: "Isi nomor rekening. Salin dari buku tabungan atau slip bank karyawan.", abort: true })
      .regex(/^\d+$/, { error: "Nomor rekening hanya boleh berisi angka.", abort: true })
      .min(6, "Nomor rekening harus 6 sampai 20 digit. Periksa kembali nomor di buku tabungan.")
      .max(20, "Nomor rekening harus 6 sampai 20 digit. Periksa kembali nomor di buku tabungan."),
  );

export const karyawanSkema = z.object({
  namaLengkap: teksWajib("nama lengkap", 150, "Ketik nama sesuai KTP."),
  jabatan: teksWajib("jabatan", 100, "Contoh: Staf Gudang."),
  cabang: teksWajib("cabang", 100, "Contoh: Surabaya."),
  gajiPokok: z
    .int({ error: "Isi gaji pokok dengan angka bulat, misalnya 4000000." })
    .min(1, "Gaji pokok harus lebih dari 0. Isi sesuai gaji pokok karyawan.")
    .max(MAKS_NOMINAL_GAJI, "Gaji pokok terlalu besar. Periksa jumlah nol yang diketik."),
  tunjangan: z
    .int({ error: "Isi tunjangan dengan angka bulat, misalnya 500000." })
    .min(0, "Tunjangan tidak boleh negatif. Isi 0 bila tidak ada tunjangan.")
    .max(MAKS_NOMINAL_GAJI, "Tunjangan terlalu besar. Periksa jumlah nol yang diketik.")
    .default(0),
  nomorRekening: nomorRekeningSkema,
  statusAktif: z.boolean({ error: "Pilih status karyawan: aktif atau nonaktif." }).default(true),
});

export type KaryawanInput = z.infer<typeof karyawanSkema>;
export type KaryawanFormInput = z.input<typeof karyawanSkema>;
