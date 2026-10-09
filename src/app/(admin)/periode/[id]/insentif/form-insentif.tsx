"use client";

import { useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Kartu } from "@/components/ui/kartu";
import { SelNominal, SelTeks } from "@/components/ui/kolom";
import { KeadaanKosong } from "@/components/ui/kosong";
import { Pesan, RingkasanGalat } from "@/components/ui/pesan";
import { MemuatData } from "@/components/ui/spinner";
import { Baris, KepalaTabel, Tabel, Td, TdAngka, Th } from "@/components/ui/tabel";
import { Tombol, TombolTautan } from "@/components/ui/tombol";
import { formatRupiah } from "@/domain/uang";
import { useData } from "@/hooks/use-data";
import { GalatApi, api } from "@/lib/api";
import type { BarisInsentif, ambilInsentif } from "@/server/services/insentif";

type DataInsentif = Awaited<ReturnType<typeof ambilInsentif>>;

const MAKS_ENTRI = 50;

interface EntriIsian {
  kunci: number;
  jenis: string;
  nominal: number | null;
}
type PetaEntri = Record<string, EntriIsian[]>;

/** Setiap karyawan selalu punya minimal satu baris kosong, supaya HRD bisa langsung mengetik. */
function buatPeta(karyawan: BarisInsentif[]): PetaEntri {
  let kunci = 0;
  return Object.fromEntries(
    karyawan.map((k) => [
      k.karyawanId,
      (k.entri.length > 0 ? k.entri : [{ jenis: "", nominal: null }]).map((e) => ({ kunci: kunci++, jenis: e.jenis, nominal: e.nominal })),
    ]),
  );
}

const potret = (peta: PetaEntri) => JSON.stringify(Object.entries(peta).map(([id, entri]) => [id, entri.map((e) => [e.jenis, e.nominal])]));
const jumlahNominal = (entri: EntriIsian[]) => entri.reduce((total, e) => total + (e.nominal ?? 0), 0);

export function FormInsentif({ periodeId, final }: { periodeId: string; final: boolean }) {
  const insentif = useData<DataInsentif>(`/api/periode/${periodeId}/insentif`);

  if (insentif.galat) {
    return (
      <Pesan jenis="galat" judul="Data belum bisa dimuat" aksi={<Tombol ukuran="kecil" varian="sekunder" onClick={insentif.muatUlang}>Coba lagi</Tombol>}>
        {insentif.galat.message}
      </Pesan>
    );
  }
  if (!insentif.data) return <MemuatData />;

  if (insentif.data.karyawan.length === 0) {
    return (
      <KeadaanKosong
        judul="Belum ada karyawan aktif"
        deskripsi="Tambahkan karyawan di menu Karyawan, lalu kembali ke langkah ini."
        aksi={<TombolTautan href="/karyawan">Ke menu Karyawan</TombolTautan>}
      />
    );
  }
  return <TabelInsentif periodeId={periodeId} data={insentif.data} final={final} onTersimpan={insentif.muatUlang} />;
}

function TabelInsentif({ periodeId, data, final, onTersimpan }: { periodeId: string; data: DataInsentif; final: boolean; onTersimpan: () => void }) {
  const kunciBaru = useRef(1_000_000);
  const [peta, setPeta] = useState<PetaEntri>(() => buatPeta(data.karyawan));
  const [tersimpan, setTersimpan] = useState(() => potret(buatPeta(data.karyawan)));
  const [pesan, setPesan] = useState<string | null>(null);
  const [kabar, setKabar] = useState<{ disimpan: number; peringatan: string[] } | null>(null);
  const [memproses, setMemproses] = useState(false);

  const belumTersimpan = potret(peta) !== tersimpan;

  function ubah(id: string, kunci: number, perubahan: Partial<EntriIsian>) {
    setKabar(null);
    setPeta((l) => ({ ...l, [id]: l[id].map((e) => (e.kunci === kunci ? { ...e, ...perubahan } : e)) }));
  }
  function tambah(id: string) {
    const kunci = kunciBaru.current++;
    setKabar(null);
    setPeta((l) => ({ ...l, [id]: [...l[id], { kunci, jenis: "", nominal: null }] }));
  }
  function hapus(id: string, kunci: number) {
    const pengganti = kunciBaru.current++;
    setKabar(null);
    setPeta((l) => {
      const sisa = l[id].filter((e) => e.kunci !== kunci);
      return { ...l, [id]: sisa.length > 0 ? sisa : [{ kunci: pengganti, jenis: "", nominal: null }] };
    });
  }

  async function simpan() {
    setPesan(null);
    setKabar(null);
    setMemproses(true);
    const potretKirim = potret(peta);
    try {
      const hasil = await api<{ disimpan: number; peringatan: string[] }>(`/api/periode/${periodeId}/insentif`, {
        metode: "PUT",
        body: {
          items: data.karyawan.map((k) => ({
            karyawanId: k.karyawanId,
            entri: peta[k.karyawanId].map((e) => ({ jenis: e.jenis, nominal: e.nominal })),
          })),
        },
      });
      setTersimpan(potretKirim);
      setKabar(hasil);
      onTersimpan();
    } catch (g) {
      setPesan(g instanceof GalatApi ? g.message : "Gagal menyimpan. Coba lagi.");
    } finally {
      setMemproses(false);
    }
  }

  const totalInsentif = data.karyawan.reduce((total, k) => total + jumlahNominal(peta[k.karyawanId]), 0);
  const totalBonus = data.karyawan.reduce((total, k) => total + k.bonusTarget, 0);

  return (
    <div className="space-y-4">
      {final ? (
        <Pesan jenis="info" judul="Periode sudah final">
          Insentif tidak dapat diubah lagi. Buka kembali periode di langkah Hitung Gaji bila perlu koreksi.
        </Pesan>
      ) : null}
      {kabar ? (
        <Pesan jenis={kabar.peringatan.length > 0 ? "peringatan" : "sukses"} judul={kabar.peringatan.length > 0 ? "Tersimpan dengan catatan" : "Tersimpan"}>
          <p>{kabar.disimpan} baris insentif tersimpan. Baris tanpa nominal tidak disimpan.</p>
          {kabar.peringatan.length > 0 ? (
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {kabar.peringatan.map((p, n) => (
                <li key={n}>{p}</li>
              ))}
            </ul>
          ) : null}
        </Pesan>
      ) : null}
      <RingkasanGalat pesan={pesan} />

      <Kartu
        judul="Insentif per karyawan"
        deskripsi="Satu karyawan boleh punya beberapa baris. Kolom jenis yang dikosongkan dicatat sebagai Pengiriman. Bonus target diambil dari langkah Pendapatan dan Target."
        aksi={belumTersimpan ? <Badge nada="peringatan">Belum tersimpan</Badge> : undefined}
      >
        <Tabel keterangan="Insentif dan bonus target tiap karyawan aktif">
          <KepalaTabel>
            <tr>
              <Th>Karyawan</Th>
              <Th>Insentif</Th>
              <Th className="text-right">Bonus target</Th>
              <Th className="text-right">Total</Th>
            </tr>
          </KepalaTabel>
          <tbody>
            {data.karyawan.map((k) => {
              const entri = peta[k.karyawanId];
              return (
                <Baris key={k.karyawanId} className="align-top">
                  <Td>
                    <span className="font-semibold">{k.nama}</span>
                    <span className="block text-teks-redup">{k.cabang}</span>
                  </Td>
                  <Td>
                    <ul className="space-y-2">
                      {entri.map((e, n) => (
                        <li key={e.kunci} className="flex flex-wrap items-center gap-2">
                          <SelTeks
                            label={`Jenis insentif ${k.nama} baris ${n + 1}`}
                            value={e.jenis}
                            placeholder="Pengiriman"
                            maxLength={100}
                            disabled={final}
                            onChange={(v) => ubah(k.karyawanId, e.kunci, { jenis: v })}
                          />
                          <SelNominal label={`Nominal insentif ${k.nama} baris ${n + 1}`} nilai={e.nominal} disabled={final} onUbah={(v) => ubah(k.karyawanId, e.kunci, { nominal: v })} />
                          {!final ? (
                            <Tombol varian="sekunder" ukuran="kecil" onClick={() => hapus(k.karyawanId, e.kunci)}>
                              Hapus<span className="sr-only"> baris {n + 1} {k.nama}</span>
                            </Tombol>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                    {!final ? (
                      <Tombol varian="tautan" ukuran="kecil" className="mt-1" disabled={entri.length >= MAKS_ENTRI} onClick={() => tambah(k.karyawanId)}>
                        + Tambah baris<span className="sr-only"> untuk {k.nama}</span>
                      </Tombol>
                    ) : null}
                  </Td>
                  <TdAngka>{formatRupiah(k.bonusTarget)}</TdAngka>
                  <TdAngka className="font-bold">{formatRupiah(jumlahNominal(entri) + k.bonusTarget)}</TdAngka>
                </Baris>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-garis-tebal bg-merek-lembut font-bold">
              <th scope="row" className="px-3 py-2.5 text-left">
                Jumlah insentif {formatRupiah(totalInsentif)}
              </th>
              <td />
              <TdAngka>{formatRupiah(totalBonus)}</TdAngka>
              <TdAngka>{formatRupiah(totalInsentif + totalBonus)}</TdAngka>
            </tr>
          </tfoot>
        </Tabel>

        {!final ? (
          <div className="sticky bottom-0 z-10 -mx-5 -mb-4 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-b-xl border-t border-garis bg-kartu px-5 py-3">
            <p className="text-teks-redup">{belumTersimpan ? "Ada perubahan yang belum disimpan." : "Semua perubahan sudah tersimpan."}</p>
            <Tombol memuat={memproses} onClick={() => void simpan()}>
              Simpan insentif
            </Tombol>
          </div>
        ) : null}
      </Kartu>
    </div>
  );
}
