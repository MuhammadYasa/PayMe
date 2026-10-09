"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { Tombol } from "@/components/ui/tombol";

export function TombolKeluar() {
  const [memproses, setMemproses] = useState(false);

  async function keluar() {
    setMemproses(true);
    try {
      await api("/api/auth/keluar", { metode: "POST" });
    } finally {
      // Navigasi penuh (bukan router.push) agar cache halaman di browser ikut dibuang.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/masuk");
    }
  }

  return (
    <Tombol varian="sekunder" ukuran="kecil" onClick={keluar} memuat={memproses}>
      Keluar
    </Tombol>
  );
}
