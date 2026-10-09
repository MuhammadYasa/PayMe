import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bersihkanUntukLog, log } from "@/server/log";
import { samarkanRekening } from "@/server/kripto";

describe("samarkanRekening", () => {
  it("hanya menyisakan empat digit terakhir", () => {
    expect(samarkanRekening("1234567890")).toBe("••••7890");
    expect(samarkanRekening("0012345678")).toBe("••••5678");
  });

  it("menyamarkan seluruhnya bila terlalu pendek", () => {
    expect(samarkanRekening("123")).toBe("••••");
    expect(samarkanRekening("")).toBe("••••");
  });
});

describe("bersihkanUntukLog (FR-19, NFR-03)", () => {
  it("menyamarkan field rekening dan menyembunyikan rahasia", () => {
    const hasil = bersihkanUntukLog({
      nomorRekening: "1234567890",
      rekening: "9876543210",
      kataSandi: "rahasia123",
      password: "x",
      token: "abc",
      authorization: "Bearer xyz",
      nama: "Budi",
    }) as Record<string, string>;
    expect(hasil.nomorRekening).toBe("••••7890");
    expect(hasil.rekening).toBe("••••3210");
    expect(hasil.kataSandi).toBe("[disembunyikan]");
    expect(hasil.password).toBe("[disembunyikan]");
    expect(hasil.token).toBe("[disembunyikan]");
    expect(hasil.authorization).toBe("[disembunyikan]");
    expect(hasil.nama).toBe("Budi");
  });

  it("menyamarkan deretan digit panjang di dalam teks bebas", () => {
    expect(bersihkanUntukLog("gagal untuk rekening 1234567890 pada 09:30")).toBe("gagal untuk rekening ••••7890 pada 09:30");
  });

  it("menembus objek dan larik bersarang serta pesan galat", () => {
    const hasil = JSON.stringify(
      bersihkanUntukLog({ percobaan: [{ detail: { nomorRekening: "1234567890" } }], galat: new Error("rekening 1234567890 tidak cocok") }),
    );
    expect(hasil).not.toContain("1234567890");
    expect(hasil).toContain("••••7890");
  });

  it("membatasi kedalaman agar objek siklik tidak membuat proses macet", () => {
    const siklik: Record<string, unknown> = {};
    siklik.diri = siklik;
    expect(() => bersihkanUntukLog(siklik)).not.toThrow();
  });
});

describe("log", () => {
  let keluaran: string[];

  beforeEach(() => {
    keluaran = [];
    vi.spyOn(console, "log").mockImplementation((baris: string) => void keluaran.push(baris));
    vi.spyOn(console, "warn").mockImplementation((baris: string) => void keluaran.push(baris));
    vi.spyOn(console, "error").mockImplementation((baris: string) => void keluaran.push(baris));
  });

  afterEach(() => vi.restoreAllMocks());

  it("menulis satu baris JSON tanpa nomor rekening utuh", () => {
    log.warn("percobaan_gagal", { nomorRekening: "1234567890", ip: "203.0.113.5" });
    expect(keluaran).toHaveLength(1);
    expect(keluaran[0]).not.toContain("1234567890");
    expect(JSON.parse(keluaran[0])).toMatchObject({ tingkat: "warn", peristiwa: "percobaan_gagal", nomorRekening: "••••7890" });
  });
});
