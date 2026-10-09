import { redirect } from "next/navigation";
import { sesiSaatIni } from "@/server/auth/halaman";

export default async function Beranda() {
  redirect((await sesiSaatIni()) ? "/dashboard" : "/masuk");
}
