import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { keNomorHari } from "@/domain/tanggal";
import {
  bacaInfoBerkas,
  muatWorkbook,
  parseJamSel,
  parseTanggalSel,
  tebakPemetaan,
  uraiBaris,
} from "@/server/excel/baca-absensi";
import { AppError } from "@/server/errors";
import { HEADER_MESIN, type KaryawanFixture, buatFixtureAbsensi, karyawanSintetis } from "../support/fixture-absensi";

const PERIODE = { tanggalAwal: "2026-08-24", tanggalAkhir: "2026-09-23" };
const PEMETAAN = { nama: 3, tanggal: 4, jamMasuk: 8, jamPulang: 9 };

const KARYAWAN: KaryawanFixture[] = [
  { nama: "Dimas.Pratama", cabang: "Bandung" },
  { nama: "Wahyu Santika", cabang: "Bandung" },
  { nama: "Sari.Dewi", cabang: "Jakarta" },
];

async function muat(opsi: Partial<Parameters<typeof buatFixtureAbsensi>[0]> = {}) {
  const isi = await buatFixtureAbsensi({ awal: PERIODE.tanggalAwal, akhir: PERIODE.tanggalAkhir, karyawan: KARYAWAN, ...opsi });
  return muatWorkbook(isi);
}

describe("tebakPemetaan", () => {
  it("memilih Scan Masuk dan Scan Pulang, bukan Jam Masuk dan Jam Pulang yang merupakan jadwal shift", () => {
    expect(tebakPemetaan(HEADER_MESIN)).toEqual(PEMETAAN);
  });

  it("mengenali header berbahasa Inggris dan singkatan", () => {
    expect(tebakPemetaan(["Employee Name", "Date", "Clock In", "Clock Out"])).toEqual({ nama: 1, tanggal: 2, jamMasuk: 3, jamPulang: 4 });
    expect(tebakPemetaan(["Nama", "Tgl", "Masuk", "Pulang"])).toEqual({ nama: 1, tanggal: 2, jamMasuk: 3, jamPulang: 4 });
  });

  it("memakai jadwal shift hanya bila tidak ada kolom scan", () => {
    expect(tebakPemetaan(["Nama", "Tanggal", "Jam Masuk", "Jam Pulang"])).toEqual({ nama: 1, tanggal: 2, jamMasuk: 3, jamPulang: 4 });
  });

  it("kolom jam boleh tidak ditemukan, tetapi nama dan tanggal wajib", () => {
    expect(tebakPemetaan(["Nama", "Tanggal"])).toEqual({ nama: 1, tanggal: 2, jamMasuk: null, jamPulang: null });
    expect(tebakPemetaan(["Kode", "Tanggal", "Scan Masuk"])).toBeNull();
    expect(tebakPemetaan([])).toBeNull();
  });

  it("satu kolom tidak dipakai untuk dua keperluan", () => {
    const hasil = tebakPemetaan(["Nama", "Tanggal", "Masuk"])!;
    const dipakai = [hasil.nama, hasil.tanggal, hasil.jamMasuk, hasil.jamPulang].filter((k) => k !== null);
    expect(new Set(dipakai).size).toBe(dipakai.length);
  });
});

describe("bacaInfoBerkas", () => {
  it("mengenali header, menebak pemetaan, dan menyarankan sheet gabungan saja agar data tidak ganda", async () => {
    const info = bacaInfoBerkas(await muat());
    expect(info.sheet.map((s) => s.nama)).toEqual(["Bandung", "Jakarta", "All Depo"]);
    const gabungan = info.sheet.find((s) => s.nama === "All Depo")!;
    expect(gabungan.barisHeader).toBe(1);
    expect(gabungan.tebakan).toEqual(PEMETAAN);
    expect(gabungan.jumlahBaris).toBe(3 * 31);
    expect(gabungan.contoh).toHaveLength(5);
    expect(info.disarankan).toEqual(["All Depo"]);
  });

  it("tanpa sheet gabungan, semua sheet cabang disarankan", async () => {
    const info = bacaInfoBerkas(await muat({ sheetGabungan: false }));
    expect(info.disarankan).toEqual(["Bandung", "Jakarta"]);
  });

  it("mendeteksi header yang bukan di baris pertama", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Laporan");
    ws.addRow(["LAPORAN ABSENSI AGUSTUS"]);
    ws.addRow([]);
    ws.addRow(["Dicetak oleh mesin"]);
    ws.addRow(HEADER_MESIN);
    ws.addRow(["1", "4001", "Budi.Santoso", "24/08/2026", "SENIN-JUMAT_STAFF", "08.00", "16.00", "06.58", "16.13", "08.00", ""]);
    const muatLagi = await muatWorkbook(Buffer.from(await wb.xlsx.writeBuffer()));

    const info = bacaInfoBerkas(muatLagi);
    expect(info.sheet[0].barisHeader).toBe(4);
    expect(info.sheet[0].tebakan).toEqual(PEMETAAN);

    const hasil = uraiBaris(muatLagi, ["Laporan"], PEMETAAN, PERIODE);
    expect(hasil.baris).toHaveLength(1);
    expect(hasil.baris[0]).toMatchObject({ nama: "Budi.Santoso", tanggal: "2026-08-24", jamMasuk: "06:58", jamPulang: "16:13" });
  });

  it("sheet tanpa header yang dikenali tidak memiliki tebakan", async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet("Kosong").addRow(["a", "b", "c"]);
    const info = bacaInfoBerkas(await muatWorkbook(Buffer.from(await wb.xlsx.writeBuffer())));
    expect(info.sheet[0].tebakan).toBeNull();
    expect(info.disarankan).toEqual([]);
  });
});

describe("uraiBaris (FR-04)", () => {
  it("membaca seluruh baris sheet gabungan dan menandai baris tanpa scan", async () => {
    const hasil = uraiBaris(await muat(), ["All Depo"], PEMETAAN, PERIODE);
    expect(hasil.totalBaris).toBe(93);
    expect(hasil.baris).toHaveLength(93);
    expect(hasil.tidakValid).toEqual([]);
    expect(hasil.diLuarPeriode).toBe(0);
    // Empat hari Minggu (30 Agu, 6, 13, 20 Sep) untuk tiga karyawan tidak punya scan.
    expect(hasil.tanpaScan).toBe(12);
    expect(hasil.baris.filter((b) => b.adaScan)).toHaveLength(81);
  });

  it("menormalkan jam dari format HH.MM dan nama dari format Nama.Belakang", async () => {
    const hasil = uraiBaris(await muat(), ["All Depo"], PEMETAAN, PERIODE);
    const baris = hasil.baris.find((b) => b.kunci === "dimas pratama" && b.tanggal === "2026-08-24")!;
    expect(baris.nama).toBe("Dimas.Pratama");
    expect(baris.jamMasuk).toMatch(/^07:\d{2}$/);
    expect(baris.jamPulang).toMatch(/^16:\d{2}$/);
  });

  it('melaporkan jam yang tidak terbaca dengan nomor baris, dan tetap membaca baris lain ("Baris 4")', async () => {
    const wb = await muat({
      ubahBaris: (baris, info) => (info.nama === "Dimas.Pratama" && info.tanggal === "2026-08-26" ? baris.map((s, i) => (i === 7 ? "salah" : s)) : baris),
    });
    const hasil = uraiBaris(wb, ["All Depo"], PEMETAAN, PERIODE);
    expect(hasil.tidakValid).toEqual([{ sheet: "All Depo", baris: 4, alasan: "jam masuk tidak dapat dibaca" }]);
    expect(hasil.baris).toHaveLength(92);
  });

  it("melaporkan tanggal tidak terbaca dan nama kosong", async () => {
    const wb = await muat({
      ubahBaris: (baris, info) => {
        if (info.nama === "Sari.Dewi" && info.tanggal === "2026-08-25") return baris.map((s, i) => (i === 3 ? "31/02/2026" : s));
        if (info.nama === "Sari.Dewi" && info.tanggal === "2026-08-26") return baris.map((s, i) => (i === 2 ? "" : s));
        return baris;
      },
    });
    const hasil = uraiBaris(wb, ["All Depo"], PEMETAAN, PERIODE);
    expect(hasil.tidakValid.map((b) => b.alasan).sort()).toEqual(["nama karyawan kosong", "tanggal tidak dapat dibaca"]);
    expect(hasil.baris).toHaveLength(91);
  });

  it("mengabaikan tanggal di luar periode dan melaporkan jumlahnya", async () => {
    const wb = await muat({ awal: "2026-08-20", akhir: "2026-09-27" });
    const hasil = uraiBaris(wb, ["All Depo"], PEMETAAN, PERIODE);
    // 4 hari sebelum dan 4 hari sesudah periode, untuk 3 karyawan.
    expect(hasil.diLuarPeriode).toBe(24);
    expect(hasil.baris).toHaveLength(93);
  });

  it("membaca jam masuk saja atau jam pulang saja (hanya satu kali scan)", async () => {
    const wb = await muat({
      karyawan: [
        {
          nama: "Satu.Scan",
          cabang: "Bandung",
          pola: (tanggal, dow) => (dow === 0 ? "kosong" : tanggal === "2026-08-25" ? "hanyaMasuk" : tanggal === "2026-08-26" ? "hanyaPulang" : "penuh"),
        },
      ],
    });
    const hasil = uraiBaris(wb, ["All Depo"], PEMETAAN, PERIODE);
    const masukSaja = hasil.baris.find((b) => b.tanggal === "2026-08-25")!;
    const pulangSaja = hasil.baris.find((b) => b.tanggal === "2026-08-26")!;
    expect(masukSaja).toMatchObject({ jamPulang: null, adaScan: true });
    expect(masukSaja.jamMasuk).not.toBeNull();
    expect(pulangSaja).toMatchObject({ jamMasuk: null, adaScan: true });
    expect(pulangSaja.jamPulang).not.toBeNull();
  });

  it("memilih sheet cabang sekaligus sheet gabungan tidak menggandakan data", async () => {
    const hasil = uraiBaris(await muat(), ["Bandung", "Jakarta", "All Depo"], PEMETAAN, PERIODE);
    expect(hasil.baris).toHaveLength(93);
    expect(hasil.duplikat).toBe(93);
  });

  it("sheet cabang saja memberi hasil yang sama dengan sheet gabungan", async () => {
    const wb = await muat();
    const cabang = uraiBaris(wb, ["Bandung", "Jakarta"], PEMETAAN, PERIODE);
    const gabungan = uraiBaris(wb, ["All Depo"], PEMETAAN, PERIODE);
    expect(cabang.baris).toHaveLength(gabungan.baris.length);
    expect(cabang.duplikat).toBe(0);
  });

  it("menolak nama sheet yang tidak ada", async () => {
    const wb = await muat();
    expect(() => uraiBaris(wb, ["Tidak Ada"], PEMETAAN, PERIODE)).toThrow(AppError);
  });

  it("parsing 200 karyawan dalam satu file selesai di bawah 10 detik dan file di bawah 5 MB (FR-04)", async () => {
    const isi = await buatFixtureAbsensi({ awal: PERIODE.tanggalAwal, akhir: PERIODE.tanggalAkhir, karyawan: karyawanSintetis(200) });
    expect(isi.length).toBeLessThan(5 * 1024 * 1024);

    const mulai = performance.now();
    const wb = await muatWorkbook(isi);
    const info = bacaInfoBerkas(wb);
    const hasil = uraiBaris(wb, info.disarankan, info.sheet.find((s) => s.nama === "All Depo")!.tebakan!, PERIODE);
    const durasi = performance.now() - mulai;

    expect(hasil.baris).toHaveLength(200 * 31);
    expect(hasil.tidakValid).toEqual([]);
    expect(durasi).toBeLessThan(10_000);
  }, 60_000);
});

describe("parseTanggalSel", () => {
  it("membaca format teks dd/mm/yyyy dari mesin finger dan variannya", () => {
    expect(parseTanggalSel("24/08/2026")).toBe("2026-08-24");
    expect(parseTanggalSel("4/8/2026")).toBe("2026-08-04");
    expect(parseTanggalSel("24-08-2026")).toBe("2026-08-24");
    expect(parseTanggalSel("24.08.2026")).toBe("2026-08-24");
    expect(parseTanggalSel("24/08/26")).toBe("2026-08-24");
    expect(parseTanggalSel("2026-08-24")).toBe("2026-08-24");
    expect(parseTanggalSel("2026-08-24T00:00:00.000Z")).toBe("2026-08-24");
    expect(parseTanggalSel("  24/08/2026 ")).toBe("2026-08-24");
  });

  it("membaca angka serial Excel dan sel bertipe tanggal tanpa pergeseran hari", () => {
    const serial = keNomorHari("2026-08-24") + 25_569;
    expect(parseTanggalSel(serial)).toBe("2026-08-24");
    expect(parseTanggalSel(serial + 0.75)).toBe("2026-08-24");
    expect(parseTanggalSel(new Date(Date.UTC(2026, 7, 24)))).toBe("2026-08-24");
    expect(parseTanggalSel(new Date(Date.UTC(2024, 1, 29)))).toBe("2024-02-29");
  });

  it("membaca hasil rumus", () => {
    expect(parseTanggalSel({ formula: "A1", result: "24/08/2026" })).toBe("2026-08-24");
  });

  it("menolak teks yang bukan tanggal yang ada di kalender", () => {
    for (const salah of ["", "abc", "31/02/2026", "32/01/2026", "00/01/2026", "24/13/2026", "2026-02-30", "12345"]) {
      expect(parseTanggalSel(salah)).toBeNull();
    }
    expect(parseTanggalSel(null)).toBeNull();
    expect(parseTanggalSel(5)).toBeNull();
    expect(parseTanggalSel(new Date("tidak valid"))).toBeNull();
  });
});

describe("parseJamSel", () => {
  it("membaca teks HH.MM dan HH:MM", () => {
    expect(parseJamSel("06.58")).toEqual({ valid: true, jam: "06:58" });
    expect(parseJamSel("16:05")).toEqual({ valid: true, jam: "16:05" });
  });

  it("sel kosong berarti tidak ada scan, bukan galat", () => {
    expect(parseJamSel("")).toEqual({ valid: true, jam: null });
    expect(parseJamSel(null)).toEqual({ valid: true, jam: null });
    expect(parseJamSel(undefined)).toEqual({ valid: true, jam: null });
  });

  it("membaca sel waktu Excel berupa pecahan hari dan tanggal-jam", () => {
    expect(parseJamSel(0.5)).toEqual({ valid: true, jam: "12:00" });
    expect(parseJamSel(new Date(Date.UTC(1899, 11, 30, 7, 5)))).toEqual({ valid: true, jam: "07:05" });
  });

  it("menandai teks yang tidak terbaca sebagai tidak valid", () => {
    expect(parseJamSel("salah")).toEqual({ valid: false, jam: null });
    expect(parseJamSel("25.00")).toEqual({ valid: false, jam: null });
    expect(parseJamSel(-1)).toEqual({ valid: false, jam: null });
  });
});
