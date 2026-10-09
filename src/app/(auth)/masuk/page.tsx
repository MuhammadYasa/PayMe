import type { Metadata } from "next";
import { arahkanBilaSudahMasuk } from "@/server/auth/halaman";
import { FormMasuk } from "./form-masuk";

export const metadata: Metadata = { title: "Masuk" };

export default async function HalamanMasuk({ searchParams }: PageProps<"/masuk">) {
  await arahkanBilaSudahMasuk();
  const { lanjut } = await searchParams;
  return <FormMasuk lanjut={typeof lanjut === "string" ? lanjut : undefined} />;
}
