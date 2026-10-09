import "server-only";
import type { InputBonusTarget } from "@/domain/gaji";
import type { Pengaturan } from "@/domain/pengaturan";
import { hitungBonusTarget, persenCapaianPermil } from "@/domain/target";
import { formatRupiah } from "@/domain/uang";
import type { PendapatanCabangInput } from "@/skema/penghasilan";
import type { DbPerusahaan } from "@/server/db/tenant";
import { tidakValid } from "@/server/errors";
import { ambilPengaturan } from "./pengaturan";
import { muatPeriode, muatPeriodeDraf } from "./periode";

export interface BarisSales {
  karyawanId: string;
  nama: string;
  nominal: number;
  target: number;
  persenCapaianPermil: number | null;
  bonus: number;
}

export interface DataCabang {
  cabang: string;
  totalAktual: number;
  /** Cabang ini sudah pernah disimpan. Membedakan total Rp 0 yang tersimpan dari cabang yang belum diisi. */
  sudahDisimpan: boolean;
  adaBreakdown: boolean;
  /** Total cabang dikurangi jumlah breakdown. Positif berarti breakdown kurang dari total. */
  selisih: number;
  selisihDiakui: boolean;
  sales: BarisSales[];
  kandidatSales: { id: string; nama: string }[];
}

function hitungBaris(
  nominal: number,
  target: number,
  tingkatBonus: Pengaturan["tingkatBonus"],
): Pick<BarisSales, "persenCapaianPermil" | "bonus"> {
  return {
    persenCapaianPermil: persenCapaianPermil(nominal, target),
    bonus: hitungBonusTarget(nominal, target, tingkatBonus).bonus,
  };
}

export function pesanSelisih(selisih: number): string {
  return `Selisih ${formatRupiah(Math.abs(selisih))} (${selisih > 0 ? "kurang dari total cabang" : "melebihi total cabang"})`;
}

export async function ambilPendapatan(db: DbPerusahaan, periodeId: string) {
  const periode = await muatPeriode(db, periodeId);
  const [pengaturan, aktif, rowCabang, rowSales] = await Promise.all([
    ambilPengaturan(db),
    db.karyawan.findMany({
      where: { statusAktif: true },
      select: { id: true, namaLengkap: true, cabang: true },
      orderBy: [{ cabang: "asc" }, { namaLengkap: "asc" }],
    }),
    db.pendapatanCabang.findMany({ where: { periodeId } }),
    db.pendapatanSales.findMany({
      where: { periodeId },
      include: { karyawan: { select: { namaLengkap: true } } },
      orderBy: { karyawan: { namaLengkap: "asc" } },
    }),
  ]);

  const daftarCabang = [...new Set([...aktif.map((k) => k.cabang), ...rowCabang.map((c) => c.cabang), ...rowSales.map((s) => s.cabang)])].sort(
    (a, b) => a.localeCompare(b, "id"),
  );

  const cabang: DataCabang[] = daftarCabang.map((nama) => {
    const baris = rowCabang.find((c) => c.cabang === nama);
    const sales: BarisSales[] = rowSales
      .filter((s) => s.cabang === nama)
      .map((s) => ({
        karyawanId: s.karyawanId,
        nama: s.karyawan.namaLengkap,
        nominal: Number(s.nominal),
        target: Number(s.target),
        ...hitungBaris(Number(s.nominal), Number(s.target), pengaturan.tingkatBonus),
      }));
    const totalAktual = baris ? Number(baris.totalAktual) : 0;
    const jumlahSales = sales.reduce((total, s) => total + s.nominal, 0);
    const dipakai = new Set(sales.map((s) => s.karyawanId));
    return {
      cabang: nama,
      totalAktual,
      sudahDisimpan: baris !== undefined || sales.length > 0,
      adaBreakdown: sales.length > 0,
      selisih: totalAktual - jumlahSales,
      selisihDiakui: baris?.selisihDiakui ?? false,
      sales,
      kandidatSales: aktif.filter((k) => k.cabang === nama && !dipakai.has(k.id)).map((k) => ({ id: k.id, nama: k.namaLengkap })),
    };
  });

  return { periode, cabang };
}

/**
 * Menyimpan total cabang beserta breakdown sales. Selisih hanya memberi peringatan; HRD melanjutkan setelah
 * mengakuinya. Hanya karyawan aktif dari cabang yang sama yang dapat menjadi sales pada cabang tersebut.
 */
export async function simpanPendapatanCabang(db: DbPerusahaan, periodeId: string, input: PendapatanCabangInput) {
  await muatPeriodeDraf(db, periodeId);

  const ids = input.sales.map((s) => s.karyawanId);
  if (ids.length > 0) {
    const karyawan = await db.karyawan.findMany({ where: { id: { in: ids } }, select: { id: true, namaLengkap: true, cabang: true, statusAktif: true } });
    const peta = new Map(karyawan.map((k) => [k.id, k]));
    for (const id of ids) {
      const k = peta.get(id);
      if (!k) throw tidakValid("Salah satu sales tidak ditemukan. Muat ulang halaman lalu pilih sales dari daftar.", { sales: "Sales tidak ditemukan." });
      if (k.cabang !== input.cabang) {
        throw tidakValid(`${k.namaLengkap} berasal dari cabang ${k.cabang}, bukan ${input.cabang}. Pilih sales dari cabang yang sama.`, {
          sales: "Sales harus berasal dari cabang yang sama.",
        });
      }
      if (!k.statusAktif) throw tidakValid(`${k.namaLengkap} sudah nonaktif. Pilih sales yang masih aktif.`, { sales: "Sales nonaktif." });
    }
  }

  const jumlah = input.sales.reduce((total, s) => total + s.nominal, 0);
  const selisih = input.totalAktual - jumlah;
  const perluDiakui = input.sales.length > 0 && selisih !== 0;

  await db.$transaction([
    db.pendapatanCabang.upsert({
      where: { periodeId_cabang: { periodeId, cabang: input.cabang } },
      create: {
        perusahaanId: db.$perusahaanId,
        periodeId,
        cabang: input.cabang,
        totalAktual: BigInt(input.totalAktual),
        selisihDiakui: perluDiakui && input.akuiSelisih,
      },
      update: { totalAktual: BigInt(input.totalAktual), selisihDiakui: perluDiakui && input.akuiSelisih },
    }),
    // Satu karyawan hanya punya satu baris per periode, jadi baris lamanya (bila pindah cabang) ikut diganti.
    db.pendapatanSales.deleteMany({ where: { periodeId, OR: [{ cabang: input.cabang }, { karyawanId: { in: ids } }] } }),
    db.pendapatanSales.createMany({
      data: input.sales.map((s) => {
        const permil = persenCapaianPermil(s.nominal, s.target);
        return {
          perusahaanId: db.$perusahaanId,
          periodeId,
          karyawanId: s.karyawanId,
          cabang: input.cabang,
          nominal: BigInt(s.nominal),
          target: BigInt(s.target),
          persenCapaian: permil === null ? null : (permil / 10).toFixed(1),
        };
      }),
    }),
  ]);

  const hasil = (await ambilPendapatan(db, periodeId)).cabang.find((c) => c.cabang === input.cabang)!;
  return { cabang: hasil, peringatan: perluDiakui ? pesanSelisih(selisih) : null };
}

/** Bonus target dan angka penjualan per karyawan, dipakai perhitungan gaji. */
export async function muatSalesUntukGaji(db: DbPerusahaan, periodeId: string, tingkat: Pengaturan["tingkatBonus"]): Promise<Map<string, InputBonusTarget>> {
  const baris = await db.pendapatanSales.findMany({ where: { periodeId } });
  const peta = new Map<string, InputBonusTarget>();
  for (const s of baris) {
    const nominal = Number(s.nominal);
    const target = Number(s.target);
    peta.set(s.karyawanId, {
      bonus: hitungBonusTarget(nominal, target, tingkat).bonus,
      penjualan: nominal,
      target,
      persenCapaianPermil: persenCapaianPermil(nominal, target),
    });
  }
  return peta;
}

/** Cabang yang masih punya selisih belum diakui. Menahan perhitungan gaji (FR-15). */
export async function selisihBelumDiakui(db: DbPerusahaan, periodeId: string): Promise<{ cabang: string; selisih: number }[]> {
  const { cabang } = await ambilPendapatan(db, periodeId);
  return cabang.filter((c) => c.adaBreakdown && c.selisih !== 0 && !c.selisihDiakui).map((c) => ({ cabang: c.cabang, selisih: c.selisih }));
}
