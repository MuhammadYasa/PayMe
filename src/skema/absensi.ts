import { z } from "zod";
import { STATUS_ABSENSI } from "@/domain/absensi";
import { parseJam } from "@/domain/jam";
import { tanggalSkema } from "./periode";

const kolomExcel = z.int({ error: "Pilih kolom dari daftar." }).min(1, "Pilih kolom dari daftar.").max(40, "Pilih kolom dari daftar.");

export const pemetaanSkema = z
  .object({
    nama: kolomExcel,
    tanggal: kolomExcel,
    jamMasuk: kolomExcel.nullable(),
    jamPulang: kolomExcel.nullable(),
  })
  .refine((p) => p.jamMasuk !== null || p.jamPulang !== null, {
    path: ["jamMasuk"],
    error: "Pilih minimal satu kolom jam, yaitu jam masuk atau jam pulang.",
  })
  .refine(
    (p) => {
      const dipilih = [p.nama, p.tanggal, p.jamMasuk, p.jamPulang].filter((k) => k !== null);
      return new Set(dipilih).size === dipilih.length;
    },
    { path: ["nama"], error: "Satu kolom tidak boleh dipakai untuk dua keperluan. Pilih kolom yang berbeda." },
  );

export const konfigurasiImporSkema = z.object({
  sheet: z.array(z.string().min(1).max(100)).min(1, "Pilih minimal satu sheet yang akan dibaca.").max(30),
  pemetaan: pemetaanSkema,
  /** Kunci nama dari mesin finger menuju ID karyawan, atau "abaikan". */
  petaNama: z.record(z.string().max(200), z.union([z.uuid(), z.literal("abaikan")])).default({}),
  timpaManual: z.boolean().default(false),
});
export type KonfigurasiImpor = z.infer<typeof konfigurasiImporSkema>;

const keteranganOpsional = z
  .string()
  .max(255, "Keterangan terlalu panjang. Gunakan paling banyak 255 karakter.")
  .nullish()
  .transform((nilai) => {
    const bersih = nilai?.replace(/\s+/g, " ").trim();
    return bersih ? bersih : null;
  });

const jamOpsional = (label: string) =>
  z
    .string()
    .nullish()
    .transform((nilai, ctx) => {
      const hasil = parseJam(nilai);
      if (!hasil.valid) {
        ctx.addIssue({ code: "custom", message: `${label} tidak dapat dibaca. Tulis dengan format jam:menit, misalnya 08:00.` });
        return null;
      }
      return hasil.nilai;
    });

const statusSkema = z.enum(STATUS_ABSENSI, { error: "Pilih status: hadir, izin, sakit, cuti, libur, atau lainnya." });

function wajibKeteranganLainnya(data: { status: string; keterangan: string | null }, ctx: z.RefinementCtx) {
  if (data.status === "LAINNYA" && !data.keterangan) {
    ctx.addIssue({
      code: "custom",
      path: ["keterangan"],
      message: "Status lainnya wajib diberi keterangan. Tulis alasannya, misalnya 'Belum masuk kerja'.",
    });
  }
}

export const itemCatatanSkema = z
  .object({
    tanggal: tanggalSkema,
    status: statusSkema,
    jamMasuk: jamOpsional("Jam masuk"),
    jamPulang: jamOpsional("Jam pulang"),
    keterangan: keteranganOpsional,
  })
  .superRefine(wajibKeteranganLainnya);
export type ItemCatatan = z.infer<typeof itemCatatanSkema>;

export const simpanCatatanSkema = z.object({
  simpan: z.array(itemCatatanSkema).max(62, "Terlalu banyak tanggal sekaligus. Simpan paling banyak 62 tanggal per kali.").default([]),
  hapus: z.array(tanggalSkema).max(62).default([]),
});

export const isiMassalSkema = z
  .object({
    tanggal: z.array(tanggalSkema).min(1, "Pilih minimal satu tanggal.").max(62),
    status: statusSkema,
    keterangan: keteranganOpsional,
    timpa: z.boolean().default(false),
  })
  .superRefine(wajibKeteranganLainnya);

const daftarKaryawan = z.union([
  z.literal("semua"),
  z.array(z.uuid({ error: "Pilih karyawan dari daftar." })).min(1, "Pilih minimal satu karyawan.").max(2000),
]);

export const tandaiLiburSkema = z.object({
  tanggal: z.array(tanggalSkema).min(1, "Pilih minimal satu tanggal libur.").max(62),
  karyawanIds: daftarKaryawan,
  keterangan: keteranganOpsional,
  timpa: z.boolean().default(false),
});

export const hapusLiburSkema = z.object({
  tanggal: z.array(tanggalSkema).min(1, "Pilih minimal satu tanggal.").max(62),
  karyawanIds: daftarKaryawan,
});

export const ketidakhadiranSkema = z
  .object({
    karyawanId: z.uuid({ error: "Pilih karyawan dari daftar." }),
    jenis: z.enum(["IZIN", "SAKIT", "CUTI", "LAINNYA"], { error: "Pilih jenis: izin, sakit, cuti, atau lainnya." }),
    dari: tanggalSkema,
    sampai: tanggalSkema,
    keterangan: keteranganOpsional,
    timpa: z.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    if (data.dari > data.sampai) {
      ctx.addIssue({ code: "custom", path: ["sampai"], message: "Tanggal selesai tidak boleh sebelum tanggal mulai. Perbaiki salah satunya." });
    }
    if (data.jenis === "LAINNYA" && !data.keterangan) {
      ctx.addIssue({ code: "custom", path: ["keterangan"], message: "Jenis lainnya wajib diberi keterangan. Tulis alasannya." });
    }
  });
export type KetidakhadiranInput = z.infer<typeof ketidakhadiranSkema>;

export const hapusCatatanSkema = z.object({
  tanggal: z.array(tanggalSkema).min(1, "Pilih minimal satu tanggal.").max(62),
});
