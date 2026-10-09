import "server-only";
import { hash, verify } from "@node-rs/argon2";

// Argon2id dengan parameter minimum rekomendasi OWASP (19 MiB, 2 iterasi, 1 jalur).
const OPSI = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export function hashKataSandi(kataSandi: string): Promise<string> {
  return hash(kataSandi, OPSI);
}

let hashPalsu: Promise<string> | undefined;

/**
 * Bila akun tidak ada (`hashTersimpan` null), verifikasi tetap dijalankan terhadap hash palsu agar
 * waktu respons tidak membocorkan apakah sebuah email terdaftar.
 */
export async function cocokKataSandi(hashTersimpan: string | null, kataSandi: string): Promise<boolean> {
  const target = hashTersimpan ?? (await (hashPalsu ??= hash("pengisi-untuk-menyamakan-waktu", OPSI)));
  try {
    const cocok = await verify(target, kataSandi);
    return hashTersimpan !== null && cocok;
  } catch {
    return false;
  }
}
