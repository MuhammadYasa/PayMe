import type { Metadata } from "next";
import { KepalaLangkah, NavigasiLangkah } from "@/components/admin/langkah";
import { wajibSesi } from "@/server/auth/halaman";
import { dbPerusahaan } from "@/server/db/tenant";
import { muatPeriode } from "@/server/services/periode";
import { FormCatatan } from "./form-catatan";

export const metadata: Metadata = { title: "Libur, Izin dan Cuti" };

export default async function LangkahCatatan({ params }: PageProps<"/periode/[id]/catatan">) {
  const sesi = await wajibSesi();
  const { id } = await params;
  const periode = await muatPeriode(dbPerusahaan(sesi.perusahaanId), id);
  return (
    <>
      <KepalaLangkah slug="catatan" />
      <FormCatatan periodeId={periode.id} awal={periode.tanggalAwal} akhir={periode.tanggalAkhir} final={periode.status === "FINAL"} />
      <NavigasiLangkah periodeId={periode.id} slug="catatan" />
    </>
  );
}
