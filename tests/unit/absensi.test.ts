import { describe, expect, it } from "vitest";
import {
  type CatatanHarian,
  HARI_KERJA_BAWAAN,
  perluasRentang,
  ringkasAbsensi,
} from "@/domain/absensi";
import { rentangTanggal, type TanggalISO } from "@/domain/tanggal";

/** Semua tanggal berstatus HADIR, kecuali libur yang diberikan. Minggu tidak perlu catatan. */
function hadirKecuali(awal: TanggalISO, akhir: TanggalISO, libur: TanggalISO[] = []): CatatanHarian[] {
  return rentangTanggal(awal, akhir).map((tanggal) => ({
    tanggal,
    status: libur.includes(tanggal) ? "LIBUR" : "HADIR",
  }));
}

describe("ringkasAbsensi: hari kerja (FR-06) pada 20 kasus acuan", () => {
  // Angka "hariKerja" dihitung manual dari kalender, tidak dari keluaran kode.
  const kasus: {
    nama: string;
    awal: TanggalISO;
    akhir: TanggalISO;
    hariKerjaMingguan?: number[];
    libur?: TanggalISO[];
    hariKerja: number;
  }[] = [
    { nama: "April 2025, Minggu libur (4 Minggu)", awal: "2025-04-01", akhir: "2025-04-30", hariKerja: 26 },
    { nama: "Februari 2025", awal: "2025-02-01", akhir: "2025-02-28", hariKerja: 24 },
    { nama: "Februari 2024 kabisat", awal: "2024-02-01", akhir: "2024-02-29", hariKerja: 25 },
    { nama: "26 Jan sampai 25 Feb 2025", awal: "2025-01-26", akhir: "2025-02-25", hariKerja: 26 },
    { nama: "26 Des 2025 sampai 25 Jan 2026", awal: "2025-12-26", akhir: "2026-01-25", hariKerja: 26 },
    { nama: "periode contoh mesin finger", awal: "2026-08-24", akhir: "2026-09-23", hariKerja: 27 },
    { nama: "tanggal merah jatuh pada Minggu tidak dihitung dua kali", awal: "2025-04-01", akhir: "2025-04-30", libur: ["2025-04-06"], hariKerja: 26 },
    { nama: "dua tanggal merah hari kerja", awal: "2025-04-01", akhir: "2025-04-30", libur: ["2025-04-17", "2025-04-18"], hariKerja: 24 },
    { nama: "Senin sampai Jumat", awal: "2025-04-01", akhir: "2025-04-30", hariKerjaMingguan: [1, 2, 3, 4, 5], hariKerja: 22 },
    { nama: "Maret 2025", awal: "2025-03-01", akhir: "2025-03-31", hariKerja: 26 },
    { nama: "Maret 2025 Senin sampai Jumat", awal: "2025-03-01", akhir: "2025-03-31", hariKerjaMingguan: [1, 2, 3, 4, 5], hariKerja: 21 },
    { nama: "Februari 2024 Senin sampai Jumat", awal: "2024-02-01", akhir: "2024-02-29", hariKerjaMingguan: [1, 2, 3, 4, 5], hariKerja: 21 },
    { nama: "periode 28 hari mulai 31 Januari", awal: "2025-01-31", akhir: "2025-02-27", hariKerja: 24 },
    { nama: "tujuh hari kerja", awal: "2025-04-01", akhir: "2025-04-30", hariKerjaMingguan: [0, 1, 2, 3, 4, 5, 6], hariKerja: 30 },
    { nama: "hanya Senin, Rabu, Jumat", awal: "2025-04-01", akhir: "2025-04-30", hariKerjaMingguan: [1, 3, 5], hariKerja: 13 },
    { nama: "tiga hari libur berturut-turut", awal: "2025-04-01", akhir: "2025-04-30", libur: ["2025-04-01", "2025-04-02", "2025-04-03"], hariKerja: 23 },
    { nama: "libur individual pada dua hari Minggu", awal: "2025-04-01", akhir: "2025-04-30", libur: ["2025-04-13", "2025-04-20"], hariKerja: 26 },
    { nama: "libur Minggu dan Senin berurutan", awal: "2025-04-01", akhir: "2025-04-30", libur: ["2025-04-13", "2025-04-14"], hariKerja: 25 },
    { nama: "Februari 2026", awal: "2026-02-01", akhir: "2026-02-28", hariKerja: 24 },
    { nama: "Mei 2025", awal: "2025-05-01", akhir: "2025-05-31", hariKerja: 27 },
  ];

  it("berisi tepat 20 kasus", () => {
    expect(kasus).toHaveLength(20);
  });

  for (const k of kasus) {
    it(`${k.nama}: hari kerja ${k.hariKerja}`, () => {
      const hasil = ringkasAbsensi({
        tanggalAwal: k.awal,
        tanggalAkhir: k.akhir,
        catatan: hadirKecuali(k.awal, k.akhir, k.libur),
        hariKerjaMingguan: k.hariKerjaMingguan ?? HARI_KERJA_BAWAAN,
      });
      expect(hasil.hariKerja).toBe(k.hariKerja);
      expect(hasil.hadir).toBe(k.hariKerja);
      expect(hasil.jumlahKosong).toBe(0);
      expect(hasil.hariKerja + hasil.totalLibur).toBe(hasil.jumlahHariPeriode);
    });
  }
});

describe("ringkasAbsensi: status dan tanggal kosong", () => {
  const periode = { tanggalAwal: "2025-04-01", tanggalAkhir: "2025-04-30" };

  it("hari hadir = hari kerja - sakit - izin - cuti - lainnya", () => {
    const catatan = hadirKecuali(periode.tanggalAwal, periode.tanggalAkhir).map((c) => {
      if (c.tanggal === "2025-04-09" || c.tanggal === "2025-04-10") return { ...c, status: "SAKIT" as const };
      if (c.tanggal === "2025-04-14") return { ...c, status: "IZIN" as const };
      if (c.tanggal === "2025-04-15") return { ...c, status: "CUTI" as const };
      if (c.tanggal === "2025-04-16") return { ...c, status: "LAINNYA" as const };
      return c;
    });
    const hasil = ringkasAbsensi({ ...periode, catatan, hariKerjaMingguan: HARI_KERJA_BAWAAN });
    expect(hasil).toMatchObject({ hariKerja: 26, sakit: 2, izin: 1, cuti: 1, lainnya: 1, hadir: 21, jumlahKosong: 0 });
  });

  it("menandai tanggal tanpa data sebagai kosong dan melaporkan jumlahnya", () => {
    const tanpa = new Set(["2025-04-02", "2025-04-03", "2025-04-04"]);
    const catatan = hadirKecuali(periode.tanggalAwal, periode.tanggalAkhir).filter((c) => !tanpa.has(c.tanggal));
    const hasil = ringkasAbsensi({ ...periode, catatan, hariKerjaMingguan: HARI_KERJA_BAWAAN });
    expect(hasil.tanggalKosong).toEqual(["2025-04-02", "2025-04-03", "2025-04-04"]);
    expect(hasil.jumlahKosong).toBe(3);
    expect(hasil.hariKerja).toBe(26);
  });

  it("hari Minggu tanpa catatan tidak dianggap kosong", () => {
    const hasil = ringkasAbsensi({ ...periode, catatan: [], hariKerjaMingguan: HARI_KERJA_BAWAAN });
    expect(hasil.jumlahKosong).toBe(26);
    expect(hasil.tanggalKosong).not.toContain("2025-04-06");
    expect(hasil.liburMingguan).toBe(4);
  });

  it("tanggal libur yang dihapus kembali menjadi kosong", () => {
    const dengan = [{ tanggal: "2025-04-17", status: "LIBUR" as const }];
    expect(ringkasAbsensi({ ...periode, catatan: dengan, hariKerjaMingguan: HARI_KERJA_BAWAAN }).tanggalKosong).not.toContain("2025-04-17");
    expect(ringkasAbsensi({ ...periode, catatan: [], hariKerjaMingguan: HARI_KERJA_BAWAAN }).tanggalKosong).toContain("2025-04-17");
  });

  it("mengabaikan catatan di luar periode dan status pada hari libur mingguan", () => {
    const catatan: CatatanHarian[] = [
      { tanggal: "2025-03-31", status: "SAKIT" },
      { tanggal: "2025-05-01", status: "IZIN" },
      { tanggal: "2025-04-06", status: "HADIR" },
    ];
    const hasil = ringkasAbsensi({ ...periode, catatan, hariKerjaMingguan: HARI_KERJA_BAWAAN });
    expect(hasil.sakit + hasil.izin + hasil.hadir).toBe(0);
  });

  it("memakai catatan terakhir bila ada dua catatan pada tanggal yang sama", () => {
    const catatan: CatatanHarian[] = [
      { tanggal: "2025-04-02", status: "HADIR" },
      { tanggal: "2025-04-02", status: "SAKIT" },
    ];
    const hasil = ringkasAbsensi({ ...periode, catatan, hariKerjaMingguan: HARI_KERJA_BAWAAN });
    expect(hasil.sakit).toBe(1);
    expect(hasil.hadir).toBe(0);
  });
});

describe("perluasRentang (FR-08, FR-09)", () => {
  const periode = { tanggalAwal: "2025-04-01", tanggalAkhir: "2025-04-30" };
  const tanpaLibur = new Set<TanggalISO>();

  it("cuti 5 hari yang memuat 1 hari Minggu menghasilkan 4 hari", () => {
    const hasil = perluasRentang({
      dari: "2025-04-04",
      sampai: "2025-04-08",
      periode,
      hariKerjaMingguan: HARI_KERJA_BAWAAN,
      tanggalLibur: tanpaLibur,
    });
    expect(hasil.tanggal).toEqual(["2025-04-04", "2025-04-05", "2025-04-07", "2025-04-08"]);
    expect(hasil.dilewatiLibur).toEqual(["2025-04-06"]);
    expect(hasil.diLuarPeriode).toBe(0);
  });

  it("sakit 10 sampai 12 Maret menghasilkan 3 tanggal", () => {
    const hasil = perluasRentang({
      dari: "2025-03-10",
      sampai: "2025-03-12",
      periode: { tanggalAwal: "2025-03-01", tanggalAkhir: "2025-03-31" },
      hariKerjaMingguan: HARI_KERJA_BAWAAN,
      tanggalLibur: tanpaLibur,
    });
    expect(hasil.tanggal).toHaveLength(3);
  });

  it("memotong tanggal di luar periode dan melaporkan jumlahnya", () => {
    const hasil = perluasRentang({
      dari: "2025-04-28",
      sampai: "2025-05-03",
      periode,
      hariKerjaMingguan: HARI_KERJA_BAWAAN,
      tanggalLibur: tanpaLibur,
    });
    expect(hasil.tanggal).toEqual(["2025-04-28", "2025-04-29", "2025-04-30"]);
    expect(hasil.diLuarPeriode).toBe(3);
  });

  it("melewati tanggal merah yang sudah ditandai libur", () => {
    const hasil = perluasRentang({
      dari: "2025-04-07",
      sampai: "2025-04-09",
      periode,
      hariKerjaMingguan: HARI_KERJA_BAWAAN,
      tanggalLibur: new Set(["2025-04-08"]),
    });
    expect(hasil.tanggal).toEqual(["2025-04-07", "2025-04-09"]);
    expect(hasil.dilewatiLibur).toEqual(["2025-04-08"]);
  });

  it("rentang satu hari pada libur mingguan tidak menghasilkan tanggal", () => {
    const hasil = perluasRentang({
      dari: "2025-04-06",
      sampai: "2025-04-06",
      periode,
      hariKerjaMingguan: HARI_KERJA_BAWAAN,
      tanggalLibur: tanpaLibur,
    });
    expect(hasil.tanggal).toEqual([]);
  });
});
