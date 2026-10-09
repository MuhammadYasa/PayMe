import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { dariDate } from "@/server/db/tanggal";
import { AppError } from "@/server/errors";
import { detailKaryawan, ringkasanPeriode, simpanCatatan } from "@/server/services/absensi";
import { analisisImpor, bacaBerkas, jalankanImpor } from "@/server/services/impor-absensi";
import { itemCatatanSkema, konfigurasiImporSkema } from "@/skema/absensi";
import { karyawanUji, periodeUji } from "../support/data";
import { buatPerusahaanUji, hapusPerusahaan } from "../support/db";
import { buatFixtureAbsensi, karyawanSintetis } from "../support/fixture-absensi";

type Perusahaan = Awaited<ReturnType<typeof buatPerusahaanUji>>;

const AWAL = "2026-08-24";
const AKHIR = "2026-09-23";
const PEMETAAN = { nama: 3, tanggal: 4, jamMasuk: 8, jamPulang: 9 };

const konfig = (ubah: Record<string, unknown> = {}) =>
  konfigurasiImporSkema.parse({ sheet: ["All Depo"], pemetaan: PEMETAAN, ...ubah });

let p: Perusahaan;
let periodeId: string;
let dimas: string;
let wahyu: string;
let berkas: Buffer;

beforeAll(async () => {
  p = await buatPerusahaanUji("PT Impor");
  periodeId = (await periodeUji(p.db, AWAL)).id;
  dimas = (await karyawanUji(p.db, "Dimas Pratama", { cabang: "Bandung" })).id;
  wahyu = (await karyawanUji(p.db, "Wahyu Santika", { cabang: "Bandung" })).id;

  berkas = await buatFixtureAbsensi({
    awal: AWAL,
    akhir: AKHIR,
    karyawan: [
      { nama: "Dimas.Pratama", cabang: "Bandung" },
      { nama: "Wahyu Santika", cabang: "Bandung" },
      { nama: "Orang.Asing", cabang: "Jakarta" },
    ],
    // Satu baris Dimas pada 26 Agustus memiliki jam masuk rusak.
    ubahBaris: (baris, info) => (info.nama === "Dimas.Pratama" && info.tanggal === "2026-08-26" ? baris.map((s, i) => (i === 7 ? "salah" : s)) : baris),
  });
});

afterAll(async () => {
  await hapusPerusahaan(p.perusahaanId);
});

beforeEach(async () => {
  await p.db.absensi.deleteMany({});
  await p.db.karyawanAlias.deleteMany({});
});

describe("bacaBerkas dan validasi berkas (FR-04)", () => {
  it("membaca daftar sheet dan menebak pemetaan kolom", async () => {
    const info = await bacaBerkas("absen.xlsx", berkas);
    expect(info.disarankan).toEqual(["All Depo"]);
    expect(info.sheet.find((s) => s.nama === "All Depo")?.tebakan).toEqual(PEMETAAN);
  });

  it("file .xls atau .csv ditolak dengan pesan format yang diterima", async () => {
    await expect(bacaBerkas("absen.xls", berkas)).rejects.toMatchObject({ kode: "FORMAT_TIDAK_DIDUKUNG" });
    await expect(bacaBerkas("absen.csv", Buffer.from("a,b"))).rejects.toMatchObject({ kode: "FORMAT_TIDAK_DIDUKUNG" });
  });

  it("file lebih dari 5 MB ditolak sebelum diproses", async () => {
    const besar = Buffer.alloc(5 * 1024 * 1024 + 1);
    await expect(analisisImpor(p.db, periodeId, "besar.xlsx", besar, konfig())).rejects.toMatchObject({ status: 413 });
  });

  it("file yang bukan Excel walau berekstensi .xlsx ditolak dengan pesan yang jelas", async () => {
    const galat = (await bacaBerkas("palsu.xlsx", Buffer.from("ini bukan excel".repeat(20))).catch((e) => e)) as AppError;
    expect(galat).toMatchObject({ kode: "FILE_RUSAK" });
    expect(galat.message).toMatch(/tidak dapat dibuka/);
  });
});

describe("analisis impor", () => {
  it("meringkas baris terbaca, nama tidak dikenal, dan baris bermasalah dengan nomor baris", async () => {
    const hasil = await analisisImpor(p.db, periodeId, "absen.xlsx", berkas, konfig());
    expect(hasil.totalBaris).toBe(93);
    expect(hasil.karyawanCocok).toBe(2);
    expect(hasil.namaTakDikenal).toEqual([{ nama: "Orang.Asing", kunci: "orang asing", jumlahBaris: 31, ambigu: false }]);
    expect(hasil.jumlahTidakValid).toBe(1);
    expect(hasil.tidakValid[0]).toMatchObject({ baris: 4, pesan: "Baris 4: jam masuk tidak dapat dibaca" });
    // Dimas 26 hari (satu baris rusak) + Wahyu 27 hari kerja bermesin; Minggu tanpa scan tidak diimpor.
    expect(hasil.akanDiimpor).toBe(53);
    expect(hasil.tanpaScan).toBe(12);
    expect(hasil.bentrokManual).toBe(0);
    expect(hasil.kandidatKaryawan.map((k) => k.nama)).toEqual(["Dimas Pratama", "Wahyu Santika"]);
  });

  it("tidak menulis apa pun ke basis data", async () => {
    await analisisImpor(p.db, periodeId, "absen.xlsx", berkas, konfig());
    expect(await p.db.absensi.count()).toBe(0);
  });

  it("sheet cabang memberi hasil yang sama dengan sheet gabungan", async () => {
    const hasil = await analisisImpor(p.db, periodeId, "absen.xlsx", berkas, konfig({ sheet: ["Bandung", "Jakarta"] }));
    expect(hasil.akanDiimpor).toBe(53);
    expect(hasil.duplikat).toBe(0);
  });

  it("memilih sheet cabang dan gabungan sekaligus melaporkan duplikat tanpa menggandakan data", async () => {
    const hasil = await analisisImpor(p.db, periodeId, "absen.xlsx", berkas, konfig({ sheet: ["Bandung", "Jakarta", "All Depo"] }));
    expect(hasil.akanDiimpor).toBe(53);
    expect(hasil.duplikat).toBeGreaterThan(0);
  });

  it("menolak sheet yang tidak ada", async () => {
    await expect(analisisImpor(p.db, periodeId, "absen.xlsx", berkas, konfig({ sheet: ["Tidak Ada"] }))).rejects.toMatchObject({ status: 422 });
  });

  it("pemetaan dengan kolom ganda atau tanpa kolom jam ditolak oleh skema", () => {
    expect(konfigurasiImporSkema.safeParse({ sheet: ["x"], pemetaan: { nama: 3, tanggal: 3, jamMasuk: 8, jamPulang: null } }).success).toBe(false);
    expect(konfigurasiImporSkema.safeParse({ sheet: ["x"], pemetaan: { nama: 3, tanggal: 4, jamMasuk: null, jamPulang: null } }).success).toBe(false);
    expect(konfigurasiImporSkema.safeParse({ sheet: [], pemetaan: PEMETAAN }).success).toBe(false);
  });
});

describe("impor absensi (FR-04)", () => {
  it("menulis catatan hadir bersumber mesin finger dan baris valid tetap diimpor walau ada baris bermasalah", async () => {
    const hasil = await jalankanImpor(p.db, periodeId, "absen.xlsx", berkas, konfig());
    expect(hasil).toMatchObject({ dibuat: 53, diganti: 0, dilewatiKarenaManual: 0, alias: 0 });

    const semua = await p.db.absensi.findMany();
    expect(semua).toHaveLength(53);
    expect(semua.every((a) => a.status === "HADIR" && a.sumber === "MESIN")).toBe(true);
    expect(semua[0].jamMasuk).toMatch(/^\d{2}:\d{2}$/);
    expect(semua.map((a) => dariDate(a.tanggal))).not.toContain("2026-08-30");
  });

  it("tanggal tanpa scan menjadi kosong untuk diisi HRD, dan hari Minggu tidak dianggap kosong", async () => {
    await jalankanImpor(p.db, periodeId, "absen.xlsx", berkas, konfig());
    const ringkasan = await ringkasanPeriode(p.db, periodeId);
    const barisDimas = ringkasan.karyawan.find((k) => k.karyawanId === dimas)!.ringkasan;
    expect(barisDimas.tanggalKosong).toEqual(["2026-08-26"]);
    expect(ringkasan.karyawan.find((k) => k.karyawanId === wahyu)!.ringkasan.jumlahKosong).toBe(0);
  });

  it("unggah ulang menggantikan data mesin sebelumnya tanpa menggandakan", async () => {
    await jalankanImpor(p.db, periodeId, "absen.xlsx", berkas, konfig());
    const hasil = await jalankanImpor(p.db, periodeId, "absen.xlsx", berkas, konfig());
    expect(hasil).toMatchObject({ dibuat: 53, diganti: 53 });
    expect(await p.db.absensi.count()).toBe(53);
  });

  it("isian manual HRD tidak tertimpa unggah ulang tanpa konfirmasi", async () => {
    await jalankanImpor(p.db, periodeId, "absen.xlsx", berkas, konfig());
    await simpanCatatan(p.db, periodeId, wahyu, {
      simpan: [itemCatatanSkema.parse({ tanggal: "2026-08-25", status: "SAKIT", keterangan: "Surat dokter" })],
      hapus: [],
    });

    const analisis = await analisisImpor(p.db, periodeId, "absen.xlsx", berkas, konfig());
    expect(analisis.bentrokManual).toBe(1);
    expect(analisis.contohBentrokManual).toEqual([{ nama: "Wahyu Santika", tanggal: "2026-08-25" }]);

    const hasil = await jalankanImpor(p.db, periodeId, "absen.xlsx", berkas, konfig());
    expect(hasil.dilewatiKarenaManual).toBe(1);
    const baris = (await detailKaryawan(p.db, periodeId, wahyu)).baris.find((b) => b.tanggal === "2026-08-25")!;
    expect(baris).toMatchObject({ status: "SAKIT", sumber: "MANUAL", keterangan: "Surat dokter" });
    expect(await p.db.absensi.count()).toBe(53);
  });

  it("isian manual ditimpa bila HRD mengonfirmasi", async () => {
    await jalankanImpor(p.db, periodeId, "absen.xlsx", berkas, konfig());
    await simpanCatatan(p.db, periodeId, wahyu, {
      simpan: [itemCatatanSkema.parse({ tanggal: "2026-08-25", status: "SAKIT", keterangan: "Surat dokter" })],
      hapus: [],
    });
    const hasil = await jalankanImpor(p.db, periodeId, "absen.xlsx", berkas, konfig({ timpaManual: true }));
    expect(hasil.ditimpaManual).toBe(1);
    const baris = (await detailKaryawan(p.db, periodeId, wahyu)).baris.find((b) => b.tanggal === "2026-08-25")!;
    expect(baris).toMatchObject({ status: "HADIR", sumber: "MESIN" });
    expect(await p.db.absensi.count()).toBe(53);
  });

  it("unggah ulang tidak menyentuh data karyawan yang tidak ada di file", async () => {
    await jalankanImpor(p.db, periodeId, "absen.xlsx", berkas, konfig());
    const sebagian = await buatFixtureAbsensi({ awal: AWAL, akhir: AKHIR, karyawan: [{ nama: "Wahyu Santika", cabang: "Bandung" }] });
    await jalankanImpor(p.db, periodeId, "absen.xlsx", sebagian, konfig());
    expect(await p.db.absensi.count({ where: { karyawanId: dimas } })).toBe(26);
    expect(await p.db.absensi.count({ where: { karyawanId: wahyu } })).toBe(27);
  });

  it("nama tak dikenal dapat dipetakan manual, dan pemetaan diingat untuk unggahan berikutnya", async () => {
    const baru = await karyawanUji(p.db, "Orang Baru", { cabang: "Jakarta" });
    const hasil = await jalankanImpor(p.db, periodeId, "absen.xlsx", berkas, konfig({ petaNama: { "orang asing": baru.id } }));
    expect(hasil).toMatchObject({ dibuat: 80, alias: 1 });
    expect(await p.db.absensi.count({ where: { karyawanId: baru.id } })).toBe(27);

    // Unggahan berikutnya tidak perlu dipetakan lagi.
    const lanjut = await analisisImpor(p.db, periodeId, "absen.xlsx", berkas, konfig());
    expect(lanjut.namaTakDikenal).toEqual([]);
    expect(lanjut.akanDiimpor).toBe(80);
  });

  it("nama tak dikenal dapat diabaikan", async () => {
    const hasil = await analisisImpor(p.db, periodeId, "absen.xlsx", berkas, konfig({ petaNama: { "orang asing": "abaikan" } }));
    expect(hasil.namaTakDikenal).toEqual([]);
    expect(hasil.akanDiimpor).toBe(53);
  });

  it("pemetaan ke karyawan perusahaan lain atau yang tidak ada ditolak", async () => {
    const lain = await buatPerusahaanUji("PT Lain");
    try {
      const asing = await karyawanUji(lain.db, "Orang Lain");
      await expect(analisisImpor(p.db, periodeId, "absen.xlsx", berkas, konfig({ petaNama: { "orang asing": asing.id } }))).rejects.toMatchObject({ status: 422 });
    } finally {
      await hapusPerusahaan(lain.perusahaanId);
    }
  });

  it("nama yang dipakai dua karyawan berbeda ditandai ambigu sampai dipilih manual", async () => {
    const pt = await buatPerusahaanUji("PT Ambigu");
    try {
      const periode = await periodeUji(pt.db, AWAL);
      const satu = await karyawanUji(pt.db, "Budi Santoso");
      await karyawanUji(pt.db, "Budi Santoso");
      const isi = await buatFixtureAbsensi({ awal: AWAL, akhir: AKHIR, karyawan: [{ nama: "Budi.Santoso", cabang: "Surabaya" }] });

      const awal = await analisisImpor(pt.db, periode.id, "absen.xlsx", isi, konfig());
      expect(awal.namaTakDikenal).toEqual([expect.objectContaining({ kunci: "budi santoso", ambigu: true })]);
      expect(awal.akanDiimpor).toBe(0);

      const akhir = await analisisImpor(pt.db, periode.id, "absen.xlsx", isi, konfig({ petaNama: { "budi santoso": satu.id } }));
      expect(akhir.namaTakDikenal).toEqual([]);
      expect(akhir.akanDiimpor).toBe(27);
    } finally {
      await hapusPerusahaan(pt.perusahaanId);
    }
  });

  it("periode final menolak impor", async () => {
    await p.db.periode.update({ where: { id: periodeId }, data: { status: "FINAL" } });
    try {
      await expect(jalankanImpor(p.db, periodeId, "absen.xlsx", berkas, konfig())).rejects.toMatchObject({ kode: "PERIODE_FINAL" });
    } finally {
      await p.db.periode.update({ where: { id: periodeId }, data: { status: "DRAF" } });
    }
  });

  it("tanggal di luar periode diabaikan dan dilaporkan jumlahnya", async () => {
    const lebar = await buatFixtureAbsensi({ awal: "2026-08-20", akhir: "2026-09-27", karyawan: [{ nama: "Wahyu Santika", cabang: "Bandung" }] });
    const hasil = await analisisImpor(p.db, periodeId, "absen.xlsx", lebar, konfig());
    expect(hasil.diLuarPeriode).toBe(8);
    expect(hasil.akanDiimpor).toBe(27);
  });

  it("memproses 200 karyawan dalam satu file di bawah 10 detik dan menyimpan seluruhnya (FR-04)", async () => {
    const pt = await buatPerusahaanUji("PT Dua Ratus");
    try {
      const periode = await periodeUji(pt.db, AWAL);
      await pt.db.karyawan.createMany({
        data: karyawanSintetis(200).map((k, i) => ({
          perusahaanId: pt.perusahaanId,
          namaLengkap: k.nama.replace(".", " "),
          namaKunci: k.nama.replace(".", " ").toLowerCase(),
          jabatan: "Staf",
          cabang: k.cabang,
          gajiPokok: 3_000_000,
          nomorRekening: String(8_000_000_000 + i),
        })),
      });
      const isi = await buatFixtureAbsensi({ awal: AWAL, akhir: AKHIR, karyawan: karyawanSintetis(200) });
      expect(isi.length).toBeLessThan(5 * 1024 * 1024);

      const mulai = performance.now();
      const analisis = await analisisImpor(pt.db, periode.id, "absen.xlsx", isi, konfig());
      const hasil = await jalankanImpor(pt.db, periode.id, "absen.xlsx", isi, konfig());
      const durasi = performance.now() - mulai;

      expect(analisis.karyawanCocok).toBe(200);
      expect(hasil.dibuat).toBe(200 * 27);
      expect(await pt.db.absensi.count()).toBe(200 * 27);
      // Analisis dan impor masing-masing membaca ulang file; keduanya bersama masih di bawah batas satu kali parsing.
      expect(durasi).toBeLessThan(10_000);
    } finally {
      await hapusPerusahaan(pt.perusahaanId);
    }
  }, 90_000);
});
