import type { Metadata } from "next";
import { KepalaLangkah, NavigasiLangkah } from "@/components/admin/langkah";
import { wajibSesi } from "@/server/auth/halaman";
import { dbPerusahaan } from "@/server/db/tenant";
import { muatPeriode } from "@/server/services/periode";
import { FormInsentif } from "./form-insentif";

export const metadata: Metadata = { title: "Insentif" };

export default async function LangkahInsentif({ params }: PageProps<"/periode/[id]/insentif">) {
  const sesi = await wajibSesi();
  const { id } = await params;
  const periode = await muatPeriode(dbPerusahaan(sesi.perusahaanId), id);
  return (
    <>
      <KepalaLangkah slug="insentif" />
      <FormInsentif periodeId={periode.id} final={periode.status === "FINAL"} />
      <NavigasiLangkah periodeId={periode.id} slug="insentif" />
    </>
  );
}
