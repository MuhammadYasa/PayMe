import { hapusLiburSkema, tandaiLiburSkema } from "@/skema/absensi";
import { bacaJson, parseId, ruteAdmin } from "@/server/http";
import { hapusLibur, tandaiLibur } from "@/server/services/absensi";

type Params = { id: string };

export const POST = ruteAdmin<Params>(async ({ req, db, params }) => {
  return tandaiLibur(db, parseId(params.id, "Periode"), await bacaJson(req, tandaiLiburSkema));
});

export const DELETE = ruteAdmin<Params>(async ({ req, db, params }) => {
  return hapusLibur(db, parseId(params.id, "Periode"), await bacaJson(req, hapusLiburSkema));
});
