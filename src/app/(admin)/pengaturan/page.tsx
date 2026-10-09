import type { Metadata } from "next";
import { JudulHalaman } from "@/components/ui/kartu";
import { wajibSesi } from "@/server/auth/halaman";
import { FormAkun } from "./form-akun";
import { FormPengaturan } from "./form-pengaturan";

export const metadata: Metadata = { title: "Pengaturan" };

export default async function HalamanPengaturan() {
  await wajibSesi();
  return (
    <>
      <JudulHalaman
        judul="Pengaturan"
        deskripsi="Aturan perusahaan Anda: hari kerja, potongan absensi, dan bonus target. Perubahan berlaku untuk periode yang masih berupa draf."
      />
      <div className="space-y-6">
        <FormPengaturan />
        <FormAkun />
      </div>
    </>
  );
}
