import type { Metadata } from "next";
import { wajibSesi } from "@/server/auth/halaman";
import { DaftarKaryawan } from "./daftar-karyawan";

export const metadata: Metadata = { title: "Karyawan" };

export default async function HalamanKaryawan() {
  await wajibSesi();
  return <DaftarKaryawan />;
}
