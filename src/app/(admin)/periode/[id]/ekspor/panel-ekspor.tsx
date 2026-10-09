"use client";

import Link from "next/link";
import { useState } from "react";
import { TombolEkspor } from "@/components/admin/tombol-ekspor";
import { Kartu } from "@/components/ui/kartu";
import { Pesan } from "@/components/ui/pesan";
import { Tombol, TombolTautan } from "@/components/ui/tombol";
import { urlLangkah } from "@/lib/langkah";

export function PanelEkspor({ periodeId, final, namaBerkas }: { periodeId: string; final: boolean; namaBerkas: string }) {
  const [tersalin, setTersalin] = useState<"ya" | "gagal" | null>(null);

  async function salinTautan() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/lihat-gaji`);
      setTersalin("ya");
    } catch {
      setTersalin("gagal");
    }
  }

  return (
    <div className="space-y-5">
      <Kartu judul="Unduh hasil penggajian" deskripsi="File Excel berisi rincian gaji setiap karyawan beserta baris total di bagian bawah.">
        <div className="space-y-4">
          {final ? (
            <Pesan jenis="sukses" judul="Periode sudah final">
              File dibuat dari hasil yang sudah tersimpan, jadi isinya selalu sama dengan yang tampil di riwayat.
            </Pesan>
          ) : (
            <Pesan jenis="peringatan" judul="Periode masih draf">
              File dibuat dari perhitungan terbaru dan bisa berubah sampai hasilnya disimpan. Simpan dulu di langkah{" "}
              <Link href={urlLangkah(periodeId, "hitung")} className="font-semibold underline underline-offset-2">
                Hitung Gaji
              </Link>{" "}
              bila ingin hasilnya tercatat final.
            </Pesan>
          )}
          <p>
            Nama file: <strong className="break-all">{namaBerkas}</strong>
          </p>
          <TombolEkspor periodeId={periodeId} varian="utama" />
        </div>
      </Kartu>

      <Kartu judul="Bagikan ke karyawan" deskripsi="Karyawan melihat gajinya sendiri tanpa akun, cukup dengan nama lengkap dan nomor rekening.">
        <div className="space-y-4">
          <p className="max-w-3xl">
            Halaman karyawan hanya menampilkan periode yang sudah final. Setelah beberapa kali salah isi, akses diblokir sementara. Nomor rekening yang tampil selalu tersamar.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <TombolTautan varian="sekunder" href="/lihat-gaji" target="_blank" rel="noreferrer">
              Buka halaman karyawan
            </TombolTautan>
            <Tombol varian="sekunder" onClick={() => void salinTautan()}>
              Salin tautan
            </Tombol>
          </div>
          {tersalin === "ya" ? <p role="status">Tautan disalin. Bagikan ke karyawan lewat pesan atau grup perusahaan.</p> : null}
          {tersalin === "gagal" ? (
            <p role="status" className="font-semibold text-bahaya-teks">
              Tautan belum bisa disalin otomatis. Salin alamat halaman karyawan dari bilah alamat setelah membukanya.
            </p>
          ) : null}
        </div>
      </Kartu>

      <Kartu judul="Riwayat penggajian" deskripsi="Semua periode yang pernah dihitung, lengkap dengan total gaji dan jumlah karyawan.">
        <TombolTautan varian="sekunder" href="/periode">
          Lihat riwayat penggajian
        </TombolTautan>
      </Kartu>
    </div>
  );
}
