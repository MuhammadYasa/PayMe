/** Galat yang aman ditampilkan ke pengguna: pesannya sudah berbahasa Indonesia dengan penyebab dan langkah perbaikan. */
export class AppError extends Error {
  readonly status: number;
  readonly kolom?: Record<string, string>;
  readonly kode?: string;
  readonly data?: unknown;

  constructor(
    status: number,
    pesan: string,
    opsi: { kolom?: Record<string, string>; kode?: string; data?: unknown } = {},
  ) {
    super(pesan);
    this.name = "AppError";
    this.status = status;
    this.kolom = opsi.kolom;
    this.kode = opsi.kode;
    this.data = opsi.data;
  }
}

export function tidakAdaSesi(): AppError {
  return new AppError(401, "Sesi Anda sudah berakhir atau Anda belum masuk. Silakan masuk kembali.", {
    kode: "TIDAK_ADA_SESI",
  });
}

export function tidakDitemukan(apa = "Data"): AppError {
  return new AppError(
    404,
    `${apa} tidak ditemukan. Muat ulang halaman, lalu pilih kembali datanya dari daftar.`,
    { kode: "TIDAK_DITEMUKAN" },
  );
}

export function tidakValid(pesan: string, kolom?: Record<string, string>, kode = "TIDAK_VALID"): AppError {
  return new AppError(422, pesan, { kolom, kode });
}

export function bentrok(pesan: string, data?: unknown, kode = "BENTROK"): AppError {
  return new AppError(409, pesan, { kode, data });
}

export function terlaluBanyakPercobaan(pesan: string, sisaDetik: number): AppError {
  return new AppError(429, pesan, { kode: "TERLALU_BANYAK_PERCOBAAN", data: { sisaDetik } });
}
