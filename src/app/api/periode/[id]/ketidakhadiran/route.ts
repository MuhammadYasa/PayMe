import { ketidakhadiranSkema } from "@/skema/absensi";
import { bacaJson, parseId, ruteAdmin } from "@/server/http";
import { catatKetidakhadiran } from "@/server/services/absensi";

type Params = { id: string };

export const POST = ruteAdmin<Params>(async ({ req, db, params }) => {
  return catatKetidakhadiran(db, parseId(params.id, "Periode"), await bacaJson(req, ketidakhadiranSkema));
});
