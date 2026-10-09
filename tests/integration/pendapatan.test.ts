import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { pengaturanSchema } from "@/domain/pengaturan";
import { formatPersenPermil } from "@/domain/uang";
import { ambilPendapatan, muatSalesUntukGaji, selisihBelumDiakui, simpanPendapatanCabang } from "@/server/services/pendapatan";
import { simpanPengaturan } from "@/server/services/pengaturan";
import { pendapatanCabangSkema } from "@/skema/penghasilan";
import { karyawanUji, periodeUji } from "../support/data";
import { buatPerusahaanUji, hapusPerusahaan } from "../support/db";

type Perusahaan = Awaited<ReturnType<typeof buatPerusahaanUji>>;

let p: Perusahaan;
let lain: Perusahaan;
let periodeId: string;
let agus: string;
let dewi: string;
let rina: string;

const masukan = (ubah: Record<string, unknown> = {}) =>
  pendapatanCabangSkema.parse({
    cabang: "Malang",
    totalAktual: 10_000_000,
    akuiSelisih: false,
    sales: [
      { karyawanId: agus, nominal: 6_000_000, target: 5_000_000 },
      { karyawanId: dewi, nominal: 3_850_000, target: 5_000_000 },
    ],
    ...ubah,
  });

beforeAll(async () => {
  p = await buatPerusahaanUji("PT Pendapatan");
  lain = await buatPerusahaanUji("PT Lain");
  periodeId = (await periodeUji(p.db, "2025-04-01")).id;
  agus = (await karyawanUji(p.db, "Agus Wijaya", { cabang: "Malang" })).id;
  dewi = (await karyawanUji(p.db, "Dewi Lestari", { cabang: "Malang" })).id;
  rina = (await karyawanUji(p.db, "Rina Kartika", { cabang: "Surabaya" })).id;
});

afterAll(async () => {
  await hapusPerusahaan(p.perusahaanId);
  await hapusPerusahaan(lain.perusahaanId);
});

beforeEach(async () => {
  await p.db.pendapatanSales.deleteMany({});
  await p.db.pendapatanCabang.deleteMany({});
});

describe("pendapatan cabang dan breakdown sales (FR-10)", () => {
  it('total Rp 10.000.000 dengan breakdown Rp 9.850.000 menampilkan peringatan "Selisih Rp 150.000"', async () => {
    const hasil = await simpanPendapatanCabang(p.db, periodeId, masukan());
    expect(hasil.peringatan).toBe("Selisih Rp 150.000 (kurang dari total cabang)");
    expect(hasil.cabang).toMatchObject({ totalAktual: 10_000_000, selisih: 150_000, selisihDiakui: false, adaBreakdown: true });
  });

  it("breakdown yang pas tidak memberi peringatan", async () => {
    const hasil = await simpanPendapatanCabang(
      p.db,
      periodeId,
      masukan({ sales: [{ karyawanId: agus, nominal: 6_000_000, target: 0 }, { karyawanId: dewi, nominal: 4_000_000, target: 0 }] }),
    );
    expect(hasil.peringatan).toBeNull();
    expect(hasil.cabang.selisih).toBe(0);
  });

  it("breakdown melebihi total diberi peringatan dengan arah yang benar", async () => {
    const hasil = await simpanPendapatanCabang(p.db, periodeId, masukan({ totalAktual: 9_000_000 }));
    expect(hasil.peringatan).toBe("Selisih Rp 850.000 (melebihi total cabang)");
  });

  it("selisih dapat diakui, dan pengakuan hilang bila angka diubah tanpa mengakui lagi", async () => {
    await simpanPendapatanCabang(p.db, periodeId, masukan({ akuiSelisih: true }));
    expect((await selisihBelumDiakui(p.db, periodeId))).toEqual([]);
    expect((await ambilPendapatan(p.db, periodeId)).cabang.find((c) => c.cabang === "Malang")?.selisihDiakui).toBe(true);

    await simpanPendapatanCabang(p.db, periodeId, masukan({ totalAktual: 11_000_000 }));
    expect(await selisihBelumDiakui(p.db, periodeId)).toEqual([{ cabang: "Malang", selisih: 1_150_000 }]);
  });

  it("pengakuan tidak berlaku bila tidak ada selisih", async () => {
    await simpanPendapatanCabang(
      p.db,
      periodeId,
      masukan({ akuiSelisih: true, sales: [{ karyawanId: agus, nominal: 10_000_000, target: 0 }] }),
    );
    expect((await ambilPendapatan(p.db, periodeId)).cabang.find((c) => c.cabang === "Malang")?.selisihDiakui).toBe(false);
    expect(await selisihBelumDiakui(p.db, periodeId)).toEqual([]);
  });

  it("nominal negatif ditolak", () => {
    expect(pendapatanCabangSkema.safeParse({ cabang: "Malang", totalAktual: -1, sales: [] }).success).toBe(false);
    expect(
      pendapatanCabangSkema.safeParse({ cabang: "Malang", totalAktual: 1, sales: [{ karyawanId: agus ?? "", nominal: -5, target: 0 }] }).success,
    ).toBe(false);
  });

  it("cabang tanpa sales menyimpan total dan melaporkan belum ada breakdown", async () => {
    const hasil = await simpanPendapatanCabang(p.db, periodeId, masukan({ sales: [] }));
    expect(hasil.cabang).toMatchObject({ totalAktual: 10_000_000, adaBreakdown: false, sales: [] });
    expect(hasil.peringatan).toBeNull();
    expect(await selisihBelumDiakui(p.db, periodeId)).toEqual([]);
  });

  it("hanya karyawan aktif dari cabang yang sama yang dapat menjadi sales", async () => {
    await expect(simpanPendapatanCabang(p.db, periodeId, masukan({ sales: [{ karyawanId: rina, nominal: 1, target: 0 }] }))).rejects.toMatchObject({
      status: 422,
    });
    const nonaktif = (await karyawanUji(p.db, "Nonaktif Malang", { cabang: "Malang", statusAktif: false })).id;
    await expect(simpanPendapatanCabang(p.db, periodeId, masukan({ sales: [{ karyawanId: nonaktif, nominal: 1, target: 0 }] }))).rejects.toMatchObject({
      status: 422,
    });
  });

  it("karyawan yang sama dua kali ditolak oleh skema", () => {
    expect(
      pendapatanCabangSkema.safeParse({
        cabang: "Malang",
        totalAktual: 1,
        sales: [{ karyawanId: "11111111-1111-4111-8111-111111111111", nominal: 1, target: 0 }, { karyawanId: "11111111-1111-4111-8111-111111111111", nominal: 2, target: 0 }],
      }).success,
    ).toBe(false);
  });

  it("menyimpan ulang mengganti breakdown lama tanpa menyisakan baris", async () => {
    await simpanPendapatanCabang(p.db, periodeId, masukan());
    await simpanPendapatanCabang(p.db, periodeId, masukan({ sales: [{ karyawanId: agus, nominal: 10_000_000, target: 0 }] }));
    expect(await p.db.pendapatanSales.count({ where: { periodeId } })).toBe(1);
  });

  it("sales yang pindah cabang pada periode yang sama tidak menimbulkan duplikat", async () => {
    await simpanPendapatanCabang(p.db, periodeId, masukan({ sales: [{ karyawanId: agus, nominal: 1_000_000, target: 0 }] }));
    await p.db.karyawan.update({ where: { id: agus }, data: { cabang: "Surabaya" } });
    try {
      await simpanPendapatanCabang(p.db, periodeId, masukan({ cabang: "Surabaya", totalAktual: 1_000_000, sales: [{ karyawanId: agus, nominal: 1_000_000, target: 0 }] }));
      const baris = await p.db.pendapatanSales.findMany({ where: { periodeId, karyawanId: agus } });
      expect(baris).toHaveLength(1);
      expect(baris[0].cabang).toBe("Surabaya");
    } finally {
      await p.db.karyawan.update({ where: { id: agus }, data: { cabang: "Malang" } });
    }
  });

  it("nominal di atas 2 miliar tersimpan dan terbaca tepat (kolom BIGINT)", async () => {
    const hasil = await simpanPendapatanCabang(
      p.db,
      periodeId,
      masukan({ totalAktual: 500_000_000_007, sales: [{ karyawanId: agus, nominal: 500_000_000_007, target: 400_000_000_000 }] }),
    );
    expect(hasil.cabang.totalAktual).toBe(500_000_000_007);
    expect(hasil.cabang.sales[0]).toMatchObject({ nominal: 500_000_000_007, target: 400_000_000_000, persenCapaianPermil: 1250 });
  });

  it("perusahaan lain tidak dapat membaca atau menulis pendapatan periode ini (404)", async () => {
    await expect(ambilPendapatan(lain.db, periodeId)).rejects.toMatchObject({ status: 404 });
    await expect(simpanPendapatanCabang(lain.db, periodeId, masukan())).rejects.toMatchObject({ status: 404 });
  });

  it("periode final menolak perubahan", async () => {
    await p.db.periode.update({ where: { id: periodeId }, data: { status: "FINAL" } });
    try {
      await expect(simpanPendapatanCabang(p.db, periodeId, masukan())).rejects.toMatchObject({ kode: "PERIODE_FINAL" });
    } finally {
      await p.db.periode.update({ where: { id: periodeId }, data: { status: "DRAF" } });
    }
  });
});

describe("target dan bonus per sales (FR-11)", () => {
  it("persen capaian akurat sampai satu desimal dan target nol menjadi tidak ada target", async () => {
    const hasil = await simpanPendapatanCabang(
      p.db,
      periodeId,
      masukan({
        totalAktual: 11_833_333,
        sales: [
          { karyawanId: agus, nominal: 8_500_000, target: 10_000_000 },
          { karyawanId: dewi, nominal: 3_333_333, target: 10_000_000 },
        ],
      }),
    );
    const milikAgus = hasil.cabang.sales.find((s) => s.karyawanId === agus)!;
    const milikDewi = hasil.cabang.sales.find((s) => s.karyawanId === dewi)!;
    expect(formatPersenPermil(milikAgus.persenCapaianPermil!)).toBe("85,0%");
    expect(formatPersenPermil(milikDewi.persenCapaianPermil!)).toBe("33,3%");

    const tanpa = await simpanPendapatanCabang(p.db, periodeId, masukan({ sales: [{ karyawanId: agus, nominal: 5_000_000, target: 0 }] }));
    expect(tanpa.cabang.sales[0].persenCapaianPermil).toBeNull();
  });

  it('aturan ">=100% bonus Rp 500.000" memberi bonus tepat saat capaian 100,0%, dan 99,96% tidak', async () => {
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
        masukan({
          totalAktual: 19_996_000,
          akuiSelisih: true,
          sales: [
            { karyawanId: agus, nominal: 10_000_000, target: 10_000_000 },
            { karyawanId: dewi, nominal: 9_996_000, target: 10_000_000 },
          ],
        }),
      );
      const sales = await muatSalesUntukGaji(p.db, periodeId, (await p.db.pengaturanPerusahaan.findFirstOrThrow()).tingkatBonus as never);
      expect(sales.get(agus)?.bonus).toBe(500_000);
      expect(sales.get(dewi)?.bonus).toBe(0);
    } finally {
      await simpanPengaturan(p.db, pengaturanSchema.parse({ hariKerjaMingguan: [1, 2, 3, 4, 5, 6], aturanPotongan: { izin: { mode: "tidak" }, sakit: { mode: "tidak" }, cuti: { mode: "tidak" }, lainnya: { mode: "tidak" } }, tingkatBonus: [] }));
    }
  });

  it("tanpa konfigurasi bonus target = 0", async () => {
    await simpanPendapatanCabang(p.db, periodeId, masukan({ sales: [{ karyawanId: agus, nominal: 20_000_000, target: 10_000_000 }], totalAktual: 20_000_000 }));
    const sales = await muatSalesUntukGaji(p.db, periodeId, []);
    expect(sales.get(agus)?.bonus).toBe(0);
  });
});
