import { dendaSkema } from "@/skema/penghasilan";
import { bacaJson, buatResponse, parseId, ruteAdmin } from "@/server/http";
import { buatDenda, daftarDenda } from "@/server/services/denda";

type Params = { id: string };

export const GET = ruteAdmin<Params>(async ({ db, params }) => {
  return daftarDenda(db, parseId(params.id, "Periode"));
});

export const POST = ruteAdmin<Params>(async ({ req, db, params }) => {
  const denda = await buatDenda(db, parseId(params.id, "Periode"), await bacaJson(req, dendaSkema));
  return buatResponse(denda, 201);
});
