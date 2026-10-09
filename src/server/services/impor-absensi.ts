import "server-only";
import { kunciNama } from "@/domain/nama";
import type { TanggalISO } from "@/domain/tanggal";
import type { KonfigurasiImpor } from "@/skema/absensi";
import { dariDate, keDate } from "@/server/db/tanggal";
import type { DbPerusahaan } from "@/server/db/tenant";
import { tidakValid } from "@/server/errors";
import {
  type BacaanBerkas,
  type BarisAbsensi,
  bacaInfoBerkas,
  muatWorkbook,
  uraiBaris,
} from "@/server/excel/baca-absensi";
import { periksaIsiXlsx, periksaNamaDanUkuran } from "@/server/excel/berkas";
import { type PeriodeDto, muatPeriodeDraf } from "./periode";

export interface NamaTakDikenal {
  nama: string;
  kunci: string;
  jumlahBaris: number;
  /** Lebih dari satu karyawan memakai nama ini, jadi harus dipilih manual. */
  ambigu: boolean;
}

export interface RingkasanImpor {
  totalBaris: number;
  barisTerbaca: number;
  tanpaScan: number;
  diLuarPeriode: number;
  duplikat: number;
  karyawanCocok: number;
  namaTakDikenal: NamaTakDikenal[];
  tidakValid: { sheet: string; baris: number; alasan: string; pesan: string }[];
  jumlahTidakValid: number;
  /** Jumlah catatan hadir yang akan ditulis. */
  akanDiimpor: number;
  bentrokManual: number;
  contohBentrokManual: { nama: string; tanggal: TanggalISO }[];
  kandidatKaryawan: { id: string; nama: string; cabang: string }[];
}

export interface HasilImpor {
  dibuat: number;
  diganti: number;
  dilewatiKarenaManual: number;
  ditimpaManual: number;
  alias: number;
}

const MAKS_TIDAK_VALID_DITAMPILKAN = 200;

/** Tahap 1: membaca isi file dan menebak pemetaan kolom, tanpa menyentuh data periode. */
export async function bacaBerkas(nama: string, isi: Buffer): Promise<BacaanBerkas> {
  periksaNamaDanUkuran(nama, isi.length);
  periksaIsiXlsx(isi);
  const wb = await muatWorkbook(isi);
  return bacaInfoBerkas(wb);
}

interface DataCocok {
  periode: PeriodeDto;
  ringkasan: Omit<RingkasanImpor, "bentrokManual" | "contohBentrokManual">;
  catatan: { karyawanId: string; nama: string; baris: BarisAbsensi }[];
  idKaryawanTerkait: string[];
  aliasBaru: { kunci: string; karyawanId: string }[];
}

async function cocokkan(db: DbPerusahaan, periodeId: string, isi: Buffer, nama: string, konfig: KonfigurasiImpor): Promise<DataCocok> {
  periksaNamaDanUkuran(nama, isi.length);
  periksaIsiXlsx(isi);
  const periode = await muatPeriodeDraf(db, periodeId);
  const wb = await muatWorkbook(isi);
  const urai = uraiBaris(wb, konfig.sheet, konfig.pemetaan, periode);

  const [aktif, alias] = await Promise.all([
    db.karyawan.findMany({
      where: { statusAktif: true },
      select: { id: true, namaLengkap: true, namaKunci: true, cabang: true },
      orderBy: [{ cabang: "asc" }, { namaLengkap: "asc" }],
    }),
    db.karyawanAlias.findMany({ select: { aliasKunci: true, karyawanId: true } }),
  ]);
  const idAktif = new Set(aktif.map((k) => k.id));

  const kandidat = new Map<string, string[]>();
  const tambah = (kunci: string, id: string) => {
    const daftar = kandidat.get(kunci) ?? [];
    if (!daftar.includes(id)) daftar.push(id);
    kandidat.set(kunci, daftar);
  };
  for (const k of aktif) tambah(k.namaKunci, k.id);
  // Alias hanya dipakai bila nama persisnya belum cocok dengan siapa pun, supaya nama asli selalu menang.
  for (const a of alias) if (idAktif.has(a.karyawanId) && !kandidat.has(a.aliasKunci)) tambah(a.aliasKunci, a.karyawanId);

  const aliasBaru: DataCocok["aliasBaru"] = [];
  for (const [kunci, tujuan] of Object.entries(konfig.petaNama)) {
    if (tujuan === "abaikan") continue;
    if (!idAktif.has(tujuan)) {
      throw tidakValid("Karyawan yang dipilih untuk pemetaan nama tidak ditemukan atau sudah nonaktif. Pilih ulang dari daftar.", {
        petaNama: "Karyawan tidak valid.",
      });
    }
    aliasBaru.push({ kunci, karyawanId: tujuan });
  }

  const takDikenal = new Map<string, NamaTakDikenal>();
  const catatan: DataCocok["catatan"] = [];
  const cocok = new Set<string>();

  for (const baris of urai.baris) {
    const manual = konfig.petaNama[baris.kunci];
    if (manual === "abaikan") continue;
    const calon = manual ? [manual] : (kandidat.get(baris.kunci) ?? []);
    if (calon.length === 1) {
      cocok.add(calon[0]);
      if (baris.adaScan) catatan.push({ karyawanId: calon[0], nama: baris.nama, baris });
      continue;
    }
    const lama = takDikenal.get(baris.kunci);
    if (lama) lama.jumlahBaris++;
    else takDikenal.set(baris.kunci, { nama: baris.nama, kunci: baris.kunci, jumlahBaris: 1, ambigu: calon.length > 1 });
  }

  const tidakValidTampil = urai.tidakValid.slice(0, MAKS_TIDAK_VALID_DITAMPILKAN).map((b) => ({
    ...b,
    pesan: `Baris ${b.baris}: ${b.alasan}`,
  }));

  return {
    periode,
    catatan,
    idKaryawanTerkait: [...cocok],
    aliasBaru,
    ringkasan: {
      totalBaris: urai.totalBaris,
      barisTerbaca: urai.baris.length,
      tanpaScan: urai.tanpaScan,
      diLuarPeriode: urai.diLuarPeriode,
      duplikat: urai.duplikat,
      karyawanCocok: cocok.size,
      namaTakDikenal: [...takDikenal.values()].sort((a, b) => b.jumlahBaris - a.jumlahBaris),
      tidakValid: tidakValidTampil,
      jumlahTidakValid: urai.tidakValid.length,
      akanDiimpor: catatan.length,
      kandidatKaryawan: aktif.map((k) => ({ id: k.id, nama: k.namaLengkap, cabang: k.cabang })),
    },
  };
}

async function cariBentrokManual(db: DbPerusahaan, periodeId: string, data: DataCocok) {
  if (data.idKaryawanTerkait.length === 0) return [];
  const manual = await db.absensi.findMany({
    where: { periodeId, sumber: "MANUAL", karyawanId: { in: data.idKaryawanTerkait } },
    select: { karyawanId: true, tanggal: true },
  });
  const manualSet = new Set(manual.map((m) => `${m.karyawanId}|${dariDate(m.tanggal)}`));
  return data.catatan.filter((c) => manualSet.has(`${c.karyawanId}|${c.baris.tanggal}`));
}

/** Tahap 2: ringkasan hasil baca dan benturan dengan isian manual, tanpa menulis apa pun. */
export async function analisisImpor(
  db: DbPerusahaan,
  periodeId: string,
  nama: string,
  isi: Buffer,
  konfig: KonfigurasiImpor,
): Promise<RingkasanImpor> {
  const data = await cocokkan(db, periodeId, isi, nama, konfig);
  const bentrokManual = await cariBentrokManual(db, periodeId, data);
  return {
    ...data.ringkasan,
    bentrokManual: bentrokManual.length,
    contohBentrokManual: bentrokManual.slice(0, 20).map((b) => ({ nama: b.nama, tanggal: b.baris.tanggal })),
  };
}

/**
 * Tahap 3: menulis hasil impor secara atomik. Unggah ulang menggantikan data mesin finger sebelumnya milik
 * karyawan yang ada di file; isian manual HRD hanya ditimpa bila `timpaManual` dikonfirmasi.
 */
export async function jalankanImpor(
  db: DbPerusahaan,
  periodeId: string,
  nama: string,
  isi: Buffer,
  konfig: KonfigurasiImpor,
): Promise<HasilImpor> {
  const data = await cocokkan(db, periodeId, isi, nama, konfig);
  const bentrokManual = await cariBentrokManual(db, periodeId, data);
  const kunciBentrok = new Set(bentrokManual.map((b) => `${b.karyawanId}|${b.baris.tanggal}`));

  const ditulis = konfig.timpaManual ? data.catatan : data.catatan.filter((c) => !kunciBentrok.has(`${c.karyawanId}|${c.baris.tanggal}`));
  const dilewati = data.catatan.length - ditulis.length;

  const upsertAlias = (a: { kunci: string; karyawanId: string }) =>
    db.karyawanAlias.upsert({
      where: { perusahaanId_aliasKunci: { perusahaanId: db.$perusahaanId, aliasKunci: kunciNama(a.kunci) } },
      create: { perusahaanId: db.$perusahaanId, karyawanId: a.karyawanId, aliasKunci: kunciNama(a.kunci) },
      update: { karyawanId: a.karyawanId },
    });

  if (data.idKaryawanTerkait.length === 0) {
    if (data.aliasBaru.length > 0) await db.$transaction(data.aliasBaru.map(upsertAlias));
    return { dibuat: 0, diganti: 0, dilewatiKarenaManual: 0, ditimpaManual: 0, alias: data.aliasBaru.length };
  }

  const sebelumnya = await db.absensi.count({
    where: { periodeId, sumber: "MESIN", karyawanId: { in: data.idKaryawanTerkait } },
  });

  const operasi = [db.absensi.deleteMany({ where: { periodeId, sumber: "MESIN", karyawanId: { in: data.idKaryawanTerkait } } })];

  if (konfig.timpaManual && bentrokManual.length > 0) {
    const perKaryawan = new Map<string, TanggalISO[]>();
    for (const b of bentrokManual) perKaryawan.set(b.karyawanId, [...(perKaryawan.get(b.karyawanId) ?? []), b.baris.tanggal]);
    for (const [karyawanId, tanggal] of perKaryawan) {
      operasi.push(db.absensi.deleteMany({ where: { periodeId, sumber: "MANUAL", karyawanId, tanggal: { in: tanggal.map(keDate) } } }));
    }
  }

  const tulis =
    ditulis.length > 0
      ? [
          db.absensi.createMany({
            data: ditulis.map((c) => ({
              perusahaanId: db.$perusahaanId,
              periodeId,
              karyawanId: c.karyawanId,
              tanggal: keDate(c.baris.tanggal),
              jamMasuk: c.baris.jamMasuk,
              jamPulang: c.baris.jamPulang,
              status: "HADIR" as const,
              sumber: "MESIN" as const,
            })),
          }),
        ]
      : [];

  await db.$transaction([...operasi, ...tulis, ...data.aliasBaru.map(upsertAlias)]);
  return {
    dibuat: ditulis.length,
    diganti: sebelumnya,
    dilewatiKarenaManual: konfig.timpaManual ? 0 : dilewati,
    ditimpaManual: konfig.timpaManual ? bentrokManual.length : 0,
    alias: data.aliasBaru.length,
  };
}
