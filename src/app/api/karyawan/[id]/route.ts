import { karyawanSkema } from "@/skema/karyawan";
import { bacaJson, parseId, ruteAdmin } from "@/server/http";
import { ambilKaryawan, hapusKaryawan, ubahKaryawan } from "@/server/services/karyawan";

type Params = { id: string };

export const GET = ruteAdmin<Params>(async ({ db, params }) => {
  return ambilKaryawan(db, parseId(params.id, "Karyawan"));
});

export const PUT = ruteAdmin<Params>(async ({ req, db, params }) => {
  const id = parseId(params.id, "Karyawan");
  return ubahKaryawan(db, id, await bacaJson(req, karyawanSkema));
});

export const DELETE = ruteAdmin<Params>(async ({ db, params }) => {
  return hapusKaryawan(db, parseId(params.id, "Karyawan"));
});
