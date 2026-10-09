import type { ReactNode } from "react";
import { Logo } from "@/components/ui/logo";
import type { SesiAktif } from "@/server/services/auth";
import { Navigasi } from "./navigasi";
import { PenjagaSesi } from "./penjaga-sesi";
import { TombolKeluar } from "./tombol-keluar";

export function CangkangAdmin({ sesi, children }: { sesi: SesiAktif; children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <a
        href="#konten"
        className="sr-only z-50 rounded-lg bg-kartu px-4 py-2 font-semibold text-merek focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Lewati ke konten utama
      </a>

      <header className="border-b border-garis bg-kartu">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-3 lg:px-6">
          <Logo />
          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <p className="font-semibold leading-tight">{sesi.namaPerusahaan}</p>
              <p className="text-sm leading-tight text-teks-redup">{sesi.nama}</p>
            </div>
            <TombolKeluar />
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1400px] gap-6 px-4 py-6 lg:px-6">
        <aside className="hidden w-56 shrink-0 lg:block">
          <Navigasi orientasi="vertikal" />
        </aside>
        <div className="min-w-0 flex-1">
          <div className="mb-5 lg:hidden">
            <Navigasi orientasi="horizontal" />
          </div>
          <main id="konten" tabIndex={-1} className="outline-none">
            {children}
          </main>
        </div>
      </div>

      <PenjagaSesi />
    </div>
  );
}
