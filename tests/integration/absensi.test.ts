import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { tanggalDalamPeriode } from "@/domain/periode";
import { hariMinggu } from "@/domain/tanggal";
import { type TanggalISO } from "@/domain/tanggal";
import { dariDate, keDate } from "@/server/db/tanggal";
import {
  catatKetidakhadiran,
  daftarCatatan,
  detailKaryawan,
  hapusCatatan,
  hapusLibur,
  isiMassal,
  ringkasanPeriode,
  simpanCatatan,
  tandaiLibur,
} from "@/server/services/absensi";
import { itemCatatanSkema, ketidakhadiranSkema } from "@/skema/absensi";
import { karyawanUji, periodeUji } from "../support/data";
import { buatPerusahaanUji, hapusPerusahaan } from "../support/db";

type Perusahaan = Awaited<ReturnType<typeof buatPerusahaanUji>>;

let p: Perusahaan;
let lain: Perusahaan;
let periodeId: string;
let idMaret: string;
let budi: string;
let ani: string;
let nonaktif: string;

const APRIL = { awal: "2025-04-01", akhir: "2025-04-30" };

async function isiHadir(karyawanId: string, kecuali: TanggalISO[] = [], pid = periodeId, awal = APRIL.awal, akhir = APRIL.akhir) {
  const tanggal = tanggalDalamPeriode({ tanggalAwal: awal, tanggalAkhir: akhir }).filter((t) => hariMinggu(t) !== 0 && !kecuali.includes(t));
  await p.db.absensi.createMany({
    data: tanggal.map((t) => ({
      perusahaanId: p.perusahaanId,
      periodeId: pid,
      karyawanId,
      tanggal: keDate(t),
      status: "HADIR" as const,
      jamMasuk: "07:00",
      jamPulang: "16:00",
      sumber: "MESIN" as const,
    })),
  });
}

const item = (tanggal: TanggalISO, ubah: Record<string, unknown> = {}) =>
  itemCatatanSkema.parse({ tanggal, status: "HADIR", jamMasuk: "08:00", jamPulang: "16:00", ...ubah });

async function ringkas(karyawanId: string) {
  const hasil = await ringkasanPeriode(p.db, periodeId);
  return hasil.karyawan.find((k) => k.karyawanId === karyawanId)!.ringkasan;
}

beforeAll(async () => {
  p = await buatPerusahaanUji("PT Absensi");
  lain = await buatPerusahaanUji("PT Lain");
  periodeId = (await periodeUji(p.db, APRIL.awal)).id;
  idMaret = (await periodeUji(p.db, "2025-03-01")).id;
  budi = (await karyawanUji(p.db, "Budi Santoso")).id;
  ani = (await karyawanUji(p.db, "Ani Wijaya")).id;
  nonaktif = (await karyawanUji(p.db, "Cici Lama", { statusAktif: false })).id;
});

afterAll(async () => {
  await hapusPerusahaan(p.perusahaanId);
  await hapusPerusahaan(lain.perusahaanId);
});

beforeEach(async () => {
  await p.db.absensi.deleteMany({});
});

describe("tampilan absensi dan tanggal kosong (FR-05)", () => {
  it("tanggal tanpa data ditandai kosong dan jumlahnya muncul pada badge", async () => {
    await isiHadir(budi, ["2025-04-02", "2025-04-03", "2025-04-04"]);
    await isiHadir(ani);
    const hasil = await ringkasanPeriode(p.db, periodeId);
    const barisBudi = hasil.karyawan.find((k) => k.karyawanId === budi)!;
    expect(barisBudi.ringkasan.jumlahKosong).toBe(3);
    expect(barisBudi.ringkasan.tanggalKosong).toEqual(["2025-04-02", "2025-04-03", "2025-04-04"]);
    expect(hasil.karyawan.find((k) => k.karyawanId === ani)!.ringkasan.jumlahKosong).toBe(0);
    expect(hasil.jumlahBelumLengkap).toBe(1);
    expect(hasil.totalKosong).toBe(3);
    expect(hasil.lengkap).toBe(false);
  });

  it("karyawan nonaktif tidak ikut diperiksa", async () => {
    await isiHadir(budi);
    await isiHadir(ani);
    const hasil = await ringkasanPeriode(p.db, periodeId);
    expect(hasil.karyawan.map((k) => k.karyawanId)).not.toContain(nonaktif);
    expect(hasil.lengkap).toBe(true);
  });

  it("filter hanya yang belum lengkap", async () => {
    await isiHadir(budi, ["2025-04-02"]);
    await isiHadir(ani);
    const hasil = await ringkasanPeriode(p.db, periodeId, { hanyaBelumLengkap: true });
    expect(hasil.karyawan.map((k) => k.karyawanId)).toEqual([budi]);
  });

  it("mengisi satu tanggal kosong dengan hadir menurunkan hitungan dari 3 menjadi 2", async () => {
    await isiHadir(budi, ["2025-04-02", "2025-04-03", "2025-04-04"]);
    const sesudah = await simpanCatatan(p.db, periodeId, budi, { simpan: [item("2025-04-02")], hapus: [] });
    expect(sesudah.ringkasan.jumlahKosong).toBe(2);
    const baris = sesudah.baris.find((b) => b.tanggal === "2025-04-02")!;
    expect(baris).toMatchObject({ status: "HADIR", jamMasuk: "08:00", jamPulang: "16:00", sumber: "MANUAL" });
  });

  it("hari Minggu tanpa catatan tidak dihitung kosong", async () => {
    const r = await ringkas(budi);
    expect(r.jumlahKosong).toBe(26);
    expect(r.tanggalKosong).not.toContain("2025-04-06");
    expect(r.liburMingguan).toBe(4);
  });

  it("detail memuat satu baris per tanggal periode dengan penanda libur mingguan", async () => {
    await isiHadir(budi);
    const detail = await detailKaryawan(p.db, periodeId, budi);
    expect(detail.baris).toHaveLength(30);
    expect(detail.baris.find((b) => b.tanggal === "2025-04-06")).toMatchObject({ liburMingguan: true, status: null, hari: "Min" });
    expect(detail.baris.find((b) => b.tanggal === "2025-04-07")).toMatchObject({ liburMingguan: false, status: "HADIR", sumber: "MESIN" });
  });

  it("status lainnya tanpa keterangan ditolak dengan pesan pada kolom keterangan", () => {
    const hasil = itemCatatanSkema.safeParse({ tanggal: "2025-04-02", status: "LAINNYA" });
    expect(hasil.success).toBe(false);
    if (!hasil.success) {
      const isu = hasil.error.issues.find((i) => i.path[0] === "keterangan");
      expect(isu?.message).toMatch(/wajib diberi keterangan/);
    }
  });

  it("jam yang tidak terbaca ditolak dan jam dinormalkan menjadi HH:MM", () => {
    expect(itemCatatanSkema.safeParse({ tanggal: "2025-04-02", status: "HADIR", jamMasuk: "salah" }).success).toBe(false);
    expect(item("2025-04-02", { jamMasuk: "7.05", jamPulang: "16.00" })).toMatchObject({ jamMasuk: "07:05", jamPulang: "16:00" });
  });

  it("menolak tanggal di luar periode", async () => {
    await expect(simpanCatatan(p.db, periodeId, budi, { simpan: [item("2025-05-01")], hapus: [] })).rejects.toMatchObject({ status: 422 });
  });

  it("menghapus catatan mengembalikan tanggal menjadi kosong", async () => {
    await isiHadir(budi);
    const sesudah = await hapusCatatan(p.db, periodeId, budi, ["2025-04-07", "2025-04-08"]);
    expect(sesudah.ringkasan.tanggalKosong).toEqual(["2025-04-07", "2025-04-08"]);
  });

  it("isi massal hanya mengisi tanggal kosong kecuali diminta menimpa", async () => {
    await isiHadir(budi, ["2025-04-02", "2025-04-03"]);
    const tanggal = ["2025-04-02", "2025-04-03", "2025-04-07"];
    const awal = await isiMassal(p.db, periodeId, budi, { tanggal, status: "LAINNYA", keterangan: "Belum masuk kerja", timpa: false });
    expect(awal).toEqual({ diisi: 2, dilewati: 1 });
    const detail = await detailKaryawan(p.db, periodeId, budi);
    expect(detail.baris.find((b) => b.tanggal === "2025-04-02")).toMatchObject({ status: "LAINNYA", keterangan: "Belum masuk kerja" });
    expect(detail.baris.find((b) => b.tanggal === "2025-04-07")?.status).toBe("HADIR");

    const timpa = await isiMassal(p.db, periodeId, budi, { tanggal, status: "LAINNYA", keterangan: "Belum masuk kerja", timpa: true });
    expect(timpa.diisi).toBe(3);
  });
});

describe("libur perusahaan dan individual (FR-07)", () => {
  it("dua tanggal merah untuk semua membuat dua catatan libur per karyawan aktif dan mengurangi hari kerja", async () => {
    await isiHadir(budi);
    await isiHadir(ani);
    const sebelum = await ringkas(budi);
    expect(sebelum.hariKerja).toBe(26);

    const hasil = await tandaiLibur(p.db, periodeId, { tanggal: ["2025-04-17", "2025-04-18"], karyawanIds: "semua", keterangan: "Paskah", timpa: true });
    expect(hasil.karyawan).toBe(2);

    for (const id of [budi, ani]) {
      expect(await p.db.absensi.count({ where: { periodeId, karyawanId: id, status: "LIBUR" } })).toBe(2);
    }
    expect(await p.db.absensi.count({ where: { karyawanId: nonaktif, status: "LIBUR" } })).toBe(0);
    expect((await ringkas(budi)).hariKerja).toBe(24);
    expect((await ringkas(ani)).hariKerja).toBe(24);
  });

  it("libur individual tidak memengaruhi karyawan lain", async () => {
    await isiHadir(budi);
    await isiHadir(ani);
    await tandaiLibur(p.db, periodeId, { tanggal: ["2025-04-09"], karyawanIds: [budi], keterangan: "Giliran libur", timpa: true });
    expect((await ringkas(budi)).hariKerja).toBe(25);
    expect((await ringkas(ani)).hariKerja).toBe(26);
  });

  it("tanggal merah pada hari Minggu tidak dihitung dua kali", async () => {
    await isiHadir(budi);
    await tandaiLibur(p.db, periodeId, { tanggal: ["2025-04-06"], karyawanIds: "semua", keterangan: null, timpa: true });
    expect((await ringkas(budi)).hariKerja).toBe(26);
  });

  it("tanggal di luar periode ditolak", async () => {
    await expect(
      tandaiLibur(p.db, periodeId, { tanggal: ["2025-03-31"], karyawanIds: "semua", keterangan: null, timpa: true }),
    ).rejects.toMatchObject({ status: 422 });
  });

  it("tanggal yang sudah berstatus hadir dari mesin finger meminta konfirmasi sebelum ditimpa", async () => {
    await isiHadir(budi);
    const galat = await tandaiLibur(p.db, periodeId, { tanggal: ["2025-04-07"], karyawanIds: [budi], keterangan: null, timpa: false }).catch((e) => e);
    expect(galat).toMatchObject({ status: 409, kode: "KONFIRMASI_TIMPA" });
    expect(galat.data.jumlah).toBe(1);
    expect((await detailKaryawan(p.db, periodeId, budi)).baris.find((b) => b.tanggal === "2025-04-07")?.status).toBe("HADIR");

    await tandaiLibur(p.db, periodeId, { tanggal: ["2025-04-07"], karyawanIds: [budi], keterangan: null, timpa: true });
    expect((await detailKaryawan(p.db, periodeId, budi)).baris.find((b) => b.tanggal === "2025-04-07")?.status).toBe("LIBUR");
  });

  it("menandai libur ulang pada tanggal yang sudah libur tidak meminta konfirmasi dan tidak menggandakan data", async () => {
    await tandaiLibur(p.db, periodeId, { tanggal: ["2025-04-09"], karyawanIds: [budi], keterangan: null, timpa: false });
    await tandaiLibur(p.db, periodeId, { tanggal: ["2025-04-09"], karyawanIds: [budi], keterangan: null, timpa: false });
    expect(await p.db.absensi.count({ where: { karyawanId: budi, status: "LIBUR" } })).toBe(1);
  });

  it("menghapus penanda libur mengembalikan tanggal menjadi kosong", async () => {
    await tandaiLibur(p.db, periodeId, { tanggal: ["2025-04-09"], karyawanIds: "semua", keterangan: null, timpa: true });
    expect((await ringkas(budi)).tanggalKosong).not.toContain("2025-04-09");
    const hasil = await hapusLibur(p.db, periodeId, { tanggal: ["2025-04-09"], karyawanIds: "semua" });
    expect(hasil.dihapus).toBe(2);
    expect((await ringkas(budi)).tanggalKosong).toContain("2025-04-09");
  });

  it("libur untuk karyawan perusahaan lain ditolak dengan 404", async () => {
    const asing = (await karyawanUji(lain.db, "Orang Lain")).id;
    await expect(tandaiLibur(p.db, periodeId, { tanggal: ["2025-04-09"], karyawanIds: [asing], keterangan: null, timpa: true })).rejects.toMatchObject({
      status: 404,
    });
  });

  it("daftar catatan menunjukkan libur perusahaan dan total per jenis", async () => {
    await tandaiLibur(p.db, periodeId, { tanggal: ["2025-04-17"], karyawanIds: "semua", keterangan: "Paskah", timpa: true });
    await tandaiLibur(p.db, periodeId, { tanggal: ["2025-04-09"], karyawanIds: [budi], keterangan: null, timpa: true });
    const hasil = await daftarCatatan(p.db, periodeId);
    expect(hasil.liburPerusahaan).toEqual(["2025-04-17"]);
    expect(hasil.total.libur).toBe(3);
  });
});

describe("izin, sakit, cuti, dan lainnya (FR-08, FR-09)", () => {
  const rentang = (ubah: Record<string, unknown>) =>
    ketidakhadiranSkema.parse({ karyawanId: budi, jenis: "SAKIT", dari: "2025-03-10", sampai: "2025-03-12", keterangan: null, timpa: false, ...ubah });

  it("sakit 10 sampai 12 Maret membentuk 3 catatan dan menambah total sakit 3", async () => {
    const hasil = await catatKetidakhadiran(p.db, idMaret, rentang({}));
    expect(hasil).toMatchObject({ dicatat: 3, diperbarui: 0 });
    const detail = await detailKaryawan(p.db, idMaret, budi);
    expect(detail.ringkasan.sakit).toBe(3);
    expect(detail.baris.filter((b) => b.status === "SAKIT").map((b) => b.tanggal)).toEqual(["2025-03-10", "2025-03-11", "2025-03-12"]);
  });

  it("jenis lainnya tanpa keterangan ditolak pada kolom keterangan", () => {
    const hasil = ketidakhadiranSkema.safeParse({ karyawanId: budi, jenis: "LAINNYA", dari: "2025-03-10", sampai: "2025-03-10" });
    expect(hasil.success).toBe(false);
    if (!hasil.success) expect(hasil.error.issues.some((i) => i.path[0] === "keterangan")).toBe(true);
  });

  it("tanggal selesai sebelum tanggal mulai ditolak", () => {
    expect(ketidakhadiranSkema.safeParse({ karyawanId: budi, jenis: "IZIN", dari: "2025-03-12", sampai: "2025-03-10" }).success).toBe(false);
  });

  it("cuti 5 hari yang memuat satu hari Minggu menghasilkan total cuti 4", async () => {
    const hasil = await catatKetidakhadiran(p.db, periodeId, rentang({ jenis: "CUTI", dari: "2025-04-04", sampai: "2025-04-08" }));
    expect(hasil.dicatat).toBe(4);
    expect(hasil.dilewatiLibur).toBe(1);
    expect((await ringkas(budi)).cuti).toBe(4);
  });

  it("cuti yang melewati akhir periode hanya menyimpan tanggal di dalam periode dan memberi peringatan", async () => {
    const hasil = await catatKetidakhadiran(p.db, periodeId, rentang({ jenis: "CUTI", dari: "2025-04-28", sampai: "2025-05-03" }));
    expect(hasil).toMatchObject({ dicatat: 3, diLuarPeriode: 3 });
    expect(hasil.peringatan.join(" ")).toMatch(/di luar periode/);
  });

  it("hari libur individual di dalam rentang dilewati", async () => {
    await tandaiLibur(p.db, periodeId, { tanggal: ["2025-04-08"], karyawanIds: [budi], keterangan: null, timpa: true });
    const hasil = await catatKetidakhadiran(p.db, periodeId, rentang({ jenis: "IZIN", dari: "2025-04-07", sampai: "2025-04-09" }));
    expect(hasil).toMatchObject({ dicatat: 2, dilewatiLibur: 1 });
  });

  it("tanggal yang sudah punya status lain menawarkan menimpa dan tidak membuat duplikat", async () => {
    await isiHadir(budi);
    const galat = await catatKetidakhadiran(p.db, periodeId, rentang({ jenis: "SAKIT", dari: "2025-04-07", sampai: "2025-04-08" })).catch((e) => e);
    expect(galat).toMatchObject({ status: 409, kode: "KONFIRMASI_TIMPA" });
    expect(galat.data.jumlah).toBe(2);

    const hasil = await catatKetidakhadiran(p.db, periodeId, rentang({ jenis: "SAKIT", dari: "2025-04-07", sampai: "2025-04-08", timpa: true }));
    expect(hasil.diperbarui).toBe(2);
    expect(await p.db.absensi.count({ where: { periodeId, karyawanId: budi, tanggal: { in: [keDate("2025-04-07"), keDate("2025-04-08")] } } })).toBe(2);
    expect((await ringkas(budi)).sakit).toBe(2);
  });

  it("mencatat ulang status yang sama bersifat idempoten", async () => {
    await catatKetidakhadiran(p.db, periodeId, rentang({ dari: "2025-04-07", sampai: "2025-04-08" }));
    await expect(catatKetidakhadiran(p.db, periodeId, rentang({ dari: "2025-04-07", sampai: "2025-04-08" }))).resolves.toMatchObject({ dicatat: 2 });
    expect((await ringkas(budi)).sakit).toBe(2);
  });

  it("rentang yang seluruhnya libur atau di luar periode ditolak", async () => {
    await expect(catatKetidakhadiran(p.db, periodeId, rentang({ dari: "2025-04-06", sampai: "2025-04-06" }))).rejects.toMatchObject({ status: 422 });
    await expect(catatKetidakhadiran(p.db, periodeId, rentang({ dari: "2025-06-01", sampai: "2025-06-03" }))).rejects.toMatchObject({ status: 422 });
  });

  it("menghapus entri mengurangi total per jenis dan mengembalikan tanggal menjadi kosong", async () => {
    await catatKetidakhadiran(p.db, periodeId, rentang({ jenis: "IZIN", dari: "2025-04-07", sampai: "2025-04-09" }));
    expect((await ringkas(budi)).izin).toBe(3);
    await hapusCatatan(p.db, periodeId, budi, ["2025-04-08"]);
    const r = await ringkas(budi);
    expect(r.izin).toBe(2);
    expect(r.tanggalKosong).toContain("2025-04-08");
  });

  it("hari hadir = hari kerja dikurangi sakit, izin, cuti, dan lainnya", async () => {
    await isiHadir(budi);
    await catatKetidakhadiran(p.db, periodeId, rentang({ jenis: "SAKIT", dari: "2025-04-09", sampai: "2025-04-10", timpa: true }));
    await catatKetidakhadiran(p.db, periodeId, rentang({ jenis: "IZIN", dari: "2025-04-14", sampai: "2025-04-14", timpa: true }));
    await catatKetidakhadiran(p.db, periodeId, rentang({ jenis: "CUTI", dari: "2025-04-15", sampai: "2025-04-15", timpa: true }));
    await catatKetidakhadiran(p.db, periodeId, rentang({ jenis: "LAINNYA", dari: "2025-04-16", sampai: "2025-04-16", keterangan: "Dinas luar", timpa: true }));
    expect(await ringkas(budi)).toMatchObject({ hariKerja: 26, sakit: 2, izin: 1, cuti: 1, lainnya: 1, hadir: 21, jumlahKosong: 0 });
  });
});

describe("batas akses", () => {
  it("periode final bersifat baca-saja untuk semua perubahan absensi", async () => {
    await isiHadir(budi);
    await p.db.periode.update({ where: { id: periodeId }, data: { status: "FINAL" } });
    try {
      await expect(simpanCatatan(p.db, periodeId, budi, { simpan: [item("2025-04-07")], hapus: [] })).rejects.toMatchObject({ kode: "PERIODE_FINAL" });
      await expect(tandaiLibur(p.db, periodeId, { tanggal: ["2025-04-09"], karyawanIds: "semua", keterangan: null, timpa: true })).rejects.toMatchObject({ kode: "PERIODE_FINAL" });
      await expect(catatKetidakhadiran(p.db, periodeId, ketidakhadiranSkema.parse({ karyawanId: budi, jenis: "IZIN", dari: "2025-04-09", sampai: "2025-04-09" }))).rejects.toMatchObject({ kode: "PERIODE_FINAL" });
      // Membaca tetap diizinkan.
      await expect(detailKaryawan(p.db, periodeId, budi)).resolves.toBeDefined();
    } finally {
      await p.db.periode.update({ where: { id: periodeId }, data: { status: "DRAF" } });
    }
  });

  it("perusahaan lain tidak dapat membaca atau mengubah absensi (404)", async () => {
    await isiHadir(budi);
    await expect(detailKaryawan(lain.db, periodeId, budi)).rejects.toMatchObject({ status: 404 });
    await expect(ringkasanPeriode(lain.db, periodeId)).rejects.toMatchObject({ status: 404 });
    await expect(simpanCatatan(lain.db, periodeId, budi, { simpan: [item("2025-04-07")], hapus: [] })).rejects.toMatchObject({ status: 404 });
    expect((await detailKaryawan(p.db, periodeId, budi)).baris.find((b) => b.tanggal === "2025-04-07")?.jamMasuk).toBe("07:00");
  });

  it("tanggal dari DB tidak bergeser sehari", async () => {
    await simpanCatatan(p.db, periodeId, budi, { simpan: [item("2025-04-01")], hapus: [] });
    const baris = await p.db.absensi.findFirstOrThrow({ where: { periodeId, karyawanId: budi } });
    expect(dariDate(baris.tanggal)).toBe("2025-04-01");
  });
});
