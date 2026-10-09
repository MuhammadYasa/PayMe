import type { ReactNode } from "react";

export function KeadaanKosong({ judul, deskripsi, aksi }: { judul: string; deskripsi?: ReactNode; aksi?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-garis-tebal bg-kartu px-6 py-12 text-center">
      <p className="text-lg font-bold">{judul}</p>
      {deskripsi ? <p className="mx-auto mt-1 max-w-xl text-teks-redup">{deskripsi}</p> : null}
      {aksi ? <div className="mt-5 flex justify-center gap-2">{aksi}</div> : null}
    </div>
  );
}
