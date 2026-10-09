import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db/client";
import { AppError } from "@/server/errors";
import { akhiriSesi, buatSesi, cariSesi, daftarAkun, masuk, tambahAkun } from "@/server/services/auth";
import { aturanBatasMasuk } from "@/server/services/auth";
import { daftarSkema, masukSkema } from "@/skema/auth";
import { KATA_SANDI_UJI, emailUji, hapusKunciPembatas, hapusPerusahaan } from "../support/db";

const perusahaanDibuat: string[] = [];
const kunciDibuat: string[] = [];

afterAll(async () => {
  for (const id of perusahaanDibuat) await hapusPerusahaan(id);
  await hapusKunciPembatas(kunciDibuat);
});

async function daftarBaru(ubah: Partial<Parameters<typeof daftarAkun>[0]> = {}) {
  const email = ubah.email ?? emailUji();
  const hasil = await daftarAkun({
    nama: "Sari Dewi",
    namaPerusahaan: "CV Maju Jaya",
    email,
    kataSandi: KATA_SANDI_UJI,
    ...ubah,
  });
  perusahaanDibuat.push(hasil.perusahaanId);
  return { ...hasil, email };
}

describe("registrasi (FR-01)", () => {
  it("membuat perusahaan, akun, dan pengaturan bawaan sekaligus", async () => {
    const { akunId, perusahaanId } = await daftarBaru();
    const akun = await prisma().akun.findUniqueOrThrow({ where: { id: akunId }, include: { perusahaan: { include: { pengaturan: true } } } });
    expect(akun.perusahaanId).toBe(perusahaanId);
    expect(akun.perusahaan.nama).toBe("CV Maju Jaya");
    expect(akun.perusahaan.pengaturan?.hariKerjaMingguan).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("menyimpan password_hash yang bukan sandi asli", async () => {
    const { akunId } = await daftarBaru();
    const akun = await prisma().akun.findUniqueOrThrow({ where: { id: akunId } });
    expect(akun.passwordHash).not.toContain(KATA_SANDI_UJI);
    expect(akun.passwordHash.startsWith("$argon2id$")).toBe(true);
  });

  it("menolak email yang sudah terdaftar tanpa membedakan huruf besar-kecil", async () => {
    const { email } = await daftarBaru();
    const pesan = "Email sudah terdaftar. Silakan masuk atau gunakan email lain.";
    const parsed = daftarSkema.parse({ nama: "X", namaPerusahaan: "Y", email: email.toUpperCase(), kataSandi: KATA_SANDI_UJI });
    await expect(daftarAkun(parsed)).rejects.toMatchObject({ status: 409, message: pesan });
  });

  it("dua pendaftaran serentak dengan email sama hanya menghasilkan satu akun", async () => {
    const email = emailUji();
    const percobaan = await Promise.allSettled([daftarBaru({ email }), daftarBaru({ email })]);
    expect(percobaan.filter((p) => p.status === "fulfilled")).toHaveLength(1);
    const gagal = percobaan.find((p) => p.status === "rejected") as PromiseRejectedResult;
    expect(gagal.reason).toBeInstanceOf(AppError);
    expect((gagal.reason as AppError).message).toBe("Email sudah terdaftar. Silakan masuk atau gunakan email lain.");
    expect(await prisma().akun.count({ where: { email } })).toBe(1);
  });

  it("memangkas spasi dan menyeragamkan huruf kecil pada email melalui skema", () => {
    const hasil = daftarSkema.parse({ nama: "  Sari   Dewi ", namaPerusahaan: " CV  Maju ", email: "  Sari@Contoh.TEST ", kataSandi: "12345678" });
    expect(hasil.email).toBe("sari@contoh.test");
    expect(hasil.nama).toBe("Sari Dewi");
    expect(hasil.namaPerusahaan).toBe("CV Maju");
  });

  it("menolak kata sandi pendek dan email tidak valid dengan pesan berisi langkah perbaikan", () => {
    const hasil = daftarSkema.safeParse({ nama: "A", namaPerusahaan: "B", email: "bukan-email", kataSandi: "123" });
    expect(hasil.success).toBe(false);
    if (!hasil.success) {
      const pesan = hasil.error.issues.map((i) => i.message).join(" | ");
      expect(pesan).toContain("minimal 8 karakter");
      expect(pesan).toContain("Alamat email tidak valid");
    }
  });

  it("akun tambahan masuk ke perusahaan yang sama", async () => {
    const { perusahaanId } = await daftarBaru();
    const { akunId } = await tambahAkun(perusahaanId, { nama: "Rudi", email: emailUji(), kataSandi: KATA_SANDI_UJI });
    const akun = await prisma().akun.findUniqueOrThrow({ where: { id: akunId } });
    expect(akun.perusahaanId).toBe(perusahaanId);
  });
});

describe("login, sesi, dan logout (FR-01)", () => {
  it("login berhasil mengembalikan token yang dikenali sebagai sesi perusahaan yang benar", async () => {
    const { email, perusahaanId } = await daftarBaru();
    kunciDibuat.push(...aturanBatasMasuk(email, null).map((a) => a.kunci));
    const hasil = await masuk({ email, kataSandi: KATA_SANDI_UJI, ip: null });
    const sesi = await cariSesi(hasil.token);
    expect(sesi).toMatchObject({ email, perusahaanId, namaPerusahaan: "CV Maju Jaya" });
  });

  it("token disimpan sebagai hash, bukan token asli", async () => {
    const { akunId } = await daftarBaru();
    const { token } = await buatSesi(akunId);
    const baris = await prisma().sesi.findMany({ where: { akunId } });
    expect(baris).toHaveLength(1);
    expect(baris[0].tokenHash).not.toBe(token);
    expect(baris[0].tokenHash).toHaveLength(64);
  });

  it("kredensial salah menghasilkan pesan yang sama untuk email tak dikenal maupun sandi salah", async () => {
    const { email } = await daftarBaru();
    kunciDibuat.push(...aturanBatasMasuk(email, null).map((a) => a.kunci));
    const emailAsing = emailUji("asing");
    kunciDibuat.push(...aturanBatasMasuk(emailAsing, null).map((a) => a.kunci));

    const sandiSalah = await masuk({ email, kataSandi: "sandi-yang-salah", ip: null }).catch((e) => e as AppError);
    const emailTakDikenal = await masuk({ email: emailAsing, kataSandi: KATA_SANDI_UJI, ip: null }).catch((e) => e as AppError);
    expect(sandiSalah).toBeInstanceOf(AppError);
    expect(emailTakDikenal).toBeInstanceOf(AppError);
    expect((sandiSalah as AppError).status).toBe(401);
    expect((sandiSalah as AppError).message).toBe((emailTakDikenal as AppError).message);
    expect((sandiSalah as AppError).message).not.toMatch(/email (tidak|belum)|sandi (salah|tidak benar)/i);
  });

  it("logout menghapus sesi sehingga token tidak berlaku lagi", async () => {
    const { akunId } = await daftarBaru();
    const { token } = await buatSesi(akunId);
    expect(await cariSesi(token)).not.toBeNull();
    await akhiriSesi(token);
    expect(await cariSesi(token)).toBeNull();
  });

  it("sesi yang kedaluwarsa tidak diterima", async () => {
    const { akunId } = await daftarBaru();
    const { token } = await buatSesi(akunId);
    await prisma().sesi.updateMany({ where: { akunId }, data: { kedaluwarsaPada: new Date(Date.now() - 1000) } });
    expect(await cariSesi(token)).toBeNull();
  });

  it("token kosong atau acak tidak menghasilkan sesi", async () => {
    expect(await cariSesi("")).toBeNull();
    expect(await cariSesi("token-acak-yang-tidak-pernah-dibuat")).toBeNull();
  });

  it("sepuluh kegagalan berturut-turut memblokir percobaan berikutnya walau sandi benar", async () => {
    const { email } = await daftarBaru();
    kunciDibuat.push(...aturanBatasMasuk(email, null).map((a) => a.kunci));
    for (let i = 0; i < 10; i++) {
      await masuk({ email, kataSandi: "salah-terus", ip: null }).catch(() => undefined);
    }
    await expect(masuk({ email, kataSandi: KATA_SANDI_UJI, ip: null })).rejects.toMatchObject({ status: 429 });
  });

  it("skema login tidak membocorkan apa pun tentang akun", () => {
    expect(masukSkema.safeParse({ email: "a@b.co", kataSandi: "" }).success).toBe(false);
    expect(masukSkema.safeParse({ email: "a@b.co", kataSandi: "x" }).success).toBe(true);
  });
});
