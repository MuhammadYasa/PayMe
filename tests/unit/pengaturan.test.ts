import { describe, expect, it } from "vitest";
import {
  PENGATURAN_BAWAAN,
  aturanPotonganAbsensiSchema,
  bacaPengaturan,
  daftarTingkatBonusSchema,
  hariKerjaMingguanSchema,
  pengaturanSchema,
} from "@/domain/pengaturan";

describe("pengaturan bawaan", () => {
  it("lolos validasi ketat dan tidak memotong apa pun sampai HRD mengatur", () => {
    expect(pengaturanSchema.safeParse(PENGATURAN_BAWAAN).success).toBe(true);
    expect(PENGATURAN_BAWAAN.hariKerjaMingguan).toEqual([1, 2, 3, 4, 5, 6]);
    expect(Object.values(PENGATURAN_BAWAAN.aturanPotongan).every((a) => a.mode === "tidak")).toBe(true);
    expect(PENGATURAN_BAWAAN.tingkatBonus).toEqual([]);
  });
});

describe("validasi pengaturan", () => {
  it("menolak hari kerja kosong, ganda, atau di luar 0 sampai 6", () => {
    expect(hariKerjaMingguanSchema.safeParse([]).success).toBe(false);
    expect(hariKerjaMingguanSchema.safeParse([1, 1]).success).toBe(false);
    expect(hariKerjaMingguanSchema.safeParse([7]).success).toBe(false);
    expect(hariKerjaMingguanSchema.safeParse([0, 6]).success).toBe(true);
  });

  it("menerima tiga mode potongan dan menolak nilai yang tidak masuk akal", () => {
    const dasar = { izin: { mode: "tidak" }, sakit: { mode: "tidak" }, cuti: { mode: "tidak" } };
    expect(aturanPotonganAbsensiSchema.safeParse({ ...dasar, lainnya: { mode: "per_hari", nominal: 50_000 } }).success).toBe(true);
    expect(aturanPotonganAbsensiSchema.safeParse({ ...dasar, lainnya: { mode: "persen_harian", persen: 50 } }).success).toBe(true);
    expect(aturanPotonganAbsensiSchema.safeParse({ ...dasar, lainnya: { mode: "per_hari", nominal: 0 } }).success).toBe(false);
    expect(aturanPotonganAbsensiSchema.safeParse({ ...dasar, lainnya: { mode: "persen_harian", persen: 101 } }).success).toBe(false);
    expect(aturanPotonganAbsensiSchema.safeParse({ ...dasar, lainnya: { mode: "tidak dikenal" } }).success).toBe(false);
    expect(aturanPotonganAbsensiSchema.safeParse({ ...dasar, lainnya: { mode: "per_hari", nominal: 1.5 } }).success).toBe(false);
  });

  it("menolak tingkat bonus dengan ambang kembar atau persen di atas 100%", () => {
    expect(
      daftarTingkatBonusSchema.safeParse([
        { ambangPermil: 1000, jenis: "tetap", nilai: 1 },
        { ambangPermil: 1000, jenis: "tetap", nilai: 2 },
      ]).success,
    ).toBe(false);
    expect(daftarTingkatBonusSchema.safeParse([{ ambangPermil: 1000, jenis: "persen_penjualan", nilai: 10_001 }]).success).toBe(false);
    expect(daftarTingkatBonusSchema.safeParse([{ ambangPermil: 0, jenis: "tetap", nilai: 1 }]).success).toBe(false);
    expect(daftarTingkatBonusSchema.safeParse([{ ambangPermil: 1000, jenis: "tetap", nilai: 500_000 }]).success).toBe(true);
  });

  it("setiap pesan galat memuat penyebab dan langkah perbaikan (FR-20)", () => {
    const hasil = hariKerjaMingguanSchema.safeParse([]);
    expect(hasil.success).toBe(false);
    if (!hasil.success) expect(hasil.error.issues[0].message).toMatch(/Pilih minimal satu/);
  });
});

describe("bacaPengaturan", () => {
  it("memakai nilai bawaan untuk data kosong", () => {
    expect(bacaPengaturan(null)).toEqual(PENGATURAN_BAWAAN);
    expect(bacaPengaturan({})).toEqual(PENGATURAN_BAWAAN);
  });

  it("menggabungkan aturan potongan sebagian dengan nilai bawaan", () => {
    const hasil = bacaPengaturan({ aturanPotongan: { sakit: { mode: "per_hari", nominal: 25_000 } } });
    expect(hasil.aturanPotongan.sakit).toEqual({ mode: "per_hari", nominal: 25_000 });
    expect(hasil.aturanPotongan.izin).toEqual({ mode: "tidak" });
  });

  it("mengurutkan hari kerja dan membuang JSON yang rusak tanpa melempar galat", () => {
    expect(bacaPengaturan({ hariKerjaMingguan: [6, 1, 3] }).hariKerjaMingguan).toEqual([1, 3, 6]);
    expect(bacaPengaturan({ aturanPotongan: "bukan objek", tingkatBonus: "rusak" })).toEqual(PENGATURAN_BAWAAN);
    expect(bacaPengaturan({ tingkatBonus: [{ ambangPermil: -1 }] }).tingkatBonus).toEqual([]);
  });
});
