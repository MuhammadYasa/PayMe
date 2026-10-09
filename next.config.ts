import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

const headerKeamanan = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  },
  ...(isProduction
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]
    : []),
];

// Halaman dan API yang memuat data gaji tidak boleh disimpan cache browser,
// supaya tombol "kembali" setelah keluar tidak menampilkan data lama.
const tanpaCache = [{ key: "Cache-Control", value: "no-store, max-age=0" }];
const rutePrivat = [
  "/dashboard/:path*",
  "/karyawan/:path*",
  "/periode/:path*",
  "/pengaturan/:path*",
  "/lihat-gaji/:path*",
  "/api/:path*",
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  agentRules: false,
  serverExternalPackages: ["@node-rs/argon2", "exceljs", "pg"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      { source: "/:path*", headers: headerKeamanan },
      ...rutePrivat.map((source) => ({ source, headers: tanpaCache })),
    ];
  },
};

export default nextConfig;
