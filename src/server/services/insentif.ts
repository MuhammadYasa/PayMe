import "server-only";
import { formatRupiah } from "@/domain/uang";
import type { SimpanInsentifInput } from "@/skema/penghasilan";
import type { DbPerusahaan } from "@/server/db/tenant";
import { tidakDitemukan } from "@/server/errors";
import { ambilPengaturan } from "./pengaturan";
import { muatSalesUntukGaji } from "./pendapatan";
import { muatPeriode, muatPeriodeDraf } from "./periode";

export interface EntriInsentif {
  jenis: string;
  nominal: number;
}

export interface BarisInsentif {
  karyawanId: string;
  nama: string;
  cabang: string;
  entri: EntriInsentif[];
  totalInsentif: number;
  bonusTarget: number;
  /** Insentif ditambah bonus target, yang masuk ke gaji. */
  totalKomponen: number;
}

const JENIS_BAWAAN = "Pengiriman";

export async function ambilInsentif(db: DbPerusahaan, periodeId: string) {
  const periode = await muatPeriode(db, periodeId);
  const pengaturan = await ambilPengaturan(db);
  const [karyawan, entri, sales] = await Promise.all([
    db.karyawan.findMany({
      where: { statusAktif: true },
      select: { id: true, namaLengkap: true, cabang: true },
      orderBy: [{ cabang: "asc" }, { namaLengkap: "asc" }],
    }),
    db.insentif.findMany({ where: { periodeId }, orderBy: { jenis: "asc" } }),
    muatSalesUntukGaji(db, periodeId, pengaturan.tingkatBonus),
  ]);

  const baris: BarisInsentif[] = karyawan.map((k) => {
    const milik = entri.filter((e) => e.karyawanId === k.id).map((e) => ({ jenis: e.jenis, nominal: e.nominal }));
    const totalInsentif = milik.reduce((total, e) => total + e.nominal, 0);
    const bonusTarget = sales.get(k.id)?.bonus ?? 0;
    return { karyawanId: k.id, nama: k.namaLengkap, cabang: k.cabang, entri: milik, totalInsentif, bonusTarget, totalKomponen: totalInsentif + bonusTarget };
  });
  return { periode, karyawan: baris };
}

/**
 * Menyimpan insentif per karyawan. Baris tanpa nominal (kosong atau 0) tidak disimpan. Entri yang sama persis
 * pada satu karyawan hanya diberi peringatan, tidak ditolak.
 */
export async function simpanInsentif(db: DbPerusahaan, periodeId: string, input: SimpanInsentifInput) {
  await muatPeriodeDraf(db, periodeId);
  const ids = [...new Set(input.items.map((i) => i.karyawanId))];
  const karyawan = await db.karyawan.findMany({ where: { id: { in: ids } }, select: { id: true, namaLengkap: true } });
  if (karyawan.length !== ids.length) throw tidakDitemukan("Salah satu karyawan");
  const nama = new Map(karyawan.map((k) => [k.id, k.namaLengkap]));

  const peringatan: string[] = [];
  const baru: { karyawanId: string; jenis: string; nominal: number }[] = [];
  for (const item of input.items) {
    const lihat = new Set<string>();
    for (const e of item.entri) {
      if (!e.nominal) continue;
      const jenis = e.jenis || JENIS_BAWAAN;
      const kunci = `${jenis.toLowerCase()}|${e.nominal}`;
      if (lihat.has(kunci)) peringatan.push(`Entri ganda untuk ${nama.get(item.karyawanId)}: ${jenis} ${formatRupiah(e.nominal)}. Periksa kembali bila tidak disengaja.`);
      lihat.add(kunci);
      baru.push({ karyawanId: item.karyawanId, jenis, nominal: e.nominal });
    }
  }

  await db.$transaction([
    db.insentif.deleteMany({ where: { periodeId, karyawanId: { in: ids } } }),
    db.insentif.createMany({ data: baru.map((b) => ({ perusahaanId: db.$perusahaanId, periodeId, ...b })) }),
  ]);
  return { disimpan: baru.length, peringatan };
}
