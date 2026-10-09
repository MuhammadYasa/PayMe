import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { periksaIsiXlsx, periksaNamaDanUkuran } from "@/server/excel/berkas";
import { AppError } from "@/server/errors";
import { buatFixtureAbsensi, karyawanSintetis } from "../support/fixture-absensi";

function galatDari(fn: () => void): AppError {
  try {
    fn();
  } catch (e) {
    return e as AppError;
  }
  throw new Error("Seharusnya melempar galat");
}

describe("periksaNamaDanUkuran (FR-04)", () => {
  it("menerima .xlsx pada berbagai penulisan huruf", () => {
    expect(() => periksaNamaDanUkuran("absen.xlsx", 1000)).not.toThrow();
    expect(() => periksaNamaDanUkuran("ABSEN.XLSX", 1000)).not.toThrow();
    expect(() => periksaNamaDanUkuran("absen.mei.2026.xlsx", 1000)).not.toThrow();
  });

  it("menolak .xls dan .csv dengan pesan format yang diterima", () => {
    for (const nama of ["absen.xls", "absen.csv", "absen.xlsm", "absen.pdf", "absen", "absen."]) {
      const galat = galatDari(() => periksaNamaDanUkuran(nama, 1000));
      expect(galat.status).toBe(422);
      expect(galat.kode).toBe("FORMAT_TIDAK_DIDUKUNG");
      expect(galat.message).toContain(".xlsx");
    }
  });

  it("menolak file lebih dari 5 MB sebelum diproses, dan menerima tepat 5 MB", () => {
    const lima = 5 * 1024 * 1024;
    expect(() => periksaNamaDanUkuran("a.xlsx", lima)).not.toThrow();
    const galat = galatDari(() => periksaNamaDanUkuran("a.xlsx", lima + 1));
    expect(galat.status).toBe(413);
    expect(galat.kode).toBe("FILE_TERLALU_BESAR");
    expect(galat.message).toContain("5 MB");
  });

  it("menolak file kosong", () => {
    expect(galatDari(() => periksaNamaDanUkuran("a.xlsx", 0)).kode).toBe("FILE_KOSONG");
  });
});

describe("periksaIsiXlsx", () => {
  it("menerima berkas .xlsx asli", async () => {
    const isi = await buatFixtureAbsensi({ awal: "2026-08-24", akhir: "2026-09-23", karyawan: karyawanSintetis(2) });
    expect(() => periksaIsiXlsx(isi)).not.toThrow();
  });

  it("menolak berkas yang bukan ZIP walau namanya .xlsx", () => {
    const teks = Buffer.from("Nama,Tanggal\nBudi,24/08/2026\n".repeat(10));
    expect(galatDari(() => periksaIsiXlsx(teks)).kode).toBe("FILE_RUSAK");
  });

  it("menolak ZIP yang terpotong", async () => {
    const isi = await buatFixtureAbsensi({ awal: "2026-08-24", akhir: "2026-09-23", karyawan: karyawanSintetis(1) });
    expect(galatDari(() => periksaIsiXlsx(isi.subarray(0, Math.floor(isi.length / 2)))).kode).toBe("FILE_RUSAK");
  });

  it("menolak ZIP yang mengaku berisi data sangat besar (zip bomb)", () => {
    const lfh = Buffer.alloc(30);
    lfh.writeUInt32LE(0x04034b50, 0);
    const cdh = Buffer.alloc(46);
    cdh.writeUInt32LE(0x02014b50, 0);
    cdh.writeUInt32LE(200 * 1024 * 1024, 24);
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(1, 8);
    eocd.writeUInt16LE(1, 10);
    eocd.writeUInt32LE(46, 12);
    eocd.writeUInt32LE(30, 16);
    const galat = galatDari(() => periksaIsiXlsx(Buffer.concat([lfh, cdh, eocd])));
    expect(galat.kode).toBe("FILE_TERLALU_BESAR");
  });

  /** ZIP satu entri deflate dengan ukuran terurai yang sengaja ditulis salah di direktori pusat. */
  function zipDenganUkuranPalsu(termampat: Buffer, ukuranDiklaim: number): Buffer {
    const nama = Buffer.from("xl/media/x.png");
    const lfh = Buffer.alloc(30);
    lfh.writeUInt32LE(0x04034b50, 0);
    lfh.writeUInt16LE(8, 8);
    lfh.writeUInt32LE(termampat.length, 18);
    lfh.writeUInt32LE(ukuranDiklaim, 22);
    lfh.writeUInt16LE(nama.length, 26);
    const cdh = Buffer.alloc(46);
    cdh.writeUInt32LE(0x02014b50, 0);
    cdh.writeUInt16LE(8, 10);
    cdh.writeUInt32LE(termampat.length, 20);
    cdh.writeUInt32LE(ukuranDiklaim, 24);
    cdh.writeUInt16LE(nama.length, 28);
    cdh.writeUInt32LE(0, 42);
    const awalDirektori = lfh.length + nama.length + termampat.length;
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(1, 8);
    eocd.writeUInt16LE(1, 10);
    eocd.writeUInt32LE(cdh.length + nama.length, 12);
    eocd.writeUInt32LE(awalDirektori, 16);
    return Buffer.concat([lfh, nama, termampat, cdh, nama, eocd]);
  }

  it("menolak zip bomb yang memalsukan ukuran terurai di header", () => {
    // 80 MB nol hanya termampat menjadi puluhan KB. Header mengaku 177 byte, sehingga pemeriksaan header saja lolos.
    const termampat = deflateRawSync(Buffer.alloc(80 * 1024 * 1024));
    expect(termampat.length).toBeLessThan(1024 * 1024);
    const galat = galatDari(() => periksaIsiXlsx(zipDenganUkuranPalsu(termampat, 177)));
    expect(galat.kode).toBe("FILE_TERLALU_BESAR");
  });

  it("menerima entri kecil yang ukurannya jujur", () => {
    const termampat = deflateRawSync(Buffer.from("<xml>isi kecil</xml>"));
    expect(() => periksaIsiXlsx(zipDenganUkuranPalsu(termampat, 20))).not.toThrow();
  });

  it("menolak data termampat yang rusak walau direktorinya tampak wajar", () => {
    const rusak = Buffer.from([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);
    expect(galatDari(() => periksaIsiXlsx(zipDenganUkuranPalsu(rusak, 100))).kode).toBe("FILE_RUSAK");
  });

  it("menolak ZIP dengan terlalu banyak entri", () => {
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(5000, 10);
    eocd.writeUInt32LE(30, 16);
    const lfh = Buffer.alloc(30);
    lfh.writeUInt32LE(0x04034b50, 0);
    expect(galatDari(() => periksaIsiXlsx(Buffer.concat([lfh, eocd]))).kode).toBe("FILE_RUSAK");
  });
});
