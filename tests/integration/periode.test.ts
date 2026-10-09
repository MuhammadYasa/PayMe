import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buatPeriodeSkema } from "@/skema/periode";
import { AppError } from "@/server/errors";
import { buatPeriode, daftarPeriode, hapusPeriodeDraf, muatPeriode, muatPeriodeDraf } from "@/server/services/periode";
import { buatPerusahaanUji, hapusPerusahaan } from "../support/db";

type Perusahaan = Awaited<ReturnType<typeof buatPerusahaanUji>>;

describe("periode gaji (FR-03)", () => {
  let p: Perusahaan;
  let lain: Perusahaan;

  beforeAll(async () => {
    p = await buatPerusahaanUji("PT Periode");
    lain = await buatPerusahaanUji("PT Periode Lain");
  });
  afterAll(async () => {
    await hapusPerusahaan(p.perusahaanId);
    await hapusPerusahaan(lain.perusahaanId);
  });

  it("1 Februari 2024 menghasilkan tanggal akhir 29 Februari 2024 dan 29 hari", async () => {
    const periode = await buatPeriode(p.db, "2024-02-01");
    expect(periode).toMatchObject({ tanggalAwal: "2024-02-01", tanggalAkhir: "2024-02-29", jumlahHari: 29, status: "DRAF" });
  });

  it("1 Februari 2025 menghasilkan 28 hari", async () => {
    expect((await buatPeriode(p.db, "2025-02-01")).jumlahHari).toBe(28);
  });

  it("26 Desember berakhir 25 Januari tahun berikutnya", async () => {
    const periode = await buatPeriode(p.db, "2025-12-26");
    expect(periode.tanggalAkhir).toBe("2026-01-25");
  });

  it("mulai tanggal 31 Januari memakai akhir bulan yang dikoreksi", async () => {
    const periode = await buatPeriode(p.db, "2027-01-31");
    expect(periode.tanggalAkhir).toBe("2027-02-27");
  });

  it("periode yang tumpang tindih ditolak dengan pesan yang menyebut periode bentrok", async () => {
    await buatPeriode(p.db, "2025-04-01");
    const galat = await buatPeriode(p.db, "2025-04-20").catch((e) => e as AppError);
    expect(galat).toBeInstanceOf(AppError);
    expect((galat as AppError).status).toBe(409);
    expect((galat as AppError).kode).toBe("PERIODE_BENTROK");
    expect((galat as AppError).message).toContain("1 Apr 2025 sampai 30 Apr 2025");
  });

  it("periode final yang bersinggungan juga menolak periode baru yang tumpang tindih", async () => {
    const final = await buatPeriode(p.db, "2025-06-01");
    await p.db.periode.update({ where: { id: final.id }, data: { status: "FINAL", difinalkanPada: new Date() } });
    const galat = (await buatPeriode(p.db, "2025-06-30").catch((e) => e)) as AppError;
    expect(galat.kode).toBe("PERIODE_BENTROK");
    expect(galat.message).toContain("1 Jun 2025 sampai 30 Jun 2025");
  });

  it("periode berurutan tanpa tumpang tindih diterima", async () => {
    await buatPeriode(p.db, "2025-08-01");
    await expect(buatPeriode(p.db, "2025-09-01")).resolves.toBeDefined();
  });

  it("tanggal awal yang sama dengan draf yang ada menawarkan melanjutkan draf tersebut", async () => {
    const asli = await buatPeriode(p.db, "2025-10-05");
    const galat = (await buatPeriode(p.db, "2025-10-05").catch((e) => e)) as AppError;
    expect(galat.kode).toBe("PERIODE_SUDAH_ADA");
    expect(galat.data).toMatchObject({ periodeId: asli.id, status: "DRAF" });
  });

  it("dua permintaan serentak untuk periode bertabrakan hanya menghasilkan satu periode", async () => {
    const hasil = await Promise.allSettled([buatPeriode(p.db, "2026-03-01"), buatPeriode(p.db, "2026-03-10")]);
    expect(hasil.filter((h) => h.status === "fulfilled")).toHaveLength(1);
    const gagal = hasil.find((h) => h.status === "rejected") as PromiseRejectedResult;
    expect(gagal.reason).toBeInstanceOf(AppError);
    expect((gagal.reason as AppError).status).toBe(409);
  });

  it("perusahaan lain bebas memakai tanggal yang sama", async () => {
    await expect(buatPeriode(lain.db, "2025-04-01")).resolves.toBeDefined();
  });

  it("meminta periode perusahaan lain lewat ID menghasilkan 404", async () => {
    const milikP = await buatPeriode(p.db, "2028-01-01");
    await expect(muatPeriode(lain.db, milikP.id)).rejects.toMatchObject({ status: 404 });
  });

  it("riwayat menampilkan periode terbaru lebih dulu beserta statusnya", async () => {
    const daftar = await daftarPeriode(p.db);
    const awal = daftar.map((d) => d.tanggalAwal);
    expect(awal).toEqual([...awal].sort().reverse());
    expect(daftar.find((d) => d.tanggalAwal === "2025-06-01")?.status).toBe("FINAL");
  });

  it("periode final bersifat baca-saja bagi layanan yang meminta draf", async () => {
    const final = (await daftarPeriode(p.db)).find((d) => d.status === "FINAL")!;
    await expect(muatPeriodeDraf(p.db, final.id)).rejects.toMatchObject({ kode: "PERIODE_FINAL" });
    await expect(hapusPeriodeDraf(p.db, final.id)).rejects.toMatchObject({ kode: "PERIODE_FINAL" });
  });

  it("draf dapat dihapus", async () => {
    const draf = await buatPeriode(p.db, "2029-01-01");
    await hapusPeriodeDraf(p.db, draf.id);
    await expect(muatPeriode(p.db, draf.id)).rejects.toMatchObject({ status: 404 });
  });
});

describe("skema periode", () => {
  it("menolak tanggal yang tidak ada di kalender", () => {
    expect(buatPeriodeSkema.safeParse({ tanggalAwal: "2025-02-30" }).success).toBe(false);
    expect(buatPeriodeSkema.safeParse({ tanggalAwal: "26/01/2025" }).success).toBe(false);
    expect(buatPeriodeSkema.safeParse({}).success).toBe(false);
    expect(buatPeriodeSkema.safeParse({ tanggalAwal: "2025-01-26" }).success).toBe(true);
  });
});
