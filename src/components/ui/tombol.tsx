import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";
import { Spinner } from "./spinner";

export type VarianTombol = "utama" | "sekunder" | "bahaya" | "tautan";
export type UkuranTombol = "normal" | "kecil";

const dasar =
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors select-none " +
  "disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-60";

const varian: Record<VarianTombol, string> = {
  utama: "bg-merek text-white hover:bg-merek-gelap",
  sekunder: "border border-garis-tebal bg-kartu text-teks hover:bg-merek-lembut",
  bahaya: "bg-bahaya text-white hover:bg-bahaya-gelap",
  tautan: "text-merek underline-offset-2 hover:underline",
};

const ukuran: Record<UkuranTombol, string> = {
  normal: "min-h-11 px-4 text-[15px]",
  kecil: "min-h-9 px-3 text-sm",
};

export function kelasTombol(v: VarianTombol = "utama", u: UkuranTombol = "normal", tambahan = ""): string {
  return [dasar, varian[v], v === "tautan" ? "" : ukuran[u], tambahan].filter(Boolean).join(" ");
}

interface PropTombol extends ButtonHTMLAttributes<HTMLButtonElement> {
  varian?: VarianTombol;
  ukuran?: UkuranTombol;
  memuat?: boolean;
}

export function Tombol({
  varian: v = "utama",
  ukuran: u = "normal",
  memuat = false,
  type = "button",
  disabled,
  className = "",
  children,
  ...sisa
}: PropTombol) {
  return (
    <button
      type={type}
      disabled={disabled || memuat}
      aria-busy={memuat || undefined}
      className={kelasTombol(v, u, className)}
      {...sisa}
    >
      {memuat ? <Spinner ukuran={16} /> : null}
      {children}
    </button>
  );
}

interface PropTautan extends Omit<ComponentProps<typeof Link>, "className"> {
  varian?: VarianTombol;
  ukuran?: UkuranTombol;
  className?: string;
  children: ReactNode;
}

export function TombolTautan({ varian: v = "utama", ukuran: u = "normal", className = "", children, ...sisa }: PropTautan) {
  return (
    <Link className={kelasTombol(v, u, className)} {...sisa}>
      {children}
    </Link>
  );
}
