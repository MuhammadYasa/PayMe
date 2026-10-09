import { tambahAkunSkema } from "@/skema/auth";
import { bacaJson, buatResponse, ruteAdmin } from "@/server/http";
import { tambahAkun } from "@/server/services/auth";

// Akun tambahan selalu masuk ke perusahaan milik akun yang sedang masuk.
export const POST = ruteAdmin(async ({ req, sesi }) => {
  const input = await bacaJson(req, tambahAkunSkema);
  return buatResponse(await tambahAkun(sesi.perusahaanId, input), 201);
});
