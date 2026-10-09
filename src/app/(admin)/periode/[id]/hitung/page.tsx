import type { Metadata } from "next";
import { KepalaLangkah, NavigasiLangkah } from "@/components/admin/langkah";
import { labelPeriode } from "@/domain/periode";
import { wajibSesi } from "@/server/auth/halaman";
import { dbPerusahaan } from "@/server/db/tenant";
import { muatPeriode } from "@/server/services/periode";
import { PanelHitung } from "./panel-hitung";

export const metadata: Metadata = { title: "Hitung Gaji" };

export default async function LangkahHitung({ params }: PageProps<"/periode/[id]/hitung">) {
  const sesi = await wajibSesi();
  const { id } = await params;
  const periode = await muatPeriode(dbPerusahaan(sesi.perusahaanId), id);
  return (
    <>
      <KepalaLangkah slug="hitung" />
      <PanelHitung periodeId={periode.id} label={labelPeriode(periode)} final={periode.status === "FINAL"} />
      <NavigasiLangkah periodeId={periode.id} slug="hitung" />
    </>
  );
}
