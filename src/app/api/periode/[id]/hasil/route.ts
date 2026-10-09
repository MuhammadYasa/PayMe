import { parseId, ruteAdmin } from "@/server/http";
import { ambilHasilTersimpan } from "@/server/services/penggajian";

type Params = { id: string };

export const GET = ruteAdmin<Params>(async ({ db, params }) => {
  return ambilHasilTersimpan(db, parseId(params.id, "Periode"));
});
