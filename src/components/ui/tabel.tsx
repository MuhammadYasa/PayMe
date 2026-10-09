import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";

export function Tabel({ keterangan, children, className = "" }: { keterangan: string; children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-x-auto rounded-lg border border-garis bg-kartu ${className}`}>
      <table className="w-full border-collapse text-left text-sm">
        <caption className="sr-only">{keterangan}</caption>
        {children}
      </table>
    </div>
  );
}

export function KepalaTabel({ children }: { children: ReactNode }) {
  return <thead className="bg-merek-lembut text-teks">{children}</thead>;
}

export function Th({ className = "", children, ...sisa }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th scope="col" className={`whitespace-nowrap border-b border-garis px-3 py-2.5 font-bold ${className}`} {...sisa}>
      {children}
    </th>
  );
}

export function Baris({ className = "", children, ...sisa }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={`border-b border-garis last:border-b-0 hover:bg-merek-lembut/60 ${className}`} {...sisa}>
      {children}
    </tr>
  );
}

export function Td({ className = "", children, ...sisa }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={`px-3 py-2.5 align-middle ${className}`} {...sisa}>
      {children}
    </td>
  );
}

/** Sel angka rata kanan dengan digit selebar sama, agar kolom rupiah mudah dibandingkan. */
export function TdAngka({ className = "", children, ...sisa }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={`px-3 py-2.5 text-right align-middle tabular-nums ${className}`} {...sisa}>
      {children}
    </td>
  );
}
