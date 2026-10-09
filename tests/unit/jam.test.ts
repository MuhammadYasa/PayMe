import { describe, expect, it } from "vitest";
import { adalahJamBaku, jamDariPecahanHari, parseJam } from "@/domain/jam";

describe("parseJam", () => {
  it("membaca format titik seperti ekspor mesin finger", () => {
    expect(parseJam("06.58")).toEqual({ valid: true, nilai: "06:58" });
    expect(parseJam("16.13")).toEqual({ valid: true, nilai: "16:13" });
    expect(parseJam("00.00")).toEqual({ valid: true, nilai: "00:00" });
  });

  it("membaca titik dua dan jam satu digit", () => {
    expect(parseJam("6:05")).toEqual({ valid: true, nilai: "06:05" });
    expect(parseJam("06:58")).toEqual({ valid: true, nilai: "06:58" });
    expect(parseJam("23.59")).toEqual({ valid: true, nilai: "23:59" });
  });

  it("membuang detik bila ada", () => {
    expect(parseJam("06:58:12")).toEqual({ valid: true, nilai: "06:58" });
  });

  it("menganggap teks kosong sebagai tidak ada jam, bukan galat", () => {
    expect(parseJam("")).toEqual({ valid: true, nilai: null });
    expect(parseJam("   ")).toEqual({ valid: true, nilai: null });
    expect(parseJam(null)).toEqual({ valid: true, nilai: null });
    expect(parseJam(undefined)).toEqual({ valid: true, nilai: null });
  });

  it("menolak jam yang tidak mungkin atau bukan jam", () => {
    for (const salah of ["24.00", "12.60", "abc", "7", "12-30", "06.5", "ab:cd", "-1.00"]) {
      expect(parseJam(salah)).toEqual({ valid: false });
    }
  });
});

describe("adalahJamBaku", () => {
  it("hanya menerima HH:MM", () => {
    expect(adalahJamBaku("06:58")).toBe(true);
    expect(adalahJamBaku("6:58")).toBe(false);
    expect(adalahJamBaku("06.58")).toBe(false);
    expect(adalahJamBaku("24:00")).toBe(false);
    expect(adalahJamBaku(null)).toBe(false);
  });
});

describe("jamDariPecahanHari", () => {
  it("mengubah sel waktu Excel menjadi HH:MM", () => {
    expect(jamDariPecahanHari(0)).toBe("00:00");
    expect(jamDariPecahanHari(0.5)).toBe("12:00");
    expect(jamDariPecahanHari(7 / 24)).toBe("07:00");
    expect(jamDariPecahanHari(16.13 / 24)).toBe("16:08");
  });

  it("memakai bagian pecahan saja bila sel berisi tanggal dan jam", () => {
    expect(jamDariPecahanHari(45000.75)).toBe("18:00");
  });

  it("mengembalikan null untuk nilai yang tidak masuk akal", () => {
    expect(jamDariPecahanHari(-1)).toBeNull();
    expect(jamDariPecahanHari(Number.NaN)).toBeNull();
  });
});
