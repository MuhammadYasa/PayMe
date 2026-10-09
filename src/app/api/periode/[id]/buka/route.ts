import { bukaKembaliSkema } from "@/skema/penghasilan";
import { bacaJson, parseId, ruteAdmin } from "@/server/http";
import { bukaKembali } from "@/server/services/penggajian";

type Params = { id: string };

// Membuka kembali periode final menuntut konfirmasi eksplisit di body, bukan sekadar permintaan POST.
export const POST = ruteAdmin<Params>(async ({ req, db, params }) => {
  const id = parseId(params.id, "Periode");
  await bacaJson(req, bukaKembaliSkema);
  return bukaKembali(db, id);
});
