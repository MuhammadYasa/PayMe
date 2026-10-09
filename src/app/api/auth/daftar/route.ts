import { daftarSkema } from "@/skema/auth";
import { ambilIp, ambilPerangkat, bacaJson, buatResponse, pasangCookiePerangkat, pasangCookieSesi, responsGalat, rutePublik } from "@/server/http";
import { batasiPendaftaran, buatSesi, daftarAkun } from "@/server/services/auth";

/**
 * Pendaftaran dibatasi per perangkat, per IP (bila tepercaya), dan secara menyeluruh. Jatah diambil setelah isian lolos
 * validasi tetapi sebelum hash kata sandi, supaya permintaan berlebih ditolak sebelum pekerjaan mahal dimulai.
 */
export const POST = rutePublik(async ({ req }) => {
  const input = await bacaJson(req, daftarSkema);
  const perangkat = ambilPerangkat(req);

  let res;
  try {
    await batasiPendaftaran(perangkat.id, ambilIp(req));
    const { akunId } = await daftarAkun(input);
    const sesi = await buatSesi(akunId);
    res = buatResponse({ tujuan: "/dashboard" }, 201);
    pasangCookieSesi(res, sesi.token, sesi.kedaluwarsa);
  } catch (galat) {
    res = responsGalat(galat);
  }
  // Cookie perangkat juga dipasang pada jawaban gagal supaya percobaan berikutnya dikenali sebagai perangkat yang sama.
  if (perangkat.baru) pasangCookiePerangkat(res, perangkat.id);
  return res;
});
