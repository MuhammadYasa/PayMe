import "server-only";
import { DURASI_BLOKIR_MENIT } from "@/domain/batas";
import type { DaftarInput, TambahAkunInput } from "@/skema/auth";
import { prisma } from "@/server/db/client";
import { adalahPelanggaranUnik } from "@/server/db/galat-prisma";
import { AppError, terlaluBanyakPercobaan } from "@/server/errors";
import { cocokKataSandi, hashKataSandi } from "@/server/kata-sandi";
import { acakBase64Url, hmacHex, sha256Hex } from "@/server/kripto";
import { type AturanBatas, ambilJatahSemua, resetJatah } from "@/server/pembatas";

export const DURASI_SESI_MS = 7 * 24 * 60 * 60 * 1000;

export interface SesiAktif {
  sesiId: string;
  akunId: string;
  nama: string;
  email: string;
  perusahaanId: string;
  namaPerusahaan: string;
}

function emailTerdaftar(): AppError {
  return new AppError(409, "Email sudah terdaftar. Silakan masuk atau gunakan email lain.", {
    kode: "EMAIL_TERDAFTAR",
    kolom: { email: "Email sudah terdaftar. Silakan masuk atau gunakan email lain." },
  });
}

export async function daftarAkun(input: DaftarInput): Promise<{ akunId: string; perusahaanId: string }> {
  const sudahAda = await prisma().akun.findUnique({ where: { email: input.email }, select: { id: true } });
  if (sudahAda) throw emailTerdaftar();

  const passwordHash = await hashKataSandi(input.kataSandi);
  try {
    return await prisma().$transaction(async (tx) => {
      const perusahaan = await tx.perusahaan.create({
        data: { nama: input.namaPerusahaan, pengaturan: { create: {} } },
      });
      const akun = await tx.akun.create({
        data: { email: input.email, passwordHash, nama: input.nama, perusahaanId: perusahaan.id },
      });
      return { akunId: akun.id, perusahaanId: perusahaan.id };
    });
  } catch (galat) {
    if (adalahPelanggaranUnik(galat)) throw emailTerdaftar();
    throw galat;
  }
}

/** Akun tambahan dibuat oleh akun yang sudah ada dan otomatis masuk ke perusahaan yang sama. */
export async function tambahAkun(perusahaanId: string, input: TambahAkunInput): Promise<{ akunId: string }> {
  const sudahAda = await prisma().akun.findUnique({ where: { email: input.email }, select: { id: true } });
  if (sudahAda) throw emailTerdaftar();
  try {
    const akun = await prisma().akun.create({
      data: {
        email: input.email,
        passwordHash: await hashKataSandi(input.kataSandi),
        nama: input.nama,
        perusahaanId,
      },
    });
    return { akunId: akun.id };
  } catch (galat) {
    if (adalahPelanggaranUnik(galat)) throw emailTerdaftar();
    throw galat;
  }
}

export async function buatSesi(akunId: string): Promise<{ token: string; kedaluwarsa: Date }> {
  const token = acakBase64Url(32);
  const kedaluwarsa = new Date(Date.now() + DURASI_SESI_MS);
  await prisma().sesi.deleteMany({ where: { akunId, kedaluwarsaPada: { lt: new Date() } } });
  await prisma().sesi.create({ data: { akunId, tokenHash: sha256Hex(token), kedaluwarsaPada: kedaluwarsa } });
  return { token, kedaluwarsa };
}

/** Batas percobaan masuk: per email (terlepas dari IP) dan, bila IP tepercaya diketahui, per IP. */
export function aturanBatasMasuk(email: string, ip: string | null): AturanBatas[] {
  const aturan: AturanBatas[] = [
    { kunci: hmacHex(`masuk:email:${email}`), batas: 10, jendelaMenit: DURASI_BLOKIR_MENIT, blokirMenit: DURASI_BLOKIR_MENIT },
  ];
  if (ip) {
    aturan.push({ kunci: hmacHex(`masuk:ip:${ip}`), batas: 40, jendelaMenit: DURASI_BLOKIR_MENIT, blokirMenit: DURASI_BLOKIR_MENIT });
  }
  return aturan;
}

/**
 * Batas pendaftaran akun: per perangkat, per IP bila IP tepercaya diketahui, dan satu batas menyeluruh. Pendaftaran
 * menjalankan hash kata sandi yang mahal dan menulis baris baru, jadi tanpa batas satu skrip bisa menghabiskan CPU,
 * memori, dan isi database. Batas menyeluruh melindungi dari penyerang yang membuang cookie perangkat di tiap permintaan.
 */
export function aturanBatasDaftar(perangkat: string, ip: string | null): AturanBatas[] {
  const aturan: AturanBatas[] = [
    { kunci: hmacHex(`daftar:perangkat:${perangkat}`), batas: 5, jendelaMenit: 60, blokirMenit: 60 },
    { kunci: hmacHex("daftar:semua"), batas: 200, jendelaMenit: 60, blokirMenit: 15 },
  ];
  if (ip) aturan.push({ kunci: hmacHex(`daftar:ip:${ip}`), batas: 10, jendelaMenit: 60, blokirMenit: 60 });
  return aturan;
}

/** Mengambil jatah pendaftaran sebelum pekerjaan mahal dimulai. Melempar 429 bila jatah habis. */
export async function batasiPendaftaran(perangkat: string, ip: string | null, sekarang: Date = new Date()): Promise<void> {
  const jatah = await ambilJatahSemua(aturanBatasDaftar(perangkat, ip), sekarang);
  if (!jatah.diizinkan) {
    throw terlaluBanyakPercobaan(
      `Terlalu banyak percobaan mendaftar. Coba lagi dalam ${Math.max(1, Math.ceil(jatah.sisaDetik / 60))} menit, atau masuk bila Anda sudah punya akun.`,
      jatah.sisaDetik,
    );
  }
}

export async function masuk(input: {
  email: string;
  kataSandi: string;
  ip: string | null;
}): Promise<{ token: string; kedaluwarsa: Date; akunId: string; perusahaanId: string }> {
  const aturan = aturanBatasMasuk(input.email, input.ip);
  const jatah = await ambilJatahSemua(aturan);
  if (!jatah.diizinkan) {
    throw terlaluBanyakPercobaan(
      `Terlalu banyak percobaan masuk. Coba lagi dalam ${DURASI_BLOKIR_MENIT} menit, atau hubungi pemilik usaha bila lupa kata sandi.`,
      jatah.sisaDetik,
    );
  }

  const akun = await prisma().akun.findUnique({ where: { email: input.email } });
  const cocok = await cocokKataSandi(akun?.passwordHash ?? null, input.kataSandi);
  if (!akun || !cocok) {
    throw new AppError(401, "Email atau kata sandi tidak sesuai. Periksa kembali isiannya, lalu coba lagi.", {
      kode: "KREDENSIAL_SALAH",
    });
  }

  await resetJatah([aturan[0].kunci]);
  const sesi = await buatSesi(akun.id);
  return { ...sesi, akunId: akun.id, perusahaanId: akun.perusahaanId };
}

export async function cariSesi(token: string): Promise<SesiAktif | null> {
  if (!token) return null;
  const sesi = await prisma().sesi.findUnique({
    where: { tokenHash: sha256Hex(token) },
    include: { akun: { include: { perusahaan: { select: { nama: true } } } } },
  });
  if (!sesi || sesi.kedaluwarsaPada.getTime() <= Date.now()) return null;
  return {
    sesiId: sesi.id,
    akunId: sesi.akunId,
    nama: sesi.akun.nama,
    email: sesi.akun.email,
    perusahaanId: sesi.akun.perusahaanId,
    namaPerusahaan: sesi.akun.perusahaan.nama,
  };
}

export async function akhiriSesi(token: string): Promise<void> {
  if (!token) return;
  await prisma().sesi.deleteMany({ where: { tokenHash: sha256Hex(token) } });
}
