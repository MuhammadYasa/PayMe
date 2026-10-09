import { describe, expect, it } from "vitest";
import { bpsKeTeks, parsePersenKeBps, parsePersenKePermil, permilKeTeks } from "@/domain/persen";

describe("parsePersenKePermil", () => {
  it("membaca bilangan bulat dan satu desimal dengan koma atau titik", () => {
    expect(parsePersenKePermil("100")).toBe(1000);
    expect(parsePersenKePermil("87,5")).toBe(875);
    expect(parsePersenKePermil("87.5")).toBe(875);
    expect(parsePersenKePermil(" 85% ")).toBe(850);
    expect(parsePersenKePermil("0,1")).toBe(1);
    expect(parsePersenKePermil("120")).toBe(1200);
  });

  it("menolak teks yang bukan persen yang wajar", () => {
    for (const salah of ["", "abc", "12,34", "1,2,3", "-5", "1001", "1e3", "100 persen"]) {
      expect(parsePersenKePermil(salah)).toBeNull();
    }
  });
});

describe("permilKeTeks", () => {
  it("menampilkan tanpa desimal bila bulat", () => {
    expect(permilKeTeks(1000)).toBe("100");
    expect(permilKeTeks(875)).toBe("87,5");
    expect(permilKeTeks(5)).toBe("0,5");
    expect(permilKeTeks(0)).toBe("0");
  });

  it("hasil tampilan dapat dibaca kembali tanpa perubahan", () => {
    for (const nilai of [1, 5, 99, 850, 875, 1000, 1200, 10000]) {
      expect(parsePersenKePermil(permilKeTeks(nilai))).toBe(nilai);
    }
  });
});

describe("persen dalam basis poin", () => {
  it("membaca dua desimal", () => {
    expect(parsePersenKeBps("2")).toBe(200);
    expect(parsePersenKeBps("2,5")).toBe(250);
    expect(parsePersenKeBps("0,25")).toBe(25);
    expect(parsePersenKeBps("100")).toBe(10000);
  });

  it("menolak lebih dari 100% dan lebih dari dua desimal", () => {
    expect(parsePersenKeBps("100,01")).toBeNull();
    expect(parsePersenKeBps("1,234")).toBeNull();
    expect(parsePersenKeBps("")).toBeNull();
  });

  it("memformat dan membaca kembali", () => {
    expect(bpsKeTeks(250)).toBe("2,5");
    expect(bpsKeTeks(100)).toBe("1");
    expect(bpsKeTeks(25)).toBe("0,25");
    for (const nilai of [1, 25, 100, 250, 9999, 10000]) {
      expect(parsePersenKeBps(bpsKeTeks(nilai))).toBe(nilai);
    }
  });
});
