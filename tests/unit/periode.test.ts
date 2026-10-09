import { describe, expect, it } from "vitest";
import {
  berisiTanggal,
  hitungPeriode,
  labelPeriode,
  periodeBertabrakan,
  pratinjauPeriode,
  tanggalDalamPeriode,
} from "@/domain/periode";
import { adalahTanggalValid, keNomorHari, tambahHari } from "@/domain/tanggal";

describe("hitungPeriode (FR-03)", () => {
  it("1 Februari 2024 berakhir 29 Februari 2024 dengan 29 hari", () => {
    expect(hitungPeriode("2024-02-01")).toEqual({
      tanggalAwal: "2024-02-01",
      tanggalAkhir: "2024-02-29",
      jumlahHari: 29,
    });
  });

  it("1 Februari 2025 berjumlah 28 hari", () => {
    const periode = hitungPeriode("2025-02-01");
    expect(periode.tanggalAkhir).toBe("2025-02-28");
    expect(periode.jumlahHari).toBe(28);
  });

  it("26 Desember berakhir 25 Januari tahun berikutnya", () => {
    expect(hitungPeriode("2025-12-26").tanggalAkhir).toBe("2026-01-25");
    expect(hitungPeriode("2025-12-26").jumlahHari).toBe(31);
  });

  it("26 Januari 2025 berakhir 25 Februari 2025 dengan 31 hari", () => {
    const periode = hitungPeriode("2025-01-26");
    expect(periode.tanggalAkhir).toBe("2025-02-25");
    expect(periode.jumlahHari).toBe(31);
  });

  it("mulai tanggal 31 Januari memakai akhir Februari dikurangi satu hari", () => {
    expect(hitungPeriode("2025-01-31").tanggalAkhir).toBe("2025-02-27");
    expect(hitungPeriode("2024-01-31").tanggalAkhir).toBe("2024-02-28");
  });

  it("mulai tanggal 29 dan 30 Januari pada tahun biasa", () => {
    expect(hitungPeriode("2025-01-29").tanggalAkhir).toBe("2025-02-27");
    expect(hitungPeriode("2025-01-30").tanggalAkhir).toBe("2025-02-27");
    expect(hitungPeriode("2024-01-30").tanggalAkhir).toBe("2024-02-28");
  });

  it("mulai tanggal 31 pada bulan yang diikuti bulan 30 hari", () => {
    expect(hitungPeriode("2025-03-31").tanggalAkhir).toBe("2025-04-29");
    expect(hitungPeriode("2025-08-31").tanggalAkhir).toBe("2025-09-29");
  });

  it("periode dari contoh mesin finger: 24 Agustus berakhir 23 September", () => {
    const periode = hitungPeriode("2026-08-24");
    expect(periode.tanggalAkhir).toBe("2026-09-23");
    expect(periode.jumlahHari).toBe(31);
  });

  it("selalu menghasilkan 28 sampai 31 hari dan tanggal akhir valid untuk setiap tanggal awal 2024 sampai 2027", () => {
    let tanggal = "2024-01-01";
    while (tanggal < "2028-01-01") {
      const periode = hitungPeriode(tanggal);
      expect(adalahTanggalValid(periode.tanggalAkhir)).toBe(true);
      expect(periode.jumlahHari).toBeGreaterThanOrEqual(28);
      expect(periode.jumlahHari).toBeLessThanOrEqual(31);
      expect(keNomorHari(periode.tanggalAkhir) - keNomorHari(tanggal) + 1).toBe(periode.jumlahHari);
      tanggal = tambahHari(tanggal, 1);
    }
  });

  it("menolak tanggal awal yang tidak valid", () => {
    expect(() => hitungPeriode("2025-02-30")).toThrow(RangeError);
    expect(() => hitungPeriode("bukan tanggal")).toThrow(RangeError);
  });
});

describe("periodeBertabrakan", () => {
  const maret = { tanggalAwal: "2025-03-01", tanggalAkhir: "2025-03-31" };

  it("mendeteksi tumpang tindih sebagian dan satu hari bersinggungan", () => {
    expect(periodeBertabrakan(maret, { tanggalAwal: "2025-03-15", tanggalAkhir: "2025-04-14" })).toBe(true);
    expect(periodeBertabrakan(maret, { tanggalAwal: "2025-03-31", tanggalAkhir: "2025-04-30" })).toBe(true);
    expect(periodeBertabrakan(maret, { tanggalAwal: "2025-02-01", tanggalAkhir: "2025-03-01" })).toBe(true);
  });

  it("tidak menganggap periode berurutan sebagai bentrok", () => {
    expect(periodeBertabrakan(maret, { tanggalAwal: "2025-04-01", tanggalAkhir: "2025-04-30" })).toBe(false);
    expect(periodeBertabrakan(maret, { tanggalAwal: "2025-02-01", tanggalAkhir: "2025-02-28" })).toBe(false);
  });

  it("bersifat simetris", () => {
    const lain = { tanggalAwal: "2025-03-20", tanggalAkhir: "2025-04-19" };
    expect(periodeBertabrakan(maret, lain)).toBe(periodeBertabrakan(lain, maret));
  });
});

describe("tampilan periode", () => {
  it("menyusun pratinjau sesuai contoh pada spesifikasi", () => {
    expect(pratinjauPeriode(hitungPeriode("2025-01-26"))).toBe("Periode: 26 Jan 2025 sampai 25 Feb 2025 (31 hari)");
    expect(labelPeriode(hitungPeriode("2025-01-26"))).toBe("26 Jan 2025 sampai 25 Feb 2025");
  });

  it("memeriksa tanggal di dalam periode dan membuat daftar tanggalnya", () => {
    const periode = hitungPeriode("2025-04-01");
    expect(tanggalDalamPeriode(periode)).toHaveLength(30);
    expect(berisiTanggal(periode, "2025-04-30")).toBe(true);
    expect(berisiTanggal(periode, "2025-05-01")).toBe(false);
    expect(berisiTanggal(periode, "2025-03-31")).toBe(false);
  });
});
