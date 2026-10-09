import type { Metadata } from "next";
import { KepalaLangkah, NavigasiLangkah } from "@/components/admin/langkah";
import { wajibSesi } from "@/server/auth/halaman";
import { dbPerusahaan } from "@/server/db/tenant";
import { namaBerkasGaji } from "@/server/excel/ekspor-gaji";
import { muatPeriode } from "@/server/services/periode";
import { PanelEkspor } from "./panel-ekspor";

export const metadata: Metadata = { title: "Ekspor" };

export default async function LangkahEkspor({ params }: PageProps<"/periode/[id]/ekspor">) {
  const sesi = await wajibSesi();
  const { id } = await params;
  const periode = await muatPeriode(dbPerusahaan(sesi.perusahaanId), id);
  return (
    <>
      <KepalaLangkah slug="ekspor" />
      <PanelEkspor periodeId={periode.id} final={periode.status === "FINAL"} namaBerkas={namaBerkasGaji(periode)} />
      <NavigasiLangkah periodeId={periode.id} slug="ekspor" />
    </>
  );
}
