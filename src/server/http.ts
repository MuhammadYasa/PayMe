import "server-only";
import { type NextRequest, NextResponse } from "next/server";
import { type ZodError, type ZodType, z } from "zod";
import { NAMA_COOKIE_PERANGKAT, NAMA_COOKIE_SESI } from "@/lib/konstanta";
import { ringkasGalatZod } from "@/lib/zod-galat";
import { adalahPelanggaranUnik, adalahTidakDitemukan } from "@/server/db/galat-prisma";
import { type DbPerusahaan, dbPerusahaan } from "@/server/db/tenant";
import { env } from "@/server/env";
import { AppError, tidakAdaSesi, tidakDitemukan } from "@/server/errors";
import { acakBase64Url } from "@/server/kripto";
import { log } from "@/server/log";
import { type SesiAktif, cariSesi } from "@/server/services/auth";

const MAKS_BODY_JSON_BYTE = 1_000_000;
const METODE_MUTASI = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const PESAN_GALAT_SERVER =
  "Terjadi kesalahan di server. Data Anda tidak berubah. Coba lagi beberapa saat lagi, dan hubungi pengelola aplikasi bila masih berulang.";

export function responsGalat(galat: unknown): NextResponse {
  if (galat instanceof AppError) {
    const header: Record<string, string> = {};
    if (galat.status === 429) {
      const sisa = (galat.data as { sisaDetik?: number } | undefined)?.sisaDetik;
      if (sisa) header["Retry-After"] = String(sisa);
    }
    return NextResponse.json(
      { pesan: galat.message, kolom: galat.kolom, kode: galat.kode, data: galat.data },
      { status: galat.status, headers: header },
    );
  }
  if (galat && typeof galat === "object" && "issues" in galat && Array.isArray((galat as ZodError).issues)) {
    const { pesan, kolom } = ringkasGalatZod(galat as ZodError);
    return NextResponse.json({ pesan, kolom, kode: "TIDAK_VALID" }, { status: 422 });
  }
  if (adalahPelanggaranUnik(galat)) {
    return NextResponse.json(
      { pesan: "Data yang sama sudah ada. Periksa daftar yang ada, atau ubah isiannya lalu coba lagi.", kode: "DATA_GANDA" },
      { status: 409 },
    );
  }
  if (adalahTidakDitemukan(galat)) {
    const g = tidakDitemukan();
    return NextResponse.json({ pesan: g.message, kode: g.kode }, { status: 404 });
  }
  log.error("galat_server", { galat });
  return NextResponse.json({ pesan: PESAN_GALAT_SERVER, kode: "GALAT_SERVER" }, { status: 500 });
}

/**
 * Perlindungan CSRF tambahan di atas cookie SameSite=Lax: permintaan yang mengubah data harus berasal
 * dari host yang sama bila browser menyertakan header Origin.
 */
export function periksaAsal(req: NextRequest): void {
  if (!METODE_MUTASI.has(req.method)) return;
  const asal = req.headers.get("origin");
  if (!asal) return;
  const ditolak = new AppError(
    403,
    "Permintaan ditolak karena berasal dari situs lain. Muat ulang halaman ini lalu coba lagi.",
    { kode: "ASAL_DITOLAK" },
  );
  let hostAsal: string;
  try {
    hostAsal = new URL(asal).host;
  } catch {
    throw ditolak;
  }
  const hostTujuan =
    (env().TRUST_PROXY ? req.headers.get("x-forwarded-host") : null) ?? req.headers.get("host") ?? req.nextUrl.host;
  if (hostAsal !== hostTujuan) throw ditolak;
}

export async function bacaJson<S extends ZodType>(req: Request, skema: S): Promise<z.output<S>> {
  const panjang = Number(req.headers.get("content-length") ?? 0);
  if (panjang > MAKS_BODY_JSON_BYTE) {
    throw new AppError(413, "Data yang dikirim terlalu besar. Kurangi isinya lalu coba lagi.", { kode: "TERLALU_BESAR" });
  }
  let mentah: unknown;
  try {
    mentah = await req.json();
  } catch {
    throw new AppError(400, "Data yang dikirim tidak terbaca. Muat ulang halaman lalu coba lagi.", { kode: "BODY_RUSAK" });
  }
  return skema.parse(mentah);
}

export function bacaQuery<S extends ZodType>(req: NextRequest, skema: S): z.output<S> {
  return skema.parse(Object.fromEntries(req.nextUrl.searchParams.entries()));
}

/** ID yang bukan UUID diperlakukan sebagai tidak ditemukan, bukan galat server. */
export function parseId(nilai: string, apa = "Data"): string {
  if (!z.uuid().safeParse(nilai).success) throw tidakDitemukan(apa);
  return nilai;
}

/**
 * IP klien hanya dipercaya bila aplikasi berjalan di belakang proxy tepercaya (TRUST_PROXY=true).
 * Entri terakhir pada X-Forwarded-For ditambahkan oleh proxy terdekat dan tidak dapat dipalsukan klien.
 */
export function ambilIp(req: Request): string | null {
  if (!env().TRUST_PROXY) return null;
  const daftar = req.headers.get("x-forwarded-for")?.split(",").map((s) => s.trim()).filter(Boolean);
  if (daftar && daftar.length > 0) return daftar[daftar.length - 1];
  return req.headers.get("x-real-ip");
}

export function ambilPerangkat(req: NextRequest): { id: string; baru: boolean } {
  const ada = req.cookies.get(NAMA_COOKIE_PERANGKAT)?.value;
  if (ada && /^[A-Za-z0-9_-]{16,64}$/.test(ada)) return { id: ada, baru: false };
  return { id: acakBase64Url(24), baru: true };
}

export function pasangCookiePerangkat(res: NextResponse, id: string): void {
  res.cookies.set({
    name: NAMA_COOKIE_PERANGKAT,
    value: id,
    httpOnly: true,
    sameSite: "lax",
    secure: env().NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export function pasangCookieSesi(res: NextResponse, token: string, kedaluwarsa: Date): void {
  res.cookies.set({
    name: NAMA_COOKIE_SESI,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: env().NODE_ENV === "production",
    path: "/",
    expires: kedaluwarsa,
  });
}

export function hapusCookieSesi(res: NextResponse): void {
  res.cookies.set({
    name: NAMA_COOKIE_SESI,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: env().NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export interface KonteksPublik<P> {
  req: NextRequest;
  params: P;
}

export interface KonteksAdmin<P> extends KonteksPublik<P> {
  sesi: SesiAktif;
  db: DbPerusahaan;
}

type ParamsRute = Record<string, string>;
type KonteksNext<P> = { params: Promise<P> };

function keResponse(hasil: unknown, statusBawaan = 200): Response {
  if (hasil instanceof Response) return hasil;
  return NextResponse.json(hasil ?? { ok: true }, { status: statusBawaan });
}

/** Route tanpa sesi (masuk, daftar, halaman karyawan). Tetap melewati pemeriksaan asal dan pemetaan galat. */
export function rutePublik<P extends ParamsRute = Record<string, never>>(
  fn: (konteks: KonteksPublik<P>) => Promise<unknown>,
) {
  return async (req: NextRequest, ctx: KonteksNext<P>): Promise<Response> => {
    try {
      periksaAsal(req);
      return keResponse(await fn({ req, params: await ctx.params }));
    } catch (galat) {
      return responsGalat(galat);
    }
  };
}

/**
 * Route admin: sesi wajib valid (401 bila tidak) dan semua akses data lewat klien yang terkunci pada
 * perusahaan dari sesi, bukan dari parameter klien (NFR-09).
 */
export function ruteAdmin<P extends ParamsRute = Record<string, never>>(
  fn: (konteks: KonteksAdmin<P>) => Promise<unknown>,
) {
  return async (req: NextRequest, ctx: KonteksNext<P>): Promise<Response> => {
    try {
      periksaAsal(req);
      const token = req.cookies.get(NAMA_COOKIE_SESI)?.value ?? "";
      const sesi = await cariSesi(token);
      if (!sesi) throw tidakAdaSesi();
      return keResponse(await fn({ req, params: await ctx.params, sesi, db: dbPerusahaan(sesi.perusahaanId) }));
    } catch (galat) {
      return responsGalat(galat);
    }
  };
}

export function buatResponse(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}
