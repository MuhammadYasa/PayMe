"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Kartu } from "@/components/ui/kartu";
import { SelNominal } from "@/components/ui/kolom";
import { KeadaanKosong } from "@/components/ui/kosong";
import { Pesan, type JenisPesan } from "@/components/ui/pesan";
import { MemuatData } from "@/components/ui/spinner";
import { Baris, KepalaTabel, Tabel, Td, TdAngka, Th } from "@/components/ui/tabel";
import { Tombol, TombolTautan } from "@/components/ui/tombol";
import { labelPeriode } from "@/domain/periode";
import { formatRupiah } from "@/domain/uang";
import { useData } from "@/hooks/use-data";
import { GalatApi, api } from "@/lib/api";
import type { PeriodeDto } from "@/server/services/periode";
import type { BarisPotonganLain, ambilPotonganLain } from "@/server/services/potongan-lain";

type DataPotongan = Awaited<ReturnType<typeof ambilPotonganLain>>;

interface Nilai {
  pajak: number | null;
  asuransi: number | null;
}
type Peta = Record<string, Nilai>;

const dariBaris = (k: BarisPotonganLain): Nilai => ({ pajak: k.pajak || null, asuransi: k.asuransi || null });
const buatPeta = (karyawan: BarisPotonganLain[]): Peta => Object.fromEntries(karyawan.map((k) => [k.karyawanId, dariBaris(k)]));
const potret = (peta: Peta) => JSON.stringify(Object.entries(peta));

export function PanelPajakAsuransi({ periodeId, final }: { periodeId: string; final: boolean }) {
  const potongan = useData<DataPotongan>(`/api/periode/${periodeId}/potongan`);

  if (potongan.galat) {
    return (
      <Pesan jenis="galat" judul="Data pajak dan asuransi belum bisa dimuat" aksi={<Tombol ukuran="kecil" varian="sekunder" onClick={potongan.muatUlang}>Coba lagi</Tombol>}>
        {potongan.galat.message}
      </Pesan>
    );
  }
  if (!potongan.data) return <MemuatData />;
  if (potongan.data.karyawan.length === 0) {
    return (
      <KeadaanKosong
        judul="Belum ada karyawan aktif"
        deskripsi="Tambahkan karyawan di menu Karyawan untuk mengisi pajak dan asuransi."
        aksi={<TombolTautan href="/karyawan">Ke menu Karyawan</TombolTautan>}
      />
    );
  }
  return <TabelPotongan periodeId={periodeId} karyawan={potongan.data.karyawan} final={final} onTersimpan={potongan.muatUlang} />;
}

function TabelPotongan({ periodeId, karyawan, final, onTersimpan }: { periodeId: string; karyawan: BarisPotonganLain[]; final: boolean; onTersimpan: () => void }) {
  const [peta, setPeta] = useState<Peta>(() => buatPeta(karyawan));
  const [tersimpan, setTersimpan] = useState(() => potret(buatPeta(karyawan)));
  const [kabar, setKabar] = useState<{ jenis: JenisPesan; judul: string; teks: string } | null>(null);
  const [memproses, setMemproses] = useState(false);
  const [menyalin, setMenyalin] = useState(false);

  const belumTersimpan = potret(peta) !== tersimpan;

  function ubah(id: string, perubahan: Partial<Nilai>) {
    setKabar(null);
    setPeta((l) => ({ ...l, [id]: { ...l[id], ...perubahan } }));
  }

  async function simpan() {
    setKabar(null);
    setMemproses(true);
    const potretKirim = potret(peta);
    try {
      await api(`/api/periode/${periodeId}/potongan`, {
        metode: "PUT",
        body: { items: karyawan.map((k) => ({ karyawanId: k.karyawanId, pajak: peta[k.karyawanId].pajak, asuransi: peta[k.karyawanId].asuransi })) },
      });
      setTersimpan(potretKirim);
      setKabar({ jenis: "sukses", judul: "Tersimpan", teks: "Pajak dan asuransi tersimpan. Baris tanpa nominal tidak disimpan." });
      onTersimpan();
    } catch (g) {
      setKabar({ jenis: "galat", judul: "Belum bisa disimpan", teks: g instanceof GalatApi ? g.message : "Gagal menyimpan. Coba lagi." });
    } finally {
      setMemproses(false);
    }
  }

  /** Hanya mengisi kolom dari periode sebelumnya. Penyimpanan tetap menunggu HRD memeriksa dan menekan Simpan. */
  async function salin() {
    setKabar(null);
    setMenyalin(true);
    try {
      const hasil = await api<{ sumber: PeriodeDto | null; karyawan: BarisPotonganLain[] }>(`/api/periode/${periodeId}/potongan/salin`);
      if (!hasil.sumber) {
        setKabar({ jenis: "info", judul: "Belum ada periode sebelumnya", teks: "Belum ada periode sebelumnya yang punya data pajak atau asuransi. Isi nominalnya secara manual." });
        return;
      }
      const sumber = new Map(hasil.karyawan.map((k) => [k.karyawanId, k]));
      setPeta((l) => Object.fromEntries(Object.entries(l).map(([id, nilai]) => [id, sumber.has(id) ? dariBaris(sumber.get(id)!) : nilai])));
      setKabar({
        jenis: "sukses",
        judul: "Nominal disalin",
        teks: `Nominal disalin dari periode ${labelPeriode(hasil.sumber)} dan menggantikan isian yang ada. Periksa dan ubah bila perlu, lalu tekan Simpan.`,
      });
    } catch (g) {
      setKabar({ jenis: "galat", judul: "Belum bisa menyalin", teks: g instanceof GalatApi ? g.message : "Gagal menyalin. Coba lagi." });
    } finally {
      setMenyalin(false);
    }
  }

  const totalPajak = karyawan.reduce((total, k) => total + (peta[k.karyawanId].pajak ?? 0), 0);
  const totalAsuransi = karyawan.reduce((total, k) => total + (peta[k.karyawanId].asuransi ?? 0), 0);

  return (
    <Kartu
      judul="Pajak dan asuransi"
      deskripsi="Isi nominal apa adanya sesuai ketentuan perusahaan. PayMe tidak menghitung PPh atau iuran sendiri."
      aksi={
        <>
          {belumTersimpan ? <Badge nada="peringatan">Belum tersimpan</Badge> : null}
          {!final ? (
            <Tombol varian="sekunder" ukuran="kecil" memuat={menyalin} onClick={() => void salin()}>
              Salin dari periode sebelumnya
            </Tombol>
          ) : null}
        </>
      }
    >
      <div className="space-y-4">
        {final ? (
          <Pesan jenis="info" judul="Periode sudah final">
            Nominal tidak dapat diubah lagi. Buka kembali periode di langkah Hitung Gaji bila perlu koreksi.
          </Pesan>
        ) : null}
        {kabar ? (
          <Pesan jenis={kabar.jenis} judul={kabar.judul}>
            {kabar.teks}
          </Pesan>
        ) : null}

        <Tabel keterangan="Nominal pajak dan asuransi tiap karyawan aktif">
          <KepalaTabel>
            <tr>
              <Th>Karyawan</Th>
              <Th className="text-right">Pajak</Th>
              <Th className="text-right">Asuransi</Th>
              <Th className="text-right">Total potongan</Th>
            </tr>
          </KepalaTabel>
          <tbody>
            {karyawan.map((k) => {
              const nilai = peta[k.karyawanId];
              return (
                <Baris key={k.karyawanId}>
                  <Td>
                    <span className="font-semibold">{k.nama}</span>
                    <span className="block text-teks-redup">{k.cabang}</span>
                  </Td>
                  <Td>
                    <div className="flex justify-end">
                      <SelNominal label={`Pajak ${k.nama}`} nilai={nilai.pajak} disabled={final} onUbah={(v) => ubah(k.karyawanId, { pajak: v })} />
                    </div>
                  </Td>
                  <Td>
                    <div className="flex justify-end">
                      <SelNominal label={`Asuransi ${k.nama}`} nilai={nilai.asuransi} disabled={final} onUbah={(v) => ubah(k.karyawanId, { asuransi: v })} />
                    </div>
                  </Td>
                  <TdAngka>{formatRupiah((nilai.pajak ?? 0) + (nilai.asuransi ?? 0))}</TdAngka>
                </Baris>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-garis-tebal bg-merek-lembut font-bold">
              <th scope="row" className="px-3 py-2.5 text-left">
                Jumlah
              </th>
              <TdAngka>{formatRupiah(totalPajak)}</TdAngka>
              <TdAngka>{formatRupiah(totalAsuransi)}</TdAngka>
              <TdAngka>{formatRupiah(totalPajak + totalAsuransi)}</TdAngka>
            </tr>
          </tfoot>
        </Tabel>

        {!final ? (
          <div className="flex justify-end">
            <Tombol memuat={memproses} onClick={() => void simpan()}>
              Simpan pajak dan asuransi
            </Tombol>
          </div>
        ) : null}
      </div>
    </Kartu>
  );
}
