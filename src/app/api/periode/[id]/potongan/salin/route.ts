import { parseId, ruteAdmin } from "@/server/http";
import { salinDariSebelumnya } from "@/server/services/potongan-lain";

type Params = { id: string };

// Hanya membaca nominal periode sebelumnya. Penyimpanan tetap lewat PUT setelah HRD memeriksa dan mengubahnya.
export const GET = ruteAdmin<Params>(async ({ db, params }) => {
  return salinDariSebelumnya(db, parseId(params.id, "Periode"));
});
