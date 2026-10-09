import type { ReactNode } from "react";

export function Kartu({
  judul,
  deskripsi,
  aksi,
  children,
  className = "",
}: {
  judul?: ReactNode;
  deskripsi?: ReactNode;
  aksi?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-garis bg-kartu shadow-sm ${className}`}>
      {judul || aksi ? (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-garis px-5 py-4">
          <div className="min-w-0">
            {judul ? <h2 className="text-lg font-bold">{judul}</h2> : null}
            {deskripsi ? <p className="mt-0.5 text-teks-redup">{deskripsi}</p> : null}
          </div>
          {aksi ? <div className="flex flex-wrap items-center gap-2">{aksi}</div> : null}
        </header>
      ) : null}
      {children !== undefined ? <div className="px-5 py-4">{children}</div> : null}
    </section>
  );
}

export function JudulHalaman({ judul, deskripsi, aksi }: { judul: string; deskripsi?: ReactNode; aksi?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold">{judul}</h1>
        {deskripsi ? <p className="mt-1 max-w-3xl text-teks-redup">{deskripsi}</p> : null}
      </div>
      {aksi ? <div className="flex flex-wrap items-center gap-2">{aksi}</div> : null}
    </div>
  );
}
