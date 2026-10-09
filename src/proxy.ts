import { type NextRequest, NextResponse } from "next/server";
import { HEADER_TUJUAN, NAMA_COOKIE_SESI } from "@/lib/konstanta";

// Rute yang boleh diakses tanpa sesi: halaman masuk, daftar, halaman karyawan, dan API-nya.
const HALAMAN_PUBLIK = ["/masuk", "/daftar", "/lihat-gaji"];
const API_PUBLIK = ["/api/auth/daftar", "/api/auth/masuk", "/api/auth/keluar", "/api/publik/"];

function cocok(jalur: string, daftar: string[]): boolean {
  return daftar.some((p) => jalur === p || jalur.startsWith(p.endsWith("/") ? p : `${p}/`));
}

/**
 * Pemeriksaan awal: ada atau tidaknya cookie sesi. Keabsahan sesi diperiksa lagi di setiap route handler
 * dan halaman (proxy sengaja tidak mengakses basis data), jadi cookie palsu tidak memberi akses ke data.
 */
export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (cocok(pathname, HALAMAN_PUBLIK) || cocok(pathname, API_PUBLIK)) return NextResponse.next();

  if (req.cookies.has(NAMA_COOKIE_SESI)) {
    const header = new Headers(req.headers);
    header.set(HEADER_TUJUAN, `${pathname}${search}`);
    return NextResponse.next({ request: { headers: header } });
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { pesan: "Sesi Anda sudah berakhir atau Anda belum masuk. Silakan masuk kembali.", kode: "TIDAK_ADA_SESI" },
      { status: 401 },
    );
  }

  if (pathname === "/") return NextResponse.redirect(new URL("/masuk", req.url));

  const tujuan = new URL("/masuk", req.url);
  tujuan.searchParams.set("lanjut", `${pathname}${search}`);
  return NextResponse.redirect(tujuan);
}

export const config = {
  // Semua jalur kecuali aset statis Next.js dan berkas dengan ekstensi (ikon, gambar).
  matcher: ["/((?!_next/static|_next/image|.*\\..*).*)"],
};
