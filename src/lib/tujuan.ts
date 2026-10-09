/**
 * Tujuan pengalihan setelah masuk. Hanya jalur internal yang diterima agar tautan seperti
 * `/masuk?lanjut=//situs-lain.com` tidak dapat dipakai untuk mengalihkan pengguna ke situs lain.
 */
export function amankanTujuan(tujuan: string | null | undefined, bawaan = "/dashboard"): string {
  if (!tujuan) return bawaan;
  if (!tujuan.startsWith("/") || tujuan.startsWith("//") || tujuan.includes("\\")) return bawaan;
  for (let i = 0; i < tujuan.length; i++) {
    if (tujuan.charCodeAt(i) < 32) return bawaan;
  }
  const jalur = tujuan.split(/[?#]/)[0];
  if (jalur === "/masuk" || jalur === "/daftar" || jalur.startsWith("/api/")) return bawaan;
  return tujuan;
}
