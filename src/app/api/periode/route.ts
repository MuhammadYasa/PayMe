import { buatPeriodeSkema } from "@/skema/periode";
import { bacaJson, buatResponse, ruteAdmin } from "@/server/http";
import { buatPeriode, daftarPeriode } from "@/server/services/periode";

export const GET = ruteAdmin(async ({ db }) => {
  return { periode: await daftarPeriode(db) };
});

export const POST = ruteAdmin(async ({ req, db }) => {
  const { tanggalAwal } = await bacaJson(req, buatPeriodeSkema);
  return buatResponse(await buatPeriode(db, tanggalAwal), 201);
});
