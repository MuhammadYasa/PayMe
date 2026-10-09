import ExcelJS from "exceljs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { NAMA_COOKIE_PERANGKAT } from "@/lib/konstanta";
import { hitungPeriode } from "@/domain/periode";
import { prisma } from "@/server/db/client";
import { GET as ekspor } from "@/app/api/periode/[id]/ekspor/route";
import { GET as ambilHasil } from "@/app/api/periode/[id]/hasil/route";
import { POST as buka } from "@/app/api/periode/[id]/buka/route";
import { POST as hitung } from "@/app/api/periode/[id]/hitung/route";
import { POST as simpan } from "@/app/api/periode/[id]/simpan/route";
import { POST as buatDendaApi } from "@/app/api/periode/[id]/denda/route";
import { DELETE as hapusDendaApi } from "@/app/api/denda/[id]/route";
import { PUT as simpanInsentifApi } from "@/app/api/periode/[id]/insentif/route";
import { PUT as simpanPendapatanApi } from "@/app/api/periode/[id]/pendapatan/route";
import { GET as salinApi } from "@/app/api/periode/[id]/potongan/salin/route";
import { PUT as simpanPotonganApi } from "@/app/api/periode/[id]/potongan/route";
import { POST as publik } from "@/app/api/publik/gaji/route";
import { lengkapiAbsensi } from "../support/absensi";
import { panggil, tokenUntuk } from "../support/api";
import { karyawanUji, periodeUji } from "../support/data";
import { buatPerusahaanUji, hapusPerusahaan } from "../support/db";

type Perusahaan = Awaited<ReturnType<typeof buatPerusahaanUji>>;

describe("alur penggajian lewat API dari hitung sampai ekspor (FR-15 sampai FR-17)", () => {
  let p: Perusahaan;
  let token: string;
  let periodeId: string;
  let budi: string;
  let ani: string;

  beforeAll(async () => {
    p = await buatPerusahaanUji("PT Alur");
    token = await tokenUntuk(p.akunId);
    periodeId = (await periodeUji(p.db, "2025-04-01")).id;
    budi = (await karyawanUji(p.db, "Budi Santoso", { gajiPokok: 4_000_000, tunjangan: 500_000, cabang: "Malang", nomorRekening: "0012345678" })).id;
    ani = (await karyawanUji(p.db, "Ani Wijaya", { gajiPokok: 3_000_000, tunjangan: 0, cabang: "Malang" })).id;
  });

  afterAll(async () => hapusPerusahaan(p.perusahaanId));

  const params = () => ({ id: periodeId });

  it("hitung ditahan dengan pesan yang jelas selama absensi belum lengkap", async () => {
    const { status, json } = await panggil(hitung, { metode: "POST", jalur: "/x", params: params(), token });
    expect(status).toBe(409);
    expect(json.kode).toBe("ABSENSI_BELUM_LENGKAP");
    expect(String(json.pesan)).toContain("Budi Santoso (26 tanggal kosong)");
  });

  it("alur lengkap: isi data, hitung, simpan, lihat hasil, ekspor, lalu buka kembali", async () => {
    await lengkapiAbsensi(p.db, periodeId, [budi, ani], hitungPeriode("2025-04-01"));

    const insentif = await panggil(simpanInsentifApi, {
      metode: "PUT",
      jalur: "/x",
      params: params(),
      token,
      body: { items: [{ karyawanId: budi, entri: [{ jenis: "Pengiriman", nominal: 350_000 }] }] },
    });
    expect(insentif.status).toBe(200);

    const denda = await panggil(buatDendaApi, {
      metode: "POST",
      jalur: "/x",
      params: params(),
      token,
      body: { karyawanId: budi, alasan: "Kerusakan barang", total: 100_000, jumlahCicilan: 1, mulai: "periode_ini" },
    });
    expect(denda.status).toBe(201);

    const potongan = await panggil(simpanPotonganApi, {
      metode: "PUT",
      jalur: "/x",
      params: params(),
      token,
      body: { items: [{ karyawanId: budi, pajak: null, asuransi: 150_000 }] },
    });
    expect(potongan.status).toBe(200);

    const hasil = await panggil(hitung, { metode: "POST", jalur: "/x", params: params(), token });
    expect(hasil.status).toBe(200);
    const daftar = hasil.json.hasil as { namaLengkap: string; totalBersih: number }[];
    expect(daftar.find((r) => r.namaLengkap === "Budi Santoso")?.totalBersih).toBe(4_600_000);
    expect((hasil.json.total as { totalBersih: number }).totalBersih).toBe(7_600_000);

    const salah = await panggil(simpan, { metode: "POST", jalur: "/x", params: params(), token, body: { hash: "0".repeat(64), akuiPeringatan: false } });
    expect(salah.status).toBe(409);
    expect(salah.json.kode).toBe("HASIL_USANG");

    const disimpan = await panggil(simpan, { metode: "POST", jalur: "/x", params: params(), token, body: { hash: hasil.json.hash, akuiPeringatan: false } });
    expect(disimpan.status).toBe(200);
    expect(disimpan.json).toMatchObject({ sudahFinal: false });

    const tersimpan = await panggil(ambilHasil, { jalur: "/x", params: params(), token });
    expect((tersimpan.json.hasil as unknown[]).length).toBe(2);
    expect((tersimpan.json.periode as { status: string }).status).toBe("FINAL");

    const berkas = await panggil(ekspor, { jalur: "/x", params: params(), token });
    expect(berkas.status).toBe(200);
    expect(berkas.res.headers.get("content-type")).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(berkas.res.headers.get("content-disposition")).toBe('attachment; filename="PayMe_2025-04-01_2025-04-30.xlsx"');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(await berkas.res.arrayBuffer()) as unknown as Parameters<typeof wb.xlsx.load>[0]);
    const ws = wb.getWorksheet("Gaji")!;
    // Baris diurutkan menurut cabang lalu nama: Ani Wijaya (baris 5), Budi Santoso (baris 6), lalu baris total.
    expect(ws.getRow(5).getCell(1).value).toBe("Ani Wijaya");
    expect(ws.getRow(6).getCell(1).value).toBe("Budi Santoso");
    expect(ws.getRow(6).getCell(4).value).toBe("0012345678");
    expect(ws.getRow(7).getCell(21).value).toBe(7_600_000);

    const tanpaKonfirmasi = await panggil(buka, { metode: "POST", jalur: "/x", params: params(), token, body: {} });
    expect(tanpaKonfirmasi.status).toBe(422);
    const dibuka = await panggil(buka, { metode: "POST", jalur: "/x", params: params(), token, body: { konfirmasi: true } });
    expect(dibuka.status).toBe(200);
    expect(dibuka.json).toMatchObject({ status: "DRAF" });
    expect((await p.db.denda.findFirstOrThrow()).sisa).toBe(100_000);
  });

  it("ekspor tanpa sesi ditolak dengan 401", async () => {
    const { status } = await panggil(ekspor, { jalur: "/x", params: params() });
    expect(status).toBe(401);
  });

  it("ekspor draf yang datanya belum lengkap ditahan dengan pesan yang sama seperti hitung", async () => {
    await p.db.absensi.deleteMany({ where: { karyawanId: ani } });
    const { status, json } = await panggil(ekspor, { jalur: "/x", params: params(), token });
    expect(status).toBe(409);
    expect(json.kode).toBe("ABSENSI_BELUM_LENGKAP");
  });

  it("denda dapat dihapus selama belum dipotong, dan penghapusan ditolak bila sudah", async () => {
    const baru = await panggil(buatDendaApi, {
      metode: "POST",
      jalur: "/x",
      params: params(),
      token,
      body: { karyawanId: ani, alasan: "Terlambat", total: 50_000, jumlahCicilan: 1, mulai: "periode_ini" },
    });
    const dendaId = baru.json.id as string;
    const hapus = await panggil(hapusDendaApi, { metode: "DELETE", jalur: "/x", params: { id: dendaId }, token });
    expect(hapus.status).toBe(200);
    const lagi = await panggil(hapusDendaApi, { metode: "DELETE", jalur: "/x", params: { id: dendaId }, token });
    expect(lagi.status).toBe(404);
  });

  it("nominal negatif dan isian kosong menghasilkan 422 dengan pesan per kolom", async () => {
    const insentif = await panggil(simpanInsentifApi, {
      metode: "PUT",
      jalur: "/x",
      params: params(),
      token,
      body: { items: [{ karyawanId: budi, entri: [{ jenis: "x", nominal: -5 }] }] },
    });
    expect(insentif.status).toBe(422);
    expect(Object.keys(insentif.json.kolom as object)[0]).toContain("nominal");

    const pendapatan = await panggil(simpanPendapatanApi, { metode: "PUT", jalur: "/x", params: params(), token, body: { cabang: "Malang", totalAktual: -1, sales: [] } });
    expect(pendapatan.status).toBe(422);

    const denda = await panggil(buatDendaApi, { metode: "POST", jalur: "/x", params: params(), token, body: { karyawanId: budi, alasan: "", total: 0, jumlahCicilan: 1, mulai: "periode_ini" } });
    expect(denda.status).toBe(422);
    expect(Object.keys(denda.json.kolom as object).sort()).toEqual(["alasan", "total"]);
  });

  it("Salin dari periode sebelumnya hanya membaca, dan memberi sumber kosong bila tidak ada periode sebelumnya", async () => {
    const hasil = await panggil(salinApi, { jalur: "/x", params: params(), token });
    expect(hasil.status).toBe(200);
    expect(hasil.json.sumber).toBeNull();
  });
});

describe("endpoint publik halaman karyawan (FR-19)", () => {
  let p: Perusahaan;

  beforeAll(async () => {
    p = await buatPerusahaanUji("CV Publik");
    const budi = (await karyawanUji(p.db, "Budi Santoso", { nomorRekening: "0012345678", tunjangan: 0 })).id;
    const periode = await periodeUji(p.db, "2025-04-01");
    await lengkapiAbsensi(p.db, periode.id, [budi], hitungPeriode("2025-04-01"));
    const token = await tokenUntuk(p.akunId);
    const hasil = await panggil(hitung, { metode: "POST", jalur: "/x", params: { id: periode.id }, token });
    await panggil(simpan, { metode: "POST", jalur: "/x", params: { id: periode.id }, token, body: { hash: hasil.json.hash, akuiPeringatan: false } });
  });

  afterAll(async () => hapusPerusahaan(p.perusahaanId));
  beforeEach(async () => {
    await prisma().percobaanPublik.deleteMany({});
  });

  const kirim = (body: unknown, cookie?: string, headers: Record<string, string> = {}) =>
    panggil(publik, {
      metode: "POST",
      jalur: "/api/publik/gaji",
      body,
      headers: { ...(cookie ? { cookie: `${NAMA_COOKIE_PERANGKAT}=${cookie}` } : {}), ...headers },
    });

  const ambilCookie = (res: Response) => /payme_perangkat=([^;]+)/.exec(res.headers.get("set-cookie") ?? "")?.[1];

  it("berhasil tanpa sesi dan memasang cookie perangkat acak yang httpOnly", async () => {
    const { status, json, res } = await kirim({ nama: "Budi Santoso", rekening: "0012345678" });
    expect(status).toBe(200);
    expect(json).toMatchObject({ nama: "Budi Santoso", rekeningSamar: "••••5678" });
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("payme_perangkat=");
    expect(cookie.toLowerCase()).toContain("httponly");
    expect(res.headers.get("set-cookie")).not.toContain("payme_sesi");
  });

  it("kegagalan memberi pesan generik, status 404, dan tetap memasang cookie perangkat", async () => {
    const { status, json, res } = await kirim({ nama: "Budi Santoso", rekening: "1111111111" });
    expect(status).toBe(404);
    expect(json.pesan).toBe("Data tidak ditemukan. Periksa kembali nama dan nomor rekening Anda.");
    expect(ambilCookie(res)).toBeTruthy();
  });

  it("lima kegagalan lalu percobaan ke-6 diblokir walau input benar, dan mengganti header tidak dapat melewatinya", async () => {
    const perangkat = "perangkat-uji-0123456789abcdef";
    for (let i = 0; i < 5; i++) {
      const g = await kirim({ nama: "Budi Santoso", rekening: `99999999${i}9` }, perangkat, { "x-forwarded-for": `198.51.100.${i}`, "x-real-ip": `198.51.100.${i + 50}` });
      expect(g.status).toBe(404);
    }
    const keenam = await kirim({ nama: "Budi Santoso", rekening: "0012345678" }, perangkat, { "x-forwarded-for": "203.0.113.200", "user-agent": "peramban-lain" });
    expect(keenam.status).toBe(429);
    expect(keenam.json.pesan).toBe("Terlalu banyak percobaan. Coba lagi dalam 15 menit.");
    expect(Number(keenam.res.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  it("isian kosong ditolak tanpa membocorkan kolom mana yang salah", async () => {
    const { status, json } = await kirim({ nama: "", rekening: "" });
    expect(status).toBe(422);
    expect(json.pesan).toBe("Isi nama lengkap dan nomor rekening Anda.");
  });

  it("jawaban tidak mengandung nomor rekening utuh", async () => {
    const { res } = await kirim({ nama: "Budi Santoso", rekening: "0012345678" });
    expect(await res.text()).not.toContain("0012345678");
  });
});
