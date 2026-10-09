import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { JudulHalaman } from "@/components/ui/kartu";
import { KeadaanKosong } from "@/components/ui/kosong";
import { Baris, KepalaTabel, Tabel, Td, TdAngka, Th } from "@/components/ui/tabel";
import { TombolTautan } from "@/components/ui/tombol";
import { labelPeriode } from "@/domain/periode";
import { formatRupiah } from "@/domain/uang";
import { wajibSesi } from "@/server/auth/halaman";
import { dbPerusahaan } from "@/server/db/tenant";
import { daftarPeriode } from "@/server/services/periode";
import { TombolHapusPeriode } from "./tombol-hapus-periode";

export const metadata: Metadata = { title: "Penggajian" };

export default async function HalamanPeriode() {
  const sesi = await wajibSesi();
  const periode = await daftarPeriode(dbPerusahaan(sesi.perusahaanId));

  return (
    <>
      <JudulHalaman
        judul="Penggajian"
        deskripsi="Riwayat penggajian per periode. Mulai periode baru atau lanjutkan draf yang belum selesai."
        aksi={<TombolTautan href="/periode/baru">Mulai Penggajian Baru</TombolTautan>}
      />

      {periode.length === 0 ? (
        <KeadaanKosong
          judul="Belum ada periode penggajian"
          deskripsi="Mulai dengan memilih tanggal awal periode gaji. Setelah itu Anda dipandu langkah demi langkah."
          aksi={<TombolTautan href="/periode/baru">Mulai Penggajian Baru</TombolTautan>}
        />
      ) : (
        <Tabel keterangan="Daftar periode penggajian">
          <KepalaTabel>
            <tr>
              <Th>Periode</Th>
              <Th>Status</Th>
              <Th className="text-right">Karyawan</Th>
              <Th className="text-right">Total gaji bersih</Th>
              <Th>
                <span className="sr-only">Aksi</span>
              </Th>
            </tr>
          </KepalaTabel>
          <tbody>
            {periode.map((p) => (
              <Baris key={p.id}>
                <Td>
                  <Link href={`/periode/${p.id}`} className="font-semibold text-merek underline-offset-2 hover:underline">
                    {labelPeriode(p)}
                  </Link>
                  <span className="block text-teks-redup">{p.jumlahHari} hari</span>
                </Td>
                <Td>
                  <Badge nada={p.status === "FINAL" ? "sukses" : "peringatan"}>{p.status === "FINAL" ? "Final" : "Draf"}</Badge>
                </Td>
                <TdAngka>{p.jumlahKaryawan}</TdAngka>
                <TdAngka>{p.totalGaji === null ? "-" : formatRupiah(p.totalGaji)}</TdAngka>
                <Td>
                  <div className="flex justify-end gap-2">
                    <TombolTautan varian="sekunder" ukuran="kecil" href={p.status === "FINAL" ? `/periode/${p.id}/hitung` : `/periode/${p.id}`}>
                      {p.status === "FINAL" ? "Lihat" : "Lanjutkan"}
                    </TombolTautan>
                    {p.status === "DRAF" ? <TombolHapusPeriode periodeId={p.id} label={labelPeriode(p)} /> : null}
                  </div>
                </Td>
              </Baris>
            ))}
          </tbody>
        </Tabel>
      )}
    </>
  );
}
