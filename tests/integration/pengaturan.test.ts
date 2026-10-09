import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PENGATURAN_BAWAAN, pengaturanSchema } from "@/domain/pengaturan";
import { ambilPengaturan, simpanPengaturan } from "@/server/services/pengaturan";
import { buatPerusahaanUji, hapusPerusahaan } from "../support/db";

type Perusahaan = Awaited<ReturnType<typeof buatPerusahaanUji>>;

describe("pengaturan perusahaan", () => {
  let a: Perusahaan;
  let b: Perusahaan;

  beforeAll(async () => {
    a = await buatPerusahaanUji("PT Atur A");
    b = await buatPerusahaanUji("PT Atur B");
  });
  afterAll(async () => {
    await hapusPerusahaan(a.perusahaanId);
    await hapusPerusahaan(b.perusahaanId);
  });

  it("perusahaan baru memakai pengaturan bawaan tanpa potongan dan bonus", async () => {
    expect(await ambilPengaturan(a.db)).toEqual(PENGATURAN_BAWAAN);
  });

  it("perubahan tersimpan tanpa mengubah kode dan tidak memengaruhi perusahaan lain", async () => {
    const baru = pengaturanSchema.parse({
      hariKerjaMingguan: [5, 1, 2, 3, 4],
      aturanPotongan: {
        izin: { mode: "per_hari", nominal: 50_000 },
        sakit: { mode: "tidak" },
        cuti: { mode: "persen_harian", persen: 100 },
        lainnya: { mode: "tidak" },
      },
      tingkatBonus: [
        { ambangPermil: 1000, jenis: "tetap", nilai: 500_000 },
        { ambangPermil: 1200, jenis: "persen_penjualan", nilai: 100 },
      ],
    });
    const tersimpan = await simpanPengaturan(a.db, baru);
    expect(tersimpan.hariKerjaMingguan).toEqual([1, 2, 3, 4, 5]);
    expect(tersimpan.aturanPotongan.izin).toEqual({ mode: "per_hari", nominal: 50_000 });
    expect(tersimpan.tingkatBonus).toHaveLength(2);

    expect(await ambilPengaturan(a.db)).toEqual(tersimpan);
    expect(await ambilPengaturan(b.db)).toEqual(PENGATURAN_BAWAAN);
  });

  it("menyimpan ulang memperbarui baris yang sama, bukan membuat baris baru", async () => {
    await simpanPengaturan(a.db, PENGATURAN_BAWAAN);
    await simpanPengaturan(a.db, { ...PENGATURAN_BAWAAN, hariKerjaMingguan: [1, 2, 3, 4, 5, 6, 0] });
    expect(await a.db.pengaturanPerusahaan.count()).toBe(1);
    expect((await ambilPengaturan(a.db)).hariKerjaMingguan).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});
