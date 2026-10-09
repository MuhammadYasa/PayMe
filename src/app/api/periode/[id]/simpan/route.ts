import { simpanFinalSkema } from "@/skema/penghasilan";
import { bacaJson, parseId, ruteAdmin } from "@/server/http";
import { simpanFinal } from "@/server/services/penggajian";

type Params = { id: string };

export const POST = ruteAdmin<Params>(async ({ req, db, params }) => {
  return simpanFinal(db, parseId(params.id, "Periode"), await bacaJson(req, simpanFinalSkema));
});
