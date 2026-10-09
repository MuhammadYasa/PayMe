export const PERISTIWA_SESI_BERAKHIR = "payme:sesi-berakhir";

const PESAN_UMUM: Record<number, string> = {
  400: "Data yang dikirim tidak terbaca. Muat ulang halaman lalu coba lagi.",
  401: "Sesi Anda sudah berakhir. Silakan masuk kembali.",
  403: "Anda tidak memiliki izin untuk melakukan ini. Muat ulang halaman lalu coba lagi.",
  404: "Data tidak ditemukan. Muat ulang halaman, lalu pilih kembali datanya dari daftar.",
  409: "Data bentrok dengan data yang sudah ada. Muat ulang halaman lalu periksa kembali.",
  413: "Data yang dikirim terlalu besar. Kurangi isinya lalu coba lagi.",
  422: "Ada isian yang belum benar. Periksa kolom yang ditandai, lalu coba lagi.",
  429: "Terlalu banyak percobaan. Tunggu beberapa saat, lalu coba lagi.",
};
const PESAN_SERVER = "Terjadi kesalahan di server. Data Anda tidak berubah. Coba lagi beberapa saat lagi.";
const PESAN_JARINGAN = "Tidak dapat terhubung ke server. Periksa koneksi internet Anda, lalu coba lagi.";

export class GalatApi extends Error {
  readonly status: number;
  readonly kolom: Record<string, string>;
  readonly kode?: string;
  readonly data?: unknown;

  constructor(status: number, pesan: string, kolom: Record<string, string> = {}, kode?: string, data?: unknown) {
    super(pesan);
    this.name = "GalatApi";
    this.status = status;
    this.kolom = kolom;
    this.kode = kode;
    this.data = data;
  }
}

interface OpsiApi {
  metode?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  formData?: FormData;
  sinyal?: AbortSignal;
}

interface BentukGalat {
  pesan?: string;
  kolom?: Record<string, string>;
  kode?: string;
  data?: unknown;
}

async function bacaGalat(res: Response, url: string): Promise<GalatApi> {
  let isi: BentukGalat = {};
  try {
    isi = (await res.json()) as BentukGalat;
  } catch {
    // Respons bukan JSON (mis. halaman galat dari proxy); pakai pesan umum.
  }
  // Kegagalan login bukan tanda sesi berakhir, jadi tidak memicu dialog "sesi berakhir".
  if (res.status === 401 && !url.startsWith("/api/auth/") && typeof window !== "undefined") {
    window.dispatchEvent(new Event(PERISTIWA_SESI_BERAKHIR));
  }
  const pesan = isi.pesan ?? (res.status >= 500 ? PESAN_SERVER : (PESAN_UMUM[res.status] ?? PESAN_SERVER));
  return new GalatApi(res.status, pesan, isi.kolom ?? {}, isi.kode, isi.data);
}

/** Pembungkus fetch: JSON masuk dan keluar, galat dipetakan ke GalatApi berpesan Indonesia. */
export async function api<T = unknown>(url: string, opsi: OpsiApi = {}): Promise<T> {
  const metode = opsi.metode ?? (opsi.body !== undefined || opsi.formData ? "POST" : "GET");
  let res: Response;
  try {
    res = await fetch(url, {
      method: metode,
      headers: opsi.body !== undefined ? { "content-type": "application/json" } : undefined,
      body: opsi.formData ?? (opsi.body !== undefined ? JSON.stringify(opsi.body) : undefined),
      signal: opsi.sinyal,
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch (galat) {
    if (opsi.sinyal?.aborted) throw galat;
    throw new GalatApi(0, PESAN_JARINGAN);
  }
  if (!res.ok) throw await bacaGalat(res, url);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Mengunduh berkas lewat fetch supaya galat tampil sebagai pesan, bukan halaman JSON mentah. */
export async function unduhBerkas(url: string, namaBawaan: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(url, { credentials: "same-origin", cache: "no-store" });
  } catch {
    throw new GalatApi(0, PESAN_JARINGAN);
  }
  if (!res.ok) throw await bacaGalat(res, url);

  const disposisi = res.headers.get("content-disposition") ?? "";
  const nama = /filename="?([^";]+)"?/i.exec(disposisi)?.[1] ?? namaBawaan;
  const blob = await res.blob();
  const tautan = document.createElement("a");
  const alamat = URL.createObjectURL(blob);
  tautan.href = alamat;
  tautan.download = nama;
  document.body.appendChild(tautan);
  tautan.click();
  tautan.remove();
  setTimeout(() => URL.revokeObjectURL(alamat), 10_000);
}

export function pesanDariGalat(galat: unknown): string {
  if (galat instanceof GalatApi) return galat.message;
  return PESAN_SERVER;
}
