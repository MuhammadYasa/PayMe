import { MAKS_UKURAN_UNGGAH_BYTE } from "@/domain/batas";
import { konfigurasiImporSkema } from "@/skema/absensi";
import { AppError, tidakValid } from "@/server/errors";
import { periksaNamaDanUkuran } from "@/server/excel/berkas";
import { parseId, ruteAdmin } from "@/server/http";
import { analisisImpor, bacaBerkas, jalankanImpor } from "@/server/services/impor-absensi";
import { muatPeriodeDraf } from "@/server/services/periode";

type Params = { id: string };

// Ruang untuk bagian multipart selain berkas (batas, nama field, konfigurasi JSON).
const TAMBAHAN_BODY_BYTE = 256 * 1024;

/**
 * Satu endpoint untuk tiga tahap, dengan berkas dikirim ulang di setiap tahap sehingga server tidak menyimpan
 * apa pun di antara permintaan: `baca` (sheet dan tebakan kolom), `analisis` (ringkasan), `impor` (menulis).
 */
export const POST = ruteAdmin<Params>(async ({ req, db, params }) => {
  const periodeId = parseId(params.id, "Periode");

  // Berkas yang kebesaran ditolak dari header sebelum isinya dibaca.
  const panjang = Number(req.headers.get("content-length") ?? 0);
  if (panjang > MAKS_UKURAN_UNGGAH_BYTE + TAMBAHAN_BODY_BYTE) {
    throw new AppError(
      413,
      "Ukuran file melebihi 5 MB. Hapus sheet atau kolom yang tidak dipakai di Excel, lalu unggah lagi.",
      { kode: "FILE_TERLALU_BESAR" },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw tidakValid("Unggahan tidak terbaca. Pilih file Excel lagi lalu coba kembali.", { file: "Unggahan tidak terbaca." });
  }

  const file = form.get("file");
  if (!(file instanceof File)) throw tidakValid("Pilih file Excel hasil mesin finger terlebih dahulu.", { file: "Pilih file Excel." });
  periksaNamaDanUkuran(file.name, file.size);
  await muatPeriodeDraf(db, periodeId);
  const isi = Buffer.from(await file.arrayBuffer());

  const tahap = form.get("tahap");
  if (tahap === "baca") return bacaBerkas(file.name, isi);

  let mentah: unknown;
  try {
    mentah = JSON.parse(String(form.get("konfigurasi") ?? ""));
  } catch {
    throw tidakValid("Pengaturan pembacaan file tidak terbaca. Muat ulang halaman lalu coba lagi.");
  }
  const konfigurasi = konfigurasiImporSkema.parse(mentah);

  if (tahap === "analisis") return analisisImpor(db, periodeId, file.name, isi, konfigurasi);
  if (tahap === "impor") return jalankanImpor(db, periodeId, file.name, isi, konfigurasi);
  throw tidakValid("Tahap unggahan tidak dikenal. Muat ulang halaman lalu coba lagi.");
});
