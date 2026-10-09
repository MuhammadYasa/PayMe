import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { hitungGaji } from "@/domain/gaji";
import { PENGATURAN_BAWAAN } from "@/domain/pengaturan";
import { prisma } from "@/server/db/client";
import { keDate } from "@/server/db/tanggal";
import { AppError } from "@/server/errors";
import { PESAN_TERLALU_BANYAK, PESAN_TIDAK_DITEMUKAN, lihatGajiKaryawan } from "@/server/services/publik";
import { lihatGajiSkema } from "@/skema/penghasilan";
import { karyawanUji } from "../support/data";
import { buatPerusahaanUji, hapusPerusahaan } from "../support/db";

type Perusahaan = Awaited<ReturnType<typeof buatPerusahaanUji>>;

const T0 = new Date("2026-01-01T10:00:00Z");
const menit = (n: number) => new Date(T0.getTime() + n * 60_000);

let p: Perusahaan;
let budi: string;
let periodeFinal: string;

function simpanHasil(karyawanId: string, nama: string, totalAwal = 4_000_000) {
  const rincian = hitungGaji({
    karyawan: { id: karyawanId, namaLengkap: nama, jabatan: "Staf", cabang: "Surabaya", nomorRekening: "0012345678", gajiPokok: totalAwal, tunjangan: 500_000 },
    absensi: { hariKerja: 26, hadir: 24, izin: 0, sakit: 0, cuti: 2, lainnya: 0, totalLibur: 5 },
    aturanPotongan: PENGATURAN_BAWAAN.aturanPotongan,
    insentif: [{ jenis: "Pengiriman", nominal: 200_000 }],
    bonusTarget: null,
    denda: [{ dendaId: randomUUID(), alasan: "Kerusakan barang", nominal: 100_000 }],
    pajak: 0,
    asuransi: 150_000,
  });
  return rincian;
}

beforeAll(async () => {
  p = await buatPerusahaanUji("CV Slip Gaji");
  budi = (await karyawanUji(p.db, "Budi Santoso", { nomorRekening: "0012345678" })).id;
  const periode = await p.db.periode.create({
    data: { perusahaanId: p.perusahaanId, tanggalAwal: keDate("2025-03-01"), tanggalAkhir: keDate("2025-03-31"), status: "FINAL", difinalkanPada: new Date() },
  });
  periodeFinal = periode.id;
  const r = simpanHasil(budi, "Budi Santoso");
  await p.db.hasilGaji.create({ data: { perusahaanId: p.perusahaanId, periodeId: periode.id, karyawanId: budi, rincian: JSON.parse(JSON.stringify(r)), totalBersih: r.totalBersih } });
});

afterAll(async () => {
  await hapusPerusahaan(p.perusahaanId);
});

beforeEach(async () => {
  await prisma().percobaanPublik.deleteMany({});
});

afterEach(() => vi.restoreAllMocks());

const cari = (ubah: Record<string, unknown> = {}, opsi: { sekarang?: Date; waktuMinimumMs?: number } = {}) =>
  lihatGajiKaryawan(
    { nama: "Budi Santoso", rekening: "0012345678", ip: null, perangkat: randomUUID(), ...ubah },
    { waktuMinimumMs: 0, sekarang: T0, ...opsi },
  );

describe("halaman karyawan (FR-19)", () => {
  it("nama dan rekening yang cocok menampilkan rincian periode final terbaru", async () => {
    const hasil = await cari();
    expect(hasil).toMatchObject({ nama: "Budi Santoso", jabatan: "Staf", perusahaan: "CV Slip Gaji", rekeningSamar: "••••5678" });
    expect(hasil.periode).toHaveLength(1);
    expect(hasil.periode[0]).toMatchObject({ label: "1 Mar 2025 sampai 31 Mar 2025" });
    expect(hasil.periode[0].rincian).toMatchObject({
      gajiPokok: 4_000_000,
      tunjangan: 500_000,
      totalPendapatan: 4_700_000,
      totalPotongan: 250_000,
      totalBersih: 4_450_000,
      absensi: { cuti: 2 },
      denda: { total: 100_000, rinci: [{ alasan: "Kerusakan barang", nominal: 100_000 }] },
    });
  });

  it("nama tidak peka huruf besar-kecil dan spasi dirapikan", async () => {
    await expect(cari({ nama: "  BUDI    santoso " })).resolves.toMatchObject({ nama: "Budi Santoso" });
    await expect(cari({ rekening: " 0012 3456 78 " })).resolves.toMatchObject({ nama: "Budi Santoso" });
  });

  it("hasil tidak memuat nomor rekening utuh, ID internal, atau ID perusahaan", async () => {
    const teks = JSON.stringify(await cari());
    expect(teks).not.toContain("0012345678");
    expect(teks).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);
    expect(teks).not.toContain("perusahaanId");
    expect(teks).not.toContain("karyawanId");
  });

  it("nama benar dengan rekening salah memberi pesan yang sama persis dengan nama salah rekening benar", async () => {
    const rekeningSalah = (await cari({ rekening: "9999999999" }).catch((e) => e)) as AppError;
    const namaSalah = (await cari({ nama: "Budi Santosa" }).catch((e) => e)) as AppError;
    expect(rekeningSalah).toBeInstanceOf(AppError);
    expect(rekeningSalah.message).toBe(PESAN_TIDAK_DITEMUKAN);
    expect(namaSalah.message).toBe(rekeningSalah.message);
    expect(namaSalah.status).toBe(rekeningSalah.status);
    expect(namaSalah.kode).toBe(rekeningSalah.kode);
    expect(PESAN_TIDAK_DITEMUKAN).toBe("Data tidak ditemukan. Periksa kembali nama dan nomor rekening Anda.");
  });

  it('lima kali gagal berturut-turut: percobaan ke-6 ditolak "Terlalu banyak percobaan. Coba lagi dalam 15 menit." walau input benar', async () => {
    const perangkat = randomUUID();
    for (let i = 0; i < 5; i++) {
      await expect(cari({ perangkat, rekening: `11111111${i}0` }, { sekarang: menit(i) })).rejects.toMatchObject({ status: 404 });
    }
    const keenam = (await cari({ perangkat }, { sekarang: menit(6) }).catch((e) => e)) as AppError;
    expect(keenam).toMatchObject({ status: 429, message: "Terlalu banyak percobaan. Coba lagi dalam 15 menit." });
    expect(PESAN_TERLALU_BANYAK).toBe("Terlalu banyak percobaan. Coba lagi dalam 15 menit.");
    expect((keenam.data as { sisaDetik: number }).sisaDetik).toBeGreaterThan(0);

    // Setelah blokir berakhir, input benar diterima kembali.
    await expect(cari({ perangkat }, { sekarang: menit(30) })).resolves.toMatchObject({ nama: "Budi Santoso" });
  });

  it("keberhasilan mengembalikan hitungan sehingga yang dihitung benar-benar kegagalan berturut-turut", async () => {
    const perangkat = randomUUID();
    for (let i = 0; i < 4; i++) await cari({ perangkat, rekening: `22222222${i}0` }).catch(() => undefined);
    await expect(cari({ perangkat })).resolves.toBeDefined();
    for (let i = 0; i < 4; i++) {
      await expect(cari({ perangkat, rekening: `33333333${i}0` })).rejects.toMatchObject({ status: 404 });
    }
    await expect(cari({ perangkat })).resolves.toBeDefined();
  });

  it("perangkat berbeda tidak ikut terblokir, tetapi IP yang sama tetap dibatasi walau perangkat terus berganti", async () => {
    const perangkat = randomUUID();
    for (let i = 0; i < 6; i++) await cari({ perangkat, rekening: `44444444${i}0` }).catch(() => undefined);
    await expect(cari({ perangkat })).rejects.toMatchObject({ status: 429 });
    await expect(cari({ perangkat: randomUUID() })).resolves.toBeDefined();

    const ip = "203.0.113.7";
    for (let i = 0; i < 5; i++) await cari({ ip, perangkat: randomUUID(), rekening: `55555555${i}0` }).catch(() => undefined);
    await expect(cari({ ip, perangkat: randomUUID() })).rejects.toMatchObject({ status: 429 });
    await expect(cari({ ip: "203.0.113.8", perangkat: randomUUID() })).resolves.toBeDefined();
  });

  it("percobaan paralel tidak dapat melewati batas: hanya lima tebakan yang pernah diuji", async () => {
    const perangkat = randomUUID();
    const hasil = await Promise.allSettled(Array.from({ length: 30 }, (_, i) => cari({ perangkat, rekening: `66666666${String(i).padStart(2, "0")}` })));
    const ditolak = hasil.filter((h) => h.status === "rejected" && (h.reason as AppError).status === 429);
    const tidakCocok = hasil.filter((h) => h.status === "rejected" && (h.reason as AppError).status === 404);
    expect(tidakCocok).toHaveLength(5);
    expect(ditolak).toHaveLength(25);
  });

  it("hanya periode final yang tampil: periode berstatus draf tidak muncul walau punya data", async () => {
    await p.db.periode.update({ where: { id: periodeFinal }, data: { status: "DRAF" } });
    try {
      expect((await cari()).periode).toEqual([]);
    } finally {
      await p.db.periode.update({ where: { id: periodeFinal }, data: { status: "FINAL" } });
    }
  });

  it("karyawan nonaktif tetap dapat melihat riwayatnya", async () => {
    await p.db.karyawan.update({ where: { id: budi }, data: { statusAktif: false } });
    try {
      expect((await cari()).periode).toHaveLength(1);
    } finally {
      await p.db.karyawan.update({ where: { id: budi }, data: { statusAktif: true } });
    }
  });

  it("nama dengan gelar harus cocok persis sebagaimana tersimpan", async () => {
    await expect(cari({ nama: "Dr Budi Santoso" })).rejects.toMatchObject({ status: 404 });
  });

  it("nama dan rekening sama di dua perusahaan ditolak dengan pesan generik dan dicatat tanpa rekening utuh", async () => {
    const lain = await buatPerusahaanUji("CV Kembar");
    try {
      await karyawanUji(lain.db, "Budi Santoso", { nomorRekening: "0012345678" });
      const galat = (await cari().catch((e) => e)) as AppError;
      expect(galat.message).toBe(PESAN_TIDAK_DITEMUKAN);
      const catatan = await prisma().catatanTinjauan.findFirstOrThrow({ where: { jenis: "NAMA_REKENING_GANDA_LINTAS_PERUSAHAAN" }, orderBy: { dibuatPada: "desc" } });
      expect(JSON.stringify(catatan.detail)).not.toContain("0012345678");
      expect(catatan.detail).toMatchObject({ jumlah: 2, rekening: "••••5678" });
    } finally {
      await hapusPerusahaan(lain.perusahaanId);
    }
  });

  it("log kegagalan tidak memuat nomor rekening utuh (T-038)", async () => {
    const keluaran: string[] = [];
    vi.spyOn(console, "warn").mockImplementation((baris: string) => void keluaran.push(String(baris)));
    vi.spyOn(console, "log").mockImplementation((baris: string) => void keluaran.push(String(baris)));
    await cari({ rekening: "7777777777" }).catch(() => undefined);
    expect(keluaran.length).toBeGreaterThan(0);
    expect(keluaran.join("\n")).not.toContain("7777777777");
    expect(keluaran.join("\n")).toContain("••••7777");
  });

  it("waktu respons seragam untuk kegagalan dan keberhasilan", async () => {
    const ukur = async (fn: () => Promise<unknown>) => {
      const mulai = performance.now();
      await fn().catch(() => undefined);
      return performance.now() - mulai;
    };
    const berhasil = await ukur(() => cari({}, { waktuMinimumMs: 150 }));
    const gagal = await ukur(() => cari({ rekening: "8888888888" }, { waktuMinimumMs: 150 }));
    expect(berhasil).toBeGreaterThanOrEqual(145);
    expect(gagal).toBeGreaterThanOrEqual(145);
    expect(Math.abs(berhasil - gagal)).toBeLessThan(120);
  });
});

describe("validasi masukan halaman karyawan", () => {
  it("isian kosong ditolak dengan pesan yang tidak menyebut kolom mana yang salah", () => {
    const hasil = lihatGajiSkema.safeParse({ nama: "", rekening: "" });
    expect(hasil.success).toBe(false);
    if (!hasil.success) expect(new Set(hasil.error.issues.map((i) => i.message))).toEqual(new Set(["Isi nama lengkap dan nomor rekening Anda."]));
  });
});
