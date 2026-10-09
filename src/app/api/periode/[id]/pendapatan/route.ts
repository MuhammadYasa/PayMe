import { pendapatanCabangSkema } from "@/skema/penghasilan";
import { bacaJson, parseId, ruteAdmin } from "@/server/http";
import { ambilPendapatan, simpanPendapatanCabang } from "@/server/services/pendapatan";

type Params = { id: string };

export const GET = ruteAdmin<Params>(async ({ db, params }) => {
  return ambilPendapatan(db, parseId(params.id, "Periode"));
});

/** Menyimpan satu cabang beserta breakdown sales-nya. */
export const PUT = ruteAdmin<Params>(async ({ req, db, params }) => {
  return simpanPendapatanCabang(db, parseId(params.id, "Periode"), await bacaJson(req, pendapatanCabangSkema));
});
