import { describe, expect, it } from "vitest";
import { jadwalCicilan, nominalCicilanBerikut, statusDenda } from "@/domain/cicilan";

describe("jadwalCicilan (FR-14)", () => {
  it("Rp 1.000.000 dalam 3 cicilan: sisa pembulatan masuk cicilan terakhir", () => {
    expect(jadwalCicilan(1_000_000, 3)).toEqual([333_333, 333_333, 333_334]);
  });

  it("satu cicilan memotong seluruhnya", () => {
    expect(jadwalCicilan(100_000, 1)).toEqual([100_000]);
  });

  it("pembagian habis menghasilkan cicilan sama", () => {
    expect(jadwalCicilan(900_000, 3)).toEqual([300_000, 300_000, 300_000]);
  });

  it("jumlah seluruh cicilan selalu sama dengan total", () => {
    for (const [total, n] of [
      [1, 1],
      [7, 3],
      [100, 7],
      [1_234_567, 12],
      [999_999_999, 120],
      [2_000_000_000, 11],
    ] as const) {
      const jadwal = jadwalCicilan(total, n);
      expect(jadwal).toHaveLength(n);
      expect(jadwal.reduce((a, b) => a + b, 0)).toBe(total);
      expect(Math.min(...jadwal)).toBeGreaterThanOrEqual(1);
    }
  });

  it("menolak total atau jumlah cicilan yang tidak masuk akal", () => {
    expect(() => jadwalCicilan(0, 3)).toThrow(RangeError);
    expect(() => jadwalCicilan(-5, 3)).toThrow(RangeError);
    expect(() => jadwalCicilan(1000, 0)).toThrow(RangeError);
    expect(() => jadwalCicilan(1000, 121)).toThrow(RangeError);
    expect(() => jadwalCicilan(1000, 2.5)).toThrow(RangeError);
    expect(() => jadwalCicilan(5, 10)).toThrow(RangeError);
  });
});

describe("nominalCicilanBerikut", () => {
  const denda = { total: 1_000_000, jumlahCicilan: 3 };

  it("mengikuti jadwal selama cicilan berjalan sampai lunas", () => {
    let sisa = denda.total;
    const dipotong: number[] = [];
    for (let terbayar = 0; terbayar < 5; terbayar++) {
      const nominal = nominalCicilanBerikut({ ...denda, terbayar, sisa });
      dipotong.push(nominal);
      sisa -= nominal;
    }
    expect(dipotong).toEqual([333_333, 333_333, 333_334, 0, 0]);
    expect(sisa).toBe(0);
  });

  it("berhenti saat sisa 0 dan tidak pernah negatif", () => {
    expect(nominalCicilanBerikut({ ...denda, terbayar: 3, sisa: 0 })).toBe(0);
    expect(nominalCicilanBerikut({ ...denda, terbayar: 1, sisa: 0 })).toBe(0);
  });

  it("memotong sebesar sisa bila sisa lebih kecil dari cicilan standar", () => {
    expect(nominalCicilanBerikut({ ...denda, terbayar: 1, sisa: 100_000 })).toBe(100_000);
  });

  it("cicilan terakhir menutup seluruh sisa", () => {
    expect(nominalCicilanBerikut({ ...denda, terbayar: 2, sisa: 333_334 })).toBe(333_334);
  });

  it("satu kali cicilan langsung memotong total", () => {
    expect(nominalCicilanBerikut({ total: 250_000, jumlahCicilan: 1, terbayar: 0, sisa: 250_000 })).toBe(250_000);
  });
});

describe("statusDenda", () => {
  it("lunas hanya saat sisa 0", () => {
    expect(statusDenda(1)).toBe("berjalan");
    expect(statusDenda(0)).toBe("lunas");
  });
});
