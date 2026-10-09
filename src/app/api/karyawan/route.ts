import { z } from "zod";
import { karyawanSkema } from "@/skema/karyawan";
import { bacaJson, bacaQuery, buatResponse, ruteAdmin } from "@/server/http";
import { buatKaryawan, daftarKaryawan } from "@/server/services/karyawan";

const querySkema = z.object({
  cari: z.string().max(150).optional(),
  cabang: z.string().max(100).optional(),
  status: z.enum(["aktif", "nonaktif", "semua"]).optional(),
});

export const GET = ruteAdmin(async ({ req, db }) => {
  return daftarKaryawan(db, bacaQuery(req, querySkema));
});

export const POST = ruteAdmin(async ({ req, db }) => {
  const input = await bacaJson(req, karyawanSkema);
  return buatResponse(await buatKaryawan(db, input), 201);
});
