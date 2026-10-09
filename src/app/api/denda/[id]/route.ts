import { parseId, ruteAdmin } from "@/server/http";
import { hapusDenda } from "@/server/services/denda";

type Params = { id: string };

export const DELETE = ruteAdmin<Params>(async ({ db, params }) => {
  await hapusDenda(db, parseId(params.id, "Denda"));
  return { ok: true };
});
