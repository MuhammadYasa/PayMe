import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { type Pengaturan, bacaPengaturan } from "@/domain/pengaturan";
import type { DbPerusahaan } from "@/server/db/tenant";

export async function ambilPengaturan(db: DbPerusahaan): Promise<Pengaturan> {
  return bacaPengaturan(await db.pengaturanPerusahaan.findFirst());
}

/**
 * Mengubah pengaturan hanya memengaruhi periode draf yang dihitung sesudahnya. Periode final tetap
 * memakai angka yang sudah tersimpan pada rinciannya.
 */
export async function simpanPengaturan(db: DbPerusahaan, input: Pengaturan): Promise<Pengaturan> {
  const data = {
    hariKerjaMingguan: [...input.hariKerjaMingguan].sort((a, b) => a - b),
    aturanPotongan: input.aturanPotongan as unknown as Prisma.InputJsonValue,
    tingkatBonus: input.tingkatBonus as unknown as Prisma.InputJsonValue,
  };
  const diubah = await db.pengaturanPerusahaan.updateMany({ where: {}, data });
  if (diubah.count === 0) await db.pengaturanPerusahaan.create({ data: { ...data, perusahaanId: db.$perusahaanId } });
  return ambilPengaturan(db);
}
