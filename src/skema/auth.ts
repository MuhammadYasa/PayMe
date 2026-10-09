import { z } from "zod";
import { rapikanNama } from "@/domain/nama";

export const emailSkema = z
  .string({ error: "Isi alamat email Anda." })
  .trim()
  .max(254, "Alamat email terlalu panjang. Gunakan alamat yang lebih singkat.")
  .toLowerCase()
  .pipe(z.email({ error: "Alamat email tidak valid. Periksa penulisannya, misalnya nama@perusahaan.com." }));

const kataSandiBaru = z
  .string({ error: "Isi kata sandi." })
  .min(8, "Kata sandi minimal 8 karakter. Tambahkan huruf atau angka sampai cukup panjang.")
  .max(128, "Kata sandi terlalu panjang. Gunakan paling banyak 128 karakter.");

const namaOrang = z
  .string({ error: "Isi nama Anda." })
  .transform(rapikanNama)
  .pipe(
    z
      .string()
      .min(1, "Isi nama Anda.")
      .max(100, "Nama terlalu panjang. Gunakan paling banyak 100 karakter."),
  );

const namaPerusahaan = z
  .string({ error: "Isi nama perusahaan." })
  .transform(rapikanNama)
  .pipe(
    z
      .string()
      .min(1, "Isi nama perusahaan.")
      .max(150, "Nama perusahaan terlalu panjang. Gunakan paling banyak 150 karakter."),
  );

export const daftarSkema = z.object({
  nama: namaOrang,
  namaPerusahaan,
  email: emailSkema,
  kataSandi: kataSandiBaru,
});
export type DaftarInput = z.infer<typeof daftarSkema>;

export const masukSkema = z.object({
  email: emailSkema,
  kataSandi: z
    .string({ error: "Isi kata sandi." })
    .min(1, "Isi kata sandi.")
    .max(128, "Kata sandi terlalu panjang. Periksa kembali isiannya."),
});
export type MasukInput = z.infer<typeof masukSkema>;

export const tambahAkunSkema = z.object({
  nama: namaOrang,
  email: emailSkema,
  kataSandi: kataSandiBaru,
});
export type TambahAkunInput = z.infer<typeof tambahAkunSkema>;
