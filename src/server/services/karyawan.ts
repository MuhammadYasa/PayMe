import "server-only";
import { kunciNama, rapikanNama } from "@/domain/nama";
import type { KaryawanInput } from "@/skema/karyawan";
import { adalahPelanggaranUnik } from "@/server/db/galat-prisma";
import type { DbPerusahaan } from "@/server/db/tenant";
import { AppError, tidakDitemukan } from "@/server/errors";

export interface KaryawanDto {
  id: string;
  namaLengkap: string;
  jabatan: string;
  cabang: string;
  gajiPokok: number;
  tunjangan: number;
  nomorRekening: string;
  statusAktif: boolean;
}

const PILIH = {
  id: true,
  namaLengkap: true,
  jabatan: true,
  cabang: true,
  gajiPokok: true,
  tunjangan: true,
  nomorRekening: true,
  statusAktif: true,
} as const;

function karyawanGanda(): AppError {
  const pesan = "Karyawan dengan nama dan nomor rekening yang sama sudah ada. Periksa daftar karyawan, atau ubah salah satu isiannya.";
  return new AppError(409, pesan, {
    kode: "KARYAWAN_GANDA",
    kolom: { namaLengkap: pesan, nomorRekening: pesan },
  });
}

function dataTulis(input: KaryawanInput) {
  return {
    namaLengkap: rapikanNama(input.namaLengkap),
    namaKunci: kunciNama(input.namaLengkap),
    jabatan: input.jabatan,
    cabang: input.cabang,
    gajiPokok: input.gajiPokok,
    tunjangan: input.tunjangan,
    nomorRekening: input.nomorRekening,
    statusAktif: input.statusAktif,
  };
}

export async function daftarKaryawan(
  db: DbPerusahaan,
  filter: { cari?: string; cabang?: string; status?: "aktif" | "nonaktif" | "semua" } = {},
): Promise<{ karyawan: KaryawanDto[]; daftarCabang: string[] }> {
  const kunci = filter.cari ? kunciNama(filter.cari) : "";
  const status = filter.status ?? "semua";

  const [karyawan, cabang] = await Promise.all([
    db.karyawan.findMany({
      where: {
        ...(kunci ? { namaKunci: { contains: kunci } } : {}),
        ...(filter.cabang ? { cabang: filter.cabang } : {}),
        ...(status === "aktif" ? { statusAktif: true } : status === "nonaktif" ? { statusAktif: false } : {}),
      },
      select: PILIH,
      orderBy: [{ cabang: "asc" }, { namaLengkap: "asc" }],
      take: 2000,
    }),
    db.karyawan.groupBy({ by: ["cabang"], orderBy: { cabang: "asc" } }),
  ]);

  return { karyawan, daftarCabang: cabang.map((c) => c.cabang) };
}

export async function ambilKaryawan(db: DbPerusahaan, id: string): Promise<KaryawanDto> {
  const karyawan = await db.karyawan.findFirst({ where: { id }, select: PILIH });
  if (!karyawan) throw tidakDitemukan("Karyawan");
  return karyawan;
}

export async function buatKaryawan(db: DbPerusahaan, input: KaryawanInput): Promise<KaryawanDto> {
  try {
    return await db.karyawan.create({
      data: { ...dataTulis(input), perusahaanId: db.$perusahaanId },
      select: PILIH,
    });
  } catch (galat) {
    if (adalahPelanggaranUnik(galat)) throw karyawanGanda();
    throw galat;
  }
}

export async function ubahKaryawan(db: DbPerusahaan, id: string, input: KaryawanInput): Promise<KaryawanDto> {
  await ambilKaryawan(db, id);
  try {
    return await db.karyawan.update({ where: { id }, data: dataTulis(input), select: PILIH });
  } catch (galat) {
    if (adalahPelanggaranUnik(galat)) throw karyawanGanda();
    throw galat;
  }
}

/**
 * Karyawan yang sudah punya hasil gaji tidak dihapus permanen supaya riwayat tetap utuh; statusnya
 * menjadi nonaktif. Karyawan tanpa riwayat dihapus bersama isian draf miliknya (absensi, insentif, dst.).
 */
export async function hapusKaryawan(db: DbPerusahaan, id: string): Promise<{ hasil: "dihapus" | "dinonaktifkan" }> {
  await ambilKaryawan(db, id);

  const jumlahRiwayat = await db.hasilGaji.count({ where: { karyawanId: id } });
  if (jumlahRiwayat > 0) {
    await db.karyawan.update({ where: { id }, data: { statusAktif: false } });
    return { hasil: "dinonaktifkan" };
  }

  await db.$transaction([
    db.absensi.deleteMany({ where: { karyawanId: id } }),
    db.pendapatanSales.deleteMany({ where: { karyawanId: id } }),
    db.insentif.deleteMany({ where: { karyawanId: id } }),
    db.potonganLain.deleteMany({ where: { karyawanId: id } }),
    db.potonganDenda.deleteMany({ where: { denda: { karyawanId: id } } }),
    db.denda.deleteMany({ where: { karyawanId: id } }),
    db.karyawanAlias.deleteMany({ where: { karyawanId: id } }),
    db.karyawan.delete({ where: { id } }),
  ]);
  return { hasil: "dihapus" };
}
