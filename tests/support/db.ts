import { randomUUID } from "node:crypto";
import { prisma } from "@/server/db/client";
import { dbPerusahaan } from "@/server/db/tenant";
import { daftarAkun } from "@/server/services/auth";

export const KATA_SANDI_UJI = "kata-sandi-uji-123";

export function emailUji(awalan = "uji"): string {
  return `${awalan}-${randomUUID()}@contoh.test`;
}

/** Perusahaan baru lengkap dengan satu akun, untuk dipakai satu berkas tes. */
export async function buatPerusahaanUji(nama = "PT Uji Sejahtera") {
  const email = emailUji();
  const { akunId, perusahaanId } = await daftarAkun({
    nama: "Admin Uji",
    namaPerusahaan: nama,
    email,
    kataSandi: KATA_SANDI_UJI,
  });
  return { akunId, perusahaanId, email, db: dbPerusahaan(perusahaanId) };
}

/** Semua data turunan ikut terhapus lewat cascade. */
export async function hapusPerusahaan(perusahaanId: string): Promise<void> {
  await prisma().perusahaan.deleteMany({ where: { id: perusahaanId } });
}

export async function hapusKunciPembatas(kunci: string[]): Promise<void> {
  await prisma().percobaanPublik.deleteMany({ where: { kunci: { in: kunci } } });
}
