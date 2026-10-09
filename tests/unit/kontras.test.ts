import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function ambilToken(): Map<string, string> {
  const css = readFileSync("src/app/globals.css", "utf8");
  const peta = new Map<string, string>();
  for (const cocok of css.matchAll(/--color-([a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) peta.set(cocok[1], cocok[2].toLowerCase());
  return peta;
}

function cahayaRelatif(hex: string): number {
  const saluran = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * saluran[0] + 0.7152 * saluran[1] + 0.0722 * saluran[2];
}

export function rasioKontras(a: string, b: string): number {
  const [terang, gelap] = [cahayaRelatif(a), cahayaRelatif(b)].sort((x, y) => y - x);
  return (terang + 0.05) / (gelap + 0.05);
}

const PUTIH = "#ffffff";

// Pasangan [warna teks, warna latar] yang benar-benar dipakai komponen. Nama mengacu ke token di globals.css.
const PASANGAN: [string, string][] = [
  ["teks", "halaman"],
  ["teks", "kartu"],
  ["teks", "merek-lembut"],
  ["teks-redup", "halaman"],
  ["teks-redup", "kartu"],
  ["placeholder", "kartu"],
  ["merek", "kartu"],
  ["merek", "merek-lembut"],
  ["merek-gelap", "merek-lembut"],
  [PUTIH, "merek"],
  [PUTIH, "merek-gelap"],
  [PUTIH, "bahaya"],
  [PUTIH, "bahaya-gelap"],
  ["sukses-teks", "sukses-latar"],
  ["peringatan-teks", "peringatan-latar"],
  ["bahaya-teks", "bahaya-latar"],
  ["bahaya-teks", "kartu"],
  ["info-teks", "info-latar"],
  ["netral-teks", "netral-latar"],
];

describe("kontras warna (NFR-07, T-004)", () => {
  const token = ambilToken();
  const nilai = (nama: string) => (nama.startsWith("#") ? nama : token.get(nama));

  it("semua token yang dirujuk tersedia di globals.css", () => {
    for (const [teks, latar] of PASANGAN) {
      expect(nilai(teks), `token ${teks}`).toBeDefined();
      expect(nilai(latar), `token ${latar}`).toBeDefined();
    }
  });

  for (const [teks, latar] of PASANGAN) {
    it(`${teks} di atas ${latar} minimal 4,5:1`, () => {
      expect(rasioKontras(nilai(teks)!, nilai(latar)!)).toBeGreaterThanOrEqual(4.5);
    });
  }
});

describe("ukuran font isi (NFR-07)", () => {
  function berkasTsx(folder: string, hasil: string[] = []): string[] {
    for (const entri of readdirSync(folder, { withFileTypes: true })) {
      const jalur = join(folder, entri.name);
      if (entri.isDirectory()) berkasTsx(jalur, hasil);
      else if (jalur.endsWith(".tsx")) hasil.push(jalur);
    }
    return hasil;
  }

  it("tidak ada kelas teks di bawah 14 px pada komponen dan halaman", () => {
    const terlarang = /\btext-(xs|\[(?:[0-9]|1[0-3])(?:\.\d+)?px\]|\[0?\.[0-8]\d*rem\])/;
    const pelanggar = berkasTsx("src").filter((jalur) => terlarang.test(readFileSync(jalur, "utf8")));
    expect(pelanggar).toEqual([]);
  });

  it("font dasar halaman 15 px dan tidak lebih kecil dari 14 px", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    expect(css).toMatch(/font-size:\s*0\.9375rem/);
  });
});
