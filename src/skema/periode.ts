import { z } from "zod";
import { adalahTanggalValid } from "@/domain/tanggal";

export const tanggalSkema = z
  .string({ error: "Pilih tanggal dari kalender." })
  .refine(adalahTanggalValid, "Tanggal tidak valid. Pilih tanggal dari kalender, misalnya 2025-01-26.");

export const buatPeriodeSkema = z.object({
  tanggalAwal: tanggalSkema,
});
export type BuatPeriodeInput = z.infer<typeof buatPeriodeSkema>;
