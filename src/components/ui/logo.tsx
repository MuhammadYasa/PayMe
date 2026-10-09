export function Logo({ ukuran = 32, tampilkanNama = true }: { ukuran?: number; tampilkanNama?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width={ukuran} height={ukuran} viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="#1d4ed8" />
        <rect x="8" y="9" width="16" height="3" rx="1.5" fill="#fff" />
        <rect x="8" y="14.5" width="11" height="3" rx="1.5" fill="#bfdbfe" />
        <rect x="8" y="20" width="16" height="3" rx="1.5" fill="#fff" />
      </svg>
      {tampilkanNama ? <span className="text-xl font-extrabold tracking-tight text-teks">PayMe</span> : null}
    </span>
  );
}
