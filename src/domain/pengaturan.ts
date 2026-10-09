import { z } from "zod";
import { HARI_KERJA_BAWAAN } from "./absensi";
import { MAKS_NOMINAL_GAJI } from "./batas";

// Aturan yang masih berstatus asumsi (hari kerja, potongan absensi, tingkat bonus) disimpan per
// perusahaan, bukan tertanam di kode. Bawaannya: tanpa potongan dan tanpa bonus sampai HRD mengaturnya.

export const aturanPotonganSchema = z.discriminatedUnion(
  "mode",
  [
    z.object({ mode: z.literal("tidak") }),
    z.object({
      mode: z.literal("per_hari"),
      nominal: z
        .int({ error: "Isi nominal potongan per hari dengan angka bulat, misalnya 50000." })
        .min(1, "Nominal potongan per hari minimal Rp 1. Pilih \"Tidak dipotong\" bila memang tanpa potongan.")
        .max(MAKS_NOMINAL_GAJI, "Nominal potongan per hari terlalu besar. Periksa jumlah nol yang diketik."),
    }),
    z.object({
      mode: z.literal("persen_harian"),
      persen: z
        .int({ error: "Isi persentase potongan dengan angka bulat, misalnya 50." })
        .min(1, "Persentase potongan minimal 1. Pilih \"Tidak dipotong\" bila memang tanpa potongan.")
        .max(100, "Persentase potongan paling besar 100. Turunkan angkanya."),
    }),
  ],
  { error: "Pilih salah satu mode potongan: tidak dipotong, nominal per hari, atau persen dari gaji harian." },
);
export type AturanPotongan = z.infer<typeof aturanPotonganSchema>;

export const STATUS_BERPOTONGAN = ["izin", "sakit", "cuti", "lainnya"] as const;
export type StatusBerpotongan = (typeof STATUS_BERPOTONGAN)[number];

export const aturanPotonganAbsensiSchema = z.object({
  izin: aturanPotonganSchema,
  sakit: aturanPotonganSchema,
  cuti: aturanPotonganSchema,
  lainnya: aturanPotonganSchema,
});
export type AturanPotonganAbsensi = z.infer<typeof aturanPotonganAbsensiSchema>;

export const tingkatBonusSchema = z
  .object({
    /** Ambang capaian dalam per mil (1000 = 100,0%). */
    ambangPermil: z
      .int({ error: "Isi ambang capaian dengan angka, misalnya 100 untuk 100%." })
      .min(1, "Ambang capaian harus lebih dari 0%. Naikkan angkanya.")
      .max(100_000, "Ambang capaian terlalu besar. Periksa angka yang diketik."),
    jenis: z.enum(["tetap", "persen_penjualan"], { error: "Pilih jenis bonus: nominal tetap atau persen dari penjualan." }),
    /** Rupiah untuk jenis "tetap"; basis poin (100 = 1%) untuk jenis "persen_penjualan". */
    nilai: z
      .int({ error: "Isi nilai bonus dengan angka bulat." })
      .min(0, "Nilai bonus tidak boleh negatif. Isi 0 atau angka yang lebih besar.")
      .max(MAKS_NOMINAL_GAJI, "Nilai bonus terlalu besar. Periksa jumlah nol yang diketik."),
  })
  .refine((t) => t.jenis !== "persen_penjualan" || t.nilai <= 10_000, {
    path: ["nilai"],
    error: "Persen dari penjualan paling besar 100%. Turunkan angkanya.",
  });
export type TingkatBonus = z.infer<typeof tingkatBonusSchema>;

export const daftarTingkatBonusSchema = z
  .array(tingkatBonusSchema)
  .max(20, "Tingkat bonus paling banyak 20. Hapus tingkat yang tidak dipakai.")
  .refine((daftar) => new Set(daftar.map((t) => t.ambangPermil)).size === daftar.length, {
    error: "Ada dua tingkat bonus dengan ambang yang sama. Ubah salah satunya agar berbeda.",
  });

export const hariKerjaMingguanSchema = z
  .array(z.int().min(0).max(6))
  .min(1, "Pilih minimal satu hari kerja dalam seminggu.")
  .refine((hari) => new Set(hari).size === hari.length, { error: "Hari kerja tidak boleh dipilih dua kali." });

export const pengaturanSchema = z.object({
  hariKerjaMingguan: hariKerjaMingguanSchema,
  aturanPotongan: aturanPotonganAbsensiSchema,
  tingkatBonus: daftarTingkatBonusSchema,
});

export interface Pengaturan {
  hariKerjaMingguan: number[];
  aturanPotongan: AturanPotonganAbsensi;
  tingkatBonus: TingkatBonus[];
}

export const PENGATURAN_BAWAAN: Pengaturan = {
  hariKerjaMingguan: [...HARI_KERJA_BAWAAN],
  aturanPotongan: {
    izin: { mode: "tidak" },
    sakit: { mode: "tidak" },
    cuti: { mode: "tidak" },
    lainnya: { mode: "tidak" },
  },
  tingkatBonus: [],
};

/**
 * Membaca pengaturan dari basis data. Bagian yang rusak atau belum diisi memakai nilai bawaan
 * supaya perhitungan tidak berhenti karena satu kolom JSON yang tidak sesuai.
 */
export function bacaPengaturan(
  mentah: { hariKerjaMingguan?: number[] | null; aturanPotongan?: unknown; tingkatBonus?: unknown } | null | undefined,
): Pengaturan {
  const hari = hariKerjaMingguanSchema.safeParse(mentah?.hariKerjaMingguan);
  const sumberPotongan =
    mentah?.aturanPotongan && typeof mentah.aturanPotongan === "object" ? mentah.aturanPotongan : {};
  const potongan = aturanPotonganAbsensiSchema.safeParse({ ...PENGATURAN_BAWAAN.aturanPotongan, ...sumberPotongan });
  const bonus = daftarTingkatBonusSchema.safeParse(mentah?.tingkatBonus);
  return {
    hariKerjaMingguan: hari.success ? [...hari.data].sort((a, b) => a - b) : [...PENGATURAN_BAWAAN.hariKerjaMingguan],
    aturanPotongan: potongan.success ? potongan.data : PENGATURAN_BAWAAN.aturanPotongan,
    tingkatBonus: bonus.success ? bonus.data : [],
  };
}
