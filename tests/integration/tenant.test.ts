import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db/client";
import { dariDate, keDate } from "@/server/db/tanggal";
import { MODEL_PER_PERUSAHAAN, dbPerusahaan } from "@/server/db/tenant";
import { buatPerusahaanUji, hapusPerusahaan } from "../support/db";

type Perusahaan = Awaited<ReturnType<typeof buatPerusahaanUji>>;

function dataKaryawan(nama: string, rekening: string, perusahaanId: string) {
  return {
    perusahaanId,
    namaLengkap: nama,
    namaKunci: nama.toLowerCase(),
    jabatan: "Staf",
    cabang: "Surabaya",
    gajiPokok: 4_000_000,
    nomorRekening: rekening,
  };
}

describe("isolasi data antar perusahaan (NFR-09)", () => {
  let a: Perusahaan;
  let b: Perusahaan;
  let idKaryawanA: string;
  let idKaryawanB: string;

  beforeAll(async () => {
    a = await buatPerusahaanUji("Perusahaan A");
    b = await buatPerusahaanUji("Perusahaan B");
    idKaryawanA = (await a.db.karyawan.create({ data: dataKaryawan("Ani A", "1111111111", a.perusahaanId) })).id;
    idKaryawanB = (await b.db.karyawan.create({ data: dataKaryawan("Budi B", "2222222222", b.perusahaanId) })).id;
  });

  afterAll(async () => {
    await hapusPerusahaan(a.perusahaanId);
    await hapusPerusahaan(b.perusahaanId);
  });

  it("daftar hanya memuat data perusahaan sendiri", async () => {
    const daftarA = await a.db.karyawan.findMany();
    expect(daftarA.map((k) => k.id)).toEqual([idKaryawanA]);
    const daftarB = await b.db.karyawan.findMany();
    expect(daftarB.map((k) => k.id)).toEqual([idKaryawanB]);
  });

  it("meminta data perusahaan lain lewat ID menghasilkan tidak ditemukan", async () => {
    expect(await a.db.karyawan.findUnique({ where: { id: idKaryawanB } })).toBeNull();
    expect(await a.db.karyawan.findFirst({ where: { id: idKaryawanB } })).toBeNull();
    await expect(a.db.karyawan.findUniqueOrThrow({ where: { id: idKaryawanB } })).rejects.toThrow();
  });

  it("mengubah atau menghapus data perusahaan lain gagal dan data tetap utuh", async () => {
    await expect(a.db.karyawan.update({ where: { id: idKaryawanB }, data: { jabatan: "Diubah A" } })).rejects.toThrow();
    expect((await a.db.karyawan.updateMany({ where: { id: idKaryawanB }, data: { jabatan: "Diubah A" } })).count).toBe(0);
    await expect(a.db.karyawan.delete({ where: { id: idKaryawanB } })).rejects.toThrow();
    expect((await a.db.karyawan.deleteMany({ where: { id: idKaryawanB } })).count).toBe(0);

    const utuh = await prisma().karyawan.findUnique({ where: { id: idKaryawanB } });
    expect(utuh?.jabatan).toBe("Staf");
  });

  it("perusahaan_id yang dikirim pemanggil pada create dan createMany ditimpa dengan perusahaan dari sesi", async () => {
    const dibuat = await a.db.karyawan.create({ data: dataKaryawan("Citra A", "3333333333", b.perusahaanId) });
    expect(dibuat.perusahaanId).toBe(a.perusahaanId);

    await a.db.karyawan.createMany({
      data: [
        dataKaryawan("Dedi A", "4444444444", b.perusahaanId),
        dataKaryawan("Eka A", "5555555555", b.perusahaanId),
      ],
    });
    expect(await prisma().karyawan.count({ where: { perusahaanId: b.perusahaanId } })).toBe(1);
    expect(await a.db.karyawan.count()).toBe(4);
  });

  it("update tidak dapat memindahkan data ke perusahaan lain", async () => {
    await a.db.karyawan.update({ where: { id: idKaryawanA }, data: { perusahaanId: b.perusahaanId, jabatan: "Supervisor" } });
    const hasil = await prisma().karyawan.findUnique({ where: { id: idKaryawanA } });
    expect(hasil?.perusahaanId).toBe(a.perusahaanId);
    expect(hasil?.jabatan).toBe("Supervisor");
  });

  it("upsert dengan ID milik perusahaan lain tidak menyentuhnya dan hanya membuat data di perusahaan sendiri", async () => {
    const hasil = await a.db.karyawan.upsert({
      where: { id: idKaryawanB },
      update: { jabatan: "Diubah A" },
      create: dataKaryawan("Pengganti", "9999999999", b.perusahaanId),
    });
    expect(hasil.perusahaanId).toBe(a.perusahaanId);
    expect(hasil.id).not.toBe(idKaryawanB);
    const milikB = await prisma().karyawan.findUniqueOrThrow({ where: { id: idKaryawanB } });
    expect(milikB.jabatan).toBe("Staf");
    expect(milikB.perusahaanId).toBe(b.perusahaanId);
  });

  it("count, aggregate, dan groupBy hanya menghitung data sendiri", async () => {
    expect(await b.db.karyawan.count()).toBe(1);
    const agregat = await b.db.karyawan.aggregate({ _sum: { gajiPokok: true } });
    expect(agregat._sum.gajiPokok).toBe(4_000_000);
    const kelompok = await b.db.karyawan.groupBy({ by: ["cabang"], _count: { _all: true } });
    expect(kelompok).toEqual([{ cabang: "Surabaya", _count: { _all: 1 } }]);
  });

  it("filter tetap berlaku di dalam transaksi", async () => {
    const hasil = await b.db.$transaction(async (tx) => {
      const daftar = await tx.karyawan.findMany();
      const lain = await tx.karyawan.findUnique({ where: { id: idKaryawanA } });
      return { jumlah: daftar.length, lain };
    });
    expect(hasil.jumlah).toBe(1);
    expect(hasil.lain).toBeNull();
  });

  it("pengaturan perusahaan dibaca per perusahaan", async () => {
    const pengaturan = await a.db.pengaturanPerusahaan.findFirst();
    expect(pengaturan?.perusahaanId).toBe(a.perusahaanId);
    expect(pengaturan?.hariKerjaMingguan).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("tanggal DATE ditulis dan dibaca tanpa pergeseran hari", async () => {
    const periode = await a.db.periode.create({
      data: { perusahaanId: a.perusahaanId, tanggalAwal: keDate("2024-02-01"), tanggalAkhir: keDate("2024-02-29") },
    });
    const dibaca = await a.db.periode.findUniqueOrThrow({ where: { id: periode.id } });
    expect(dariDate(dibaca.tanggalAwal)).toBe("2024-02-01");
    expect(dariDate(dibaca.tanggalAkhir)).toBe("2024-02-29");
  });

  it("basis data menolak periode yang tumpang tindih pada perusahaan yang sama, tetapi mengizinkan perusahaan lain", async () => {
    const rentang = (perusahaanId: string, awal: string, akhir: string) => ({
      perusahaanId,
      tanggalAwal: keDate(awal),
      tanggalAkhir: keDate(akhir),
    });
    await a.db.periode.create({ data: rentang(a.perusahaanId, "2025-03-01", "2025-03-31") });
    await expect(a.db.periode.create({ data: rentang(a.perusahaanId, "2025-03-15", "2025-04-14") })).rejects.toThrow();
    await expect(b.db.periode.create({ data: rentang(b.perusahaanId, "2025-03-15", "2025-04-14") })).resolves.toBeDefined();
  });

  it("dua klien untuk perusahaan berbeda tidak berbagi filter", async () => {
    const klienA = dbPerusahaan(a.perusahaanId);
    const klienB = dbPerusahaan(b.perusahaanId);
    const [daftarA, daftarB] = await Promise.all([klienA.karyawan.findMany(), klienB.karyawan.findMany()]);
    expect(daftarA.every((k) => k.perusahaanId === a.perusahaanId)).toBe(true);
    expect(daftarB.every((k) => k.perusahaanId === b.perusahaanId)).toBe(true);
  });

  it("menolak klien tanpa perusahaan", () => {
    expect(() => dbPerusahaan("")).toThrow();
  });
});

describe("daftar model per perusahaan", () => {
  it("sama persis dengan model di skema Prisma yang memiliki kolom perusahaanId (kecuali Akun)", () => {
    const skema = readFileSync("prisma/schema.prisma", "utf8");
    const bentukModel = /^model (\w+) \{([\s\S]*?)^\}/gm;
    const diSkema = new Set<string>();
    for (const cocok of skema.matchAll(bentukModel)) {
      const [, nama, isi] = cocok;
      if (/^\s+perusahaanId\s/m.test(isi)) diSkema.add(nama);
    }
    diSkema.delete("Akun");
    expect([...diSkema].sort()).toEqual([...MODEL_PER_PERUSAHAAN].sort());
  });
});
