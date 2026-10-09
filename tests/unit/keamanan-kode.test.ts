import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function semuaBerkas(folder: string, hasil: string[] = []): string[] {
  for (const entri of readdirSync(folder, { withFileTypes: true })) {
    if (entri.name === "generated" || entri.name === "node_modules") continue;
    const jalur = join(folder, entri.name);
    if (entri.isDirectory()) semuaBerkas(jalur, hasil);
    else if (/\.(ts|tsx)$/.test(entri.name)) hasil.push(jalur.replaceAll("\\", "/"));
  }
  return hasil;
}

const berkasSumber = semuaBerkas("src");

describe("aturan keamanan kode", () => {
  it("SQL mentah hanya dipakai di pembatas percobaan (tabel tanpa perusahaan_id)", () => {
    const pelanggar = berkasSumber.filter((jalur) => {
      if (jalur === "src/server/pembatas.ts") return false;
      return /\$(queryRaw|executeRaw)(Unsafe)?\b/.test(readFileSync(jalur, "utf8"));
    });
    expect(pelanggar).toEqual([]);
  });

  it("tidak ada dangerouslySetInnerHTML", () => {
    const pelanggar = berkasSumber.filter((jalur) => readFileSync(jalur, "utf8").includes("dangerouslySetInnerHTML"));
    expect(pelanggar).toEqual([]);
  });

  it("console hanya dipakai lewat modul log agar data sensitif tersamarkan", () => {
    const pelanggar = berkasSumber.filter((jalur) => {
      if (jalur === "src/server/log.ts") return false;
      return /\bconsole\.(log|warn|error|info|debug)\(/.test(readFileSync(jalur, "utf8"));
    });
    expect(pelanggar).toEqual([]);
  });

  it("tidak ada kunci atau kata sandi tertanam di kode", () => {
    const pola = /(password|secret|api[_-]?key)\s*[:=]\s*["'][^"']{8,}["']/i;
    const pelanggar = berkasSumber.filter((jalur) => pola.test(readFileSync(jalur, "utf8")));
    expect(pelanggar).toEqual([]);
  });
});
