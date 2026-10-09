import { NAMA_COOKIE_SESI } from "@/lib/konstanta";
import { buatResponse, hapusCookieSesi, rutePublik } from "@/server/http";
import { akhiriSesi } from "@/server/services/auth";

// Selalu menghapus cookie, juga saat sesi di server sudah tidak ada, supaya klien bisa keluar dari kondisi macet.
export const POST = rutePublik(async ({ req }) => {
  const token = req.cookies.get(NAMA_COOKIE_SESI)?.value;
  if (token) await akhiriSesi(token);
  const res = buatResponse({ tujuan: "/masuk" });
  hapusCookieSesi(res);
  return res;
});
