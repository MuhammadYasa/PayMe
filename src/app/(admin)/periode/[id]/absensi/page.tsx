import type { Metadata } from "next";
import { KepalaLangkah } from "@/components/admin/langkah";
import { wajibSesi } from "@/server/auth/halaman";
import { dbPerusahaan } from "@/server/db/tenant";
import { muatPeriode } from "@/server/services/periode";
import { DaftarAbsensi } from "./daftar-absensi";

export const metadata: Metadata = { title: "Lengkapi Absensi" };

export default async function LangkahAbsensi({ params }: PageProps<"/periode/[id]/absensi">) {
  const sesi = await wajibSesi();
  const { id } = await params;
  const periode = await muatPeriode(dbPerusahaan(sesi.perusahaanId), id);
  return (
    <>
      <KepalaLangkah slug="absensi" />
      <DaftarAbsensi periodeId={periode.id} final={periode.status === "FINAL"} />
    </>
  );
}
