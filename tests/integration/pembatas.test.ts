import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { type AturanBatas, ambilJatah, ambilJatahSemua, resetJatah } from "@/server/pembatas";
import { hapusKunciPembatas } from "../support/db";

const kunciDipakai: string[] = [];

function aturanBaru(ubah: Partial<AturanBatas> = {}): AturanBatas {
  const kunci = `uji-${randomUUID()}`;
  kunciDipakai.push(kunci);
  return { kunci, batas: 5, jendelaMenit: 15, blokirMenit: 15, ...ubah };
}

const menit = (n: number) => n * 60_000;

afterAll(async () => {
  await hapusKunciPembatas(kunciDipakai);
});

describe("pembatas percobaan (FR-19)", () => {
  it("lima percobaan pertama lolos dan percobaan ke-6 ditolak", async () => {
    const aturan = aturanBaru();
    const t0 = new Date("2026-01-01T10:00:00Z");
    for (let i = 1; i <= 5; i++) {
      expect((await ambilJatah(aturan, new Date(t0.getTime() + i * 1000))).diizinkan).toBe(true);
    }
    const keenam = await ambilJatah(aturan, new Date(t0.getTime() + 6000));
    expect(keenam.diizinkan).toBe(false);
    expect(keenam.sisaDetik).toBe(15 * 60);
  });

  it("tetap ditolak sepanjang 15 menit blokir dan terbuka lagi sesudahnya", async () => {
    const aturan = aturanBaru();
    const t0 = new Date("2026-01-01T10:00:00Z");
    for (let i = 0; i < 6; i++) await ambilJatah(aturan, new Date(t0.getTime() + i * 1000));

    const diMenit14 = await ambilJatah(aturan, new Date(t0.getTime() + menit(14)));
    expect(diMenit14.diizinkan).toBe(false);
    expect(diMenit14.sisaDetik).toBeGreaterThan(0);
    expect(diMenit14.sisaDetik).toBeLessThanOrEqual(15 * 60);

    const diMenit21 = await ambilJatah(aturan, new Date(t0.getTime() + menit(21)));
    expect(diMenit21.diizinkan).toBe(true);
  });

  it("percobaan yang ditolak selama blokir tidak memperpanjang blokir", async () => {
    const aturan = aturanBaru();
    const t0 = new Date("2026-01-01T10:00:00Z");
    for (let i = 0; i < 6; i++) await ambilJatah(aturan, new Date(t0.getTime() + i * 1000));
    for (let i = 1; i <= 10; i++) await ambilJatah(aturan, new Date(t0.getTime() + menit(i)));
    // Blokir dimulai di detik ke-5, jadi berakhir sebelum menit ke-21 walau ada banyak percobaan di tengahnya.
    expect((await ambilJatah(aturan, new Date(t0.getTime() + menit(20)))).diizinkan).toBe(true);
  });

  it("jendela yang habis memulai hitungan dari awal", async () => {
    const aturan = aturanBaru();
    const t0 = new Date("2026-01-01T10:00:00Z");
    for (let i = 0; i < 3; i++) await ambilJatah(aturan, new Date(t0.getTime() + i * 1000));
    const hasil: boolean[] = [];
    for (let i = 0; i < 6; i++) hasil.push((await ambilJatah(aturan, new Date(t0.getTime() + menit(16) + i * 1000))).diizinkan);
    expect(hasil).toEqual([true, true, true, true, true, false]);
  });

  it("reset setelah berhasil membuat hitungan kembali nol", async () => {
    const aturan = aturanBaru();
    const t0 = new Date("2026-01-01T10:00:00Z");
    for (let i = 0; i < 4; i++) await ambilJatah(aturan, new Date(t0.getTime() + i * 1000));
    await resetJatah([aturan.kunci]);
    for (let i = 0; i < 5; i++) {
      expect((await ambilJatah(aturan, new Date(t0.getTime() + 10_000 + i * 1000))).diizinkan).toBe(true);
    }
  });

  it("kunci yang berbeda tidak saling memengaruhi", async () => {
    const satu = aturanBaru();
    const dua = aturanBaru();
    const t0 = new Date("2026-01-01T10:00:00Z");
    for (let i = 0; i < 7; i++) await ambilJatah(satu, new Date(t0.getTime() + i * 1000));
    expect((await ambilJatah(dua, new Date(t0.getTime() + 8000))).diizinkan).toBe(true);
  });

  it("40 percobaan serentak hanya meloloskan sebanyak batas, sisanya ditolak sebelum tebakan diuji", async () => {
    const aturan = aturanBaru();
    const sekarang = new Date("2026-01-01T10:00:00Z");
    const hasil = await Promise.all(Array.from({ length: 40 }, () => ambilJatah(aturan, sekarang)));
    expect(hasil.filter((h) => h.diizinkan)).toHaveLength(5);
    expect(hasil.filter((h) => !h.diizinkan)).toHaveLength(35);
  });

  it("ambilJatahSemua menolak bila salah satu kunci sudah habis", async () => {
    const longgar = aturanBaru({ batas: 100 });
    const ketat = aturanBaru({ batas: 1 });
    const t0 = new Date("2026-01-01T10:00:00Z");
    expect((await ambilJatahSemua([longgar, ketat], t0)).diizinkan).toBe(true);
    const kedua = await ambilJatahSemua([longgar, ketat], new Date(t0.getTime() + 1000));
    expect(kedua.diizinkan).toBe(false);
    expect(kedua.sisaDetik).toBeGreaterThan(0);
  });
});
