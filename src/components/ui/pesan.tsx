import type { ReactNode } from "react";

export type JenisPesan = "galat" | "peringatan" | "sukses" | "info";

const gaya: Record<JenisPesan, string> = {
  galat: "border-bahaya bg-bahaya-latar text-bahaya-teks",
  peringatan: "border-peringatan-teks bg-peringatan-latar text-peringatan-teks",
  sukses: "border-sukses-teks bg-sukses-latar text-sukses-teks",
  info: "border-info-teks bg-info-latar text-info-teks",
};

const label: Record<JenisPesan, string> = {
  galat: "Galat",
  peringatan: "Perhatian",
  sukses: "Berhasil",
  info: "Informasi",
};

function Ikon({ jenis }: { jenis: JenisPesan }) {
  const umum = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, "aria-hidden": true } as const;
  if (jenis === "galat")
    return (
      <svg {...umum}>
        <circle cx="12" cy="12" r="9" />
        <path d="M15 9l-6 6M9 9l6 6" strokeLinecap="round" />
      </svg>
    );
  if (jenis === "peringatan")
    return (
      <svg {...umum}>
        <path d="M12 3l10 18H2L12 3z" strokeLinejoin="round" />
        <path d="M12 10v4M12 17.5v.01" strokeLinecap="round" />
      </svg>
    );
  if (jenis === "sukses")
    return (
      <svg {...umum}>
        <circle cx="12" cy="12" r="9" />
        <path d="M8 12.5l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  return (
    <svg {...umum}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8v.01" strokeLinecap="round" />
    </svg>
  );
}

interface PropPesan {
  jenis?: JenisPesan;
  judul?: string;
  children?: ReactNode;
  aksi?: ReactNode;
  className?: string;
}

/** Pesan dengan ikon dan label teks, sehingga jenisnya tidak hanya dibedakan lewat warna. */
export function Pesan({ jenis = "info", judul, children, aksi, className = "" }: PropPesan) {
  return (
    <div
      role={jenis === "galat" ? "alert" : "status"}
      className={`flex items-start gap-3 rounded-lg border-l-4 px-4 py-3 ${gaya[jenis]} ${className}`}
    >
      <span className="mt-0.5 shrink-0">
        <Ikon jenis={jenis} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          {judul ? <span className="sr-only">{label[jenis]}: </span> : null}
          {judul ?? label[jenis]}
        </p>
        {children ? <div className="mt-0.5 text-[15px]">{children}</div> : null}
      </div>
      {aksi ? <div className="shrink-0">{aksi}</div> : null}
    </div>
  );
}

/** Ringkasan di atas formulir bila ada lebih dari satu kolom yang bermasalah. */
export function RingkasanGalat({
  pesan,
  kolom,
  judul = "Belum bisa disimpan",
}: {
  pesan?: string | null;
  kolom?: Record<string, string>;
  judul?: string;
}) {
  const daftar = Object.values(kolom ?? {});
  if (!pesan && daftar.length === 0) return null;
  if (daftar.length <= 1) {
    return (
      <Pesan jenis="galat" judul={judul}>
        {pesan ?? daftar[0]}
      </Pesan>
    );
  }
  return (
    <Pesan jenis="galat" judul={pesan ?? `Ada ${daftar.length} isian yang belum benar`}>
      <ul className="mt-1 list-disc space-y-0.5 pl-5">
        {daftar.map((teks, i) => (
          <li key={i}>{teks}</li>
        ))}
      </ul>
    </Pesan>
  );
}
