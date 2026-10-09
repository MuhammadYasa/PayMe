import "dotenv/config";
import { spawnSync } from "node:child_process";

const urlUji = process.env.TEST_DATABASE_URL;

if (!urlUji) {
  console.error("TEST_DATABASE_URL belum diisi. Salin .env.example ke .env lalu jalankan `npm run db:up`.");
  process.exit(1);
}

const hasil = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, DATABASE_URL: urlUji },
});

process.exit(hasil.status ?? 1);
