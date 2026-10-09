"use client";

import { type FormEvent, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Kartu } from "@/components/ui/kartu";
import { KolomNominal, KolomPilih, KotakCentang, SelNominal } from "@/components/ui/kolom";
import { KeadaanKosong } from "@/components/ui/kosong";
import { Pesan, RingkasanGalat } from "@/components/ui/pesan";
import { MemuatData } from "@/components/ui/spinner";
import { Baris, KepalaTabel, Tabel, Td, TdAngka, Th } from "@/components/ui/tabel";
import { Tombol, TombolTautan } from "@/components/ui/tombol";
import type { Pengaturan } from "@/domain/pengaturan";
import { hitungBonusTarget, persenCapaianPermil } from "@/domain/target";
import { formatPersenPermil, formatRupiah } from "@/domain/uang";
import { useCegahKehilangan } from "@/hooks/use-cegah-kehilangan";
import { useData } from "@/hooks/use-data";
import { GalatApi, api } from "@/lib/api";
import { fokusKolomPertama } from "@/lib/fokus";
import type { DataCabang, ambilPendapatan } from "@/server/services/pendapatan";

type DataPendapatan = Awaited<ReturnType<typeof ambilPendapatan>>;

interface BarisSalesIsian {
  karyawanId: string;
  nominal: number | null;
  target: number | null;
}

interface IsianCabang {
  total: number | null;
  sales: BarisSalesIsian[];
  akui: boolean;
}

function isianAwal(c: DataCabang): IsianCabang {
  const sudahAda = c.adaBreakdown || c.totalAktual > 0;
  return {
    total: sudahAda ? c.totalAktual : null,
    sales: c.sales.map((s) => ({ karyawanId: s.karyawanId, nominal: s.nominal, target: s.target })),
    akui: c.selisihDiakui,
  };
}

export function FormPendapatan({ periodeId, final }: { periodeId: string; final: boolean }) {
  const pendapatan = useData<DataPendapatan>(`/api/periode/${periodeId}/pendapatan`);
  const pengaturan = useData<Pengaturan>("/api/pengaturan");

  const galat = pendapatan.galat ?? pengaturan.galat;
  if (galat) {
    return (
      <Pesan
        jenis="galat"
        judul="Data belum bisa dimuat"
        aksi={
          <Tombol
            ukuran="kecil"
            varian="sekunder"
            onClick={() => {
              pendapatan.muatUlang();
              pengaturan.muatUlang();
            }}
          >
            Coba lagi
          </Tombol>
        }
      >
        {galat.message}
      </Pesan>
    );
  }
  if (!pendapatan.data || !pengaturan.data) return <MemuatData />;

  if (pendapatan.data.cabang.length === 0) {
    return (
      <KeadaanKosong
        judul="Belum ada cabang"
        deskripsi="Daftar cabang diambil dari data karyawan aktif. Tambahkan karyawan di menu Karyawan, lalu kembali ke langkah ini."
        aksi={<TombolTautan href="/karyawan">Ke menu Karyawan</TombolTautan>}
      />
    );
  }

  return (
    <div className="space-y-5">
      {final ? (
        <Pesan jenis="info" judul="Periode sudah final">
          Pendapatan tidak dapat diubah lagi. Buka kembali periode di langkah Hitung Gaji bila perlu koreksi.
        </Pesan>
      ) : null}
      {pendapatan.data.cabang.map((c) => (
        <KartuCabang key={c.cabang} periodeId={periodeId} data={c} tingkat={pengaturan.data!.tingkatBonus} final={final} onTersimpan={pendapatan.muatUlang} />
      ))}
    </div>
  );
}

interface PropKartu {
  periodeId: string;
  data: DataCabang;
  tingkat: Pengaturan["tingkatBonus"];
  final: boolean;
  onTersimpan: () => void;
}

function KartuCabang({ periodeId, data, tingkat, final, onTersimpan }: PropKartu) {
  const form = useRef<HTMLFormElement>(null);
  // Nama semua kandidat sales dicatat sekali saat kartu dibuka, sehingga baris yang dihapus bisa ditambahkan lagi.
  const [nama] = useState(
    () => new Map<string, string>([...data.sales.map((s) => [s.karyawanId, s.nama] as const), ...data.kandidatSales.map((k) => [k.id, k.nama] as const)]),
  );
  const [isian, setIsian] = useState<IsianCabang>(() => isianAwal(data));
  const [tersimpan, setTersimpan] = useState(() => JSON.stringify(isianAwal(data)));
  const [kolom, setKolom] = useState<Record<string, string>>({});
  const [pesan, setPesan] = useState<string | null>(null);
  const [kabar, setKabar] = useState<{ jenis: "sukses" | "peringatan"; teks: string } | null>(null);
  const [memproses, setMemproses] = useState(false);

  /** Mengubah angka membatalkan pengakuan selisih, karena pengakuan hanya berlaku untuk selisih yang sedang terlihat. */
  function ubahAngka(ubah: (lama: IsianCabang) => IsianCabang) {
    setIsian((lama) => ({ ...ubah(lama), akui: false }));
    setKabar(null);
  }
  const ubahBaris = (id: string, perubahan: Partial<BarisSalesIsian>) =>
    ubahAngka((l) => ({ ...l, sales: l.sales.map((s) => (s.karyawanId === id ? { ...s, ...perubahan } : s)) }));
  const tambah = (ids: string[]) =>
    ubahAngka((l) => ({ ...l, sales: [...l.sales, ...ids.map((id) => ({ karyawanId: id, nominal: null, target: null }))] }));
  const hapus = (id: string) => ubahAngka((l) => ({ ...l, sales: l.sales.filter((s) => s.karyawanId !== id) }));

  const dipakai = new Set(isian.sales.map((s) => s.karyawanId));
  const tersedia = [...nama.entries()].filter(([id]) => !dipakai.has(id)).sort((a, b) => a[1].localeCompare(b[1], "id"));

  const jumlahBreakdown = isian.sales.reduce((total, s) => total + (s.nominal ?? 0), 0);
  const jumlahTarget = isian.sales.reduce((total, s) => total + (s.target ?? 0), 0);
  const selisih = isian.total === null ? 0 : isian.total - jumlahBreakdown;
  const perluAkui = isian.sales.length > 0 && isian.total !== null && selisih !== 0;
  const belumTersimpan = JSON.stringify(isian) !== tersimpan;
  useCegahKehilangan(belumTersimpan);
  const sudahAda = data.adaBreakdown || data.totalAktual > 0;

  async function simpan(e: FormEvent) {
    e.preventDefault();
    const k: Record<string, string> = {};
    if (isian.total === null) k.totalAktual = "Isi total pendapatan cabang. Isi 0 bila cabang tidak punya pendapatan.";
    for (const s of isian.sales) {
      if (s.nominal === null) k[`nominal-${s.karyawanId}`] = `Isi pendapatan ${nama.get(s.karyawanId)}. Isi 0 bila tidak ada penjualan.`;
    }
    setKolom(k);
    const jumlahGalat = Object.keys(k).length;
    if (jumlahGalat > 0) {
      setPesan(jumlahGalat === 1 ? Object.values(k)[0] : `Ada ${jumlahGalat} isian yang belum benar. Periksa kolom yang ditandai, lalu coba lagi.`);
      fokusKolomPertama(form.current, k);
      return;
    }

    setPesan(null);
    setKabar(null);
    setMemproses(true);
    const potret = JSON.stringify(isian);
    try {
      const hasil = await api<{ cabang: DataCabang; peringatan: string | null }>(`/api/periode/${periodeId}/pendapatan`, {
        metode: "PUT",
        body: {
          cabang: data.cabang,
          totalAktual: isian.total,
          akuiSelisih: perluAkui && isian.akui,
          sales: isian.sales.map((s) => ({ karyawanId: s.karyawanId, nominal: s.nominal, target: s.target ?? 0 })),
        },
      });
      setTersimpan(potret);
      setKabar(
        hasil.peringatan && !isian.akui
          ? { jenis: "peringatan", teks: `Tersimpan. ${hasil.peringatan}. Periksa angkanya, atau akui selisih ini agar gaji bisa dihitung.` }
          : { jenis: "sukses", teks: `Pendapatan cabang ${data.cabang} tersimpan.` },
      );
      onTersimpan();
    } catch (g) {
      const galat = g instanceof GalatApi ? g : new GalatApi(0, "Gagal menyimpan. Coba lagi.");
      setPesan(galat.message);
      setKolom(galat.kolom);
    } finally {
      setMemproses(false);
    }
  }

  return (
    <Kartu
      judul={`Cabang ${data.cabang}`}
      deskripsi="Pembagian per sales boleh dikosongkan."
      aksi={
        belumTersimpan ? (
          <Badge nada="peringatan">Belum tersimpan</Badge>
        ) : sudahAda ? (
          <Badge nada="sukses">Tersimpan</Badge>
        ) : (
          <Badge nada="netral">Belum diisi</Badge>
        )
      }
    >
      <form ref={form} onSubmit={(e) => void simpan(e)} noValidate className="space-y-4">
        <RingkasanGalat pesan={pesan} />
        {kabar ? (
          <Pesan jenis={kabar.jenis} judul={kabar.jenis === "sukses" ? "Tersimpan" : "Tersimpan dengan catatan"}>
            {kabar.teks}
          </Pesan>
        ) : null}

        <KolomNominal
          label="Total pendapatan aktual cabang"
          name="totalAktual"
          nilai={isian.total}
          onUbah={(v) => ubahAngka((l) => ({ ...l, total: v }))}
          galat={kolom.totalAktual}
          disabled={final}
          wajib
          className="max-w-sm"
        />

        {isian.sales.length === 0 ? (
          <p className="text-teks-redup">
            Belum ada pembagian per sales. Tanpa pembagian, hanya total cabang yang dicatat dan tidak ada bonus target untuk cabang ini.
          </p>
        ) : (
          <Tabel keterangan={`Pendapatan dan target sales cabang ${data.cabang}`}>
            <KepalaTabel>
              <tr>
                <Th>Sales</Th>
                <Th className="text-right">Pendapatan</Th>
                <Th className="text-right">Target</Th>
                <Th className="text-right">Capaian</Th>
                <Th className="text-right">Bonus</Th>
                <Th>
                  <span className="sr-only">Aksi</span>
                </Th>
              </tr>
            </KepalaTabel>
            <tbody>
              {isian.sales.map((s) => {
                const n = nama.get(s.karyawanId) ?? "Sales";
                const permil = persenCapaianPermil(s.nominal ?? 0, s.target ?? 0);
                const bonus = hitungBonusTarget(s.nominal ?? 0, s.target ?? 0, tingkat).bonus;
                return (
                  <Baris key={s.karyawanId}>
                    <Td className="font-semibold">{n}</Td>
                    <Td>
                      <SelNominal
                        label={`Pendapatan ${n}`}
                        name={`nominal-${s.karyawanId}`}
                        nilai={s.nominal}
                        onUbah={(v) => ubahBaris(s.karyawanId, { nominal: v })}
                        disabled={final}
                        bermasalah={`nominal-${s.karyawanId}` in kolom}
                      />
                    </Td>
                    <Td>
                      <SelNominal label={`Target ${n}`} name={`target-${s.karyawanId}`} nilai={s.target} onUbah={(v) => ubahBaris(s.karyawanId, { target: v })} disabled={final} />
                    </Td>
                    <TdAngka>{permil === null ? "Tidak ada target" : formatPersenPermil(permil)}</TdAngka>
                    <TdAngka>{formatRupiah(bonus)}</TdAngka>
                    <Td>
                      {!final ? (
                        <div className="flex justify-end">
                          <Tombol varian="sekunder" ukuran="kecil" onClick={() => hapus(s.karyawanId)}>
                            Hapus<span className="sr-only"> {n}</span>
                          </Tombol>
                        </div>
                      ) : null}
                    </Td>
                  </Baris>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-garis-tebal bg-merek-lembut font-bold">
                <th scope="row" className="px-3 py-2.5 text-left">
                  Jumlah sales
                </th>
                <TdAngka>{formatRupiah(jumlahBreakdown)}</TdAngka>
                <TdAngka>{formatRupiah(jumlahTarget)}</TdAngka>
                <td />
                <td />
                <td />
              </tr>
            </tfoot>
          </Tabel>
        )}

        {perluAkui ? (
          <Pesan jenis="peringatan" judul={`Selisih ${formatRupiah(Math.abs(selisih))}`}>
            <p>
              Total cabang {formatRupiah(isian.total ?? 0)}, sedangkan jumlah pendapatan sales {formatRupiah(jumlahBreakdown)}. Pembagian per sales{" "}
              {selisih > 0 ? "kurang dari" : "melebihi"} total cabang. Periksa kembali angkanya. Bila selisih ini memang benar, centang pengakuan di bawah, karena gaji
              tidak bisa dihitung sebelum selisih diakui.
            </p>
            <KotakCentang
              label="Saya sudah memeriksa dan mengakui selisih ini"
              checked={isian.akui}
              disabled={final}
              onChange={(e) => {
                const centang = e.target.checked;
                setIsian((l) => ({ ...l, akui: centang }));
              }}
            />
          </Pesan>
        ) : null}

        {!final ? (
          <div className="flex flex-wrap items-end gap-3">
            <KolomPilih
              label="Tambah sales"
              value=""
              onChange={(e) => {
                if (e.target.value) tambah([e.target.value]);
              }}
              disabled={tersedia.length === 0}
              className="min-w-64"
            >
              <option value="">{tersedia.length === 0 ? "Semua karyawan cabang ini sudah ditambahkan" : "Pilih karyawan cabang ini"}</option>
              {tersedia.map(([id, n]) => (
                <option key={id} value={id}>
                  {n}
                </option>
              ))}
            </KolomPilih>
            <Tombol varian="sekunder" disabled={tersedia.length === 0} onClick={() => tambah(tersedia.map(([id]) => id))}>
              Tambahkan semua karyawan cabang
            </Tombol>
            <Tombol type="submit" memuat={memproses}>
              Simpan cabang {data.cabang}
            </Tombol>
          </div>
        ) : null}
      </form>
    </Kartu>
  );
}
