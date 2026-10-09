"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { KonfirmasiDialog } from "@/components/ui/dialog";
import { KolomInput, KolomPilih } from "@/components/ui/kolom";
import { JudulHalaman } from "@/components/ui/kartu";
import { KeadaanKosong } from "@/components/ui/kosong";
import { Pesan } from "@/components/ui/pesan";
import { MemuatData } from "@/components/ui/spinner";
import { Baris, KepalaTabel, Tabel, Td, TdAngka, Th } from "@/components/ui/tabel";
import { Tombol } from "@/components/ui/tombol";
import { formatRupiah } from "@/domain/uang";
import { useData } from "@/hooks/use-data";
import { api, pesanDariGalat } from "@/lib/api";
import type { KaryawanDto } from "@/server/services/karyawan";
import { FormKaryawan } from "./form-karyawan";

interface Daftar {
  karyawan: KaryawanDto[];
  daftarCabang: string[];
}

function useTertunda<T>(nilai: T, ms: number): T {
  const [tertunda, setTertunda] = useState(nilai);
  useEffect(() => {
    const timer = setTimeout(() => setTertunda(nilai), ms);
    return () => clearTimeout(timer);
  }, [nilai, ms]);
  return tertunda;
}

export function DaftarKaryawan() {
  const [cari, setCari] = useState("");
  const [cabang, setCabang] = useState("");
  const [status, setStatus] = useState("aktif");
  const cariTertunda = useTertunda(cari, 250);

  const parameter = new URLSearchParams();
  if (cariTertunda.trim()) parameter.set("cari", cariTertunda.trim());
  if (cabang) parameter.set("cabang", cabang);
  parameter.set("status", status);
  const { data, galat, memuat, muatUlang } = useData<Daftar>(`/api/karyawan?${parameter.toString()}`);

  const [formBuka, setFormBuka] = useState<{ karyawan: KaryawanDto | null } | null>(null);
  const [hapus, setHapus] = useState<KaryawanDto | null>(null);
  const [memprosesHapus, setMemprosesHapus] = useState(false);
  const [galatHapus, setGalatHapus] = useState<string | null>(null);
  const [kabar, setKabar] = useState<string | null>(null);

  async function konfirmasiHapus() {
    if (!hapus) return;
    setMemprosesHapus(true);
    setGalatHapus(null);
    try {
      const { hasil } = await api<{ hasil: "dihapus" | "dinonaktifkan" }>(`/api/karyawan/${hapus.id}`, { metode: "DELETE" });
      setKabar(
        hasil === "dihapus"
          ? `${hapus.namaLengkap} sudah dihapus dari daftar karyawan.`
          : `${hapus.namaLengkap} sudah punya riwayat gaji, jadi statusnya diubah menjadi nonaktif dan riwayatnya tetap tersimpan.`,
      );
      setHapus(null);
      muatUlang();
    } catch (g) {
      setGalatHapus(pesanDariGalat(g));
    } finally {
      setMemprosesHapus(false);
    }
  }

  const daftar = data?.karyawan ?? [];
  const adaFilter = Boolean(cariTertunda.trim() || cabang || status !== "aktif");

  return (
    <>
      <JudulHalaman
        judul="Karyawan"
        deskripsi="Data karyawan menjadi dasar perhitungan gaji. Pastikan gaji pokok, tunjangan, dan nomor rekening sudah benar."
        aksi={<Tombol onClick={() => setFormBuka({ karyawan: null })}>Tambah Karyawan</Tombol>}
      />

      {kabar ? (
        <Pesan jenis="sukses" judul="Berhasil" className="mb-4">
          {kabar}
        </Pesan>
      ) : null}

      <div className="mb-4 grid gap-3 rounded-xl border border-garis bg-kartu p-4 md:grid-cols-[2fr_1fr_1fr]">
        <KolomInput
          label="Cari nama"
          name="cari"
          type="search"
          value={cari}
          onChange={(e) => setCari(e.target.value)}
          placeholder="Ketik nama karyawan"
        />
        <KolomPilih label="Cabang" name="cabang" value={cabang} onChange={(e) => setCabang(e.target.value)}>
          <option value="">Semua cabang</option>
          {(data?.daftarCabang ?? []).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </KolomPilih>
        <KolomPilih label="Status" name="status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="aktif">Aktif</option>
          <option value="nonaktif">Nonaktif</option>
          <option value="semua">Semua</option>
        </KolomPilih>
      </div>

      {galat ? (
        <Pesan
          jenis="galat"
          judul="Daftar karyawan belum bisa dimuat"
          aksi={
            <Tombol ukuran="kecil" varian="sekunder" onClick={muatUlang}>
              Coba lagi
            </Tombol>
          }
        >
          {galat.message}
        </Pesan>
      ) : data === null && memuat ? (
        <MemuatData />
      ) : daftar.length === 0 ? (
        <KeadaanKosong
          judul={adaFilter ? "Tidak ada karyawan yang cocok" : "Belum ada karyawan"}
          deskripsi={
            adaFilter
              ? "Ubah kata pencarian atau filter, lalu coba lagi."
              : "Tambahkan karyawan pertama Anda untuk mulai menghitung gaji."
          }
          aksi={!adaFilter ? <Tombol onClick={() => setFormBuka({ karyawan: null })}>Tambah Karyawan</Tombol> : undefined}
        />
      ) : (
        <div aria-busy={memuat}>
          <Tabel keterangan="Daftar karyawan">
            <KepalaTabel>
              <tr>
                <Th>Nama</Th>
                <Th>Jabatan</Th>
                <Th>Cabang</Th>
                <Th className="text-right">Gaji pokok</Th>
                <Th className="text-right">Tunjangan</Th>
                <Th>No. rekening</Th>
                <Th>Status</Th>
                <Th>
                  <span className="sr-only">Aksi</span>
                </Th>
              </tr>
            </KepalaTabel>
            <tbody>
              {daftar.map((k) => (
                <Baris key={k.id}>
                  <Td className="font-semibold">{k.namaLengkap}</Td>
                  <Td>{k.jabatan}</Td>
                  <Td>{k.cabang}</Td>
                  <TdAngka>{formatRupiah(k.gajiPokok)}</TdAngka>
                  <TdAngka>{formatRupiah(k.tunjangan)}</TdAngka>
                  <Td className="tabular-nums">{k.nomorRekening}</Td>
                  <Td>
                    <Badge nada={k.statusAktif ? "sukses" : "netral"}>{k.statusAktif ? "Aktif" : "Nonaktif"}</Badge>
                  </Td>
                  <Td>
                    <div className="flex justify-end gap-2">
                      <Tombol varian="sekunder" ukuran="kecil" onClick={() => setFormBuka({ karyawan: k })}>
                        Ubah
                      </Tombol>
                      <Tombol varian="sekunder" ukuran="kecil" onClick={() => setHapus(k)}>
                        Hapus
                      </Tombol>
                    </div>
                  </Td>
                </Baris>
              ))}
            </tbody>
          </Tabel>
          <p className="mt-2 text-teks-redup">{daftar.length} karyawan ditampilkan.</p>
        </div>
      )}

      <FormKaryawan
        buka={formBuka !== null}
        karyawan={formBuka?.karyawan ?? null}
        daftarCabang={data?.daftarCabang ?? []}
        onTutup={() => setFormBuka(null)}
        onTersimpan={(pesan) => {
          setFormBuka(null);
          setKabar(pesan);
          muatUlang();
        }}
      />

      <KonfirmasiDialog
        buka={hapus !== null}
        judul={`Hapus ${hapus?.namaLengkap ?? "karyawan"}?`}
        pesan={
          <div className="space-y-3">
            <p>
              Karyawan <strong>{hapus?.namaLengkap}</strong> akan dihapus dari daftar. Bila sudah pernah punya hasil gaji, statusnya
              hanya diubah menjadi nonaktif supaya riwayat gaji tetap utuh.
            </p>
            {galatHapus ? <Pesan jenis="galat">{galatHapus}</Pesan> : null}
          </div>
        }
        labelYa="Ya, hapus"
        bahaya
        memproses={memprosesHapus}
        onYa={konfirmasiHapus}
        onBatal={() => {
          setHapus(null);
          setGalatHapus(null);
        }}
      />
    </>
  );
}
