import "server-only";
import { Prisma } from "@/generated/prisma/client";

function kodeGalat(galat: unknown): string | undefined {
  return galat instanceof Prisma.PrismaClientKnownRequestError ? galat.code : undefined;
}

export const adalahPelanggaranUnik = (galat: unknown): boolean => kodeGalat(galat) === "P2002";
export const adalahTidakDitemukan = (galat: unknown): boolean => kodeGalat(galat) === "P2025";
export const adalahKunciAsingGagal = (galat: unknown): boolean => kodeGalat(galat) === "P2003";

/** Pelanggaran constraint bernama (mis. EXCLUDE) dikenali dari nama constraint pada pesan galat basis data. */
export function menyebutConstraint(galat: unknown, namaConstraint: string): boolean {
  return galat instanceof Error && galat.message.includes(namaConstraint);
}
