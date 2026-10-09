"use client";

import { Tombol } from "@/components/ui/tombol";

export default function GalatHalaman({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-bold">Halaman ini belum bisa dimuat</h1>
      <p className="text-teks-redup">
        Terjadi gangguan saat menyiapkan halaman. Data Anda aman dan tidak berubah. Coba muat ulang; bila masih
        berulang, hubungi pengelola aplikasi.
      </p>
      <Tombol onClick={() => retry()}>Coba lagi</Tombol>
    </main>
  );
}
