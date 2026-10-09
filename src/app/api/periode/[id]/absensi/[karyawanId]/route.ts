import { simpanCatatanSkema } from "@/skema/absensi";
import { bacaJson, parseId, ruteAdmin } from "@/server/http";
import { detailKaryawan, simpanCatatan } from "@/server/services/absensi";

type Params = { id: string; karyawanId: string };

export const GET = ruteAdmin<Params>(async ({ db, params }) => {
  return detailKaryawan(db, parseId(params.id, "Periode"), parseId(params.karyawanId, "Karyawan"));
});

export const PUT = ruteAdmin<Params>(async ({ req, db, params }) => {
  const periodeId = parseId(params.id, "Periode");
  const karyawanId = parseId(params.karyawanId, "Karyawan");
  return simpanCatatan(db, periodeId, karyawanId, await bacaJson(req, simpanCatatanSkema));
});
