import "server-only";
import { hitungPeriode } from "@/domain/periode";
import { dariDate, keDate } from "@/server/db/tanggal";
import type { SimpanPotonganLainInput } from "@/skema/penghasilan";
import type { DbPerusahaan } from "@/server/db/tenant";
import { tidakDitemukan } from "@/server/errors";
import { type PeriodeDto, muatPeriode, muatPeriodeDraf } from "./periode";

export interface BarisPotonganLain {
  karyawanId: string;
  nama: string;
  cabang: string;
  pajak: number;
  asuransi: number;
}

async function muatBaris(db: DbPerusahaan, periodeId: string): Promise<BarisPotonganLain[]> {
  const [karyawan, potongan] = await Promise.all([
    db.karyawan.findMany({
      where: { statusAktif: true },
      select: { id: true, namaLengkap: true, cabang: true },
      orderBy: [{ cabang: "asc" }, { namaLengkap: "asc" }],
    }),
    db.potonganLain.findMany({ where: { periodeId } }),
  ]);
  return karyawan.map((k) => ({
    karyawanId: k.id,
    nama: k.namaLengkap,
    cabang: k.cabang,
    pajak: potongan.find((p) => p.karyawanId === k.id && p.jenis === "PAJAK")?.nominal ?? 0,
    asuransi: potongan.find((p) => p.karyawanId === k.id && p.jenis === "ASURANSI")?.nominal ?? 0,
  }));
}

export async function ambilPotonganLain(db: DbPerusahaan, periodeId: string) {
  const periode = await muatPeriode(db, periodeId);
  return { periode, karyawan: await muatBaris(db, periodeId) };
}

/** Nominal pajak dan asuransi diisi HRD apa adanya; sistem tidak menghitung PPh atau iuran. */
export async function simpanPotonganLain(db: DbPerusahaan, periodeId: string, input: SimpanPotonganLainInput) {
  await muatPeriodeDraf(db, periodeId);
  const ids = [...new Set(input.items.map((i) => i.karyawanId))];
  const ada = await db.karyawan.count({ where: { id: { in: ids } } });
  if (ada !== ids.length) throw tidakDitemukan("Salah satu karyawan");

  const data = input.items.flatMap((item) => [
    ...(item.pajak ? [{ karyawanId: item.karyawanId, jenis: "PAJAK" as const, nominal: item.pajak }] : []),
    ...(item.asuransi ? [{ karyawanId: item.karyawanId, jenis: "ASURANSI" as const, nominal: item.asuransi }] : []),
  ]);
  await db.$transaction([
    db.potonganLain.deleteMany({ where: { periodeId, karyawanId: { in: ids } } }),
    db.potonganLain.createMany({ data: data.map((d) => ({ perusahaanId: db.$perusahaanId, periodeId, ...d })) }),
  ]);
  return { disimpan: data.length };
}

/**
 * Nominal dari periode terdekat sebelumnya yang punya data, untuk mengisi form. Tidak menyimpan apa pun;
 * HRD masih dapat mengubah angkanya sebelum menyimpan.
 */
export async function salinDariSebelumnya(db: DbPerusahaan, periodeId: string): Promise<{ sumber: PeriodeDto | null; karyawan: BarisPotonganLain[] }> {
  const periode = await muatPeriode(db, periodeId);
  const sebelumnya = await db.periode.findMany({
    where: { tanggalAwal: { lt: keDate(periode.tanggalAwal) }, potonganLain: { some: {} } },
    orderBy: { tanggalAwal: "desc" },
    take: 1,
  });
  const sumber = sebelumnya[0];
  if (!sumber) return { sumber: null, karyawan: [] };
  const rentang = hitungPeriode(dariDate(sumber.tanggalAwal));
  return {
    sumber: {
      id: sumber.id,
      tanggalAwal: rentang.tanggalAwal,
      tanggalAkhir: dariDate(sumber.tanggalAkhir),
      jumlahHari: rentang.jumlahHari,
      status: sumber.status,
      difinalkanPada: sumber.difinalkanPada?.toISOString() ?? null,
    },
    karyawan: await muatBaris(db, sumber.id),
  };
}
