import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { HEADER_TUJUAN, NAMA_COOKIE_SESI } from "@/lib/konstanta";
import { amankanTujuan } from "@/lib/tujuan";
import { type SesiAktif, cariSesi } from "@/server/services/auth";

/** Sesi untuk halaman server. Dibungkus cache supaya satu permintaan hanya mengecek basis data sekali. */
export const sesiSaatIni = cache(async (): Promise<SesiAktif | null> => {
  const token = (await cookies()).get(NAMA_COOKIE_SESI)?.value;
  return token ? cariSesi(token) : null;
});

/** Halaman admin: tanpa sesi valid pengguna diarahkan ke login dan kembali ke halaman tujuan setelahnya. */
export async function wajibSesi(): Promise<SesiAktif> {
  const sesi = await sesiSaatIni();
  if (sesi) return sesi;
  const tujuan = amankanTujuan((await headers()).get(HEADER_TUJUAN), "");
  redirect(tujuan ? `/masuk?lanjut=${encodeURIComponent(tujuan)}` : "/masuk");
}

/** Halaman masuk dan daftar: pengguna yang sudah punya sesi langsung diarahkan ke dashboard. */
export async function arahkanBilaSudahMasuk(): Promise<void> {
  if (await sesiSaatIni()) redirect("/dashboard");
}
