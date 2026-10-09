import { amankanTujuan } from "@/lib/tujuan";
import { masukSkema } from "@/skema/auth";
import { ambilIp, bacaJson, buatResponse, pasangCookieSesi, rutePublik } from "@/server/http";
import { masuk } from "@/server/services/auth";
import { z } from "zod";

const skema = masukSkema.extend({ lanjut: z.string().optional() });

export const POST = rutePublik(async ({ req }) => {
  const { lanjut, ...kredensial } = await bacaJson(req, skema);
  const sesi = await masuk({ ...kredensial, ip: ambilIp(req) });
  const res = buatResponse({ tujuan: amankanTujuan(lanjut) });
  pasangCookieSesi(res, sesi.token, sesi.kedaluwarsa);
  return res;
});
