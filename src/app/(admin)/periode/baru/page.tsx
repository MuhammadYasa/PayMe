import type { Metadata } from "next";
import { JudulHalaman } from "@/components/ui/kartu";
import { tambahHari } from "@/domain/tanggal";
import { hariIniJakarta } from "@/domain/tanggal";
import { wajibSesi } from "@/server/auth/halaman";
import { dbPerusahaan } from "@/server/db/tenant";
import { daftarPeriode } from "@/server/services/periode";
import { FormPeriode } from "./form-periode";

export const metadata: Metadata = { title: "Penggajian Baru" };

export default async function HalamanPeriodeBaru() {
  const sesi = await wajibSesi();
  const periode = await daftarPeriode(dbPerusahaan(sesi.perusahaanId));
  // Saran tanggal awal: sehari setelah periode terakhir berakhir, atau hari ini bila belum ada periode.
  const terakhir = periode[0];
  const saran = terakhir ? tambahHari(terakhir.tanggalAkhir, 1) : hariIniJakarta();

  return (
    <>
      <JudulHalaman
        judul="Mulai Penggajian Baru"
        deskripsi="Langkah 1 dari 9. Pilih tanggal awal periode gaji; tanggal akhir dihitung otomatis satu bulan setelahnya."
      />
      <FormPeriode saran={saran} />
    </>
  );
}
