import { Kartu } from "@/components/ui/kartu";
import { Pesan } from "@/components/ui/pesan";
import { TombolTautan } from "@/components/ui/tombol";
import { formatTanggalPanjang, hariMinggu, namaHari } from "@/domain/tanggal";
import { LANGKAH, urlLangkah } from "@/lib/langkah";
import { wajibSesi } from "@/server/auth/halaman";
import { dbPerusahaan } from "@/server/db/tenant";
import { muatPeriode } from "@/server/services/periode";

export default async function LangkahPeriode({ params }: PageProps<"/periode/[id]">) {
  const sesi = await wajibSesi();
  const { id } = await params;
  const periode = await muatPeriode(dbPerusahaan(sesi.perusahaanId), id);
  const final = periode.status === "FINAL";

  return (
    <div className="space-y-5">
      <p className="text-teks-redup">{LANGKAH[0].bantuan}</p>

      {final ? (
        <Pesan jenis="sukses" judul="Periode ini sudah final">
          Hasil penggajian sudah tersimpan dan tidak dapat diubah. Buka halaman Hitung Gaji untuk melihat rinciannya atau
          membuka kembali periode bila ada yang perlu dikoreksi.
        </Pesan>
      ) : null}

      <Kartu judul="Rentang periode">
        <dl className="grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-sm text-teks-redup">Tanggal awal</dt>
            <dd className="font-semibold">{formatTanggalPanjang(periode.tanggalAwal)}</dd>
          </div>
          <div>
            <dt className="text-sm text-teks-redup">Tanggal akhir</dt>
            <dd className="font-semibold">{formatTanggalPanjang(periode.tanggalAkhir)}</dd>
          </div>
          <div>
            <dt className="text-sm text-teks-redup">Jumlah hari</dt>
            <dd className="font-semibold">
              {periode.jumlahHari} hari (mulai hari {namaHari(hariMinggu(periode.tanggalAwal))})
            </dd>
          </div>
        </dl>
      </Kartu>

      <div className="flex justify-end">
        <TombolTautan href={urlLangkah(periode.id, final ? "hitung" : "unggah")}>
          {final ? "Lihat hasil gaji" : "Lanjut: Unggah Absensi"}
        </TombolTautan>
      </div>
    </div>
  );
}
