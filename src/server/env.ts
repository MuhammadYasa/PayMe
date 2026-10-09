import "server-only";
import { z } from "zod";

const skema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL belum diisi."),
  APP_SECRET: z.string().min(32, "APP_SECRET minimal 32 karakter."),
  TRUST_PROXY: z
    .enum(["true", "false"])
    .default("false")
    .transform((nilai) => nilai === "true"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type Lingkungan = z.infer<typeof skema>;

let tersimpan: Lingkungan | undefined;

/** Dibaca saat dibutuhkan, bukan saat modul dimuat, supaya `next build` tidak gagal di mesin tanpa .env. */
export function env(): Lingkungan {
  if (!tersimpan) {
    const hasil = skema.safeParse(process.env);
    if (!hasil.success) {
      const rincian = hasil.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      throw new Error(`Konfigurasi lingkungan belum lengkap. ${rincian}`);
    }
    tersimpan = hasil.data;
  }
  return tersimpan;
}
