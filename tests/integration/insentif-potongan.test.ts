import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { pengaturanSchema } from "@/domain/pengaturan";
import { ambilInsentif, simpanInsentif } from "@/server/services/insentif";
import { simpanPendapatanCabang } from "@/server/services/pendapatan";
import { simpanPengaturan } from "@/server/services/pengaturan";
import { ambilPotonganLain, salinDariSebelumnya, simpanPotonganLain } from "@/server/services/potongan-lain";
import { pendapatanCabangSkema, simpanInsentifSkema, simpanPotonganLainSkema } from "@/skema/penghasilan";
import { karyawanUji, periodeUji } from "../support/data";
import { buatPerusahaanUji, hapusPerusahaan } from "../support/db";

type Perusahaan = Awaited<ReturnType<typeof buatPerusahaanUji>>;

let p: Perusahaan;
let lain: Perusahaan;
let periodeId: string;
let periodeLama: string;
let budi: string;
let ani: string;

const insentif = (items: unknown) => simpanInsentifSkema.parse({ items });

beforeAll(async () => {
  p = await buatPerusahaanUji("PT Insentif");
  lain = await buatPerusahaanUji("PT Lain");
  periodeLama = (await periodeUji(p.db, "2025-03-01")).id;
  periodeId = (await periodeUji(p.db, "2025-04-01")).id;
  budi = (await karyawanUji(p.db, "Budi Santoso", { cabang: "Malang" })).id;
  ani = (await karyawanUji(p.db, "Ani Wijaya", { cabang: "Malang" })).id;
});

afterAll(async () => {
  await hapusPerusahaan(p.perusahaanId);
  await hapusPerusahaan(lain.perusahaanId);
});

beforeEach(async () => {
  await p.db.insentif.deleteMany({});
  await p.db.potonganLain.deleteMany({});
  await p.db.pendapatanSales.deleteMany({});
  await p.db.pendapatanCabang.deleteMany({});
});

describe("insentif pengiriman (FR-12)", () => {
  it("dua entri Rp 200.000 dan Rp 150.000 menjadi total insentif Rp 350.000", async () => {
    await simpanInsentif(
      p.db,
      periodeId,
      insentif([{ karyawanId: budi, entri: [{ jenis: "Pengiriman", nominal: 200_000 }, { jenis: "Pengiriman", nominal: 150_000 }] }]),
    );
    const baris = (await ambilInsentif(p.db, periodeId)).karyawan.find((k) => k.karyawanId === budi)!;
    expect(baris.entri).toHaveLength(2);
    expect(baris.totalInsentif).toBe(350_000);
  });

  it("insentif Rp 350.000 ditambah bonus target Rp 500.000 menjadi komponen Rp 850.000", async () => {
    await simpanPengaturan(
      p.db,
      pengaturanSchema.parse({
        hariKerjaMingguan: [1, 2, 3, 4, 5, 6],
        aturanPotongan: { izin: { mode: "tidak" }, sakit: { mode: "tidak" }, cuti: { mode: "tidak" }, lainnya: { mode: "tidak" } },
        tingkatBonus: [{ ambangPermil: 1000, jenis: "tetap", nilai: 500_000 }],
      }),
    );
    try {
      await simpanPendapatanCabang(
        p.db,
        periodeId,
        pendapatanCabangSkema.parse({ cabang: "Malang", totalAktual: 10_000_000, sales: [{ karyawanId: budi, nominal: 10_000_000, target: 10_000_000 }] }),
      );
      await simpanInsentif(p.db, periodeId, insentif([{ karyawanId: budi, entri: [{ jenis: "Pengiriman", nominal: 350_000 }] }]));
      const baris = (await ambilInsentif(p.db, periodeId)).karyawan.find((k) => k.karyawanId === budi)!;
      expect(baris).toMatchObject({ totalInsentif: 350_000, bonusTarget: 500_000, totalKomponen: 850_000 });
    } finally {
      await simpanPengaturan(p.db, pengaturanSchema.parse({ hariKerjaMingguan: [1, 2, 3, 4, 5, 6], aturanPotongan: { izin: { mode: "tidak" }, sakit: { mode: "tidak" }, cuti: { mode: "tidak" }, lainnya: { mode: "tidak" } }, tingkatBonus: [] }));
    }
  });

  it("nominal kosong dianggap 0 dan baris kosong tidak tersimpan", async () => {
    const hasil = await simpanInsentif(
      p.db,
      periodeId,
      insentif([{ karyawanId: budi, entri: [{ jenis: "Pengiriman", nominal: null }, { jenis: "", nominal: 0 }, { jenis: "Lembur", nominal: 75_000 }] }]),
    );
    expect(hasil.disimpan).toBe(1);
    expect(await p.db.insentif.count({ where: { periodeId } })).toBe(1);
  });

  it("jenis yang kosong diisi bawaan Pengiriman", async () => {
    await simpanInsentif(p.db, periodeId, insentif([{ karyawanId: budi, entri: [{ jenis: "  ", nominal: 10_000 }] }]));
    expect((await p.db.insentif.findFirstOrThrow({ where: { periodeId } })).jenis).toBe("Pengiriman");
  });

  it("entri ganda hanya memberi peringatan dan tidak diblokir", async () => {
    const hasil = await simpanInsentif(
      p.db,
      periodeId,
      insentif([{ karyawanId: budi, entri: [{ jenis: "Pengiriman", nominal: 100_000 }, { jenis: "pengiriman", nominal: 100_000 }] }]),
    );
    expect(hasil.peringatan).toHaveLength(1);
    expect(hasil.disimpan).toBe(2);
  });

  it("menyimpan ulang mengganti entri lama milik karyawan itu saja", async () => {
    await simpanInsentif(p.db, periodeId, insentif([
      { karyawanId: budi, entri: [{ jenis: "A", nominal: 1000 }] },
      { karyawanId: ani, entri: [{ jenis: "B", nominal: 2000 }] },
    ]));
    await simpanInsentif(p.db, periodeId, insentif([{ karyawanId: budi, entri: [{ jenis: "C", nominal: 3000 }] }]));
    const daftar = (await ambilInsentif(p.db, periodeId)).karyawan;
    expect(daftar.find((k) => k.karyawanId === budi)?.entri).toEqual([{ jenis: "C", nominal: 3000 }]);
    expect(daftar.find((k) => k.karyawanId === ani)?.entri).toEqual([{ jenis: "B", nominal: 2000 }]);
  });

  it("nominal negatif ditolak oleh skema", () => {
    expect(simpanInsentifSkema.safeParse({ items: [{ karyawanId: budi, entri: [{ jenis: "x", nominal: -1 }] }] }).success).toBe(false);
  });

  it("karyawan perusahaan lain ditolak dan periode final menolak perubahan", async () => {
    const asing = (await karyawanUji(lain.db, "Orang Lain")).id;
    await expect(simpanInsentif(p.db, periodeId, insentif([{ karyawanId: asing, entri: [{ jenis: "x", nominal: 1 }] }]))).rejects.toMatchObject({ status: 404 });
    await expect(simpanInsentif(lain.db, periodeId, insentif([]))).rejects.toMatchObject({ status: 404 });
  });
});

describe("pajak dan asuransi sebagai nominal input (FR-18)", () => {
  it("asuransi Rp 150.000 dan pajak Rp 50.000 tersimpan dan terbaca per karyawan", async () => {
    await simpanPotonganLain(p.db, periodeId, simpanPotonganLainSkema.parse({ items: [{ karyawanId: budi, pajak: 50_000, asuransi: 150_000 }] }));
    const baris = (await ambilPotonganLain(p.db, periodeId)).karyawan.find((k) => k.karyawanId === budi)!;
    expect(baris).toMatchObject({ pajak: 50_000, asuransi: 150_000 });
    expect(baris.pajak + baris.asuransi).toBe(200_000);
  });

  it("nominal 0 atau kosong tidak menyimpan baris", async () => {
    await simpanPotonganLain(p.db, periodeId, simpanPotonganLainSkema.parse({ items: [{ karyawanId: budi, pajak: 0, asuransi: null }] }));
    expect(await p.db.potonganLain.count({ where: { periodeId } })).toBe(0);
  });

  it("nominal negatif ditolak", () => {
    expect(simpanPotonganLainSkema.safeParse({ items: [{ karyawanId: budi, pajak: -1, asuransi: 0 }] }).success).toBe(false);
  });

  it("Salin dari periode sebelumnya mengisi nominal tanpa menyimpan, dan masih dapat diubah", async () => {
    await simpanPotonganLain(p.db, periodeLama, simpanPotonganLainSkema.parse({ items: [{ karyawanId: budi, pajak: 50_000, asuransi: 150_000 }] }));
    const salinan = await salinDariSebelumnya(p.db, periodeId);
    expect(salinan.sumber?.tanggalAwal).toBe("2025-03-01");
    expect(salinan.karyawan.find((k) => k.karyawanId === budi)).toMatchObject({ pajak: 50_000, asuransi: 150_000 });
    expect(await p.db.potonganLain.count({ where: { periodeId } })).toBe(0);

    await simpanPotonganLain(p.db, periodeId, simpanPotonganLainSkema.parse({ items: [{ karyawanId: budi, pajak: 60_000, asuransi: 150_000 }] }));
    expect((await ambilPotonganLain(p.db, periodeId)).karyawan.find((k) => k.karyawanId === budi)?.pajak).toBe(60_000);
  });

  it("tanpa periode sebelumnya mengembalikan pesan informasi (sumber null)", async () => {
    const hasil = await salinDariSebelumnya(p.db, periodeLama);
    expect(hasil.sumber).toBeNull();
    expect(hasil.karyawan).toEqual([]);
  });

  it("karyawan baru tanpa data tampil dengan nominal 0", async () => {
    const baru = (await karyawanUji(p.db, "Karyawan Baru", { cabang: "Malang" })).id;
    const baris = (await ambilPotonganLain(p.db, periodeId)).karyawan.find((k) => k.karyawanId === baru)!;
    expect(baris).toMatchObject({ pajak: 0, asuransi: 0 });
  });

  it("perusahaan lain mendapat 404", async () => {
    await expect(ambilPotonganLain(lain.db, periodeId)).rejects.toMatchObject({ status: 404 });
  });
});
