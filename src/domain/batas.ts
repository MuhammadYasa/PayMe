// Batas nilai yang dipakai bersama oleh validasi, basis data, dan tampilan.

/** Gaji, tunjangan, insentif, denda, dan potongan per karyawan. Kolom basis datanya bertipe INT. */
export const MAKS_NOMINAL_GAJI = 2_000_000_000;

/** Pendapatan cabang dan sales. Kolom basis datanya BIGINT; angka ini jauh di bawah batas aman JavaScript. */
export const MAKS_NOMINAL_PENDAPATAN = 1_000_000_000_000;

export const MAKS_CICILAN = 120;

export const MAKS_UKURAN_UNGGAH_BYTE = 5 * 1024 * 1024;

/** Percobaan gagal berturut-turut sebelum akses halaman karyawan diblokir. */
export const MAKS_PERCOBAAN_GAGAL = 5;
export const DURASI_BLOKIR_MENIT = 15;
