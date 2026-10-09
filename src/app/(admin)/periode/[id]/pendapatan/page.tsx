import type { Metadata } from "next";
import { KepalaLangkah, NavigasiLangkah } from "@/components/admin/langkah";
import { wajibSesi } from "@/server/auth/halaman";
import { dbPerusahaan } from "@/server/db/tenant";
import { muatPeriode } from "@/server/services/periode";
import { FormPendapatan } from "./form-pendapatan";

export const metadata: Metadata = { title: "Pendapatan dan Target" };

export default async function LangkahPendapatan({ params }: PageProps<"/periode/[id]/pendapatan">) {
  const sesi = await wajibSesi();
  const { id } = await params;
  const periode = await muatPeriode(dbPerusahaan(sesi.perusahaanId), id);
  return (
    <>
      <KepalaLangkah slug="pendapatan" />
      <FormPendapatan periodeId={periode.id} final={periode.status === "FINAL"} />
      <NavigasiLangkah periodeId={periode.id} slug="pendapatan" />
    </>
  );
}
