import { simpanInsentifSkema } from "@/skema/penghasilan";
import { bacaJson, parseId, ruteAdmin } from "@/server/http";
import { ambilInsentif, simpanInsentif } from "@/server/services/insentif";

type Params = { id: string };

export const GET = ruteAdmin<Params>(async ({ db, params }) => {
  return ambilInsentif(db, parseId(params.id, "Periode"));
});

export const PUT = ruteAdmin<Params>(async ({ req, db, params }) => {
  return simpanInsentif(db, parseId(params.id, "Periode"), await bacaJson(req, simpanInsentifSkema));
});
