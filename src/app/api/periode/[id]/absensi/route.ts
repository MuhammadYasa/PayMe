import { z } from "zod";
import { bacaQuery, parseId, ruteAdmin } from "@/server/http";
import { ringkasanPeriode } from "@/server/services/absensi";

type Params = { id: string };

const querySkema = z.object({ hanya: z.enum(["belum-lengkap"]).optional() });

export const GET = ruteAdmin<Params>(async ({ req, db, params }) => {
  const { hanya } = bacaQuery(req, querySkema);
  return ringkasanPeriode(db, parseId(params.id, "Periode"), { hanyaBelumLengkap: hanya === "belum-lengkap" });
});
