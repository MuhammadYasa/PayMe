import { pengaturanSchema } from "@/domain/pengaturan";
import { bacaJson, ruteAdmin } from "@/server/http";
import { ambilPengaturan, simpanPengaturan } from "@/server/services/pengaturan";

export const GET = ruteAdmin(async ({ db }) => {
  return ambilPengaturan(db);
});

export const PUT = ruteAdmin(async ({ req, db }) => {
  return simpanPengaturan(db, await bacaJson(req, pengaturanSchema));
});
