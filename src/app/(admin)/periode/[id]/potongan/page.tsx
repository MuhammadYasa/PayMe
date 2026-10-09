import type { Metadata } from "next";
import { KepalaLangkah, NavigasiLangkah } from "@/components/admin/langkah";
import { wajibSesi } from "@/server/auth/halaman";
import { dbPerusahaan } from "@/server/db/tenant";
import { muatPeriode } from "@/server/services/periode";
import { PanelDenda } from "./panel-denda";
import { PanelPajakAsuransi } from "./panel-pajak-asuransi";

export const metadata: Metadata = { title: "Denda dan Potongan" };

export default async function LangkahPotongan({ params }: PageProps<"/periode/[id]/potongan">) {
  const sesi = await wajibSesi();
  const { id } = await params;
  const periode = await muatPeriode(dbPerusahaan(sesi.perusahaanId), id);
  const final = periode.status === "FINAL";
  return (
    <>
      <KepalaLangkah slug="potongan" />
      <div className="space-y-6">
        <PanelDenda periodeId={periode.id} final={final} />
        <PanelPajakAsuransi periodeId={periode.id} final={final} />
      </div>
      <NavigasiLangkah periodeId={periode.id} slug="potongan" />
    </>
  );
}
