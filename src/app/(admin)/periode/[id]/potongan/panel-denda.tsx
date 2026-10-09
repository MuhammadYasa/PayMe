"use client";

import { type FormEvent, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { KonfirmasiDialog } from "@/components/ui/dialog";
import { Kartu } from "@/components/ui/kartu";
import { KolomInput, KolomNominal, KolomPilih } from "@/components/ui/kolom";
import { Pesan, RingkasanGalat } from "@/components/ui/pesan";
import { MemuatData } from "@/components/ui/spinner";
import { Baris, KepalaTabel, Tabel, Td, TdAngka, Th } from "@/components/ui/tabel";
import { Tombol } from "@/components/ui/tombol";
import { MAKS_CICILAN } from "@/domain/batas";
import { jadwalCicilan, ringkasJadwal } from "@/domain/cicilan";
import { formatTanggal } from "@/domain/tanggal";
import { formatRupiah } from "@/domain/uang";
import { useData } from "@/hooks/use-data";
import { GalatApi, api } from "@/lib/api";
import { fokusKolomPertama } from "@/lib/fokus";
import { ringkasGalatZod } from "@/lib/zod-galat";
import { dendaSkema } from "@/skema/penghasilan";
import type { DendaDto, daftarDenda } from "@/server/services/denda";
import type { KaryawanDto } from "@/server/services/karyawan";

type DataDenda = Awaited<ReturnType<typeof daftarDenda>>;
type MulaiDenda = "periode_ini" | "periode_berikutnya";

interface Isian {
  karyawanId: string;
  alasan: string;
  total: number | null;
  jumlahCicilan: string;
  mulai: MulaiDenda;
}

const isianKosong = (final: boolean): Isian => ({ karyawanId: "", alasan: "", total: null, jumlahCicilan: "1", mulai: final ? "periode_berikutnya" : "periode_ini" });

export function PanelDenda({ periodeId, final }: { periodeId: string; final: boolean }) {
  const denda = useData<DataDenda>(`/api/periode/${periodeId}/denda`);
  const karyawan = useData<{ karyawan: KaryawanDto[] }>("/api/karyawan?status=aktif");

  const form = useRef<HTMLFormElement>(null);
  const [isian, setIsian] = useState<Isian>(() => isianKosong(final));
  const [kolom, setKolom] = useState<Record<string, string>>({});
  const [pesan, setPesan] = useState<string | null>(null);
  const [kabar, setKabar] = useState<string | null>(null);
  const [memproses, setMemproses] = useState(false);
  const [hapus, setHapus] = useState<DendaDto | null>(null);
  const [menghapus, setMenghapus] = useState(false);
  const [galatHapus, setGalatHapus] = useState<string | null>(null);

  const galat = denda.galat ?? karyawan.galat;
  if (galat) {
    return (
      <Pesan
        jenis="galat"
        judul="Data denda belum bisa dimuat"
        aksi={
          <Tombol
            ukuran="kecil"
            varian="sekunder"
            onClick={() => {
              denda.muatUlang();
              karyawan.muatUlang();
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
  if (!denda.data || !karyawan.data) return <MemuatData />;

  const daftarKaryawan = karyawan.data.karyawan;
  const namaKaryawan = new Map(denda.data.denda.map((d) => [d.karyawanId, d.nama]));
  const jumlah = Number(isian.jumlahCicilan);
  const jadwal = (() => {
    if (isian.total === null || isian.jumlahCicilan === "" || !Number.isInteger(jumlah)) return null;
    try {
      return jadwalCicilan(isian.total, jumlah);
    } catch {
      return null;
    }
  })();

  const ubah = (nama: keyof Isian) => (e: { target: { value: string } }) => setIsian((lama) => ({ ...lama, [nama]: e.target.value }));

  async function simpan(e: FormEvent) {
    e.preventDefault();
    setKabar(null);
    const cek = dendaSkema.safeParse({
      karyawanId: isian.karyawanId,
      alasan: isian.alasan,
      total: isian.total ?? undefined,
      jumlahCicilan: isian.jumlahCicilan === "" ? undefined : Number(isian.jumlahCicilan),
      mulai: isian.mulai,
    });
    if (!cek.success) {
      const hasil = ringkasGalatZod(cek.error);
      setKolom(hasil.kolom);
      setPesan(Object.keys(hasil.kolom).length > 1 ? hasil.pesan : null);
      fokusKolomPertama(form.current, hasil.kolom);
      return;
    }

    setKolom({});
    setPesan(null);
    setMemproses(true);
    try {
      const dibuat = await api<DendaDto>(`/api/periode/${periodeId}/denda`, { body: cek.data });
      setIsian(isianKosong(final));
      setKabar(`Denda ${dibuat.nama} sebesar ${formatRupiah(dibuat.total)} dicatat. Jadwal potongan: ${ringkasJadwal(dibuat.jadwal)}.`);
      denda.muatUlang();
    } catch (g) {
      const galatApi = g instanceof GalatApi ? g : new GalatApi(0, "Gagal menyimpan denda. Coba lagi.");
      setPesan(galatApi.message);
      setKolom(galatApi.kolom);
      fokusKolomPertama(form.current, galatApi.kolom);
    } finally {
      setMemproses(false);
    }
  }

  async function hapusDenda() {
    if (!hapus) return;
    setMenghapus(true);
    setGalatHapus(null);
    try {
      await api(`/api/denda/${hapus.id}`, { metode: "DELETE" });
      setKabar(`Denda ${hapus.nama} dihapus.`);
      denda.muatUlang();
    } catch (g) {
      setGalatHapus(g instanceof GalatApi ? g.message : "Denda belum bisa dihapus. Coba lagi.");
    } finally {
      setMenghapus(false);
      setHapus(null);
    }
  }

  return (
    <div className="space-y-5">
      <Kartu judul="Catat denda baru" deskripsi="Denda besar boleh dicicil. Cicilan dipotong otomatis dari gaji setiap periode sampai lunas.">
        <form ref={form} onSubmit={(e) => void simpan(e)} noValidate className="space-y-4">
          <RingkasanGalat pesan={pesan} />
          {kabar ? (
            <Pesan jenis="sukses" judul="Berhasil">
              {kabar}
            </Pesan>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            <KolomPilih label="Karyawan" name="karyawanId" value={isian.karyawanId} onChange={ubah("karyawanId")} galat={kolom.karyawanId} wajib>
              <option value="">Pilih karyawan</option>
              {daftarKaryawan.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.namaLengkap} ({k.cabang})
                </option>
              ))}
            </KolomPilih>
            <KolomInput label="Alasan denda" name="alasan" value={isian.alasan} onChange={ubah("alasan")} galat={kolom.alasan} maxLength={255} placeholder="Mis. Kerusakan barang" wajib />
            <KolomNominal
              label="Total denda"
              name="total"
              nilai={isian.total}
              onUbah={(v) => setIsian((l) => ({ ...l, total: v }))}
              galat={kolom.total}
              wajib
            />
            <KolomInput
              label="Jumlah cicilan"
              name="jumlahCicilan"
              type="number"
              inputMode="numeric"
              min={1}
              max={MAKS_CICILAN}
              value={isian.jumlahCicilan}
              onChange={ubah("jumlahCicilan")}
              galat={kolom.jumlahCicilan}
              bantuan="Isi 1 bila dipotong sekaligus."
              wajib
            />
          </div>

          <fieldset className="space-y-1" data-kolom="mulai">
            <legend className="font-semibold">Mulai dipotong</legend>
            <label className="flex min-h-11 items-center gap-3">
              <input
                type="radio"
                name="mulai"
                checked={isian.mulai === "periode_ini"}
                disabled={final}
                onChange={() => setIsian((l) => ({ ...l, mulai: "periode_ini" }))}
                className="size-5 accent-merek"
              />
              Periode ini
            </label>
            <label className="flex min-h-11 items-center gap-3">
              <input
                type="radio"
                name="mulai"
                checked={isian.mulai === "periode_berikutnya"}
                onChange={() => setIsian((l) => ({ ...l, mulai: "periode_berikutnya" }))}
                className="size-5 accent-merek"
              />
              Periode berikutnya
            </label>
            {final ? <p className="text-sm text-teks-redup">Periode ini sudah final, jadi denda baru hanya bisa mulai dipotong pada periode berikutnya.</p> : null}
            {kolom.mulai ? <p className="text-sm font-semibold text-bahaya-teks">{kolom.mulai}</p> : null}
          </fieldset>

          {jadwal ? (
            <p className="rounded-lg bg-merek-lembut px-3 py-2">
              Jadwal potongan: <strong>{ringkasJadwal(jadwal)}</strong>, satu cicilan pada setiap periode gaji.
            </p>
          ) : null}

          <Tombol type="submit" memuat={memproses}>
            Simpan denda
          </Tombol>
        </form>
      </Kartu>

      <Kartu
        judul="Cicilan yang dipotong pada periode ini"
        deskripsi="Dihitung otomatis dari denda yang sedang berjalan. Sisa denda baru berkurang saat periode disimpan."
      >
        {denda.data.cicilanPeriodeIni.length === 0 ? (
          <p className="text-teks-redup">Tidak ada cicilan denda yang jatuh pada periode ini.</p>
        ) : (
          <Tabel keterangan="Cicilan denda yang dipotong pada periode ini">
            <KepalaTabel>
              <tr>
                <Th>Karyawan</Th>
                <Th>Alasan</Th>
                <Th>Cicilan</Th>
                <Th className="text-right">Dipotong</Th>
              </tr>
            </KepalaTabel>
            <tbody>
              {denda.data.cicilanPeriodeIni.map((c) => (
                <Baris key={c.dendaId}>
                  <Td className="font-semibold">{namaKaryawan.get(c.karyawanId) ?? "-"}</Td>
                  <Td>{c.alasan}</Td>
                  <Td>
                    Ke-{c.cicilanKe} dari {c.dariCicilan}
                  </Td>
                  <TdAngka>{formatRupiah(c.nominal)}</TdAngka>
                </Baris>
              ))}
            </tbody>
          </Tabel>
        )}
      </Kartu>

      <Kartu judul="Semua denda" deskripsi="Denda yang belum pernah dipotong boleh dihapus. Yang sudah dipotong tetap tercatat agar riwayat gaji benar.">
        {galatHapus ? (
          <div className="mb-3">
            <Pesan jenis="galat" judul="Denda belum bisa dihapus">
              {galatHapus}
            </Pesan>
          </div>
        ) : null}
        {denda.data.denda.length === 0 ? (
          <p className="text-teks-redup">Belum ada denda yang dicatat.</p>
        ) : (
          <Tabel keterangan="Daftar denda karyawan beserta status cicilannya">
            <KepalaTabel>
              <tr>
                <Th>Karyawan</Th>
                <Th>Alasan</Th>
                <Th className="text-right">Total</Th>
                <Th>Jadwal cicilan</Th>
                <Th>Mulai</Th>
                <Th className="text-right">Sisa</Th>
                <Th>Status</Th>
                <Th>
                  <span className="sr-only">Aksi</span>
                </Th>
              </tr>
            </KepalaTabel>
            <tbody>
              {denda.data.denda.map((d) => (
                <Baris key={d.id}>
                  <Td className="font-semibold">{d.nama}</Td>
                  <Td>{d.alasan}</Td>
                  <TdAngka>{formatRupiah(d.total)}</TdAngka>
                  <Td>
                    {ringkasJadwal(d.jadwal)}
                    <span className="block text-teks-redup">
                      {d.terbayar} dari {d.jumlahCicilan} cicilan sudah dipotong
                    </span>
                  </Td>
                  <Td className="whitespace-nowrap">{formatTanggal(d.tanggalMulai)}</Td>
                  <TdAngka>{formatRupiah(d.sisa)}</TdAngka>
                  <Td>
                    <Badge nada={d.status === "lunas" ? "sukses" : "info"}>{d.status === "lunas" ? "Lunas" : "Berjalan"}</Badge>
                  </Td>
                  <Td>
                    {d.terbayar === 0 ? (
                      <div className="flex justify-end">
                        <Tombol varian="sekunder" ukuran="kecil" onClick={() => setHapus(d)}>
                          Hapus
                          <span className="sr-only">
                            {" "}
                            denda {d.nama}, {d.alasan}
                          </span>
                        </Tombol>
                      </div>
                    ) : null}
                  </Td>
                </Baris>
              ))}
            </tbody>
          </Tabel>
        )}
      </Kartu>

      <KonfirmasiDialog
        buka={hapus !== null}
        judul="Hapus denda ini?"
        pesan={
          hapus ? (
            <p>
              Denda {hapus.nama} sebesar {formatRupiah(hapus.total)} ({hapus.alasan}) belum pernah dipotong. Setelah dihapus, denda ini tidak akan ikut dihitung dan tidak bisa dikembalikan.
            </p>
          ) : null
        }
        labelYa="Ya, hapus denda"
        bahaya
        memproses={menghapus}
        onYa={() => void hapusDenda()}
        onBatal={() => setHapus(null)}
      />
    </div>
  );
}
