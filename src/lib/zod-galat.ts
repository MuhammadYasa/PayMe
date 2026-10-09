import type { ZodError } from "zod";

/** Mengubah galat Zod menjadi pesan per kolom plus satu pesan ringkas untuk bagian atas formulir. */
export function ringkasGalatZod(galat: Pick<ZodError, "issues">): { pesan: string; kolom: Record<string, string> } {
  const kolom: Record<string, string> = {};
  for (const isu of galat.issues) {
    const kunci = isu.path.join(".") || "_";
    if (!(kunci in kolom)) kolom[kunci] = isu.message;
  }
  const daftar = Object.values(kolom);
  const pesan =
    daftar.length === 1 ? daftar[0] : `Ada ${daftar.length} isian yang belum benar. Periksa kolom yang ditandai, lalu coba lagi.`;
  return { pesan, kolom };
}
