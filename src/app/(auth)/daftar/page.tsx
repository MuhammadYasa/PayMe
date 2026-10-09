import type { Metadata } from "next";
import { arahkanBilaSudahMasuk } from "@/server/auth/halaman";
import { FormDaftar } from "./form-daftar";

export const metadata: Metadata = { title: "Daftar" };

export default async function HalamanDaftar() {
  await arahkanBilaSudahMasuk();
  return <FormDaftar />;
}
