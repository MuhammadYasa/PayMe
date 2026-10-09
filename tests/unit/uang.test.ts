import { describe, expect, it } from "vitest";
import { formatPersenPermil, formatRupiah, parseNominal } from "@/domain/uang";

describe("formatRupiah", () => {
  it("menampilkan pemisah ribuan titik dengan awalan Rp", () => {
    expect(formatRupiah(1250000)).toBe("Rp 1.250.000");
    expect(formatRupiah(0)).toBe("Rp 0");
    expect(formatRupiah(999)).toBe("Rp 999");
    expect(formatRupiah(1000)).toBe("Rp 1.000");
    expect(formatRupiah(12345678901)).toBe("Rp 12.345.678.901");
  });

  it("menandai nilai negatif di depan", () => {
    expect(formatRupiah(-150000)).toBe("-Rp 150.000");
  });

  it("menolak pecahan dan nilai di luar rentang aman", () => {
    expect(() => formatRupiah(10.5)).toThrow(RangeError);
    expect(() => formatRupiah(Number.NaN)).toThrow(RangeError);
    expect(() => formatRupiah(2 ** 60)).toThrow(RangeError);
  });
});

describe("parseNominal", () => {
  it("membaca titik dan koma sebagai pemisah ribuan", () => {
    expect(parseNominal("1.250.000")).toBe(1250000);
    expect(parseNominal("1,250,000")).toBe(1250000);
    expect(parseNominal("1250000")).toBe(1250000);
    expect(parseNominal("Rp 1.250.000")).toBe(1250000);
    expect(parseNominal("rp1250000")).toBe(1250000);
    expect(parseNominal("  500.000  ")).toBe(500000);
    expect(parseNominal("0")).toBe(0);
  });

  it("mengembalikan null untuk input kosong atau format tidak dikenal", () => {
    expect(parseNominal("")).toBeNull();
    expect(parseNominal("   ")).toBeNull();
    expect(parseNominal("abc")).toBeNull();
    expect(parseNominal("12abc")).toBeNull();
    expect(parseNominal("1,5")).toBeNull();
    expect(parseNominal("1.25.000")).toBeNull();
    expect(parseNominal("1.2500")).toBeNull();
    expect(parseNominal("1.250,000")).toBeNull();
  });

  it("tetap membaca nilai negatif agar pemanggil dapat menolaknya dengan pesan yang jelas", () => {
    expect(parseNominal("-100.000")).toBe(-100000);
    expect(parseNominal("-0")).toBe(0);
  });

  it("menolak angka yang melewati batas bilangan bulat aman", () => {
    expect(parseNominal("99999999999999999999")).toBeNull();
  });

  it("hasil format dapat dibaca kembali tanpa selisih", () => {
    for (const nilai of [0, 1, 999, 1000, 1234567, 98765432100]) {
      expect(parseNominal(formatRupiah(nilai))).toBe(nilai);
    }
  });
});

describe("formatPersenPermil", () => {
  it("menampilkan satu desimal dengan koma", () => {
    expect(formatPersenPermil(850)).toBe("85,0%");
    expect(formatPersenPermil(333)).toBe("33,3%");
    expect(formatPersenPermil(1000)).toBe("100,0%");
    expect(formatPersenPermil(0)).toBe("0,0%");
    expect(formatPersenPermil(12345)).toBe("1.234,5%");
  });
});
