import "server-only";
import { prisma } from "./client";

/**
 * Model yang memiliki kolom perusahaan_id. Setiap query pada model ini otomatis difilter
 * dengan perusahaan dari sesi (NFR-09), jadi kode layanan tidak perlu mengingat untuk menyaringnya.
 * Tes `tenant.test.ts` memastikan daftar ini selalu sama dengan skema Prisma.
 */
export const MODEL_PER_PERUSAHAAN: ReadonlySet<string> = new Set([
  "PengaturanPerusahaan",
  "Karyawan",
  "KaryawanAlias",
  "Periode",
  "Absensi",
  "PendapatanCabang",
  "PendapatanSales",
  "Insentif",
  "Denda",
  "PotonganDenda",
  "PotonganLain",
  "HasilGaji",
]);

interface ArgumenLonggar {
  where?: Record<string, unknown>;
  data?: unknown;
  create?: Record<string, unknown>;
  update?: Record<string, unknown>;
}

function tanpaPerusahaan(data: unknown): unknown {
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const salinan = { ...(data as Record<string, unknown>) };
    delete salinan.perusahaanId;
    delete salinan.perusahaan;
    return salinan;
  }
  return data;
}

function denganPerusahaan(data: unknown, perusahaanId: string): unknown {
  if (Array.isArray(data)) return data.map((baris) => denganPerusahaan(baris, perusahaanId));
  return { ...(data as Record<string, unknown>), perusahaanId };
}

/**
 * Klien Prisma yang terkunci pada satu perusahaan. Semua baca dan tulis pada model per-perusahaan
 * dipaksa memakai `perusahaanId` ini, apa pun yang dikirim pemanggil.
 *
 * Aturan pemakaian: tulis relasi memakai kolom `...Id` (bukan `connect` atau nested create), dan
 * jangan memakai SQL mentah untuk tabel per-perusahaan. Tes keamanan kode memeriksa aturan kedua.
 *
 * Tipe Prisma mewajibkan `perusahaanId` pada data baru, jadi pemanggil mengisinya dari `db.$perusahaanId`.
 * Nilai itu tetap ditimpa di bawah, sehingga data yang salah isi tidak mungkin tertulis ke perusahaan lain.
 */
export function dbPerusahaan(perusahaanId: string) {
  if (!perusahaanId) throw new Error("perusahaanId wajib diisi untuk mengakses data.");

  return prisma().$extends({
    name: "isolasi-perusahaan",
    client: { $perusahaanId: perusahaanId },
    query: {
      $allModels: {
        $allOperations({ model, operation, args, query }) {
          if (!MODEL_PER_PERUSAHAAN.has(model)) return query(args);

          const a = args as ArgumenLonggar;
          switch (operation) {
            case "findUnique":
            case "findUniqueOrThrow":
            case "findFirst":
            case "findFirstOrThrow":
            case "findMany":
            case "count":
            case "aggregate":
            case "groupBy":
            case "delete":
            case "deleteMany":
              a.where = { ...a.where, perusahaanId };
              break;
            case "update":
            case "updateMany":
            case "updateManyAndReturn":
              a.where = { ...a.where, perusahaanId };
              a.data = tanpaPerusahaan(a.data);
              break;
            case "create":
            case "createMany":
            case "createManyAndReturn":
              a.data = denganPerusahaan(a.data, perusahaanId);
              break;
            case "upsert":
              a.where = { ...a.where, perusahaanId };
              a.create = denganPerusahaan(a.create, perusahaanId) as Record<string, unknown>;
              a.update = tanpaPerusahaan(a.update) as Record<string, unknown>;
              break;
            default:
              // Gagal tertutup: operasi yang belum dipetakan tidak boleh lolos tanpa filter.
              throw new Error(`Operasi ${operation} pada ${model} belum didukung lapisan akses data per perusahaan.`);
          }
          return query(a);
        },
      },
    },
  });
}

export type DbPerusahaan = ReturnType<typeof dbPerusahaan>;
