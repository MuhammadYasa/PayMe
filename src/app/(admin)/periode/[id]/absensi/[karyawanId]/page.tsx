import type { Metadata } from "next";
import { z } from "zod";
import { notFound } from "next/navigation";
import { wajibSesi } from "@/server/auth/halaman";
import { DetailAbsensi } from "./detail-absensi";

export const metadata: Metadata = { title: "Absensi Karyawan" };

export default async function HalamanDetailAbsensi({ params }: PageProps<"/periode/[id]/absensi/[karyawanId]">) {
  await wajibSesi();
  const { id, karyawanId } = await params;
  if (!z.uuid().safeParse(karyawanId).success) notFound();
  return <DetailAbsensi periodeId={id} karyawanId={karyawanId} />;
}
