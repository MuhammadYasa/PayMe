import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db/client";
import { type AturanBatas, ambilJatah, ambilJatahSemua, bersihkanKedaluwarsa, resetJatah } from "@/server/pembatas";
import { aturanBatasDaftar, batasiPendaftaran } from "@/server/services/auth";
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

describe("pembersihan baris kedaluwarsa", () => {
  it("hanya menghapus baris lama yang tidak sedang memblokir", async () => {
    // Waktu palsu jauh di masa lalu, supaya hanya baris milik tes ini yang memenuhi syarat, bukan data tes lain.
    const lama = new Date("2019-12-25T10:00:00Z");
    const sekarang = new Date("2020-01-02T10:00:00Z");
    const usang = aturanBaru();
    const masihDiblokir = aturanBaru({ batas: 1, blokirMenit: 60 * 24 * 30 });
    const segar = aturanBaru();

    await ambilJatah(usang, lama);
    await ambilJatah(masihDiblokir, lama);
    await ambilJatah(masihDiblokir, new Date(lama.getTime() + 1000));
    await ambilJatah(segar, new Date("2020-01-02T09:00:00Z"));

    expect(await bersihkanKedaluwarsa(sekarang)).toBeGreaterThanOrEqual(1);

    const sisa = await prisma().percobaanPublik.findMany({ where: { kunci: { in: [usang.kunci, masihDiblokir.kunci, segar.kunci] } } });
    expect(sisa.map((b) => b.kunci).sort()).toEqual([masihDiblokir.kunci, segar.kunci].sort());
  });
});

describe("batas pendaftaran akun", () => {
  it("lima pendaftaran dari satu perangkat lolos dan yang keenam ditolak dengan pesan yang menyebut menit", async () => {
    const perangkat = `uji-${randomUUID()}`;
    kunciDipakai.push(...aturanBatasDaftar(perangkat, null).map((a) => a.kunci));
    const t0 = new Date("2026-01-01T10:00:00Z");
    for (let i = 1; i <= 5; i++) {
      await expect(batasiPendaftaran(perangkat, null, new Date(t0.getTime() + i * 1000))).resolves.toBeUndefined();
    }
    const galat = await batasiPendaftaran(perangkat, null, new Date(t0.getTime() + 6000)).catch((e: unknown) => e as { status: number; message: string });
    expect(galat).toMatchObject({ status: 429 });
    expect((galat as { message: string }).message).toMatch(/Coba lagi dalam \d+ menit/);
  });

  it("perangkat lain tidak ikut terblokir", async () => {
    const a = `uji-${randomUUID()}`;
    const b = `uji-${randomUUID()}`;
    kunciDipakai.push(...aturanBatasDaftar(a, null).map((x) => x.kunci), ...aturanBatasDaftar(b, null).map((x) => x.kunci));
    const t0 = new Date("2026-01-01T10:00:00Z");
    for (let i = 1; i <= 6; i++) await batasiPendaftaran(a, null, new Date(t0.getTime() + i * 1000)).catch(() => undefined);
    await expect(batasiPendaftaran(b, null, new Date(t0.getTime() + 7000))).resolves.toBeUndefined();
  });

  it("IP tepercaya yang sama tetap dibatasi walau perangkat terus berganti", async () => {
    const ip = `203.0.113.${Math.floor(Math.random() * 200) + 1}`;
    const perangkat = Array.from({ length: 12 }, () => `uji-${randomUUID()}`);
    for (const p of perangkat) kunciDipakai.push(...aturanBatasDaftar(p, ip).map((x) => x.kunci));
    const t0 = new Date("2026-01-01T10:00:00Z");
    let ditolak = 0;
    for (const [i, p] of perangkat.entries()) {
      await batasiPendaftaran(p, ip, new Date(t0.getTime() + i * 1000)).catch(() => ditolak++);
    }
    expect(ditolak).toBe(2);
  });
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
