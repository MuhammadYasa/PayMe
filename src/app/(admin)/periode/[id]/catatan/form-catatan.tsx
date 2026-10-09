"use client";

import { type FormEvent, useRef, useState } from "react";
import { Badge, type NadaBadge } from "@/components/ui/badge";
import { KonfirmasiDialog } from "@/components/ui/dialog";
import { Kartu } from "@/components/ui/kartu";
import { KolomInput, KolomPilih, KotakCentang } from "@/components/ui/kolom";
import { Pesan, RingkasanGalat } from "@/components/ui/pesan";
import { MemuatData } from "@/components/ui/spinner";
import { Baris, KepalaTabel, Tabel, Td, Th } from "@/components/ui/tabel";
import { Tombol } from "@/components/ui/tombol";
import { LABEL_STATUS, type StatusAbsensi } from "@/domain/absensi";
import { rentangTanggal, formatTanggal } from "@/domain/tanggal";
import { useData } from "@/hooks/use-data";
import { GalatApi, api } from "@/lib/api";
import { fokusKolomPertama } from "@/lib/fokus";
import type { KaryawanDto } from "@/server/services/karyawan";
import type { daftarCatatan } from "@/server/services/absensi";

type Catatan = Awaited<ReturnType<typeof daftarCatatan>>;

const NADA: Record<StatusAbsensi, NadaBadge> = { HADIR: "sukses", IZIN: "info", SAKIT: "peringatan", CUTI: "info", LIBUR: "netral", LAINNYA: "netral" };

interface Konflik {
  jumlah: number;
  konflik: { nama: string; tanggal: string; status: string }[];
}

function galatKonfirmasi(g: unknown): Konflik | null {
  return g instanceof GalatApi && g.kode === "KONFIRMASI_TIMPA" ? (g.data as Konflik) : null;
}

export function FormCatatan({ periodeId, awal, akhir, final }: { periodeId: string; awal: string; akhir: string; final: boolean }) {
  const catatan = useData<Catatan>(`/api/periode/${periodeId}/catatan`);
  const karyawan = useData<{ karyawan: KaryawanDto[] }>("/api/karyawan?status=aktif");
  const [kabar, setKabar] = useState<{ jenis: "sukses" | "peringatan"; teks: string[] } | null>(null);

  if (catatan.galat || karyawan.galat) {
    return (
      <Pesan jenis="galat" judul="Data belum bisa dimuat" aksi={<Tombol ukuran="kecil" varian="sekunder" onClick={() => { catatan.muatUlang(); karyawan.muatUlang(); }}>Coba lagi</Tombol>}>
        {(catatan.galat ?? karyawan.galat)?.message}
      </Pesan>
    );
  }
  if (!catatan.data || !karyawan.data) return <MemuatData />;
  const daftarKaryawan = karyawan.data.karyawan;

  function selesai(teks: string[], jenis: "sukses" | "peringatan" = "sukses") {
    setKabar({ jenis, teks });
    catatan.muatUlang();
  }

  return (
    <div className="space-y-5">
      {kabar ? (
        <Pesan jenis={kabar.jenis} judul={kabar.jenis === "sukses" ? "Tersimpan" : "Tersimpan dengan catatan"}>
          <ul className="list-disc space-y-0.5 pl-5">
            {kabar.teks.map((t, i) => <li key={i}>{t}</li>)}
          </ul>
        </Pesan>
      ) : null}

      {final ? (
        <Pesan jenis="info" judul="Periode sudah final">Catatan tidak dapat diubah lagi. Buka kembali periode bila perlu koreksi.</Pesan>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          <FormLibur periodeId={periodeId} awal={awal} akhir={akhir} karyawan={daftarKaryawan} onSelesai={selesai} />
          <FormKetidakhadiran periodeId={periodeId} awal={awal} akhir={akhir} karyawan={daftarKaryawan} onSelesai={selesai} />
        </div>
      )}

      <Kartu
        judul="Semua catatan pada periode ini"
        deskripsi={`Libur ${catatan.data.total.libur}, izin ${catatan.data.total.izin}, sakit ${catatan.data.total.sakit}, cuti ${catatan.data.total.cuti}, lainnya ${catatan.data.total.lainnya}.`}
      >
        {catatan.data.liburPerusahaan.length > 0 ? (
          <p className="mb-3">
            <span className="font-semibold">Libur perusahaan: </span>
            {catatan.data.liburPerusahaan.map((t) => formatTanggal(t)).join(", ")}
          </p>
        ) : null}
        {catatan.data.entri.length === 0 ? (
          <p className="text-teks-redup">Belum ada catatan libur, izin, sakit, atau cuti.</p>
        ) : (
          <DaftarEntri periodeId={periodeId} entri={catatan.data.entri} final={final} onHapus={() => selesai(["Catatan dihapus. Tanggalnya kembali kosong."])} />
        )}
      </Kartu>
    </div>
  );
}

function DaftarEntri({ periodeId, entri, final, onHapus }: { periodeId: string; entri: Catatan["entri"]; final: boolean; onHapus: () => void }) {
  const [galat, setGalat] = useState<string | null>(null);
  const [hapusId, setHapusId] = useState<string | null>(null);
  const batas = 300;

  async function hapus(e: Catatan["entri"][number]) {
    setHapusId(`${e.karyawanId}|${e.tanggal}`);
    setGalat(null);
    try {
      await api(`/api/periode/${periodeId}/absensi/${e.karyawanId}`, { metode: "PUT", body: { simpan: [], hapus: [e.tanggal] } });
      onHapus();
    } catch (g) {
      setGalat(g instanceof GalatApi ? g.message : "Gagal menghapus. Coba lagi.");
    } finally {
      setHapusId(null);
    }
  }

  return (
    <div className="space-y-3">
      {galat ? <Pesan jenis="galat">{galat}</Pesan> : null}
      <Tabel keterangan="Daftar catatan libur, izin, sakit, cuti, dan lainnya">
        <KepalaTabel>
          <tr>
            <Th>Tanggal</Th>
            <Th>Karyawan</Th>
            <Th>Jenis</Th>
            <Th>Keterangan</Th>
            <Th><span className="sr-only">Aksi</span></Th>
          </tr>
        </KepalaTabel>
        <tbody>
          {entri.slice(0, batas).map((e) => (
            <Baris key={`${e.karyawanId}|${e.tanggal}`}>
              <Td className="whitespace-nowrap">{formatTanggal(e.tanggal)}</Td>
              <Td className="font-semibold">{e.nama}</Td>
              <Td><Badge nada={NADA[e.status]}>{LABEL_STATUS[e.status]}</Badge></Td>
              <Td>{e.keterangan ?? "-"}</Td>
              <Td>
                {!final ? (
                  <div className="flex justify-end">
                    <Tombol varian="sekunder" ukuran="kecil" onClick={() => void hapus(e)} memuat={hapusId === `${e.karyawanId}|${e.tanggal}`}>
                      Hapus<span className="sr-only"> catatan {e.nama} {formatTanggal(e.tanggal)}</span>
                    </Tombol>
                  </div>
                ) : null}
              </Td>
            </Baris>
          ))}
        </tbody>
      </Tabel>
      {entri.length > batas ? <p className="text-teks-redup">Menampilkan {batas} dari {entri.length} catatan.</p> : null}
    </div>
  );
}

interface PropForm {
  periodeId: string;
  awal: string;
  akhir: string;
  karyawan: KaryawanDto[];
  onSelesai: (teks: string[], jenis?: "sukses" | "peringatan") => void;
}

function DialogTimpa({ konflik, buka, memproses, onYa, onBatal, judul }: { konflik: Konflik | null; buka: boolean; memproses: boolean; onYa: () => void; onBatal: () => void; judul: string }) {
  return (
    <KonfirmasiDialog
      buka={buka}
      judul={judul}
      pesan={
        <div className="space-y-3">
          <p>
            Ada <strong>{konflik?.jumlah ?? 0}</strong> tanggal yang sudah punya data lain. Bila dilanjutkan, data tersebut akan diganti.
          </p>
          <ul className="max-h-48 list-disc overflow-y-auto pl-5">
            {(konflik?.konflik ?? []).slice(0, 10).map((k, i) => (
              <li key={i}>{k.nama}, {formatTanggal(k.tanggal)} (sebelumnya {LABEL_STATUS[k.status as StatusAbsensi]?.toLowerCase() ?? k.status})</li>
            ))}
          </ul>
        </div>
      }
      labelYa="Ya, timpa"
      labelBatal="Batal"
      bahaya
      memproses={memproses}
      onYa={onYa}
      onBatal={onBatal}
    />
  );
}

function FormLibur({ periodeId, awal, akhir, karyawan, onSelesai }: PropForm) {
  const form = useRef<HTMLFormElement>(null);
  const [dari, setDari] = useState("");
  const [sampai, setSampai] = useState("");
  const [untuk, setUntuk] = useState<"semua" | "terpilih">("semua");
  const [terpilih, setTerpilih] = useState<string[]>([]);
  const [keterangan, setKeterangan] = useState("");
  const [kolom, setKolom] = useState<Record<string, string>>({});
  const [pesan, setPesan] = useState<string | null>(null);
  const [memproses, setMemproses] = useState(false);
  const [konflik, setKonflik] = useState<Konflik | null>(null);

  async function kirim(timpa: boolean) {
    const tanggalSampai = sampai || dari;
    const k: Record<string, string> = {};
    if (!dari) k.dari = "Pilih tanggal libur. Isi tanggal awal.";
    else if (tanggalSampai < dari) k.sampai = "Tanggal akhir tidak boleh sebelum tanggal awal.";
    else if (dari < awal || tanggalSampai > akhir) k.dari = `Tanggal libur harus berada di dalam periode, yaitu ${formatTanggal(awal)} sampai ${formatTanggal(akhir)}. Ubah tanggalnya, lalu coba lagi.`;
    if (untuk === "terpilih" && terpilih.length === 0) k.karyawan = "Pilih minimal satu karyawan.";
    setKolom(k);
    if (Object.keys(k).length > 0) {
      setPesan(Object.values(k)[0]);
      fokusKolomPertama(form.current, k);
      return;
    }
    setPesan(null);
    setMemproses(true);
    try {
      const hasil = await api<{ karyawan: number; tanggal: number }>(`/api/periode/${periodeId}/libur`, {
        body: { tanggal: rentangTanggal(dari, tanggalSampai), karyawanIds: untuk === "semua" ? "semua" : terpilih, keterangan: keterangan || null, timpa },
      });
      setKonflik(null);
      setDari("");
      setSampai("");
      setKeterangan("");
      onSelesai([`${hasil.tanggal} tanggal ditandai libur untuk ${hasil.karyawan} karyawan.`]);
    } catch (g) {
      const k409 = galatKonfirmasi(g);
      if (k409) setKonflik(k409);
      else {
        const galat = g instanceof GalatApi ? g : new GalatApi(0, "Gagal menyimpan. Coba lagi.");
        setPesan(galat.message);
        setKolom(galat.kolom);
      }
    } finally {
      setMemproses(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    void kirim(false);
  }

  return (
    <Kartu judul="Tandai hari libur" deskripsi="Untuk tanggal merah atau giliran libur. Hari libur mingguan tidak perlu ditandai.">
      <form ref={form} onSubmit={submit} noValidate className="space-y-4">
        <RingkasanGalat pesan={pesan} />
        <div className="grid gap-4 sm:grid-cols-2">
          <KolomInput label="Dari tanggal" name="dari" type="date" min={awal} max={akhir} value={dari} onChange={(e) => setDari(e.target.value)} galat={kolom.dari} wajib />
          <KolomInput label="Sampai tanggal" name="sampai" type="date" min={awal} max={akhir} value={sampai} onChange={(e) => setSampai(e.target.value)} galat={kolom.sampai} bantuan="Kosongkan bila hanya satu hari." />
        </div>
        <fieldset className="space-y-1">
          <legend className="font-semibold">Berlaku untuk</legend>
          <label className="flex min-h-11 items-center gap-3"><input type="radio" name="untuk" checked={untuk === "semua"} onChange={() => setUntuk("semua")} className="size-5 accent-merek" /> Semua karyawan aktif</label>
          <label className="flex min-h-11 items-center gap-3"><input type="radio" name="untuk" checked={untuk === "terpilih"} onChange={() => setUntuk("terpilih")} className="size-5 accent-merek" /> Karyawan tertentu</label>
        </fieldset>
        {untuk === "terpilih" ? (
          <div className="max-h-48 overflow-y-auto rounded-lg border border-garis p-2" data-kolom="karyawan" tabIndex={0}>
            {karyawan.map((k) => (
              <KotakCentang key={k.id} label={`${k.namaLengkap} (${k.cabang})`} checked={terpilih.includes(k.id)} onChange={(e) => setTerpilih((lama) => (e.target.checked ? [...lama, k.id] : lama.filter((id) => id !== k.id)))} />
            ))}
            {kolom.karyawan ? <p className="px-1 font-semibold text-bahaya-teks">{kolom.karyawan}</p> : null}
          </div>
        ) : null}
        <KolomInput label="Keterangan" name="keterangan" value={keterangan} onChange={(e) => setKeterangan(e.target.value)} placeholder="Mis. Libur Paskah" />
        <Tombol type="submit" memuat={memproses}>Tandai libur</Tombol>
      </form>
      <DialogTimpa konflik={konflik} buka={konflik !== null} memproses={memproses} judul="Timpa data yang sudah ada?" onYa={() => void kirim(true)} onBatal={() => setKonflik(null)} />
    </Kartu>
  );
}

function FormKetidakhadiran({ periodeId, awal, akhir, karyawan, onSelesai }: PropForm) {
  const form = useRef<HTMLFormElement>(null);
  const [isian, setIsian] = useState({ karyawanId: "", jenis: "IZIN", dari: "", sampai: "", keterangan: "" });
  const [kolom, setKolom] = useState<Record<string, string>>({});
  const [pesan, setPesan] = useState<string | null>(null);
  const [memproses, setMemproses] = useState(false);
  const [konflik, setKonflik] = useState<Konflik | null>(null);

  const ubah = (nama: keyof typeof isian) => (e: { target: { value: string } }) => setIsian((lama) => ({ ...lama, [nama]: e.target.value }));

  async function kirim(timpa: boolean) {
    const k: Record<string, string> = {};
    if (!isian.karyawanId) k.karyawanId = "Pilih karyawan.";
    if (!isian.dari) k.dari = "Isi tanggal mulai.";
    const sampai = isian.sampai || isian.dari;
    if (isian.dari && sampai < isian.dari) k.sampai = "Tanggal selesai tidak boleh sebelum tanggal mulai.";
    else if (isian.dari && (isian.dari < awal || sampai > akhir)) k.dari = `Tanggal harus berada di dalam periode, yaitu ${formatTanggal(awal)} sampai ${formatTanggal(akhir)}. Ubah tanggalnya, lalu coba lagi.`;
    if (isian.jenis === "LAINNYA" && !isian.keterangan.trim()) k.keterangan = "Jenis lainnya wajib diberi keterangan. Tulis alasannya.";
    setKolom(k);
    if (Object.keys(k).length > 0) {
      setPesan(Object.keys(k).length === 1 ? Object.values(k)[0] : `Ada ${Object.keys(k).length} isian yang belum benar. Periksa kolom yang ditandai.`);
      fokusKolomPertama(form.current, k);
      return;
    }
    setPesan(null);
    setMemproses(true);
    try {
      const hasil = await api<{ dicatat: number; peringatan: string[] }>(`/api/periode/${periodeId}/ketidakhadiran`, {
        body: { karyawanId: isian.karyawanId, jenis: isian.jenis, dari: isian.dari, sampai, keterangan: isian.keterangan || null, timpa },
      });
      setKonflik(null);
      setIsian((lama) => ({ ...lama, dari: "", sampai: "", keterangan: "" }));
      onSelesai([`${hasil.dicatat} hari dicatat.`, ...hasil.peringatan], hasil.peringatan.length > 0 ? "peringatan" : "sukses");
    } catch (g) {
      const k409 = galatKonfirmasi(g);
      if (k409) setKonflik(k409);
      else {
        const galat = g instanceof GalatApi ? g : new GalatApi(0, "Gagal menyimpan. Coba lagi.");
        setPesan(galat.message);
        setKolom(galat.kolom);
      }
    } finally {
      setMemproses(false);
    }
  }

  return (
    <Kartu judul="Catat izin, sakit, cuti, atau lainnya" deskripsi="Satu catatan bisa mencakup beberapa hari. Hari libur di dalam rentang otomatis dilewati.">
      <form
        ref={form}
        onSubmit={(e) => {
          e.preventDefault();
          void kirim(false);
        }}
        noValidate
        className="space-y-4"
      >
        <RingkasanGalat pesan={pesan} />
        <KolomPilih label="Karyawan" name="karyawanId" value={isian.karyawanId} onChange={ubah("karyawanId")} galat={kolom.karyawanId} wajib>
          <option value="">Pilih karyawan</option>
          {karyawan.map((k) => <option key={k.id} value={k.id}>{k.namaLengkap} ({k.cabang})</option>)}
        </KolomPilih>
        <KolomPilih label="Jenis" name="jenis" value={isian.jenis} onChange={ubah("jenis")} wajib>
          <option value="IZIN">Izin</option>
          <option value="SAKIT">Sakit</option>
          <option value="CUTI">Cuti</option>
          <option value="LAINNYA">Lainnya</option>
        </KolomPilih>
        <div className="grid gap-4 sm:grid-cols-2">
          <KolomInput label="Mulai tanggal" name="dari" type="date" min={awal} max={akhir} value={isian.dari} onChange={ubah("dari")} galat={kolom.dari} wajib />
          <KolomInput label="Sampai tanggal" name="sampai" type="date" min={awal} max={akhir} value={isian.sampai} onChange={ubah("sampai")} galat={kolom.sampai} bantuan="Kosongkan bila hanya satu hari." />
        </div>
        <KolomInput label="Keterangan" name="keterangan" value={isian.keterangan} onChange={ubah("keterangan")} galat={kolom.keterangan} wajib={isian.jenis === "LAINNYA"} bantuan={isian.jenis === "LAINNYA" ? "Wajib diisi untuk jenis lainnya." : "Opsional."} />
        <Tombol type="submit" memuat={memproses}>Simpan catatan</Tombol>
      </form>
      <DialogTimpa konflik={konflik} buka={konflik !== null} memproses={memproses} judul="Timpa status yang sudah ada?" onYa={() => void kirim(true)} onBatal={() => setKonflik(null)} />
    </Kartu>
  );
}
