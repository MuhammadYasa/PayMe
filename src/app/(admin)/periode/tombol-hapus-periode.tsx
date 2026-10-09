"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { KonfirmasiDialog } from "@/components/ui/dialog";
import { Pesan } from "@/components/ui/pesan";
import { Tombol } from "@/components/ui/tombol";
import { pesanDariGalat } from "@/lib/api";
import { api } from "@/lib/api";

export function TombolHapusPeriode({ periodeId, label }: { periodeId: string; label: string }) {
  const router = useRouter();
  const [buka, setBuka] = useState(false);
  const [memproses, setMemproses] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  async function hapus() {
    setMemproses(true);
    setGalat(null);
    try {
      await api(`/api/periode/${periodeId}`, { metode: "DELETE" });
      setBuka(false);
      router.refresh();
    } catch (g) {
      setGalat(pesanDariGalat(g));
    } finally {
      setMemproses(false);
    }
  }

  return (
    <>
      <Tombol varian="sekunder" ukuran="kecil" onClick={() => setBuka(true)}>
        Hapus
      </Tombol>
      <KonfirmasiDialog
        buka={buka}
        judul="Hapus draf penggajian?"
        pesan={
          <div className="space-y-3">
            <p>
              Draf periode <strong>{label}</strong> beserta seluruh isian absensi, pendapatan, insentif, dan potongan di dalamnya akan
              dihapus. Tindakan ini tidak dapat dibatalkan.
            </p>
            {galat ? <Pesan jenis="galat">{galat}</Pesan> : null}
          </div>
        }
        labelYa="Ya, hapus draf"
        bahaya
        memproses={memproses}
        onYa={hapus}
        onBatal={() => {
          setBuka(false);
          setGalat(null);
        }}
      />
    </>
  );
}
