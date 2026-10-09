import "server-only";
import { jadwalCicilan, nominalCicilanBerikut, statusDenda } from "@/domain/cicilan";
import { type TanggalISO, tambahHari } from "@/domain/tanggal";
import type { DendaInput } from "@/skema/penghasilan";
import { dariDate, keDate } from "@/server/db/tanggal";
import type { DbPerusahaan } from "@/server/db/tenant";
import { bentrok, tidakDitemukan, tidakValid } from "@/server/errors";
import { type PeriodeDto, muatPeriode } from "./periode";

export interface DendaDto {
  id: string;
  karyawanId: string;
  nama: string;
  alasan: string;
  total: number;
  jumlahCicilan: number;
  sisa: number;
  terbayar: number;
  tanggalMulai: TanggalISO;
  status: "berjalan" | "lunas";
  jadwal: number[];
}

export interface CicilanPeriode {
  dendaId: string;
  karyawanId: string;
  alasan: string;
  nominal: number;
  cicilanKe: number;
  dariCicilan: number;
}

export async function daftarDenda(db: DbPerusahaan, periodeId: string) {
  const periode = await muatPeriode(db, periodeId);
  const baris = await db.denda.findMany({
    include: { karyawan: { select: { namaLengkap: true } }, _count: { select: { potonganDenda: true } } },
    orderBy: [{ tanggalMulai: "desc" }, { dibuatPada: "desc" }],
  });
  const denda: DendaDto[] = baris.map((d) => ({
    id: d.id,
    karyawanId: d.karyawanId,
    nama: d.karyawan.namaLengkap,
    alasan: d.alasan,
    total: d.total,
    jumlahCicilan: d.jumlahCicilan,
    sisa: d.sisa,
    terbayar: d._count.potonganDenda,
    tanggalMulai: dariDate(d.tanggalMulai),
    status: statusDenda(d.sisa),
    jadwal: jadwalCicilan(d.total, d.jumlahCicilan),
  }));
  return { periode, denda, cicilanPeriodeIni: await cicilanUntukPeriode(db, periode) };
}

/**
 * Denda baru berlaku mulai periode ini atau periode berikutnya. Setelah periode difinalkan, hanya periode
 * berikutnya yang dapat dipilih, karena potongan periode final sudah tidak berubah.
 */
export async function buatDenda(db: DbPerusahaan, periodeId: string, input: DendaInput): Promise<DendaDto> {
  const periode = await muatPeriode(db, periodeId);
  if (periode.status === "FINAL" && input.mulai === "periode_ini") {
    throw bentrok(
      "Periode ini sudah final, jadi denda baru tidak bisa dipotong di periode ini. Pilih mulai dipotong pada periode berikutnya.",
      { periodeId },
      "PERIODE_FINAL",
    );
  }
  const karyawan = await db.karyawan.findFirst({ where: { id: input.karyawanId }, select: { id: true, namaLengkap: true, statusAktif: true } });
  if (!karyawan) throw tidakDitemukan("Karyawan");
  if (!karyawan.statusAktif) throw tidakValid(`${karyawan.namaLengkap} sudah nonaktif. Aktifkan kembali karyawan sebelum mencatat denda.`, { karyawanId: "Karyawan nonaktif." });

  let jadwal: number[];
  try {
    jadwal = jadwalCicilan(input.total, input.jumlahCicilan);
  } catch (galat) {
    throw tidakValid(galat instanceof RangeError ? galat.message : "Denda tidak valid. Periksa total dan jumlah cicilan.", { jumlahCicilan: "Periksa jumlah cicilan." });
  }

  const tanggalMulai = input.mulai === "periode_ini" ? periode.tanggalAwal : tambahHari(periode.tanggalAkhir, 1);
  const dibuat = await db.denda.create({
    data: {
      perusahaanId: db.$perusahaanId,
      karyawanId: input.karyawanId,
      alasan: input.alasan,
      total: input.total,
      jumlahCicilan: input.jumlahCicilan,
      sisa: input.total,
      tanggalMulai: keDate(tanggalMulai),
    },
  });
  return {
    id: dibuat.id,
    karyawanId: dibuat.karyawanId,
    nama: karyawan.namaLengkap,
    alasan: dibuat.alasan,
    total: dibuat.total,
    jumlahCicilan: dibuat.jumlahCicilan,
    sisa: dibuat.sisa,
    terbayar: 0,
    tanggalMulai,
    status: "berjalan",
    jadwal,
  };
}

/** Denda yang belum pernah dipotong boleh dihapus. Yang sudah mulai dipotong tetap tercatat. */
export async function hapusDenda(db: DbPerusahaan, dendaId: string): Promise<void> {
  const denda = await db.denda.findFirst({ where: { id: dendaId }, include: { _count: { select: { potonganDenda: true } } } });
  if (!denda) throw tidakDitemukan("Denda");
  if (denda._count.potonganDenda > 0) {
    throw bentrok(
      "Denda ini sudah mulai dipotong dari gaji, jadi tidak bisa dihapus agar riwayat potongan tetap benar. Bila keliru, buka kembali periode terkait.",
      { dendaId },
      "DENDA_SUDAH_DIPOTONG",
    );
  }
  await db.denda.delete({ where: { id: dendaId } });
}

/**
 * Cicilan yang jatuh pada periode ini. Dihitung dari jumlah cicilan yang sudah difinalkan, bukan disimpan,
 * sehingga penghitungan ulang draf berkali-kali tidak mengubah sisa (FR-14).
 */
export async function cicilanUntukPeriode(db: DbPerusahaan, periode: Pick<PeriodeDto, "tanggalAwal">): Promise<CicilanPeriode[]> {
  const baris = await db.denda.findMany({
    where: { sisa: { gt: 0 }, tanggalMulai: { lte: keDate(periode.tanggalAwal) }, karyawan: { statusAktif: true } },
    include: { _count: { select: { potonganDenda: true } } },
    orderBy: { dibuatPada: "asc" },
  });
  return baris
    .map((d) => {
      const terbayar = d._count.potonganDenda;
      return {
        dendaId: d.id,
        karyawanId: d.karyawanId,
        alasan: d.alasan,
        nominal: nominalCicilanBerikut({ total: d.total, jumlahCicilan: d.jumlahCicilan, terbayar, sisa: d.sisa }),
        cicilanKe: terbayar + 1,
        dariCicilan: d.jumlahCicilan,
      };
    })
    .filter((c) => c.nominal > 0);
}
