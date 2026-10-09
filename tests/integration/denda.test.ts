import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buatDenda, cicilanUntukPeriode, daftarDenda, hapusDenda } from "@/server/services/denda";
import { dendaSkema } from "@/skema/penghasilan";
import { karyawanUji, periodeUji } from "../support/data";
import { buatPerusahaanUji, hapusPerusahaan } from "../support/db";

type Perusahaan = Awaited<ReturnType<typeof buatPerusahaanUji>>;

let p: Perusahaan;
let lain: Perusahaan;
let maret: string;
let april: string;
let mei: string;
let budi: string;

const denda = (ubah: Record<string, unknown> = {}) =>
  dendaSkema.parse({ karyawanId: budi, alasan: "Kerusakan barang", total: 100_000, jumlahCicilan: 1, mulai: "periode_ini", ...ubah });

beforeAll(async () => {
  p = await buatPerusahaanUji("PT Denda");
  lain = await buatPerusahaanUji("PT Lain");
  maret = (await periodeUji(p.db, "2025-03-01")).id;
  april = (await periodeUji(p.db, "2025-04-01")).id;
  mei = (await periodeUji(p.db, "2025-05-01")).id;
  budi = (await karyawanUji(p.db, "Budi Santoso")).id;
});

afterAll(async () => {
  await hapusPerusahaan(p.perusahaanId);
  await hapusPerusahaan(lain.perusahaanId);
});

beforeEach(async () => {
  await p.db.potonganDenda.deleteMany({});
  await p.db.denda.deleteMany({});
});

async function periode(id: string) {
  return (await daftarDenda(p.db, id)).periode;
}

describe("pencatatan denda (FR-13)", () => {
  it("denda Rp 100.000 satu kali pada Maret hanya muncul sebagai potongan di Maret", async () => {
    await buatDenda(p.db, maret, denda());
    expect(await cicilanUntukPeriode(p.db, await periode(maret))).toMatchObject([{ karyawanId: budi, nominal: 100_000, cicilanKe: 1, dariCicilan: 1 }]);
    // April dan seterusnya tetap memuatnya sampai difinalkan, tetapi periode sebelum tanggal mulai tidak.
    expect(await cicilanUntukPeriode(p.db, { tanggalAwal: "2025-02-01" })).toEqual([]);
  });

  it("denda tanpa alasan ditolak", () => {
    expect(dendaSkema.safeParse({ karyawanId: budi, alasan: "   ", total: 100_000, jumlahCicilan: 1, mulai: "periode_ini" }).success).toBe(false);
    expect(dendaSkema.safeParse({ karyawanId: budi, total: 100_000, jumlahCicilan: 1, mulai: "periode_ini" }).success).toBe(false);
  });

  it("total 0 atau negatif ditolak", () => {
    for (const total of [0, -5, 1.5]) {
      expect(dendaSkema.safeParse({ karyawanId: budi, alasan: "x", total, jumlahCicilan: 1, mulai: "periode_ini" }).success).toBe(false);
    }
  });

  it("jumlah cicilan di luar batas atau melebihi total ditolak", () => {
    expect(dendaSkema.safeParse({ karyawanId: budi, alasan: "x", total: 100_000, jumlahCicilan: 0, mulai: "periode_ini" }).success).toBe(false);
    expect(dendaSkema.safeParse({ karyawanId: budi, alasan: "x", total: 100_000, jumlahCicilan: 121, mulai: "periode_ini" }).success).toBe(false);
    expect(dendaSkema.safeParse({ karyawanId: budi, alasan: "x", total: 5, jumlahCicilan: 10, mulai: "periode_ini" }).success).toBe(false);
  });

  it("karyawan perusahaan lain atau yang nonaktif ditolak", async () => {
    const asing = (await karyawanUji(lain.db, "Orang Lain")).id;
    await expect(buatDenda(p.db, maret, denda({ karyawanId: asing }))).rejects.toMatchObject({ status: 404 });
    const nonaktif = (await karyawanUji(p.db, "Cici Lama", { statusAktif: false })).id;
    await expect(buatDenda(p.db, maret, denda({ karyawanId: nonaktif }))).rejects.toMatchObject({ status: 422 });
  });

  it("perusahaan lain tidak dapat membaca atau menambah denda di periode ini (404)", async () => {
    await expect(daftarDenda(lain.db, maret)).rejects.toMatchObject({ status: 404 });
    await expect(buatDenda(lain.db, maret, denda())).rejects.toMatchObject({ status: 404 });
  });

  it("denda yang dihapus sebelum dipotong tidak muncul lagi", async () => {
    const dibuat = await buatDenda(p.db, maret, denda());
    await hapusDenda(p.db, dibuat.id);
    expect(await cicilanUntukPeriode(p.db, await periode(maret))).toEqual([]);
    await expect(hapusDenda(p.db, dibuat.id)).rejects.toMatchObject({ status: 404 });
  });

  it("denda yang sudah mulai dipotong tidak dapat dihapus", async () => {
    const dibuat = await buatDenda(p.db, maret, denda());
    await p.db.potonganDenda.create({ data: { perusahaanId: p.perusahaanId, dendaId: dibuat.id, periodeId: maret, nominal: 100_000 } });
    await expect(hapusDenda(p.db, dibuat.id)).rejects.toMatchObject({ kode: "DENDA_SUDAH_DIPOTONG" });
  });

  it("denda lintas perusahaan tidak dapat dihapus (404)", async () => {
    const dibuat = await buatDenda(p.db, maret, denda());
    await expect(hapusDenda(lain.db, dibuat.id)).rejects.toMatchObject({ status: 404 });
  });
});

describe("denda cicilan (FR-14)", () => {
  it("Rp 1.000.000 dalam 3 cicilan menghasilkan jadwal 333.333, 333.333, 333.334", async () => {
    const dibuat = await buatDenda(p.db, maret, denda({ total: 1_000_000, jumlahCicilan: 3 }));
    expect(dibuat.jadwal).toEqual([333_333, 333_333, 333_334]);
    expect(dibuat).toMatchObject({ sisa: 1_000_000, terbayar: 0, status: "berjalan", tanggalMulai: "2025-03-01" });
  });

  it("cicilan ke-n dihitung dari jumlah potongan yang sudah difinalkan, bukan dari jumlah penghitungan draf", async () => {
    const dibuat = await buatDenda(p.db, maret, denda({ total: 1_000_000, jumlahCicilan: 3 }));
    for (let i = 0; i < 4; i++) {
      expect(await cicilanUntukPeriode(p.db, await periode(maret))).toMatchObject([{ nominal: 333_333, cicilanKe: 1 }]);
    }
    expect((await daftarDenda(p.db, maret)).denda[0].sisa).toBe(1_000_000);

    // Setelah satu cicilan difinalkan, cicilan berikutnya yang muncul.
    await p.db.potonganDenda.create({ data: { perusahaanId: p.perusahaanId, dendaId: dibuat.id, periodeId: maret, nominal: 333_333 } });
    await p.db.denda.update({ where: { id: dibuat.id }, data: { sisa: 666_667 } });
    expect(await cicilanUntukPeriode(p.db, await periode(april))).toMatchObject([{ nominal: 333_333, cicilanKe: 2 }]);

    await p.db.potonganDenda.create({ data: { perusahaanId: p.perusahaanId, dendaId: dibuat.id, periodeId: april, nominal: 333_333 } });
    await p.db.denda.update({ where: { id: dibuat.id }, data: { sisa: 333_334 } });
    expect(await cicilanUntukPeriode(p.db, await periode(mei))).toMatchObject([{ nominal: 333_334, cicilanKe: 3 }]);
  });

  it("denda lunas tidak lagi dipotong", async () => {
    const dibuat = await buatDenda(p.db, maret, denda({ total: 200_000, jumlahCicilan: 2 }));
    await p.db.denda.update({ where: { id: dibuat.id }, data: { sisa: 0 } });
    expect(await cicilanUntukPeriode(p.db, await periode(mei))).toEqual([]);
    expect((await daftarDenda(p.db, mei)).denda[0].status).toBe("lunas");
  });

  it("denda berawal periode berikutnya tidak memotong periode ini tetapi memotong periode sesudahnya", async () => {
    await buatDenda(p.db, maret, denda({ mulai: "periode_berikutnya" }));
    expect(await cicilanUntukPeriode(p.db, await periode(maret))).toEqual([]);
    expect(await cicilanUntukPeriode(p.db, await periode(april))).toHaveLength(1);
  });

  it("denda yang dibuat setelah periode final hanya dapat berlaku mulai periode berikutnya", async () => {
    await p.db.periode.update({ where: { id: maret }, data: { status: "FINAL" } });
    try {
      await expect(buatDenda(p.db, maret, denda({ mulai: "periode_ini" }))).rejects.toMatchObject({ kode: "PERIODE_FINAL" });
      const dibuat = await buatDenda(p.db, maret, denda({ mulai: "periode_berikutnya" }));
      expect(dibuat.tanggalMulai).toBe("2025-04-01");
    } finally {
      await p.db.periode.update({ where: { id: maret }, data: { status: "DRAF" } });
    }
  });

  it("karyawan nonaktif tidak ikut dipotong sampai diaktifkan kembali", async () => {
    await buatDenda(p.db, maret, denda());
    await p.db.karyawan.update({ where: { id: budi }, data: { statusAktif: false } });
    try {
      expect(await cicilanUntukPeriode(p.db, await periode(maret))).toEqual([]);
    } finally {
      await p.db.karyawan.update({ where: { id: budi }, data: { statusAktif: true } });
    }
  });
});
