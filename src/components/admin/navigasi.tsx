"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const MENU = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/periode", label: "Penggajian" },
  { href: "/karyawan", label: "Karyawan" },
  { href: "/pengaturan", label: "Pengaturan" },
];

export function Navigasi({ orientasi }: { orientasi: "vertikal" | "horizontal" }) {
  const jalur = usePathname();

  return (
    <nav aria-label="Menu utama" className={orientasi === "vertikal" ? "space-y-1" : "flex gap-1 overflow-x-auto"}>
      {MENU.map((item) => {
        const aktif = jalur === item.href || jalur.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={aktif ? "page" : undefined}
            className={`flex min-h-11 items-center whitespace-nowrap rounded-lg px-3.5 font-semibold transition-colors ${
              aktif ? "bg-merek text-white" : "text-teks hover:bg-merek-lembut"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
