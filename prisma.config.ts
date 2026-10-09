import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// `prisma generate` tidak butuh koneksi. Tanpa pengecualian ini, `npm install` di mesin
// yang belum punya .env (CI, clone baru) akan gagal pada skrip postinstall.
const hanyaGenerate = process.argv.includes("generate");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // `react-server` membuat paket server-only tidak melempar galat di luar Next.js.
    seed: "tsx --conditions react-server prisma/seed.ts",
  },
  datasource: {
    url: hanyaGenerate
      ? (process.env.DATABASE_URL ?? "postgresql://placeholder@localhost:5432/placeholder")
      : env("DATABASE_URL"),
  },
});
