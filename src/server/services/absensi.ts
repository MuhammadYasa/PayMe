import "server-only";
import {
  type CatatanHarian,
  type RingkasanAbsensi,
  type StatusAbsensi,
  adalahLiburMingguan,
  perluasRentang,
  ringkasAbsensi,
} from "@/domain/absensi";
import { berisiTanggal, labelPeriode, tanggalDalamPeriode } from "@/domain/periode";
import { type TanggalISO, formatTanggal, hariMinggu, namaHariPendek } from "@/domain/tanggal";
import type { ItemCatatan, KetidakhadiranInput } from "@/skema/absensi";
import { dariDate, keDate } from "@/server/db/tanggal";
import type { DbPerusahaan } from "@/server/db/tenant";
import { bentrok, tidakDitemukan, tidakValid } from "@/server/errors";
import { ambilPengaturan } from "./pengaturan";
import { type PeriodeDto, muatPeriode, muatPeriodeDraf } from "./periode";

export interface KaryawanRingkas {
  id: string;
  namaLengkap: string;
  cabang: string;
  statusAktif: boolean;
}

export interface BarisRingkasan {
  karyawanId: string;
  nama: string;
  cabang: string;
  ringkasan: RingkasanAbsensi;
}

export interface BarisHarian {
  tanggal: TanggalISO;
  hari: string;
  liburMingguan: boolean;
  status: StatusAbsensi | null;
  jamMasuk: string | null;
  jamPulang: string | null;
  keterangan: string | null;
  sumber: "MESIN" | "MANUAL" | null;
}

async function muatKaryawan(db: DbPerusahaan, id: string): Promise<KaryawanRingkas> {
  const karyawan = await db.karyawan.findFirst({
    where: { id },
    select: { id: true, namaLengkap: true, cabang: true, statusAktif: true },
  });
  if (!karyawan) throw tidakDitemukan("Karyawan");
  return karyawan;
}

function pastikanDalamPeriode(periode: PeriodeDto, tanggal: readonly TanggalISO[]): void {
  const luar = tanggal.find((t) => !berisiTanggal(periode, t));
  if (luar) {
    throw tidakValid(
      `Tanggal ${formatTanggal(luar)} berada di luar periode ${labelPeriode(periode)}. Pilih tanggal di dalam periode.`,
      { tanggal: "Tanggal di luar periode." },
    );
  }
}

function contohBentrok(daftar: { nama: string; tanggal: TanggalISO; status: string }[]) {
  return daftar.slice(0, 50);
}

async function targetKaryawan(db: DbPerusahaan, karyawanIds: "semua" | string[]): Promise<{ id: string; namaLengkap: string }[]> {
  if (karyawanIds === "semua") {
    return db.karyawan.findMany({ where: { statusAktif: true }, select: { id: true, namaLengkap: true } });
  }
  const unik = [...new Set(karyawanIds)];
  const ditemukan = await db.karyawan.findMany({ where: { id: { in: unik } }, select: { id: true, namaLengkap: true, statusAktif: true } });
  if (ditemukan.length !== unik.length) throw tidakDitemukan("Salah satu karyawan");
  // Karyawan nonaktif diabaikan, sesuai aturan: libur pada karyawan nonaktif tidak diproses.
  return ditemukan.filter((k) => k.statusAktif);
}

function kelompokkanCatatan(
  baris: { karyawanId: string; tanggal: Date; status: StatusAbsensi }[],
): Map<string, CatatanHarian[]> {
  const peta = new Map<string, CatatanHarian[]>();
  for (const b of baris) {
    const daftar = peta.get(b.karyawanId) ?? [];
    daftar.push({ tanggal: dariDate(b.tanggal), status: b.status });
    peta.set(b.karyawanId, daftar);
  }
  return peta;
}

/** Ringkasan seluruh karyawan aktif pada satu periode. Dihitung ulang dari data setiap dipanggil. */
export async function ringkasanPeriode(db: DbPerusahaan, periodeId: string, opsi: { hanyaBelumLengkap?: boolean } = {}) {
  const periode = await muatPeriode(db, periodeId);
  const [pengaturan, karyawan, catatan] = await Promise.all([
    ambilPengaturan(db),
    db.karyawan.findMany({
      where: { statusAktif: true },
      select: { id: true, namaLengkap: true, cabang: true },
      orderBy: [{ cabang: "asc" }, { namaLengkap: "asc" }],
    }),
    db.absensi.findMany({ where: { periodeId }, select: { karyawanId: true, tanggal: true, status: true } }),
  ]);

  const peta = kelompokkanCatatan(catatan);
  const semua: BarisRingkasan[] = karyawan.map((k) => ({
    karyawanId: k.id,
    nama: k.namaLengkap,
    cabang: k.cabang,
    ringkasan: ringkasAbsensi({
      tanggalAwal: periode.tanggalAwal,
      tanggalAkhir: periode.tanggalAkhir,
      catatan: peta.get(k.id) ?? [],
      hariKerjaMingguan: pengaturan.hariKerjaMingguan,
    }),
  }));

  const belumLengkap = semua.filter((b) => b.ringkasan.jumlahKosong > 0);
  return {
    periode,
    hariKerjaMingguan: pengaturan.hariKerjaMingguan,
    karyawan: opsi.hanyaBelumLengkap ? belumLengkap : semua,
    jumlahKaryawan: semua.length,
    jumlahBelumLengkap: belumLengkap.length,
    totalKosong: belumLengkap.reduce((total, b) => total + b.ringkasan.jumlahKosong, 0),
    lengkap: semua.length > 0 && belumLengkap.length === 0,
  };
}

export async function detailKaryawan(db: DbPerusahaan, periodeId: string, karyawanId: string) {
  const periode = await muatPeriode(db, periodeId);
  const karyawan = await muatKaryawan(db, karyawanId);
  const [pengaturan, baris] = await Promise.all([
    ambilPengaturan(db),
    db.absensi.findMany({ where: { periodeId, karyawanId } }),
  ]);

  const peta = new Map(baris.map((b) => [dariDate(b.tanggal), b]));
  const harian: BarisHarian[] = tanggalDalamPeriode(periode).map((tanggal) => {
    const b = peta.get(tanggal);
    return {
      tanggal,
      hari: namaHariPendek(hariMinggu(tanggal)),
      liburMingguan: adalahLiburMingguan(tanggal, pengaturan.hariKerjaMingguan),
      status: b?.status ?? null,
      jamMasuk: b?.jamMasuk ?? null,
      jamPulang: b?.jamPulang ?? null,
      keterangan: b?.keterangan ?? null,
      sumber: b?.sumber ?? null,
    };
  });

  const ringkasan = ringkasAbsensi({
    tanggalAwal: periode.tanggalAwal,
    tanggalAkhir: periode.tanggalAkhir,
    catatan: baris.map((b) => ({ tanggal: dariDate(b.tanggal), status: b.status })),
    hariKerjaMingguan: pengaturan.hariKerjaMingguan,
  });
  return { periode, karyawan, baris: harian, ringkasan };
}

/** HRD mengisi atau menghapus status per tanggal. Isian dari HRD ditandai MANUAL agar tidak tertimpa unggahan ulang. */
export async function simpanCatatan(
  db: DbPerusahaan,
  periodeId: string,
  karyawanId: string,
  input: { simpan: ItemCatatan[]; hapus: TanggalISO[] },
) {
  const periode = await muatPeriodeDraf(db, periodeId);
  await muatKaryawan(db, karyawanId);
  pastikanDalamPeriode(periode, [...input.simpan.map((s) => s.tanggal), ...input.hapus]);

  // Bila tanggal yang sama muncul dua kali, isian terakhir yang dipakai.
  const terakhir = new Map(input.simpan.map((item) => [item.tanggal, item]));
  const operasi = [...terakhir.values()].map((item) => {
    const data = {
      status: item.status,
      jamMasuk: item.status === "HADIR" ? item.jamMasuk : null,
      jamPulang: item.status === "HADIR" ? item.jamPulang : null,
      keterangan: item.keterangan,
      sumber: "MANUAL" as const,
    };
    return db.absensi.upsert({
      where: { periodeId_karyawanId_tanggal: { periodeId, karyawanId, tanggal: keDate(item.tanggal) } },
      create: { ...data, perusahaanId: db.$perusahaanId, periodeId, karyawanId, tanggal: keDate(item.tanggal) },
      update: data,
    });
  });
  const hapus =
    input.hapus.length > 0
      ? [db.absensi.deleteMany({ where: { periodeId, karyawanId, tanggal: { in: input.hapus.map(keDate) } } })]
      : [];
  await db.$transaction([...operasi, ...hapus]);
  return detailKaryawan(db, periodeId, karyawanId);
}

export async function hapusCatatan(db: DbPerusahaan, periodeId: string, karyawanId: string, tanggal: TanggalISO[]) {
  return simpanCatatan(db, periodeId, karyawanId, { simpan: [], hapus: tanggal });
}

/** Mengisi banyak tanggal sekaligus untuk satu karyawan. Tanggal yang sudah terisi dilewati kecuali `timpa`. */
export async function isiMassal(
  db: DbPerusahaan,
  periodeId: string,
  karyawanId: string,
  input: { tanggal: TanggalISO[]; status: StatusAbsensi; keterangan: string | null; timpa: boolean },
) {
  const periode = await muatPeriodeDraf(db, periodeId);
  await muatKaryawan(db, karyawanId);
  const tanggal = [...new Set(input.tanggal)];
  pastikanDalamPeriode(periode, tanggal);

  const ada = await db.absensi.findMany({
    where: { periodeId, karyawanId, tanggal: { in: tanggal.map(keDate) } },
    select: { tanggal: true },
  });
  const terisi = new Set(ada.map((a) => dariDate(a.tanggal)));
  const target = input.timpa ? tanggal : tanggal.filter((t) => !terisi.has(t));

  if (target.length > 0) {
    await db.$transaction([
      db.absensi.deleteMany({ where: { periodeId, karyawanId, tanggal: { in: target.map(keDate) } } }),
      db.absensi.createMany({
        data: target.map((t) => ({
          perusahaanId: db.$perusahaanId,
          periodeId,
          karyawanId,
          tanggal: keDate(t),
          status: input.status,
          keterangan: input.keterangan,
          sumber: "MANUAL" as const,
        })),
      }),
    ]);
  }
  return { diisi: target.length, dilewati: tanggal.length - target.length };
}

/** Libur perusahaan (semua karyawan aktif) atau libur individual. Data lain pada tanggal itu hanya ditimpa setelah dikonfirmasi. */
export async function tandaiLibur(
  db: DbPerusahaan,
  periodeId: string,
  input: { tanggal: TanggalISO[]; karyawanIds: "semua" | string[]; keterangan: string | null; timpa: boolean },
) {
  const periode = await muatPeriodeDraf(db, periodeId);
  const tanggal = [...new Set(input.tanggal)];
  pastikanDalamPeriode(periode, tanggal);

  const karyawan = await targetKaryawan(db, input.karyawanIds);
  if (karyawan.length === 0) {
    throw tidakValid("Tidak ada karyawan aktif yang bisa ditandai libur. Tambahkan karyawan atau pilih karyawan yang aktif.");
  }
  const nama = new Map(karyawan.map((k) => [k.id, k.namaLengkap]));
  const ids = karyawan.map((k) => k.id);

  const ada = await db.absensi.findMany({
    where: { periodeId, karyawanId: { in: ids }, tanggal: { in: tanggal.map(keDate) } },
    select: { karyawanId: true, tanggal: true, status: true },
  });
  const konflik = ada
    .filter((a) => a.status !== "LIBUR")
    .map((a) => ({ nama: nama.get(a.karyawanId) ?? "", tanggal: dariDate(a.tanggal), status: a.status }));

  if (konflik.length > 0 && !input.timpa) {
    throw bentrok(
      `Ada ${konflik.length} data absensi pada tanggal ini (misalnya hadir dari mesin finger, izin, atau cuti) yang akan tertimpa oleh libur. Timpa data tersebut?`,
      { konflik: contohBentrok(konflik), jumlah: konflik.length },
      "KONFIRMASI_TIMPA",
    );
  }

  await db.$transaction([
    db.absensi.deleteMany({ where: { periodeId, karyawanId: { in: ids }, tanggal: { in: tanggal.map(keDate) } } }),
    db.absensi.createMany({
      data: ids.flatMap((karyawanId) =>
        tanggal.map((t) => ({
          perusahaanId: db.$perusahaanId,
          periodeId,
          karyawanId,
          tanggal: keDate(t),
          status: "LIBUR" as const,
          keterangan: input.keterangan,
          sumber: "MANUAL" as const,
        })),
      ),
    }),
  ]);
  return { karyawan: ids.length, tanggal: tanggal.length, ditimpa: konflik.length };
}

/** Menghapus penanda libur. Tanggalnya kembali kosong bila tidak ada data lain. */
export async function hapusLibur(
  db: DbPerusahaan,
  periodeId: string,
  input: { tanggal: TanggalISO[]; karyawanIds: "semua" | string[] },
) {
  const periode = await muatPeriodeDraf(db, periodeId);
  pastikanDalamPeriode(periode, input.tanggal);
  const karyawan = await targetKaryawan(db, input.karyawanIds);
  const hasil = await db.absensi.deleteMany({
    where: {
      periodeId,
      status: "LIBUR",
      karyawanId: { in: karyawan.map((k) => k.id) },
      tanggal: { in: input.tanggal.map(keDate) },
    },
  });
  return { dihapus: hasil.count };
}

/** Izin, sakit, cuti, atau lainnya untuk satu rentang tanggal. Hari libur dilewati dan tanggal di luar periode dipotong. */
export async function catatKetidakhadiran(db: DbPerusahaan, periodeId: string, input: KetidakhadiranInput) {
  const periode = await muatPeriodeDraf(db, periodeId);
  const karyawan = await muatKaryawan(db, input.karyawanId);
  const pengaturan = await ambilPengaturan(db);

  const libur = await db.absensi.findMany({
    where: { periodeId, karyawanId: input.karyawanId, status: "LIBUR" },
    select: { tanggal: true },
  });
  const luas = perluasRentang({
    dari: input.dari,
    sampai: input.sampai,
    periode,
    hariKerjaMingguan: pengaturan.hariKerjaMingguan,
    tanggalLibur: new Set(libur.map((l) => dariDate(l.tanggal))),
  });
  if (luas.tanggal.length === 0) {
    throw tidakValid(
      "Rentang tanggal ini tidak memuat hari kerja di dalam periode (semuanya libur atau di luar periode). Pilih rentang lain.",
      { dari: "Tidak ada hari kerja pada rentang ini." },
    );
  }

  const status = input.jenis as StatusAbsensi;
  const ada = await db.absensi.findMany({
    where: { periodeId, karyawanId: input.karyawanId, tanggal: { in: luas.tanggal.map(keDate) } },
    select: { tanggal: true, status: true },
  });
  const konflik = ada
    .filter((a) => a.status !== status)
    .map((a) => ({ nama: karyawan.namaLengkap, tanggal: dariDate(a.tanggal), status: a.status }));

  if (konflik.length > 0 && !input.timpa) {
    throw bentrok(
      `Ada ${konflik.length} tanggal yang sudah punya status lain (misalnya hadir dari mesin finger atau sakit). Timpa dengan ${status.toLowerCase()}, atau ubah rentang tanggalnya?`,
      { konflik: contohBentrok(konflik), jumlah: konflik.length },
      "KONFIRMASI_TIMPA",
    );
  }

  await db.$transaction([
    db.absensi.deleteMany({
      where: { periodeId, karyawanId: input.karyawanId, tanggal: { in: luas.tanggal.map(keDate) } },
    }),
    db.absensi.createMany({
      data: luas.tanggal.map((t) => ({
        perusahaanId: db.$perusahaanId,
        periodeId,
        karyawanId: input.karyawanId,
        tanggal: keDate(t),
        status,
        keterangan: input.keterangan,
        sumber: "MANUAL" as const,
      })),
    }),
  ]);

  const peringatan: string[] = [];
  if (luas.diLuarPeriode > 0) {
    peringatan.push(`${luas.diLuarPeriode} tanggal di luar periode tidak disimpan.`);
  }
  if (luas.dilewatiLibur.length > 0) {
    peringatan.push(`${luas.dilewatiLibur.length} hari libur dalam rentang ini dilewati.`);
  }
  return {
    dicatat: luas.tanggal.length,
    diperbarui: ada.length,
    dilewatiLibur: luas.dilewatiLibur.length,
    diLuarPeriode: luas.diLuarPeriode,
    peringatan,
  };
}

/** Semua catatan selain hadir pada periode ini, untuk halaman libur, izin, sakit, dan cuti. */
export async function daftarCatatan(db: DbPerusahaan, periodeId: string) {
  const periode = await muatPeriode(db, periodeId);
  const [baris, jumlahAktif] = await Promise.all([
    db.absensi.findMany({
      where: { periodeId, status: { not: "HADIR" } },
      select: { karyawanId: true, tanggal: true, status: true, keterangan: true, karyawan: { select: { namaLengkap: true, statusAktif: true } } },
      orderBy: [{ tanggal: "asc" }],
    }),
    db.karyawan.count({ where: { statusAktif: true } }),
  ]);

  const entri = baris
    .map((b) => ({
      karyawanId: b.karyawanId,
      nama: b.karyawan.namaLengkap,
      aktif: b.karyawan.statusAktif,
      tanggal: dariDate(b.tanggal),
      status: b.status,
      keterangan: b.keterangan,
    }))
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal) || a.nama.localeCompare(b.nama, "id"));

  const liburPerTanggal = new Map<TanggalISO, number>();
  for (const e of entri) {
    if (e.status === "LIBUR" && e.aktif) liburPerTanggal.set(e.tanggal, (liburPerTanggal.get(e.tanggal) ?? 0) + 1);
  }
  const liburPerusahaan = [...liburPerTanggal.entries()]
    .filter(([, jumlah]) => jumlahAktif > 0 && jumlah >= jumlahAktif)
    .map(([tanggal]) => tanggal)
    .sort();

  const total = { izin: 0, sakit: 0, cuti: 0, lainnya: 0, libur: 0 };
  for (const e of entri) {
    if (e.status === "IZIN") total.izin++;
    else if (e.status === "SAKIT") total.sakit++;
    else if (e.status === "CUTI") total.cuti++;
    else if (e.status === "LAINNYA") total.lainnya++;
    else if (e.status === "LIBUR") total.libur++;
  }
  return { periode, entri, liburPerusahaan, total };
}
