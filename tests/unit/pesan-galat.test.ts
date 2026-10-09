import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Audit FR-20: setiap pesan galat yang bisa sampai ke pengguna harus berbahasa Indonesia dan memuat langkah perbaikan.
// Sumbernya dipindai dari kode: skema validasi Zod serta pembuat galat server (tidakValid, bentrok, AppError).

function semuaBerkas(folder: string, hasil: string[] = []): string[] {
  for (const entri of readdirSync(folder, { withFileTypes: true })) {
    if (entri.name === "generated" || entri.name === "node_modules") continue;
    const jalur = join(folder, entri.name);
    if (entri.isDirectory()) semuaBerkas(jalur, hasil);
    else if (/\.(ts|tsx)$/.test(entri.name)) hasil.push(jalur.replaceAll("\\", "/"));
  }
  return hasil;
}

const LITERAL = String.raw`(["\`])((?:\\.|(?!\1)[^\\])*)\1`;
const POLA_PEMBUAT = new RegExp(String.raw`\b(?:tidakValid|bentrok|terlaluBanyakPercobaan)\(\s*${LITERAL}`, "g");
const POLA_APPERROR = new RegExp(String.raw`new AppError\(\s*\d+,\s*${LITERAL}`, "g");
const POLA_ZOD_ERROR = new RegExp(String.raw`\berror:\s*${LITERAL}`, "g");
const POLA_ZOD_ARGUMEN = new RegExp(String.raw`\.(?:min|max|length|regex|refine|email|uuid)\([^"\`()]*(?:\([^)]*\))?[^"\`()]*,\s*${LITERAL}`, "g");

interface Pesan {
  berkas: string;
  teks: string;
}

function kumpulkan(): Pesan[] {
  const hasil: Pesan[] = [];
  for (const berkas of semuaBerkas("src")) {
    if (berkas.startsWith("src/domain/")) continue; // penjaga internal, tidak sampai ke pengguna
    const isi = readFileSync(berkas, "utf8");
    for (const pola of [POLA_PEMBUAT, POLA_APPERROR, POLA_ZOD_ERROR, POLA_ZOD_ARGUMEN]) {
      for (const cocok of isi.matchAll(pola)) hasil.push({ berkas, teks: cocok[2] });
    }
  }
  return hasil;
}

const KATA_PERBAIKAN =
  /\b(periksa|isi|isikan|pilih|coba|tekan|hubungi|muat ulang|tambahkan|kurangi|gunakan|ketik|hitung|buka|lengkapi|simpan|ubah|salin|hapus|tunggu|masuk|daftar|daftarkan|unggah|aktifkan|ganti|cocokkan|ulangi|kembali|centang|akui|tulis|bagi|buat|perbaiki|pastikan|lanjutkan|konfirmasi|silakan|sesuaikan|kecilkan|pecah|pakai|naikkan|turunkan|perbarui|kosongkan|pisahkan|gabungkan|mulai|atur|unduh|tutup|kirim|gabung|timpa)\b/i;

const KATA_INGGRIS = /\b(invalid|required|failed|the|must|should|cannot|unable|please|error|expected|received|string|number)\b/i;

describe("audit pesan galat (FR-20)", () => {
  const semua = kumpulkan();

  it("memindai pesan dalam jumlah yang masuk akal, supaya audit tidak diam-diam kosong", () => {
    expect(semua.length).toBeGreaterThan(80);
  });

  it("setiap pesan galat memuat langkah perbaikan", () => {
    const tanpaLangkah = semua.filter((p) => !KATA_PERBAIKAN.test(p.teks)).map((p) => `${p.berkas}: ${p.teks}`);
    expect(tanpaLangkah).toEqual([]);
  });

  it("tidak ada pesan galat berbahasa Inggris atau kode galat mentah", () => {
    const inggris = semua.filter((p) => KATA_INGGRIS.test(p.teks.replace(/\$\{[^}]*\}/g, ""))).map((p) => `${p.berkas}: ${p.teks}`);
    expect(inggris).toEqual([]);
  });

  it("setiap pesan berupa kalimat utuh yang diawali huruf kapital dan diakhiri tanda baca", () => {
    const rusak = semua
      .filter((p) => !/^[A-Z$']/.test(p.teks) || !/[.!?]$/.test(p.teks.replace(/\$\{[^}]*\}$/, ".")))
      .map((p) => `${p.berkas}: ${p.teks}`);
    expect(rusak).toEqual([]);
  });
});
