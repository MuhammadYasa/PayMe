import { isiMassalSkema } from "@/skema/absensi";
import { bacaJson, parseId, ruteAdmin } from "@/server/http";
import { isiMassal } from "@/server/services/absensi";

type Params = { id: string; karyawanId: string };

export const POST = ruteAdmin<Params>(async ({ req, db, params }) => {
  const periodeId = parseId(params.id, "Periode");
  const karyawanId = parseId(params.karyawanId, "Karyawan");
  return isiMassal(db, periodeId, karyawanId, await bacaJson(req, isiMassalSkema));
});
