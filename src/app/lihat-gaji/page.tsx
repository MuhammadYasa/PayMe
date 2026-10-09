import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { FormLihatGaji } from "./form-lihat-gaji";

export const metadata: Metadata = {
  title: "Lihat Gaji Saya",
  robots: { index: false, follow: false },
};

export default function HalamanLihatGaji() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <header className="mb-6 space-y-3">
        <Logo ukuran={36} />
        <h1 className="text-2xl font-bold">Lihat Gaji Saya</h1>
        <p className="max-w-2xl text-teks-redup">
          Isi nama lengkap dan nomor rekening Anda sesuai data di perusahaan. Hanya gaji yang sudah final yang ditampilkan, dan data hilang dari layar saat halaman ditutup.
        </p>
      </header>
      <FormLihatGaji />
      <p className="mt-8 text-center text-teks-redup">
        Bagian HRD?{" "}
        <Link href="/masuk" className="font-semibold text-merek underline underline-offset-2">
          Masuk ke PayMe
        </Link>
      </p>
    </main>
  );
}
