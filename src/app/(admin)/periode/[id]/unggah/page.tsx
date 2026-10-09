import type { Metadata } from "next";
import { KepalaLangkah, NavigasiLangkah } from "@/components/admin/langkah";
import { Pesan } from "@/components/ui/pesan";
import { wajibSesi } from "@/server/auth/halaman";
import { dbPerusahaan } from "@/server/db/tenant";
import { muatPeriode } from "@/server/services/periode";
import { FormUnggah } from "./form-unggah";

export const metadata: Metadata = { title: "Unggah Absensi" };

export default async function LangkahUnggah({ params }: PageProps<"/periode/[id]/unggah">) {
  const sesi = await wajibSesi();
  const { id } = await params;
  const periode = await muatPeriode(dbPerusahaan(sesi.perusahaanId), id);

  return (
    <>
      <KepalaLangkah slug="unggah" />
      {periode.status === "FINAL" ? (
        <Pesan jenis="info" judul="Periode sudah final">
          Absensi periode ini tidak dapat diubah lagi. Buka kembali periode dari halaman Riwayat bila perlu mengunggah ulang.
        </Pesan>
      ) : (
        <FormUnggah periodeId={periode.id} />
      )}
      <NavigasiLangkah periodeId={periode.id} slug="unggah" />
    </>
  );
}
