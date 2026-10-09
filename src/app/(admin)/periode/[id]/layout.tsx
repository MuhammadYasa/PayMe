import { notFound } from "next/navigation";
import { z } from "zod";
import { Stepper } from "@/components/admin/stepper";
import { Badge } from "@/components/ui/badge";
import { labelPeriode } from "@/domain/periode";
import { wajibSesi } from "@/server/auth/halaman";
import { dbPerusahaan } from "@/server/db/tenant";
import { AppError } from "@/server/errors";
import { muatPeriode } from "@/server/services/periode";

export async function generateMetadata({ params }: LayoutProps<"/periode/[id]">) {
  const { id } = await params;
  return { title: z.uuid().safeParse(id).success ? "Penggajian" : "Tidak ditemukan" };
}

export default async function LayoutPeriode({ children, params }: LayoutProps<"/periode/[id]">) {
  const sesi = await wajibSesi();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  let periode;
  try {
    periode = await muatPeriode(dbPerusahaan(sesi.perusahaanId), id);
  } catch (galat) {
    if (galat instanceof AppError && galat.status === 404) notFound();
    throw galat;
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">Penggajian {labelPeriode(periode)}</h1>
        <Badge nada={periode.status === "FINAL" ? "sukses" : "peringatan"}>{periode.status === "FINAL" ? "Final" : "Draf"}</Badge>
        <span className="text-teks-redup">{periode.jumlahHari} hari</span>
      </div>
      <Stepper periodeId={periode.id} final={periode.status === "FINAL"} />
      {children}
    </>
  );
}
