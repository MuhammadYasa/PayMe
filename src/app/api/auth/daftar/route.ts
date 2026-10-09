import { daftarSkema } from "@/skema/auth";
import { bacaJson, buatResponse, pasangCookieSesi, rutePublik } from "@/server/http";
import { buatSesi, daftarAkun } from "@/server/services/auth";

export const POST = rutePublik(async ({ req }) => {
  const input = await bacaJson(req, daftarSkema);
  const { akunId } = await daftarAkun(input);
  const sesi = await buatSesi(akunId);
  const res = buatResponse({ tujuan: "/dashboard" }, 201);
  pasangCookieSesi(res, sesi.token, sesi.kedaluwarsa);
  return res;
});
