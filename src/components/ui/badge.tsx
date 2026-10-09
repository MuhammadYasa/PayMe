import type { ReactNode } from "react";

export type NadaBadge = "sukses" | "peringatan" | "bahaya" | "info" | "netral";

const gaya: Record<NadaBadge, string> = {
  sukses: "bg-sukses-latar text-sukses-teks",
  peringatan: "bg-peringatan-latar text-peringatan-teks",
  bahaya: "bg-bahaya-latar text-bahaya-teks",
  info: "bg-info-latar text-info-teks",
  netral: "bg-netral-latar text-netral-teks",
};

export function Badge({ nada = "netral", children, className = "" }: { nada?: NadaBadge; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-sm font-semibold ${gaya[nada]} ${className}`}>
      {children}
    </span>
  );
}
