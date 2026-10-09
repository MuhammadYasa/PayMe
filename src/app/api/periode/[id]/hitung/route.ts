import { parseId, ruteAdmin } from "@/server/http";
import { hitungGajiPeriode } from "@/server/services/penggajian";

type Params = { id: string };

// POST karena menjalankan perhitungan, walau tidak menyimpan apa pun.
export const POST = ruteAdmin<Params>(async ({ db, params }) => {
  return hitungGajiPeriode(db, parseId(params.id, "Periode"));
});
