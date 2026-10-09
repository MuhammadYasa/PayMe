// \p{Cf} mencakup spasi lebar nol, penanda arah teks, dan karakter format lain yang tidak terlihat.
const KARAKTER_FORMAT = /\p{Cf}/gu;

/** Bentuk simpan: spasi berulang dirapikan, tanpa karakter tak terlihat. Huruf besar-kecil dipertahankan. */
export function rapikanNama(nama: string): string {
  return nama.replace(KARAKTER_FORMAT, "").replace(/\s+/g, " ").trim();
}

/**
 * Bentuk pencocokan: huruf kecil, spasi dirapikan, titik dan garis bawah dianggap spasi.
 * Mesin finger sering menulis "Dimas.Pratama" sementara profil karyawan memakai "Dimas Pratama".
 */
export function kunciNama(nama: string): string {
  return rapikanNama(nama.normalize("NFC").replace(/[._]+/g, " ")).toLocaleLowerCase("id-ID");
}
