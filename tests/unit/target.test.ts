import { describe, expect, it } from "vitest";
import type { TingkatBonus } from "@/domain/pengaturan";
import { hitungBonusTarget, persenCapaianPermil } from "@/domain/target";
import { formatPersenPermil } from "@/domain/uang";

describe("persenCapaianPermil (FR-11)", () => {
  it("Rp 8.500.000 dari target Rp 10.000.000 adalah 85,0%", () => {
    const permil = persenCapaianPermil(8_500_000, 10_000_000);
    expect(permil).toBe(850);
    expect(formatPersenPermil(permil!)).toBe("85,0%");
  });

  it("Rp 3.333.333 dari target Rp 10.000.000 adalah 33,3%", () => {
    const permil = persenCapaianPermil(3_333_333, 10_000_000);
    expect(permil).toBe(333);
    expect(formatPersenPermil(permil!)).toBe("33,3%");
  });

  it("target 0 menghasilkan null tanpa galat", () => {
    expect(persenCapaianPermil(5_000_000, 0)).toBeNull();
  });

  it("capaian di atas 100% tidak dibatasi", () => {
    expect(persenCapaianPermil(25_000_000, 10_000_000)).toBe(2500);
  });

  it("pembulatan setengah ke atas pada batas desimal", () => {
    // 1 / 8 = 12,5% persis; 1 / 16 = 6,25% menjadi 6,3%
    expect(persenCapaianPermil(1, 8)).toBe(125);
    expect(persenCapaianPermil(1, 16)).toBe(63);
    // 0,05% persis (1 per mil setengah) naik ke 0,1%
    expect(persenCapaianPermil(1, 2000)).toBe(1);
    expect(persenCapaianPermil(1, 3000)).toBe(0);
  });

  it("tepat untuk penjualan bernilai ratusan miliar", () => {
    expect(persenCapaianPermil(300_000_000_000, 400_000_000_000)).toBe(750);
    expect(persenCapaianPermil(999_999_999_999, 1_000_000_000_000)).toBe(1000);
  });

  it("menolak penjualan negatif atau pecahan", () => {
    expect(() => persenCapaianPermil(-1, 100)).toThrow(RangeError);
    expect(() => persenCapaianPermil(1.5, 100)).toThrow(RangeError);
  });
});

describe("hitungBonusTarget", () => {
  const tetap500: TingkatBonus = { ambangPermil: 1000, jenis: "tetap", nilai: 500_000 };

  it("aturan >= 100% bonus Rp 500.000 memberi bonus saat capaian tepat 100,0%", () => {
    const hasil = hitungBonusTarget(10_000_000, 10_000_000, [tetap500]);
    expect(hasil.bonus).toBe(500_000);
    expect(hasil.tingkat).toEqual(tetap500);
  });

  it("tanpa konfigurasi bonus target = 0", () => {
    expect(hitungBonusTarget(20_000_000, 10_000_000, [])).toEqual({ tingkat: null, bonus: 0 });
  });

  it("capaian di bawah ambang tidak mendapat bonus", () => {
    expect(hitungBonusTarget(9_990_000, 10_000_000, [tetap500]).bonus).toBe(0);
  });

  it("penentuan tingkat memakai nilai tanpa pembulatan: 99,96% tampil 100,0% tetapi belum memenuhi ambang 100%", () => {
    expect(persenCapaianPermil(9_996_000, 10_000_000)).toBe(1000);
    expect(hitungBonusTarget(9_996_000, 10_000_000, [tetap500]).bonus).toBe(0);
  });

  it("memilih satu tingkat tertinggi yang terpenuhi, tidak menjumlahkan semuanya", () => {
    const tingkat: TingkatBonus[] = [
      { ambangPermil: 1500, jenis: "tetap", nilai: 1_500_000 },
      { ambangPermil: 800, jenis: "tetap", nilai: 200_000 },
      tetap500,
    ];
    expect(hitungBonusTarget(8_500_000, 10_000_000, tingkat).bonus).toBe(200_000);
    expect(hitungBonusTarget(11_000_000, 10_000_000, tingkat).bonus).toBe(500_000);
    expect(hitungBonusTarget(16_000_000, 10_000_000, tingkat).bonus).toBe(1_500_000);
  });

  it("jenis persen dari penjualan memakai basis poin dan dibulatkan ke bawah", () => {
    const dua: TingkatBonus = { ambangPermil: 1000, jenis: "persen_penjualan", nilai: 200 };
    expect(hitungBonusTarget(12_345_678, 10_000_000, [dua]).bonus).toBe(246_913);
  });

  it("tanpa target tidak ada bonus walau ada tingkat", () => {
    expect(hitungBonusTarget(50_000_000, 0, [tetap500])).toEqual({ tingkat: null, bonus: 0 });
  });

  it("persen penjualan tetap tepat saat hasil kali melewati batas bilangan bulat aman JavaScript", () => {
    // 999.999.999.999 x 9.999 = 9.998.999.999.990.001, lebih besar dari 2^53
    const sembilanPuluhSembilanPersen: TingkatBonus = { ambangPermil: 1000, jenis: "persen_penjualan", nilai: 9999 };
    expect(hitungBonusTarget(999_999_999_999, 999_999_999_999, [sembilanPuluhSembilanPersen]).bonus).toBe(999_899_999_999);
  });
});
