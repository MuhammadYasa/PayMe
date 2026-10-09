"use client";

import { useState } from "react";
import { Pesan } from "@/components/ui/pesan";
import { Tombol, type VarianTombol } from "@/components/ui/tombol";
import { pesanDariGalat, unduhBerkas } from "@/lib/api";

/** Mengunduh hasil gaji sebagai Excel. Galat (mis. absensi belum lengkap) tampil sebagai pesan, bukan halaman JSON. */
export function TombolEkspor({ periodeId, varian = "sekunder" }: { periodeId: string; varian?: VarianTombol }) {
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  async function unduh() {
    setMemuat(true);
    setGalat(null);
    try {
      await unduhBerkas(`/api/periode/${periodeId}/ekspor`, "PayMe.xlsx");
    } catch (g) {
      setGalat(pesanDariGalat(g));
    } finally {
      setMemuat(false);
    }
  }

  return (
    <div className="space-y-2">
      <Tombol varian={varian} memuat={memuat} onClick={() => void unduh()}>
        Ekspor ke Excel
      </Tombol>
      {galat ? (
        <Pesan jenis="galat" judul="Ekspor belum berhasil">
          {galat}
        </Pesan>
      ) : null}
    </div>
  );
}
