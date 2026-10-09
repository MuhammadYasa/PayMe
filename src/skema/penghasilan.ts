import { z } from "zod";
import { MAKS_CICILAN, MAKS_NOMINAL_GAJI, MAKS_NOMINAL_PENDAPATAN } from "@/domain/batas";

const nominalPendapatan = (label: string) =>
  z
    .int({ error: `Isi ${label} dengan angka bulat, misalnya 10000000.` })
    .min(0, `${label.charAt(0).toUpperCase()}${label.slice(1)} tidak boleh negatif. Isi 0 atau angka yang lebih besar.`)
    .max(MAKS_NOMINAL_PENDAPATAN, `${label.charAt(0).toUpperCase()}${label.slice(1)} terlalu besar. Periksa jumlah nol yang diketik.`);

const nominalGaji = (label: string) =>
  z
    .int({ error: `Isi ${label} dengan angka bulat, misalnya 150000.` })
    .min(0, `${label.charAt(0).toUpperCase()}${label.slice(1)} tidak boleh negatif. Isi 0 atau angka yang lebih besar.`)
    .max(MAKS_NOMINAL_GAJI, `${label.charAt(0).toUpperCase()}${label.slice(1)} terlalu besar. Periksa jumlah nol yang diketik.`);

const teksBersih = z.string().transform((nilai) => nilai.replace(/\s+/g, " ").trim());

export const pendapatanCabangSkema = z
  .object({
    cabang: teksBersih.pipe(z.string().min(1, "Pilih cabangnya.").max(100)),
    totalAktual: nominalPendapatan("total pendapatan cabang"),
    /** HRD mengakui selisih antara total cabang dan jumlah breakdown sales, lalu melanjutkan. */
    akuiSelisih: z.boolean().default(false),
    sales: z
      .array(
        z.object({
          karyawanId: z.uuid({ error: "Pilih sales dari daftar." }),
          nominal: nominalPendapatan("pendapatan sales"),
          target: nominalPendapatan("target sales"),
        }),
      )
      .max(500, "Terlalu banyak sales pada satu cabang. Kurangi menjadi paling banyak 500 baris."),
  })
  .refine((data) => new Set(data.sales.map((s) => s.karyawanId)).size === data.sales.length, {
    path: ["sales"],
    error: "Satu karyawan hanya boleh muncul sekali pada breakdown. Hapus baris yang ganda.",
  });
export type PendapatanCabangInput = z.infer<typeof pendapatanCabangSkema>;

export const simpanInsentifSkema = z.object({
  items: z
    .array(
      z.object({
        karyawanId: z.uuid({ error: "Pilih karyawan dari daftar." }),
        entri: z
          .array(
            z.object({
              jenis: teksBersih.pipe(z.string().max(100, "Jenis insentif terlalu panjang. Gunakan paling banyak 100 karakter.")).default(""),
              nominal: nominalGaji("nominal insentif").nullable(),
            }),
          )
          .max(50, "Terlalu banyak baris insentif untuk satu karyawan. Gabungkan baris yang sejenis, paling banyak 50 baris."),
      }),
    )
    .max(2000),
});
export type SimpanInsentifInput = z.infer<typeof simpanInsentifSkema>;

export const dendaSkema = z
  .object({
    karyawanId: z.uuid({ error: "Pilih karyawan dari daftar." }),
    alasan: teksBersih.pipe(
      z
        .string()
        .min(1, "Isi alasan denda. Tulis penyebabnya, misalnya 'Kerusakan barang'.")
        .max(255, "Alasan terlalu panjang. Gunakan paling banyak 255 karakter."),
    ),
    total: z
      .int({ error: "Isi total denda dengan angka bulat, misalnya 1000000." })
      .min(1, "Total denda harus lebih dari 0. Isi nominal denda yang akan dipotong.")
      .max(MAKS_NOMINAL_GAJI, "Total denda terlalu besar. Periksa jumlah nol yang diketik."),
    jumlahCicilan: z
      .int({ error: "Isi jumlah cicilan dengan angka bulat, misalnya 3." })
      .min(1, "Jumlah cicilan minimal 1 (dipotong sekali). Isi 1 atau lebih.")
      .max(MAKS_CICILAN, `Jumlah cicilan paling banyak ${MAKS_CICILAN}. Kurangi jumlah cicilan.`),
    mulai: z.enum(["periode_ini", "periode_berikutnya"], { error: "Pilih mulai dipotong dari periode ini atau periode berikutnya." }),
  })
  .refine((d) => d.total < 1 || d.total >= d.jumlahCicilan, {
    path: ["jumlahCicilan"],
    error: "Jumlah cicilan tidak boleh melebihi total denda dalam rupiah. Kurangi jumlah cicilan.",
  });
export type DendaInput = z.infer<typeof dendaSkema>;

export const simpanPotonganLainSkema = z.object({
  items: z
    .array(
      z.object({
        karyawanId: z.uuid({ error: "Pilih karyawan dari daftar." }),
        pajak: nominalGaji("nominal pajak").nullable(),
        asuransi: nominalGaji("nominal asuransi").nullable(),
      }),
    )
    .max(2000),
});
export type SimpanPotonganLainInput = z.infer<typeof simpanPotonganLainSkema>;

export const simpanFinalSkema = z.object({
  hash: z.string().length(64, "Hasil perhitungan tidak dikenali. Tekan Hitung Gaji lagi, lalu simpan."),
  akuiPeringatan: z.boolean().default(false),
});

export const bukaKembaliSkema = z.object({
  konfirmasi: z.literal(true, { error: "Konfirmasi diperlukan untuk membuka kembali periode final." }),
});

export const lihatGajiSkema = z.object({
  nama: z
    .string({ error: "Isi nama lengkap dan nomor rekening Anda." })
    .transform((v) => v.replace(/\s+/g, " ").trim())
    .pipe(z.string().min(1, "Isi nama lengkap dan nomor rekening Anda.").max(150, "Data tidak ditemukan. Periksa kembali nama dan nomor rekening Anda.")),
  rekening: z
    .string({ error: "Isi nama lengkap dan nomor rekening Anda." })
    .transform((v) => v.replace(/\s+/g, ""))
    .pipe(z.string().min(1, "Isi nama lengkap dan nomor rekening Anda.").max(40, "Data tidak ditemukan. Periksa kembali nama dan nomor rekening Anda.")),
});
