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
import { useCegahKehilangan } from "@/hooks/use-cegah-kehilangan";
import { useData } from "@/hooks/use-data";
import { GalatApi, api } from "@/lib/api";
import type { PeriodeDto } from "@/server/services/periode";
import type { BarisPotonganLain, ambilPotonganLain } from "@/server/services/potongan-lain";

type DataPotongan = Awaited<ReturnType<typeof ambilPotonganLain>>;

interface Nilai {
  pajak: number | null;
  asuransi: number | null;
}

/** Hanya karyawan yang diubah pengguna di layar ini. Karyawan lain selalu mengikuti data terbaru dari server. */
type Ubahan = Record<string, Nilai>;

const dariBaris = (k: BarisPotonganLain): Nilai => ({ pajak: k.pajak || null, asuransi: k.asuransi || null });
const tandai = (nilai: Nilai) => JSON.stringify([nilai.pajak, nilai.asuransi]);

export function PanelPajakAsuransi({ periodeId, final }: { periodeId: string; final: boolean }) {
  const potongan = useData<DataPotongan>(`/api/periode/${periodeId}/potongan`);

  if (potongan.galat && !potongan.data) {
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
  return (
    <TabelPotongan
      periodeId={periodeId}
      karyawan={potongan.data.karyawan}
      final={final}
      galatMuat={potongan.galat?.message ?? null}
      muatUlang={potongan.muatUlang}
    />
  );
}

function TabelPotongan({
  periodeId,
  karyawan,
  final,
  galatMuat,
  muatUlang,
}: {
  periodeId: string;
  karyawan: BarisPotonganLain[];
  final: boolean;
  galatMuat: string | null;
  muatUlang: () => void;
}) {
  const [ubahan, setUbahan] = useState<Ubahan>({});
  /** Potret terakhir yang berhasil disimpan dari layar ini, per karyawan. Pembanding untuk menentukan baris yang berubah. */
  const [dasar, setDasar] = useState<Record<string, string>>({});
  const [kabar, setKabar] = useState<{ jenis: JenisPesan; judul: string; teks: string } | null>(null);
  const [memproses, setMemproses] = useState(false);
  const [menyalin, setMenyalin] = useState(false);

  const tampil = (k: BarisPotonganLain): Nilai => ubahan[k.karyawanId] ?? dariBaris(k);
  const pembanding = (k: BarisPotonganLain) => dasar[k.karyawanId] ?? tandai(dariBaris(k));
  const berubah = karyawan.filter((k) => k.karyawanId in ubahan && tandai(ubahan[k.karyawanId]) !== pembanding(k));
  const belumTersimpan = berubah.length > 0;
  useCegahKehilangan(belumTersimpan);

  function ubah(k: BarisPotonganLain, perubahan: Partial<Nilai>) {
    setKabar(null);
    setUbahan((l) => ({ ...l, [k.karyawanId]: { ...(l[k.karyawanId] ?? dariBaris(k)), ...perubahan } }));
  }

  async function simpan() {
    if (!belumTersimpan) return;
    setKabar(null);
    setMemproses(true);
    // Hanya karyawan yang diubah yang dikirim, supaya penyimpanan tidak menimpa isian orang lain pada karyawan lain.
    const terkirim = berubah.map((k) => [k.karyawanId, ubahan[k.karyawanId]] as const);
    try {
      await api(`/api/periode/${periodeId}/potongan`, {
        metode: "PUT",
        body: { items: terkirim.map(([karyawanId, nilai]) => ({ karyawanId, pajak: nilai.pajak, asuransi: nilai.asuransi })) },
      });
      setDasar((l) => ({ ...l, ...Object.fromEntries(terkirim.map(([id, nilai]) => [id, tandai(nilai)])) }));
      setKabar({ jenis: "sukses", judul: "Tersimpan", teks: "Pajak dan asuransi tersimpan. Baris tanpa nominal tidak disimpan." });
      muatUlang();
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
      setUbahan((l) => {
        const baru = { ...l };
        for (const k of karyawan) {
          const dari = sumber.get(k.karyawanId);
          if (dari) baru[k.karyawanId] = dariBaris(dari);
        }
        return baru;
      });
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

  const totalPajak = karyawan.reduce((total, k) => total + (tampil(k).pajak ?? 0), 0);
  const totalAsuransi = karyawan.reduce((total, k) => total + (tampil(k).asuransi ?? 0), 0);

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
        {galatMuat ? (
          <Pesan
            jenis="peringatan"
            judul="Data terbaru belum bisa dimuat"
            aksi={
              <Tombol ukuran="kecil" varian="sekunder" onClick={muatUlang}>
                Coba lagi
              </Tombol>
            }
          >
            {galatMuat} Isian Anda di halaman ini tetap aman dan belum hilang.
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
              const nilai = tampil(k);
              return (
                <Baris key={k.karyawanId}>
                  <Td>
                    <span className="font-semibold">{k.nama}</span>
                    <span className="block text-teks-redup">{k.cabang}</span>
                  </Td>
                  <Td>
                    <div className="flex justify-end">
                      <SelNominal label={`Pajak ${k.nama}`} nilai={nilai.pajak} disabled={final} onUbah={(v) => ubah(k, { pajak: v })} />
                    </div>
                  </Td>
                  <Td>
                    <div className="flex justify-end">
                      <SelNominal label={`Asuransi ${k.nama}`} nilai={nilai.asuransi} disabled={final} onUbah={(v) => ubah(k, { asuransi: v })} />
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
            <Tombol memuat={memproses} disabled={!belumTersimpan} onClick={() => void simpan()}>
              Simpan pajak dan asuransi
            </Tombol>
          </div>
        ) : null}
      </div>
    </Kartu>
  );
}
