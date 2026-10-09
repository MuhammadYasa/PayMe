"use client";

import { useCallback, useEffect, useState } from "react";
import { GalatApi, api } from "@/lib/api";

interface Hasil<T> {
  kunci: string;
  data?: T;
  galat?: GalatApi;
}

/**
 * Mengambil data dari API. Data lama tetap tampil selama pemuatan ulang, sehingga tabel tidak berkedip
 * setiap kali pengguna menyimpan sesuatu. Kirim `null` sebagai url untuk menunda pengambilan.
 */
export function useData<T>(url: string | null) {
  const [versi, setVersi] = useState(0);
  const [hasil, setHasil] = useState<Hasil<T> | null>(null);
  const kunci = `${url}#${versi}`;

  useEffect(() => {
    if (!url) return;
    let batal = false;
    api<T>(url)
      .then((data) => {
        if (!batal) setHasil({ kunci, data });
      })
      .catch((galat: unknown) => {
        if (batal) return;
        // Data lama dipertahankan, supaya muat ulang yang gagal tidak membuang formulir beserta isian yang belum tersimpan.
        setHasil((lama) => ({
          kunci,
          data: lama?.data,
          galat: galat instanceof GalatApi ? galat : new GalatApi(0, "Data tidak dapat dimuat. Coba lagi."),
        }));
      });
    return () => {
      batal = true;
    };
  }, [url, kunci]);

  const muatUlang = useCallback(() => setVersi((v) => v + 1), []);
  const ubahLokal = useCallback((ubah: (lama: T) => T) => {
    setHasil((h) => (h && h.data !== undefined ? { ...h, data: ubah(h.data) } : h));
  }, []);

  return {
    data: hasil?.data ?? null,
    galat: hasil?.kunci === kunci ? (hasil.galat ?? null) : null,
    memuat: url !== null && hasil?.kunci !== kunci,
    muatUlang,
    ubahLokal,
  };
}
