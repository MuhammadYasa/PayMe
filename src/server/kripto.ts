import "server-only";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { env } from "./env";

export function sha256Hex(teks: string): string {
  return createHash("sha256").update(teks).digest("hex");
}

/** HMAC dengan APP_SECRET. Dipakai untuk menyamarkan IP, perangkat, dan email pada kunci pembatas percobaan. */
export function hmacHex(teks: string): string {
  return createHmac("sha256", env().APP_SECRET).update(teks).digest("hex");
}

export function acakBase64Url(jumlahByte = 32): string {
  return randomBytes(jumlahByte).toString("base64url");
}

/** "1234567890" menjadi "••••7890". Nomor yang terlalu pendek disamarkan seluruhnya. */
export function samarkanRekening(nilai: string): string {
  const digit = nilai.replace(/\D/g, "");
  return digit.length <= 4 ? "••••" : `••••${digit.slice(-4)}`;
}
