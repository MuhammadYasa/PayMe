"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LANGKAH, urlLangkah } from "@/lib/langkah";

export function Stepper({ periodeId, final }: { periodeId: string; final: boolean }) {
  const jalur = usePathname();
  const dasar = `/periode/${periodeId}`;
  const segmen = jalur.startsWith(dasar) ? (jalur.slice(dasar.length).replace(/^\/+/, "").split("/")[0] ?? "") : "";
  const indeksAktif = Math.max(
    0,
    LANGKAH.findIndex((l) => l.slug === segmen),
  );

  return (
    <nav aria-label="Langkah penggajian" className="mb-6">
      <ol className="relative flex gap-1.5 overflow-x-auto pb-2">
        {LANGKAH.map((langkah, i) => {
          const aktif = i === indeksAktif;
          const selesai = !aktif && (final || i < indeksAktif);
          return (
            <li key={langkah.slug || "periode"} className="min-w-[6rem] flex-1">
              <Link
                href={urlLangkah(periodeId, langkah.slug)}
                aria-current={aktif ? "step" : undefined}
                className={`flex h-full flex-col items-start gap-1.5 rounded-lg border px-2.5 py-2.5 transition-colors ${
                  aktif
                    ? "border-merek bg-merek text-white"
                    : selesai
                      ? "border-merek-garis bg-merek-lembut text-teks hover:border-merek"
                      : "border-garis bg-kartu text-teks hover:border-garis-tebal"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`flex size-7 items-center justify-center rounded-full text-sm font-bold ${
                    aktif ? "bg-white text-merek" : selesai ? "bg-merek text-white" : "border-2 border-garis-tebal text-teks-redup"
                  }`}
                >
                  {selesai ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
                      <path d="M5 12.5l4.5 4.5L19 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </span>
                <span className="text-sm font-semibold leading-tight">{langkah.judul}</span>
                <span className="sr-only">
                  {aktif ? "Langkah saat ini" : selesai ? "Sudah dilewati" : "Belum dikerjakan"}, langkah {i + 1} dari {LANGKAH.length}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
