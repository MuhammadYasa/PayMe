"use client";

import Link from "next/link";
import { useState } from "react";
import { NavigasiLangkah } from "@/components/admin/langkah";
import { Badge } from "@/components/ui/badge";
import { KotakCentang } from "@/components/ui/kolom";
import { KeadaanKosong } from "@/components/ui/kosong";
import { Pesan } from "@/components/ui/pesan";
import { MemuatData } from "@/components/ui/spinner";
import { Baris, KepalaTabel, Tabel, Td, TdAngka, Th } from "@/components/ui/tabel";
import { Tombol, TombolTautan } from "@/components/ui/tombol";
import { useData } from "@/hooks/use-data";
import type { ringkasanPeriode } from "@/server/services/absensi";

type Ringkasan = Awaited<ReturnType<typeof ringkasanPeriode>>;

export function DaftarAbsensi({ periodeId, final }: { periodeId: string; final: boolean }) {
  const [hanyaBelum, setHanyaBelum] = useState(false);
  const { data, galat, memuat, muatUlang } = useData<Ringkasan>(
    `/api/periode/${periodeId}/absensi${hanyaBelum ? "?hanya=belum-lengkap" : ""}`,
  );

  if (galat) {
    return (
      <Pesan jenis="galat" judul="Absensi belum bisa dimuat" aksi={<Tombol ukuran="kecil" varian="sekunder" onClick={muatUlang}>Coba lagi</Tombol>}>
        {galat.message}
      </Pesan>
    );
  }
  if (!data) return <MemuatData />;

  const tertahan = data.jumlahKaryawan === 0
    ? "Belum ada karyawan aktif. Tambahkan karyawan terlebih dahulu di menu Karyawan."
    : data.lengkap
      ? undefined
      : `Penghitungan gaji ditahan sampai semua tanggal terisi: masih ada ${data.totalKosong} tanggal kosong pada ${data.jumlahBelumLengkap} karyawan.`;

  return (
    <>
      {data.lengkap ? (
        <Pesan jenis="sukses" judul="Absensi lengkap" className="mb-4">
          Semua tanggal karyawan aktif sudah terisi. Penghitungan gaji dapat dilanjutkan.
        </Pesan>
      ) : data.jumlahKaryawan > 0 ? (
        <Pesan jenis="peringatan" judul={`${data.totalKosong} tanggal masih kosong`} className="mb-4">
          Buka karyawan yang ditandai &quot;kosong&quot; dan isi statusnya. Hari libur mingguan tidak perlu diisi.
        </Pesan>
      ) : null}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <KotakCentang label="Hanya yang belum lengkap" checked={hanyaBelum} onChange={(e) => setHanyaBelum(e.target.checked)} />
        <p className="text-teks-redup">{data.karyawan.length} dari {data.jumlahKaryawan} karyawan ditampilkan</p>
      </div>

      {data.karyawan.length === 0 ? (
        <KeadaanKosong
          judul={hanyaBelum ? "Semua karyawan sudah lengkap" : "Belum ada karyawan aktif"}
          aksi={!hanyaBelum ? <TombolTautan href="/karyawan">Tambah karyawan</TombolTautan> : undefined}
        />
      ) : (
        <div aria-busy={memuat}>
          <Tabel keterangan="Ringkasan absensi per karyawan">
            <KepalaTabel>
              <tr>
                <Th>Karyawan</Th>
                <Th>Absensi</Th>
                <Th className="text-right">Hari kerja</Th>
                <Th className="text-right">Hadir</Th>
                <Th className="text-right">Libur</Th>
                <Th className="text-right">Izin</Th>
                <Th className="text-right">Sakit</Th>
                <Th className="text-right">Cuti</Th>
                <Th className="text-right">Lainnya</Th>
                <Th><span className="sr-only">Aksi</span></Th>
              </tr>
            </KepalaTabel>
            <tbody>
              {data.karyawan.map((k) => {
                const r = k.ringkasan;
                return (
                  <Baris key={k.karyawanId}>
                    <Td>
                      <Link href={`/periode/${periodeId}/absensi/${k.karyawanId}`} className="font-semibold text-merek underline-offset-2 hover:underline">
                        {k.nama}
                      </Link>
                      <span className="block text-teks-redup">{k.cabang}</span>
                    </Td>
                    <Td>
                      {r.jumlahKosong > 0 ? (
                        <Badge nada="peringatan">{r.jumlahKosong} kosong</Badge>
                      ) : (
                        <Badge nada="sukses">Lengkap</Badge>
                      )}
                    </Td>
                    <TdAngka>{r.hariKerja}</TdAngka>
                    <TdAngka>{r.hadir}</TdAngka>
                    <TdAngka>{r.totalLibur}</TdAngka>
                    <TdAngka>{r.izin}</TdAngka>
                    <TdAngka>{r.sakit}</TdAngka>
                    <TdAngka>{r.cuti}</TdAngka>
                    <TdAngka>{r.lainnya}</TdAngka>
                    <Td>
                      <div className="flex justify-end">
                        <TombolTautan varian="sekunder" ukuran="kecil" href={`/periode/${periodeId}/absensi/${k.karyawanId}`}>
                          {final ? "Lihat" : r.jumlahKosong > 0 ? "Isi" : "Periksa"}
                        </TombolTautan>
                      </div>
                    </Td>
                  </Baris>
                );
              })}
            </tbody>
          </Tabel>
        </div>
      )}

      <NavigasiLangkah periodeId={periodeId} slug="absensi" tertahan={tertahan} />
    </>
  );
}
