"use client";

import { useEffect, useState } from "react";
import { PERISTIWA_SESI_BERAKHIR } from "@/lib/api";
import { Dialog } from "@/components/ui/dialog";
import { Tombol } from "@/components/ui/tombol";

/**
 * Menampilkan dialog saat API menjawab 401 di tengah pekerjaan. Isian formulir yang belum tersimpan
 * sudah dicadangkan di penyimpanan lokal oleh formulirnya, jadi pengguna cukup masuk kembali.
 */
export function PenjagaSesi() {
  const [berakhir, setBerakhir] = useState(false);

  useEffect(() => {
    const tandai = () => setBerakhir(true);
    window.addEventListener(PERISTIWA_SESI_BERAKHIR, tandai);
    return () => window.removeEventListener(PERISTIWA_SESI_BERAKHIR, tandai);
  }, []);

  function masukLagi() {
    const tujuan = `${window.location.pathname}${window.location.search}`;
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`/masuk?lanjut=${encodeURIComponent(tujuan)}`);
  }

  return (
    <Dialog buka={berakhir} onTutup={() => undefined} judul="Sesi Anda sudah berakhir" bisaDitutup={false}>
      <p>
        Demi keamanan, Anda perlu masuk kembali. Isian yang belum tersimpan sudah dicadangkan di browser ini dan akan
        dipulihkan setelah Anda masuk.
      </p>
      <div className="mt-6 flex justify-end">
        <Tombol onClick={masukLagi} autoFocus>
          Masuk kembali
        </Tombol>
      </div>
    </Dialog>
  );
}
