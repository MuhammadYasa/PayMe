import { simpanPotonganLainSkema } from "@/skema/penghasilan";
import { bacaJson, parseId, ruteAdmin } from "@/server/http";
import { ambilPotonganLain, simpanPotonganLain } from "@/server/services/potongan-lain";

type Params = { id: string };

export const GET = ruteAdmin<Params>(async ({ db, params }) => {
  return ambilPotonganLain(db, parseId(params.id, "Periode"));
});

export const PUT = ruteAdmin<Params>(async ({ req, db, params }) => {
  return simpanPotonganLain(db, parseId(params.id, "Periode"), await bacaJson(req, simpanPotonganLainSkema));
});
