import { describe, expect, it } from "vitest";
import {
  adalahTanggalValid,
  dariNomorHari,
  formatTanggal,
  formatTanggalPanjang,
  hariDalamBulan,
  hariMinggu,
  keNomorHari,
  rentangTanggal,
  selisihHari,
  tambahBulan,
  tambahHari,
} from "@/domain/tanggal";

describe("adalahTanggalValid", () => {
  it("menerima tanggal kalender yang ada", () => {
    expect(adalahTanggalValid("2024-02-29")).toBe(true);
    expect(adalahTanggalValid("2025-12-31")).toBe(true);
  });

  it("menolak tanggal yang tidak ada atau salah format", () => {
    expect(adalahTanggalValid("2025-02-29")).toBe(false);
    expect(adalahTanggalValid("2025-13-01")).toBe(false);
    expect(adalahTanggalValid("2025-00-10")).toBe(false);
    expect(adalahTanggalValid("2025-1-1")).toBe(false);
    expect(adalahTanggalValid("01/02/2025")).toBe(false);
    expect(adalahTanggalValid(20250101)).toBe(false);
    expect(adalahTanggalValid(null)).toBe(false);
  });
});

describe("hariDalamBulan", () => {
  it("memperhitungkan tahun kabisat", () => {
    expect(hariDalamBulan(2024, 2)).toBe(29);
    expect(hariDalamBulan(2025, 2)).toBe(28);
    expect(hariDalamBulan(1900, 2)).toBe(28);
    expect(hariDalamBulan(2000, 2)).toBe(29);
    expect(hariDalamBulan(2025, 4)).toBe(30);
    expect(hariDalamBulan(2025, 12)).toBe(31);
  });
});

describe("aritmetika tanggal", () => {
  it("menambah hari melewati batas bulan dan tahun", () => {
    expect(tambahHari("2025-01-31", 1)).toBe("2025-02-01");
    expect(tambahHari("2025-12-31", 1)).toBe("2026-01-01");
    expect(tambahHari("2024-03-01", -1)).toBe("2024-02-29");
    expect(tambahHari("2025-03-01", -1)).toBe("2025-02-28");
  });

  it("menghitung selisih hari", () => {
    expect(selisihHari("2024-02-01", "2024-03-01")).toBe(29);
    expect(selisihHari("2025-02-01", "2025-03-01")).toBe(28);
    expect(selisihHari("2025-03-01", "2025-02-01")).toBe(-28);
    expect(selisihHari("2025-05-05", "2025-05-05")).toBe(0);
  });

  it("menambah bulan dengan koreksi ke akhir bulan", () => {
    expect(tambahBulan("2025-01-31", 1)).toBe("2025-02-28");
    expect(tambahBulan("2024-01-31", 1)).toBe("2024-02-29");
    expect(tambahBulan("2025-03-31", -1)).toBe("2025-02-28");
    expect(tambahBulan("2025-12-26", 1)).toBe("2026-01-26");
    expect(tambahBulan("2025-01-15", -2)).toBe("2024-11-15");
    expect(tambahBulan("2025-01-30", 1)).toBe("2025-02-28");
  });

  it("menentukan hari dalam minggu (0 = Minggu)", () => {
    expect(hariMinggu("1970-01-01")).toBe(4);
    expect(hariMinggu("2025-04-06")).toBe(0);
    expect(hariMinggu("2025-04-07")).toBe(1);
    expect(hariMinggu("2026-08-30")).toBe(0);
    expect(hariMinggu("2026-08-24")).toBe(1);
  });

  it("menyusun rentang tanggal termasuk kedua ujungnya", () => {
    expect(rentangTanggal("2025-04-01", "2025-04-30")).toHaveLength(30);
    expect(rentangTanggal("2025-04-01", "2025-04-01")).toEqual(["2025-04-01"]);
    expect(rentangTanggal("2025-04-02", "2025-04-01")).toEqual([]);
    expect(() => rentangTanggal("1900-01-01", "2100-01-01")).toThrow(RangeError);
  });
});

describe("kesesuaian dengan kalender sistem", () => {
  it("nomor hari dan hari dalam minggu sama dengan Date UTC untuk 1990 sampai 2040", () => {
    const mulai = Date.UTC(1990, 0, 1);
    const akhir = Date.UTC(2040, 11, 31);
    for (let ms = mulai; ms <= akhir; ms += 86_400_000) {
      const d = new Date(ms);
      const iso = d.toISOString().slice(0, 10);
      const nomor = Math.round(ms / 86_400_000);
      expect(keNomorHari(iso)).toBe(nomor);
      expect(dariNomorHari(nomor)).toBe(iso);
      expect(hariMinggu(iso)).toBe(d.getUTCDay());
    }
  });
});

describe("format tampilan", () => {
  it("memakai singkatan bulan bahasa Indonesia", () => {
    expect(formatTanggal("2025-01-26")).toBe("26 Jan 2025");
    expect(formatTanggal("2025-08-05")).toBe("5 Agu 2025");
    expect(formatTanggal("2025-05-17")).toBe("17 Mei 2025");
  });

  it("menampilkan nama hari pada format panjang", () => {
    expect(formatTanggalPanjang("2025-04-06")).toBe("Minggu, 6 April 2025");
  });
});
