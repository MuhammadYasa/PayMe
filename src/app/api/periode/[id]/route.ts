import { parseId, ruteAdmin } from "@/server/http";
import { hapusPeriodeDraf, muatPeriode } from "@/server/services/periode";

type Params = { id: string };

export const GET = ruteAdmin<Params>(async ({ db, params }) => {
  return muatPeriode(db, parseId(params.id, "Periode"));
});

export const DELETE = ruteAdmin<Params>(async ({ db, params }) => {
  await hapusPeriodeDraf(db, parseId(params.id, "Periode"));
  return { ok: true };
});
