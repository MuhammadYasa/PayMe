"use client";

import "./globals.css";

export default function GalatGlobal({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="id">
      <body className="min-h-screen">
        <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
          <h1 className="text-2xl font-bold">Aplikasi sedang bermasalah</h1>
          <p className="text-teks-redup">
            Terjadi gangguan di sisi kami. Data Anda aman dan tidak berubah. Coba muat ulang; bila masih berulang,
            hubungi pengelola aplikasi.
          </p>
          <button
            type="button"
            onClick={() => retry()}
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-merek px-4 font-semibold text-white hover:bg-merek-gelap"
          >
            Coba lagi
          </button>
        </main>
      </body>
    </html>
  );
}
