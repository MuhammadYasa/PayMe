export function Spinner({ ukuran = 20, label }: { ukuran?: number; label?: string }) {
  return (
    <svg
      width={ukuran}
      height={ukuran}
      viewBox="0 0 24 24"
      fill="none"
      className="animate-spin"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function MemuatData({ teks = "Memuat data..." }: { teks?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-12 text-teks-redup">
      <Spinner />
      <span>{teks}</span>
    </div>
  );
}
