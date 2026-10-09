import { buatBerkasGaji, namaBerkasGaji } from "@/server/excel/ekspor-gaji";
import { parseId, ruteAdmin } from "@/server/http";
import { ambilHasilTersimpan, hitungGajiPeriode } from "@/server/services/penggajian";
import { muatPeriode } from "@/server/services/periode";

type Params = { id: string };

/** Periode final diekspor dari snapshot tersimpan; draf diekspor dari hasil hitung terbaru (yang menuntut data lengkap). */
export const GET = ruteAdmin<Params>(async ({ db, params }) => {
  const id = parseId(params.id, "Periode");
  const periode = await muatPeriode(db, id);
  const hasil = periode.status === "FINAL" ? (await ambilHasilTersimpan(db, id)).hasil : (await hitungGajiPeriode(db, id)).hasil;
  const isi = await buatBerkasGaji(periode, hasil);

  return new Response(new Uint8Array(isi), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${namaBerkasGaji(periode)}"`,
      "Cache-Control": "no-store",
    },
  });
});
