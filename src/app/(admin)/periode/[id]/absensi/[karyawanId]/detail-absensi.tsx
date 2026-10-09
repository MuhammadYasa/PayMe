"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Kartu } from "@/components/ui/kartu";
import { KolomInput, KolomPilih } from "@/components/ui/kolom";
import { Pesan } from "@/components/ui/pesan";
import { MemuatData } from "@/components/ui/spinner";
import { Tombol, kelasTombol } from "@/components/ui/tombol";
import { LABEL_STATUS, STATUS_ABSENSI, type StatusAbsensi } from "@/domain/absensi";
import { formatTanggal } from "@/domain/tanggal";
import { useData } from "@/hooks/use-data";
import { GalatApi, api } from "@/lib/api";
import { ringkasGalatZod } from "@/lib/zod-galat";
import { itemCatatanSkema } from "@/skema/absensi";
import type { detailKaryawan, ringkasanPeriode } from "@/server/services/absensi";

type Detail = Awaited<ReturnType<typeof detailKaryawan>>;
type Ringkasan = Awaited<ReturnType<typeof ringkasanPeriode>>;

interface Isian {
  status: StatusAbsensi | "";
  jamMasuk: string;
  jamPulang: string;
  keterangan: string;
}

const dariBaris = (b: Detail["baris"][number]): Isian => ({
  status: b.status ?? "",
  jamMasuk: b.jamMasuk ?? "",
  jamPulang: b.jamPulang ?? "",
  keterangan: b.keterangan ?? "",
});

const sama = (a: Isian, b: Isian) =>
  a.status === b.status && a.jamMasuk === b.jamMasuk && a.jamPulang === b.jamPulang && a.keterangan === b.keterangan;

export function DetailAbsensi({ periodeId, karyawanId }: { periodeId: string; karyawanId: string }) {
  const { data, galat, memuat, muatUlang } = useData<Detail>(`/api/periode/${periodeId}/absensi/${karyawanId}`);
  const daftarBelumLengkap = useData<Ringkasan>(`/api/periode/${periodeId}/absensi?hanya=belum-lengkap`);

  if (galat) {
    return (
      <Pesan jenis="galat" judul="Absensi karyawan belum bisa dimuat" aksi={<Tombol ukuran="kecil" varian="sekunder" onClick={muatUlang}>Coba lagi</Tombol>}>
        {galat.message}
      </Pesan>
    );
  }
  if (!data || memuat) return <MemuatData />;

  const berikutnya = daftarBelumLengkap.data?.karyawan.find((k) => k.karyawanId !== karyawanId);
  return (
    <Editor
      key={`${data.karyawan.id}-${data.baris.map((b) => `${b.tanggal}${b.status}${b.jamMasuk}${b.jamPulang}${b.keterangan}`).join("|").length}`}
      periodeId={periodeId}
      awal={data}
      idBerikutnya={berikutnya?.karyawanId}
      namaBerikutnya={berikutnya?.nama}
      onSimpan={() => daftarBelumLengkap.muatUlang()}
    />
  );
}

function Editor({
  periodeId,
  awal,
  idBerikutnya,
  namaBerikutnya,
  onSimpan,
}: {
  periodeId: string;
  awal: Detail;
  idBerikutnya?: string;
  namaBerikutnya?: string;
  onSimpan: () => void;
}) {
  const [detail, setDetail] = useState<Detail>(awal);
  const [isian, setIsian] = useState<Record<string, Isian>>(() => Object.fromEntries(awal.baris.map((b) => [b.tanggal, dariBaris(b)])));
  const [galatBaris, setGalatBaris] = useState<Record<string, string>>({});
  const [pesan, setPesan] = useState<{ jenis: "sukses" | "galat"; teks: string } | null>(null);
  const [memproses, setMemproses] = useState(false);
  const [statusMassal, setStatusMassal] = useState<StatusAbsensi>("LAINNYA");
  const [ketMassal, setKetMassal] = useState("");

  const asli = useMemo(() => Object.fromEntries(detail.baris.map((b) => [b.tanggal, dariBaris(b)])), [detail]);
  const berubah = detail.baris.filter((b) => !sama(isian[b.tanggal], asli[b.tanggal]));
  const kosong = detail.ringkasan.tanggalKosong;

  function ubah(tanggal: string, bagian: Partial<Isian>) {
    setIsian((lama) => ({ ...lama, [tanggal]: { ...lama[tanggal], ...bagian } }));
    setGalatBaris((lama) => Object.fromEntries(Object.entries(lama).filter(([kunci]) => kunci !== tanggal)));
  }

  function terapkan(hasil: Detail) {
    setDetail(hasil);
    setIsian(Object.fromEntries(hasil.baris.map((b) => [b.tanggal, dariBaris(b)])));
    setGalatBaris({});
    onSimpan();
  }

  async function simpan() {
    setPesan(null);
    const simpan = [];
    const hapus: string[] = [];
    const galat: Record<string, string> = {};
    for (const b of berubah) {
      const i = isian[b.tanggal];
      if (i.status === "") {
        hapus.push(b.tanggal);
        continue;
      }
      const cek = itemCatatanSkema.safeParse({ tanggal: b.tanggal, status: i.status, jamMasuk: i.jamMasuk, jamPulang: i.jamPulang, keterangan: i.keterangan });
      if (!cek.success) galat[b.tanggal] = ringkasGalatZod(cek.error).pesan;
      else simpan.push(cek.data);
    }
    setGalatBaris(galat);
    if (Object.keys(galat).length > 0) {
      setPesan({ jenis: "galat", teks: `Ada ${Object.keys(galat).length} baris yang belum benar. Perbaiki baris yang ditandai, lalu simpan lagi.` });
      return;
    }

    setMemproses(true);
    try {
      const hasil = await api<Detail>(`/api/periode/${periodeId}/absensi/${detail.karyawan.id}`, { metode: "PUT", body: { simpan, hapus } });
      terapkan(hasil);
      setPesan({
        jenis: "sukses",
        teks: hasil.ringkasan.jumlahKosong > 0 ? `Tersimpan. Masih ada ${hasil.ringkasan.jumlahKosong} tanggal kosong.` : "Tersimpan. Semua tanggal karyawan ini sudah terisi.",
      });
    } catch (g) {
      setPesan({ jenis: "galat", teks: g instanceof GalatApi ? g.message : "Gagal menyimpan. Coba lagi." });
    } finally {
      setMemproses(false);
    }
  }

  async function isiMassal() {
    setPesan(null);
    if (statusMassal === "LAINNYA" && !ketMassal.trim()) {
      setPesan({ jenis: "galat", teks: "Status lainnya wajib diberi keterangan. Tulis alasannya, misalnya 'Belum masuk kerja'." });
      return;
    }
    setMemproses(true);
    try {
      const hasilMassal = await api<{ diisi: number }>(`/api/periode/${periodeId}/absensi/${detail.karyawan.id}/massal`, {
        body: { tanggal: kosong, status: statusMassal, keterangan: ketMassal || null, timpa: false },
      });
      terapkan(await api<Detail>(`/api/periode/${periodeId}/absensi/${detail.karyawan.id}`));
      setPesan({ jenis: "sukses", teks: `${hasilMassal.diisi} tanggal kosong diisi sebagai ${LABEL_STATUS[statusMassal].toLowerCase()}.` });
    } catch (g) {
      setPesan({ jenis: "galat", teks: g instanceof GalatApi ? g.message : "Gagal mengisi. Coba lagi." });
    } finally {
      setMemproses(false);
    }
  }

  const r = detail.ringkasan;
  const final = detail.periode.status === "FINAL";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={`/periode/${periodeId}/absensi`} className="font-semibold text-merek underline-offset-2 hover:underline">
            Kembali ke daftar absensi
          </Link>
          <h2 className="mt-1 text-xl font-bold">{detail.karyawan.namaLengkap}</h2>
          <p className="text-teks-redup">{detail.karyawan.cabang}</p>
        </div>
        {r.jumlahKosong > 0 ? <Badge nada="peringatan">{r.jumlahKosong} tanggal kosong</Badge> : <Badge nada="sukses">Lengkap</Badge>}
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {[
          ["Hari kerja", r.hariKerja],
          ["Hadir", r.hadir],
          ["Libur", r.totalLibur],
          ["Izin", r.izin],
          ["Sakit", r.sakit],
          ["Cuti", r.cuti],
          ["Lainnya", r.lainnya],
          ["Kosong", r.jumlahKosong],
        ].map(([label, nilai]) => (
          <div key={label as string} className="rounded-lg border border-garis bg-kartu px-3 py-2">
            <dt className="text-sm text-teks-redup">{label}</dt>
            <dd className="text-xl font-extrabold tabular-nums">{nilai}</dd>
          </div>
        ))}
      </dl>

      {pesan ? (
        <Pesan jenis={pesan.jenis} judul={pesan.jenis === "sukses" ? "Berhasil" : "Belum bisa disimpan"}>
          {pesan.teks}
        </Pesan>
      ) : null}

      {!final && kosong.length > 0 ? (
        <Kartu
          judul="Isi semua tanggal kosong sekaligus"
          deskripsi={`Berguna untuk karyawan yang baru masuk di tengah periode atau yang tidak bekerja. Berlaku untuk ${kosong.length} tanggal kosong.`}
        >
          <div className="grid items-end gap-3 md:grid-cols-[1fr_2fr_auto]">
            <KolomPilih label="Isi dengan status" name="statusMassal" value={statusMassal} onChange={(e) => setStatusMassal(e.target.value as StatusAbsensi)}>
              {STATUS_ABSENSI.map((s) => <option key={s} value={s}>{LABEL_STATUS[s]}</option>)}
            </KolomPilih>
            <KolomInput label="Keterangan" name="ketMassal" value={ketMassal} onChange={(e) => setKetMassal(e.target.value)} placeholder="Mis. Belum masuk kerja" />
            <Tombol onClick={() => void isiMassal()} disabled={memproses}>Isi {kosong.length} tanggal</Tombol>
          </div>
        </Kartu>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-garis bg-kartu">
        <table className="w-full border-collapse text-left text-sm">
          <caption className="sr-only">Absensi {detail.karyawan.namaLengkap} per tanggal</caption>
          <thead className="bg-merek-lembut">
            <tr>
              <th scope="col" className="px-3 py-2.5 font-bold">Tanggal</th>
              <th scope="col" className="px-3 py-2.5 font-bold">Status</th>
              <th scope="col" className="px-3 py-2.5 font-bold">Jam masuk</th>
              <th scope="col" className="px-3 py-2.5 font-bold">Jam pulang</th>
              <th scope="col" className="px-3 py-2.5 font-bold">Keterangan</th>
              <th scope="col" className="px-3 py-2.5 font-bold">Sumber</th>
            </tr>
          </thead>
          <tbody>
            {detail.baris.map((b) => {
              const i = isian[b.tanggal];
              const kosongBaris = b.status === null && !b.liburMingguan;
              const dalamPerubahan = !sama(i, asli[b.tanggal]);
              const jamAktif = i.status === "HADIR" && !final;
              return (
                <tr
                  key={b.tanggal}
                  className={`border-t border-garis align-top ${kosongBaris && i.status === "" ? "bg-peringatan-latar" : b.liburMingguan && i.status === "" ? "bg-halaman" : ""} ${dalamPerubahan ? "outline outline-2 -outline-offset-2 outline-merek" : ""}`}
                >
                  <td className="whitespace-nowrap px-3 py-2">
                    <span className="font-semibold">{b.hari}, {formatTanggal(b.tanggal)}</span>
                    {kosongBaris && i.status === "" ? <span className="ml-2 inline-block rounded bg-peringatan-teks px-2 py-0.5 text-sm font-bold text-white">Kosong</span> : null}
                    {b.liburMingguan && i.status === "" ? <span className="ml-2 text-teks-redup">Libur mingguan</span> : null}
                  </td>
                  <td className="px-3 py-2">
                    <label className="sr-only" htmlFor={`status-${b.tanggal}`}>Status {formatTanggal(b.tanggal)}</label>
                    <select
                      id={`status-${b.tanggal}`}
                      value={i.status}
                      disabled={final}
                      onChange={(e) => ubah(b.tanggal, { status: e.target.value as StatusAbsensi | "" })}
                      className="min-h-10 w-full min-w-32 rounded-lg border border-garis-tebal bg-kartu px-2"
                    >
                      <option value="">{b.liburMingguan ? "(libur mingguan)" : "Belum diisi"}</option>
                      {STATUS_ABSENSI.map((s) => <option key={s} value={s}>{LABEL_STATUS[s]}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <label className="sr-only" htmlFor={`masuk-${b.tanggal}`}>Jam masuk {formatTanggal(b.tanggal)}</label>
                    <input id={`masuk-${b.tanggal}`} value={i.jamMasuk} disabled={!jamAktif} placeholder="08:00" inputMode="numeric" onChange={(e) => ubah(b.tanggal, { jamMasuk: e.target.value })} className="min-h-10 w-24 rounded-lg border border-garis-tebal bg-kartu px-2 disabled:bg-netral-latar" />
                  </td>
                  <td className="px-3 py-2">
                    <label className="sr-only" htmlFor={`pulang-${b.tanggal}`}>Jam pulang {formatTanggal(b.tanggal)}</label>
                    <input id={`pulang-${b.tanggal}`} value={i.jamPulang} disabled={!jamAktif} placeholder="16:00" inputMode="numeric" onChange={(e) => ubah(b.tanggal, { jamPulang: e.target.value })} className="min-h-10 w-24 rounded-lg border border-garis-tebal bg-kartu px-2 disabled:bg-netral-latar" />
                  </td>
                  <td className="px-3 py-2">
                    <label className="sr-only" htmlFor={`ket-${b.tanggal}`}>Keterangan {formatTanggal(b.tanggal)}</label>
                    <input id={`ket-${b.tanggal}`} value={i.keterangan} disabled={final} onChange={(e) => ubah(b.tanggal, { keterangan: e.target.value })} aria-invalid={galatBaris[b.tanggal] ? true : undefined} className="min-h-10 w-full min-w-44 rounded-lg border border-garis-tebal bg-kartu px-2 aria-[invalid=true]:border-bahaya" />
                    {galatBaris[b.tanggal] ? <p className="mt-1 font-semibold text-bahaya-teks">{galatBaris[b.tanggal]}</p> : null}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-teks-redup">{b.sumber === "MESIN" ? "Mesin finger" : b.sumber === "MANUAL" ? "Manual" : "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!final ? (
        <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-garis bg-halaman/95 py-3 backdrop-blur">
          <p className="text-teks-redup" aria-live="polite">{berubah.length > 0 ? `${berubah.length} baris diubah dan belum disimpan.` : "Tidak ada perubahan."}</p>
          <div className="flex flex-wrap gap-2">
            {idBerikutnya ? (
              <Link href={`/periode/${periodeId}/absensi/${idBerikutnya}`} className={kelasTombol("sekunder")}>
                Berikutnya yang belum lengkap: {namaBerikutnya}
              </Link>
            ) : null}
            <Tombol onClick={() => void simpan()} memuat={memproses} disabled={berubah.length === 0}>
              Simpan perubahan
            </Tombol>
          </div>
        </div>
      ) : null}
    </div>
  );
}
