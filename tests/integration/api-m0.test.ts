import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NAMA_COOKIE_SESI } from "@/lib/konstanta";
import { prisma } from "@/server/db/client";
import { aturanBatasMasuk, cariSesi } from "@/server/services/auth";
import { POST as daftar } from "@/app/api/auth/daftar/route";
import { POST as keluar } from "@/app/api/auth/keluar/route";
import { POST as masuk } from "@/app/api/auth/masuk/route";
import { POST as tambahAkunApi } from "@/app/api/akun/route";
import { DELETE as hapusKaryawanApi, GET as ambilKaryawanApi, PUT as ubahKaryawanApi } from "@/app/api/karyawan/[id]/route";
import { GET as daftarKaryawanApi, POST as buatKaryawanApi } from "@/app/api/karyawan/route";
import { DELETE as hapusPeriodeApi, GET as ambilPeriodeApi } from "@/app/api/periode/[id]/route";
import { GET as daftarPeriodeApi, POST as buatPeriodeApi } from "@/app/api/periode/route";
import { GET as ambilPengaturanApi, PUT as simpanPengaturanApi } from "@/app/api/pengaturan/route";
import { panggil, tokenUntuk } from "../support/api";
import { KATA_SANDI_UJI, buatPerusahaanUji, emailUji, hapusKunciPembatas, hapusPerusahaan } from "../support/db";

const perusahaanDibuat: string[] = [];
const kunciDibuat: string[] = [];

afterAll(async () => {
  for (const id of perusahaanDibuat) await hapusPerusahaan(id);
  await hapusKunciPembatas(kunciDibuat);
});

const isiKaryawan = (ubah: Record<string, unknown> = {}) => ({
  namaLengkap: "Budi Santoso",
  jabatan: "Staf Gudang",
  cabang: "Surabaya",
  gajiPokok: 4_000_000,
  tunjangan: 500_000,
  nomorRekening: "0012345678",
  ...ubah,
});

describe("registrasi, login, dan logout lewat API (FR-01)", () => {
  it("daftar membuat akun, mengatur cookie sesi httpOnly, dan mengarahkan ke dashboard", async () => {
    const email = emailUji();
    const { status, json, res } = await panggil(daftar, {
      metode: "POST",
      jalur: "/api/auth/daftar",
      body: { nama: "Sari", namaPerusahaan: "CV Maju", email, kataSandi: KATA_SANDI_UJI },
    });
    expect(status).toBe(201);
    expect(json).toMatchObject({ tujuan: "/dashboard" });

    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`${NAMA_COOKIE_SESI}=`);
    expect(cookie.toLowerCase()).toContain("httponly");
    expect(cookie.toLowerCase()).toContain("samesite=lax");

    const akun = await prisma().akun.findUniqueOrThrow({ where: { email } });
    perusahaanDibuat.push(akun.perusahaanId);
    const token = /payme_sesi=([^;]+)/.exec(cookie)![1];
    expect((await cariSesi(token))?.email).toBe(email);
  });

  it("email yang sudah terdaftar menampilkan pesan yang ditetapkan", async () => {
    const { email, perusahaanId } = await buatPerusahaanUji();
    perusahaanDibuat.push(perusahaanId);
    const { status, json } = await panggil(daftar, {
      metode: "POST",
      jalur: "/api/auth/daftar",
      body: { nama: "X", namaPerusahaan: "Y", email: email.toUpperCase(), kataSandi: KATA_SANDI_UJI },
    });
    expect(status).toBe(409);
    expect(json.pesan).toBe("Email sudah terdaftar. Silakan masuk atau gunakan email lain.");
  });

  it("isian tidak valid menghasilkan 422 dengan pesan per kolom", async () => {
    const { status, json } = await panggil(daftar, {
      metode: "POST",
      jalur: "/api/auth/daftar",
      body: { nama: "", namaPerusahaan: "", email: "salah", kataSandi: "123" },
    });
    expect(status).toBe(422);
    expect(Object.keys(json.kolom as object).sort()).toEqual(["email", "kataSandi", "nama", "namaPerusahaan"]);
    expect(String(json.pesan)).toContain("4 isian");
  });

  it("login berhasil menghormati tujuan awal, tetapi menolak tujuan di luar situs", async () => {
    const { email, perusahaanId } = await buatPerusahaanUji();
    perusahaanDibuat.push(perusahaanId);
    kunciDibuat.push(...aturanBatasMasuk(email, null).map((a) => a.kunci));

    const baik = await panggil(masuk, {
      metode: "POST",
      jalur: "/api/auth/masuk",
      body: { email, kataSandi: KATA_SANDI_UJI, lanjut: "/periode/abc" },
    });
    expect(baik.status).toBe(200);
    expect(baik.json).toMatchObject({ tujuan: "/periode/abc" });

    const jahat = await panggil(masuk, {
      metode: "POST",
      jalur: "/api/auth/masuk",
      body: { email, kataSandi: KATA_SANDI_UJI, lanjut: "https://situs-jahat.example" },
    });
    expect(jahat.json).toMatchObject({ tujuan: "/dashboard" });
  });

  it("kredensial salah menghasilkan 401 dengan pesan umum", async () => {
    const { email, perusahaanId } = await buatPerusahaanUji();
    perusahaanDibuat.push(perusahaanId);
    kunciDibuat.push(...aturanBatasMasuk(email, null).map((a) => a.kunci));

    const { status, json, res } = await panggil(masuk, {
      metode: "POST",
      jalur: "/api/auth/masuk",
      body: { email, kataSandi: "salah-total" },
    });
    expect(status).toBe(401);
    expect(String(json.pesan)).toMatch(/^Email atau kata sandi tidak sesuai/);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("logout menghapus sesi di server dan cookie di browser", async () => {
    const { akunId, perusahaanId } = await buatPerusahaanUji();
    perusahaanDibuat.push(perusahaanId);
    const token = await tokenUntuk(akunId);

    const { status, res } = await panggil(keluar, { metode: "POST", jalur: "/api/auth/keluar", token });
    expect(status).toBe(200);
    expect(res.headers.get("set-cookie")).toMatch(/payme_sesi=;.*(Max-Age=0|Expires=)/i);
    expect(await cariSesi(token)).toBeNull();

    const sesudah = await panggil(daftarKaryawanApi, { jalur: "/api/karyawan", token });
    expect(sesudah.status).toBe(401);
  });

  it("logout tanpa sesi tetap berhasil dan membersihkan cookie", async () => {
    const { status } = await panggil(keluar, { metode: "POST", jalur: "/api/auth/keluar" });
    expect(status).toBe(200);
  });
});

describe("semua rute admin menolak akses tanpa sesi dengan 401 (FR-01)", () => {
  const idContoh = "11111111-1111-4111-8111-111111111111";
  const rute: [string, () => Promise<{ status: number }>][] = [
    ["GET /api/karyawan", () => panggil(daftarKaryawanApi, { jalur: "/api/karyawan" })],
    ["POST /api/karyawan", () => panggil(buatKaryawanApi, { metode: "POST", jalur: "/api/karyawan", body: isiKaryawan() })],
    ["GET /api/karyawan/:id", () => panggil(ambilKaryawanApi, { jalur: "/x", params: { id: idContoh } })],
    ["PUT /api/karyawan/:id", () => panggil(ubahKaryawanApi, { metode: "PUT", jalur: "/x", params: { id: idContoh }, body: isiKaryawan() })],
    ["DELETE /api/karyawan/:id", () => panggil(hapusKaryawanApi, { metode: "DELETE", jalur: "/x", params: { id: idContoh } })],
    ["GET /api/periode", () => panggil(daftarPeriodeApi, { jalur: "/api/periode" })],
    ["POST /api/periode", () => panggil(buatPeriodeApi, { metode: "POST", jalur: "/api/periode", body: { tanggalAwal: "2025-01-01" } })],
    ["GET /api/periode/:id", () => panggil(ambilPeriodeApi, { jalur: "/x", params: { id: idContoh } })],
    ["DELETE /api/periode/:id", () => panggil(hapusPeriodeApi, { metode: "DELETE", jalur: "/x", params: { id: idContoh } })],
    ["GET /api/pengaturan", () => panggil(ambilPengaturanApi, { jalur: "/api/pengaturan" })],
    ["PUT /api/pengaturan", () => panggil(simpanPengaturanApi, { metode: "PUT", jalur: "/api/pengaturan", body: {} })],
    ["POST /api/akun", () => panggil(tambahAkunApi, { metode: "POST", jalur: "/api/akun", body: {} })],
  ];

  for (const [nama, jalankan] of rute) {
    it(`${nama} mengembalikan 401`, async () => {
      expect((await jalankan()).status).toBe(401);
    });
  }

  it("cookie palsu juga ditolak karena sesi diperiksa ke basis data", async () => {
    const { status, json } = await panggil(daftarKaryawanApi, { jalur: "/api/karyawan", token: "token-palsu-yang-tidak-ada" });
    expect(status).toBe(401);
    expect(json.kode).toBe("TIDAK_ADA_SESI");
  });
});

describe("CRUD lewat API dan isolasi antar perusahaan (NFR-09)", () => {
  let tokenA: string;
  let tokenB: string;
  let idKaryawanA: string;
  let idPeriodeA: string;

  beforeAll(async () => {
    const a = await buatPerusahaanUji("PT API A");
    const b = await buatPerusahaanUji("PT API B");
    perusahaanDibuat.push(a.perusahaanId, b.perusahaanId);
    tokenA = await tokenUntuk(a.akunId);
    tokenB = await tokenUntuk(b.akunId);

    const k = await panggil(buatKaryawanApi, { metode: "POST", jalur: "/api/karyawan", token: tokenA, body: isiKaryawan() });
    expect(k.status).toBe(201);
    idKaryawanA = k.json.id as string;

    const p = await panggil(buatPeriodeApi, { metode: "POST", jalur: "/api/periode", token: tokenA, body: { tanggalAwal: "2025-01-26" } });
    expect(p.status).toBe(201);
    idPeriodeA = p.json.id as string;
  });

  it("karyawan yang dibuat muncul di daftar pemiliknya saja", async () => {
    const milikA = await panggil(daftarKaryawanApi, { jalur: "/api/karyawan", token: tokenA });
    expect((milikA.json.karyawan as unknown[]).length).toBe(1);
    const milikB = await panggil(daftarKaryawanApi, { jalur: "/api/karyawan", token: tokenB });
    expect((milikB.json.karyawan as unknown[]).length).toBe(0);
  });

  it("perusahaan B menerima 404 saat meminta, mengubah, atau menghapus karyawan perusahaan A", async () => {
    const params = { id: idKaryawanA };
    expect((await panggil(ambilKaryawanApi, { jalur: "/x", params, token: tokenB })).status).toBe(404);
    expect((await panggil(ubahKaryawanApi, { metode: "PUT", jalur: "/x", params, token: tokenB, body: isiKaryawan() })).status).toBe(404);
    expect((await panggil(hapusKaryawanApi, { metode: "DELETE", jalur: "/x", params, token: tokenB })).status).toBe(404);
    expect((await panggil(ambilKaryawanApi, { jalur: "/x", params, token: tokenA })).status).toBe(200);
  });

  it("perusahaan B menerima 404 untuk periode perusahaan A", async () => {
    const params = { id: idPeriodeA };
    expect((await panggil(ambilPeriodeApi, { jalur: "/x", params, token: tokenB })).status).toBe(404);
    expect((await panggil(hapusPeriodeApi, { metode: "DELETE", jalur: "/x", params, token: tokenB })).status).toBe(404);
  });

  it("ID yang bukan UUID menghasilkan 404, bukan galat server", async () => {
    const { status, json } = await panggil(ambilKaryawanApi, { jalur: "/x", params: { id: "bukan-uuid" }, token: tokenA });
    expect(status).toBe(404);
    expect(String(json.pesan)).toMatch(/tidak ditemukan/i);
  });

  it("validasi gaji pokok 0 dan rekening berhuruf mengembalikan pesan per kolom", async () => {
    const { status, json } = await panggil(buatKaryawanApi, {
      metode: "POST",
      jalur: "/api/karyawan",
      token: tokenA,
      body: isiKaryawan({ gajiPokok: 0, nomorRekening: "12ab34cd56" }),
    });
    expect(status).toBe(422);
    const kolom = json.kolom as Record<string, string>;
    expect(kolom.gajiPokok).toMatch(/lebih dari 0/);
    expect(kolom.nomorRekening).toBe("Nomor rekening hanya boleh berisi angka.");
  });

  it("karyawan ganda mengembalikan 409 dengan pesan pada kolom terkait", async () => {
    const { status, json } = await panggil(buatKaryawanApi, { metode: "POST", jalur: "/api/karyawan", token: tokenA, body: isiKaryawan() });
    expect(status).toBe(409);
    expect(json.kode).toBe("KARYAWAN_GANDA");
  });

  it("periode bentrok mengembalikan 409 dengan pesan yang menyebut periode lain", async () => {
    const { status, json } = await panggil(buatPeriodeApi, { metode: "POST", jalur: "/api/periode", token: tokenA, body: { tanggalAwal: "2025-02-10" } });
    expect(status).toBe(409);
    expect(String(json.pesan)).toContain("26 Jan 2025 sampai 25 Feb 2025");
  });

  it("pengaturan dapat dibaca dan disimpan; nilai tidak valid ditolak", async () => {
    const baca = await panggil(ambilPengaturanApi, { jalur: "/api/pengaturan", token: tokenA });
    expect(baca.json).toMatchObject({ hariKerjaMingguan: [1, 2, 3, 4, 5, 6] });

    const buruk = await panggil(simpanPengaturanApi, {
      metode: "PUT",
      jalur: "/api/pengaturan",
      token: tokenA,
      body: { ...baca.json, hariKerjaMingguan: [] },
    });
    expect(buruk.status).toBe(422);

    const baik = await panggil(simpanPengaturanApi, {
      metode: "PUT",
      jalur: "/api/pengaturan",
      token: tokenA,
      body: { ...baca.json, hariKerjaMingguan: [1, 2, 3, 4, 5] },
    });
    expect(baik.status).toBe(200);
    expect(baik.json).toMatchObject({ hariKerjaMingguan: [1, 2, 3, 4, 5] });
  });

  it("akun tambahan masuk ke perusahaan pemanggil, bukan perusahaan yang dikirim klien", async () => {
    const email = emailUji();
    const { status, json } = await panggil(tambahAkunApi, {
      metode: "POST",
      jalur: "/api/akun",
      token: tokenA,
      body: { nama: "Rudi", email, kataSandi: KATA_SANDI_UJI, perusahaanId: "11111111-1111-4111-8111-111111111111" },
    });
    expect(status).toBe(201);
    const akun = await prisma().akun.findUniqueOrThrow({ where: { id: json.akunId as string } });
    const sesiA = await cariSesi(tokenA);
    expect(akun.perusahaanId).toBe(sesiA!.perusahaanId);
  });
});

describe("perlindungan permintaan", () => {
  it("permintaan yang mengubah data dari asal berbeda ditolak (403)", async () => {
    const { akunId, perusahaanId } = await buatPerusahaanUji();
    perusahaanDibuat.push(perusahaanId);
    const token = await tokenUntuk(akunId);
    const { status, json } = await panggil(buatKaryawanApi, {
      metode: "POST",
      jalur: "/api/karyawan",
      token,
      body: isiKaryawan(),
      headers: { origin: "https://situs-jahat.example", host: "localhost:3000" },
    });
    expect(status).toBe(403);
    expect(json.kode).toBe("ASAL_DITOLAK");
  });

  it("asal yang sama diterima", async () => {
    const { akunId, perusahaanId } = await buatPerusahaanUji();
    perusahaanDibuat.push(perusahaanId);
    const token = await tokenUntuk(akunId);
    const { status } = await panggil(buatKaryawanApi, {
      metode: "POST",
      jalur: "/api/karyawan",
      token,
      body: isiKaryawan(),
      headers: { origin: "http://localhost:3000", host: "localhost:3000" },
    });
    expect(status).toBe(201);
  });

  it("JSON rusak menghasilkan 400 dengan pesan yang jelas", async () => {
    const { akunId, perusahaanId } = await buatPerusahaanUji();
    perusahaanDibuat.push(perusahaanId);
    const token = await tokenUntuk(akunId);
    const { status, json } = await panggil(buatKaryawanApi, { metode: "POST", jalur: "/api/karyawan", token, body: "{bukan json" });
    expect(status).toBe(400);
    expect(String(json.pesan)).toContain("tidak terbaca");
  });

  it("galat tak terduga tidak membocorkan detail teknis", async () => {
    const { akunId, perusahaanId } = await buatPerusahaanUji();
    perusahaanDibuat.push(perusahaanId);
    const token = await tokenUntuk(akunId);
    // Parameter query yang melanggar skema menjadi 422, bukan teks galat mentah.
    const { status, json } = await panggil(daftarKaryawanApi, { jalur: "/api/karyawan?status=ngawur", token });
    expect(status).toBe(422);
    expect(JSON.stringify(json)).not.toMatch(/prisma|stack|at \w+ \(/i);
  });
});
