import { lihatGajiSkema } from "@/skema/penghasilan";
import { ambilIp, ambilPerangkat, bacaJson, buatResponse, pasangCookiePerangkat, responsGalat, rutePublik } from "@/server/http";
import { lihatGajiKaryawan } from "@/server/services/publik";

/**
 * Satu-satunya endpoint tanpa sesi yang membuka data gaji. Identitas perangkat memakai cookie acak dari server;
 * IP hanya dipakai bila TRUST_PROXY aktif, sehingga mengganti header tidak dapat melewati pembatasan.
 */
export const POST = rutePublik(async ({ req }) => {
  const { nama, rekening } = await bacaJson(req, lihatGajiSkema);
  const perangkat = ambilPerangkat(req);

  let res;
  try {
    res = buatResponse(await lihatGajiKaryawan({ nama, rekening, ip: ambilIp(req), perangkat: perangkat.id }));
  } catch (galat) {
    res = responsGalat(galat);
  }
  // Cookie perangkat juga dipasang pada jawaban gagal supaya percobaan berikutnya dikenali sebagai perangkat yang sama.
  if (perangkat.baru) pasangCookiePerangkat(res, perangkat.id);
  return res;
});
