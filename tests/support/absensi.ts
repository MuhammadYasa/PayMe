import { tanggalDalamPeriode } from "@/domain/periode";
import { type TanggalISO, hariMinggu } from "@/domain/tanggal";
import { keDate } from "@/server/db/tanggal";
import type { DbPerusahaan } from "@/server/db/tenant";

/** Mengisi HADIR pada seluruh hari kerja (Senin sampai Sabtu) agar penghitungan gaji tidak tertahan tanggal kosong. */
export async function lengkapiAbsensi(
  db: DbPerusahaan,
  periodeId: string,
  karyawanIds: string[],
  periode: { tanggalAwal: TanggalISO; tanggalAkhir: TanggalISO },
): Promise<void> {
  const tanggal = tanggalDalamPeriode(periode).filter((t) => hariMinggu(t) !== 0);
  await db.absensi.createMany({
    data: karyawanIds.flatMap((karyawanId) =>
      tanggal.map((t) => ({
        perusahaanId: db.$perusahaanId,
        periodeId,
        karyawanId,
        tanggal: keDate(t),
        status: "HADIR" as const,
        jamMasuk: "07:00",
        jamPulang: "16:00",
        sumber: "MESIN" as const,
      })),
    ),
  });
}
