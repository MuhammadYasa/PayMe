import type { Metadata } from "next";
import Link from "next/link";
import { JudulHalaman, Kartu } from "@/components/ui/kartu";
import { Pesan } from "@/components/ui/pesan";
import { TombolTautan } from "@/components/ui/tombol";
import { labelPeriode } from "@/domain/periode";
import { formatRupiah } from "@/domain/uang";
import { wajibSesi } from "@/server/auth/halaman";
import { dbPerusahaan } from "@/server/db/tenant";
import { daftarPeriode } from "@/server/services/periode";

export const metadata: Metadata = { title: "Dashboard" };

const LANGKAH_AWAL = [
  { judul: "Siapkan data karyawan", isi: "Isi nama, jabatan, cabang, gaji pokok, tunjangan, dan nomor rekening setiap karyawan." },
  { judul: "Mulai penggajian", isi: "Pilih tanggal awal periode, lalu unggah file Excel dari mesin finger." },
  { judul: "Lengkapi dan hitung", isi: "Isi absensi yang kosong, pendapatan, insentif, dan denda. Tekan Hitung Gaji dan periksa hasilnya." },
  { judul: "Simpan dan bagikan", isi: "Simpan hasil, ekspor ke Excel, dan karyawan dapat melihat slipnya lewat halaman khusus karyawan." },
];

export default async function Dashboard() {
  const sesi = await wajibSesi();
  const db = dbPerusahaan(sesi.perusahaanId);
  const [jumlahKaryawan, periode] = await Promise.all([db.karyawan.count({ where: { statusAktif: true } }), daftarPeriode(db)]);
  const draf = periode.find((p) => p.status === "DRAF");
  const finalTerakhir = periode.find((p) => p.status === "FINAL");

  return (
    <>
      <JudulHalaman judul={`Selamat datang, ${sesi.nama}`} deskripsi={`Ringkasan penggajian ${sesi.namaPerusahaan}.`} />

      {jumlahKaryawan === 0 ? (
        <Pesan
          jenis="info"
          judul="Mulai dengan menambahkan karyawan"
          aksi={<TombolTautan href="/karyawan" ukuran="kecil">Tambah karyawan</TombolTautan>}
          className="mb-6"
        >
          Penggajian memakai data profil karyawan. Tambahkan dulu karyawan Anda, lalu mulai periode gaji.
        </Pesan>
      ) : null}

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Kartu judul="Karyawan aktif">
          <p className="text-3xl font-extrabold tabular-nums">{jumlahKaryawan}</p>
          <Link href="/karyawan" className="mt-2 inline-block font-semibold text-merek underline-offset-2 hover:underline">
            Kelola karyawan
          </Link>
        </Kartu>

        <Kartu judul="Draf penggajian">
          {draf ? (
            <>
              <p className="text-lg font-bold">{labelPeriode(draf)}</p>
              <TombolTautan href={`/periode/${draf.id}`} className="mt-3" ukuran="kecil">
                Lanjutkan penggajian
              </TombolTautan>
            </>
          ) : (
            <>
              <p className="text-teks-redup">Tidak ada draf yang sedang dikerjakan.</p>
              <TombolTautan href="/periode/baru" className="mt-3" ukuran="kecil">
                Mulai penggajian baru
              </TombolTautan>
            </>
          )}
        </Kartu>

        <Kartu judul="Penggajian terakhir">
          {finalTerakhir ? (
            <>
              <p className="text-lg font-bold">{labelPeriode(finalTerakhir)}</p>
              <p className="text-teks-redup">
                {finalTerakhir.jumlahKaryawan} karyawan, total {formatRupiah(finalTerakhir.totalGaji ?? 0)}
              </p>
              <Link href={`/periode/${finalTerakhir.id}/hitung`} className="mt-2 inline-block font-semibold text-merek underline-offset-2 hover:underline">
                Lihat rincian
              </Link>
            </>
          ) : (
            <p className="text-teks-redup">Belum ada penggajian yang disimpan.</p>
          )}
        </Kartu>
      </div>

      <Kartu judul="Cara kerja PayMe" deskripsi="Empat langkah dari data mesin finger sampai slip gaji.">
        <ol className="grid gap-4 md:grid-cols-2">
          {LANGKAH_AWAL.map((langkah, i) => (
            <li key={langkah.judul} className="flex gap-3">
              <span
                aria-hidden="true"
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-merek font-bold text-white"
              >
                {i + 1}
              </span>
              <div>
                <p className="font-semibold">{langkah.judul}</p>
                <p className="text-teks-redup">{langkah.isi}</p>
              </div>
            </li>
          ))}
        </ol>
      </Kartu>
    </>
  );
}
