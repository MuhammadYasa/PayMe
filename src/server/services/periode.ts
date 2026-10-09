import "server-only";
import { type RentangPeriode, hitungPeriode, labelPeriode, periodeBertabrakan } from "@/domain/periode";
import type { TanggalISO } from "@/domain/tanggal";
import { menyebutConstraint } from "@/server/db/galat-prisma";
import { dariDate, keDate } from "@/server/db/tanggal";
import type { DbPerusahaan } from "@/server/db/tenant";
import { bentrok, tidakDitemukan } from "@/server/errors";

export type StatusPeriodeDto = "DRAF" | "FINAL";

export interface PeriodeDto extends RentangPeriode {
  id: string;
  status: StatusPeriodeDto;
  difinalkanPada: string | null;
}

export interface RiwayatPeriodeDto extends PeriodeDto {
  jumlahKaryawan: number;
  totalGaji: number | null;
}

interface BarisPeriode {
  id: string;
  tanggalAwal: Date;
  tanggalAkhir: Date;
  status: StatusPeriodeDto;
  difinalkanPada: Date | null;
}

function keDto(baris: BarisPeriode): PeriodeDto {
  const rentang = hitungPeriode(dariDate(baris.tanggalAwal));
  return {
    id: baris.id,
    tanggalAwal: dariDate(baris.tanggalAwal),
    tanggalAkhir: dariDate(baris.tanggalAkhir),
    jumlahHari: rentang.jumlahHari,
    status: baris.status,
    difinalkanPada: baris.difinalkanPada?.toISOString() ?? null,
  };
}

export async function muatPeriode(db: DbPerusahaan, id: string): Promise<PeriodeDto> {
  const baris = await db.periode.findFirst({ where: { id } });
  if (!baris) throw tidakDitemukan("Periode");
  return keDto(baris);
}

export function pastikanDraf(periode: PeriodeDto): void {
  if (periode.status !== "DRAF") {
    throw bentrok(
      "Periode ini sudah final dan hanya bisa dibaca. Untuk mengubahnya, buka kembali periode dari halaman Riwayat.",
      { periodeId: periode.id },
      "PERIODE_FINAL",
    );
  }
}

export async function muatPeriodeDraf(db: DbPerusahaan, id: string): Promise<PeriodeDto> {
  const periode = await muatPeriode(db, id);
  pastikanDraf(periode);
  return periode;
}

function bentrokPeriode(label: string, periodeId: string): ReturnType<typeof bentrok> {
  return bentrok(
    `Periode ini bertabrakan dengan periode ${label}. Pilih tanggal awal lain, atau buka periode tersebut.`,
    { periodeId },
    "PERIODE_BENTROK",
  );
}

export async function buatPeriode(db: DbPerusahaan, tanggalAwal: TanggalISO): Promise<PeriodeDto> {
  const rentang = hitungPeriode(tanggalAwal);
  const semua = (await db.periode.findMany()).map(keDto);

  const sama = semua.find((p) => p.tanggalAwal === tanggalAwal);
  if (sama) {
    throw bentrok(
      sama.status === "DRAF"
        ? "Periode dengan tanggal awal ini sudah ada dan masih berupa draf. Lanjutkan pengisian draf tersebut."
        : "Periode dengan tanggal awal ini sudah final. Buka kembali dari halaman Riwayat bila perlu mengubahnya.",
      { periodeId: sama.id, status: sama.status },
      "PERIODE_SUDAH_ADA",
    );
  }

  const tabrakan = semua.find((p) => periodeBertabrakan(rentang, p));
  if (tabrakan) throw bentrokPeriode(labelPeriode(tabrakan), tabrakan.id);

  try {
    const baris = await db.periode.create({
      data: {
        perusahaanId: db.$perusahaanId,
        tanggalAwal: keDate(rentang.tanggalAwal),
        tanggalAkhir: keDate(rentang.tanggalAkhir),
      },
    });
    return keDto(baris);
  } catch (galat) {
    // Dua permintaan serentak dapat lolos pemeriksaan di atas; constraint basis data menjadi penentunya.
    if (menyebutConstraint(galat, "periode_tidak_tumpang_tindih")) {
      throw bentrok(
        "Periode ini bertabrakan dengan periode lain yang baru saja dibuat. Muat ulang halaman lalu pilih tanggal awal lain.",
        undefined,
        "PERIODE_BENTROK",
      );
    }
    throw galat;
  }
}

export async function daftarPeriode(db: DbPerusahaan): Promise<RiwayatPeriodeDto[]> {
  const [baris, ringkasan, jumlahDraf] = await Promise.all([
    db.periode.findMany({ orderBy: { tanggalAwal: "desc" } }),
    db.hasilGaji.groupBy({ by: ["periodeId"], _count: { _all: true }, _sum: { totalBersih: true }, orderBy: { periodeId: "asc" } }),
    db.karyawan.count({ where: { statusAktif: true } }),
  ]);
  const peta = new Map(ringkasan.map((r) => [r.periodeId, r]));

  return baris.map((b) => {
    const dto = keDto(b);
    const hasil = peta.get(b.id);
    return {
      ...dto,
      jumlahKaryawan: dto.status === "FINAL" ? (hasil?._count._all ?? 0) : jumlahDraf,
      totalGaji: dto.status === "FINAL" ? (hasil?._sum.totalBersih ?? 0) : null,
    };
  });
}

export async function hapusPeriodeDraf(db: DbPerusahaan, id: string): Promise<void> {
  await muatPeriodeDraf(db, id);
  await db.periode.delete({ where: { id } });
}
