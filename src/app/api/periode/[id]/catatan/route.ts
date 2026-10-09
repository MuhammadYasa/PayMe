import { parseId, ruteAdmin } from "@/server/http";
import { daftarCatatan } from "@/server/services/absensi";

type Params = { id: string };

export const GET = ruteAdmin<Params>(async ({ db, params }) => {
  return daftarCatatan(db, parseId(params.id, "Periode"));
});
