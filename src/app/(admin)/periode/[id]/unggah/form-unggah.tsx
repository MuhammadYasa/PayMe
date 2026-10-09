"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Kartu } from "@/components/ui/kartu";
import { KolomPilih, KotakCentang } from "@/components/ui/kolom";
import { Pesan } from "@/components/ui/pesan";
import { Spinner } from "@/components/ui/spinner";
import { Baris, KepalaTabel, Tabel, Td, Th } from "@/components/ui/tabel";
import { Tombol, kelasTombol } from "@/components/ui/tombol";
import { formatTanggal } from "@/domain/tanggal";
import { GalatApi, api } from "@/lib/api";
import { periksaBerkasUnggahan } from "@/lib/berkas";
import type { BacaanBerkas } from "@/server/excel/baca-absensi";
import type { HasilImpor, RingkasanImpor } from "@/server/services/impor-absensi";

type Fase = "pilih" | "atur" | "periksa" | "selesai";

interface IsianPemetaan {
  nama: string;
  tanggal: string;
  jamMasuk: string;
  jamPulang: string;
}

const KOSONG: IsianPemetaan = { nama: "", tanggal: "", jamMasuk: "", jamPulang: "" };

const angka = (nilai: number) => nilai.toLocaleString("id-ID");

function Statistik({ label, nilai, catatan }: { label: string; nilai: string; catatan?: string }) {
  return (
    <div className="rounded-lg border border-garis bg-kartu px-4 py-3">
      <p className="text-sm text-teks-redup">{label}</p>
      <p className="text-2xl font-extrabold tabular-nums">{nilai}</p>
      {catatan ? <p className="text-sm text-teks-redup">{catatan}</p> : null}
    </div>
  );
}

export function FormUnggah({ periodeId }: { periodeId: string }) {
  const inputBerkas = useRef<HTMLInputElement>(null);
  const [fase, setFase] = useState<Fase>("pilih");
  const [berkas, setBerkas] = useState<File | null>(null);
  const [bacaan, setBacaan] = useState<BacaanBerkas | null>(null);
  const [sheetTerpilih, setSheetTerpilih] = useState<string[]>([]);
  const [pemetaan, setPemetaan] = useState<IsianPemetaan>(KOSONG);
  const [ringkasan, setRingkasan] = useState<RingkasanImpor | null>(null);
  const [petaNama, setPetaNama] = useState<Record<string, string>>({});
  const [timpaManual, setTimpaManual] = useState(false);
  const [hasil, setHasil] = useState<HasilImpor | null>(null);
  const [galat, setGalat] = useState<GalatApi | null>(null);
  const [sibuk, setSibuk] = useState<string | null>(null);

  function ulangi() {
    setFase("pilih");
    setBerkas(null);
    setBacaan(null);
    setRingkasan(null);
    setPetaNama({});
    setTimpaManual(false);
    setHasil(null);
    setGalat(null);
    if (inputBerkas.current) inputBerkas.current.value = "";
  }

  async function kirim<T>(file: File, tahap: "baca" | "analisis" | "impor", konfigurasi?: unknown): Promise<T> {
    const form = new FormData();
    form.set("file", file);
    form.set("tahap", tahap);
    if (konfigurasi) form.set("konfigurasi", JSON.stringify(konfigurasi));
    return api<T>(`/api/periode/${periodeId}/absensi/impor`, { formData: form });
  }

  function bangunKonfigurasi(peta: Record<string, string>, timpa: boolean, sheet = sheetTerpilih, pm = pemetaan) {
    const kolom = (nilai: string) => (nilai ? Number(nilai) : null);
    return {
      sheet,
      pemetaan: { nama: kolom(pm.nama), tanggal: kolom(pm.tanggal), jamMasuk: kolom(pm.jamMasuk), jamPulang: kolom(pm.jamPulang) },
      petaNama: Object.fromEntries(Object.entries(peta).filter(([, nilai]) => nilai !== "")),
      timpaManual: timpa,
    };
  }

  async function pilihBerkas(file: File | undefined) {
    setGalat(null);
    if (!file) return;
    const pesan = periksaBerkasUnggahan(file.name, file.size);
    if (pesan) {
      setGalat(new GalatApi(422, pesan, { file: pesan }, "FORMAT_TIDAK_DIDUKUNG"));
      if (inputBerkas.current) inputBerkas.current.value = "";
      return;
    }
    setBerkas(file);
    setSibuk("Membaca file...");
    try {
      const info = await kirim<BacaanBerkas>(file, "baca");
      setBacaan(info);
      setSheetTerpilih(info.disarankan);
      const acuan = info.sheet.find((s) => s.nama === info.disarankan[0]) ?? info.sheet.find((s) => s.tebakan) ?? null;
      const tebakan = acuan?.tebakan;
      setPemetaan(
        tebakan
          ? { nama: String(tebakan.nama), tanggal: String(tebakan.tanggal), jamMasuk: tebakan.jamMasuk ? String(tebakan.jamMasuk) : "", jamPulang: tebakan.jamPulang ? String(tebakan.jamPulang) : "" }
          : KOSONG,
      );
      setFase("atur");
    } catch (g) {
      setGalat(g instanceof GalatApi ? g : new GalatApi(0, "File tidak dapat dibaca. Coba lagi."));
      setBerkas(null);
      if (inputBerkas.current) inputBerkas.current.value = "";
    } finally {
      setSibuk(null);
    }
  }

  async function periksa(peta = petaNama, timpa = timpaManual) {
    if (!berkas) return;
    setGalat(null);
    setSibuk("Memeriksa isi file...");
    try {
      setRingkasan(await kirim<RingkasanImpor>(berkas, "analisis", bangunKonfigurasi(peta, timpa)));
      setFase("periksa");
    } catch (g) {
      setGalat(g instanceof GalatApi ? g : new GalatApi(0, "File tidak dapat diperiksa. Coba lagi."));
    } finally {
      setSibuk(null);
    }
  }

  async function impor() {
    if (!berkas) return;
    setGalat(null);
    setSibuk("Menyimpan data absensi...");
    try {
      setHasil(await kirim<HasilImpor>(berkas, "impor", bangunKonfigurasi(petaNama, timpaManual)));
      setFase("selesai");
    } catch (g) {
      setGalat(g instanceof GalatApi ? g : new GalatApi(0, "Data tidak dapat disimpan. Coba lagi."));
    } finally {
      setSibuk(null);
    }
  }

  function ubahPetaNama(kunci: string, nilai: string) {
    const baru = { ...petaNama, [kunci]: nilai };
    setPetaNama(baru);
    void periksa(baru, timpaManual);
  }

  const sheetAcuan = bacaan?.sheet.find((s) => s.nama === sheetTerpilih[0]);
  const opsiKolom = (sheetAcuan?.header ?? []).map((h, i) => ({ nilai: String(i + 1), label: `Kolom ${i + 1}: ${h || "(kosong)"}` }));

  return (
    <div className="space-y-5">
      {galat ? (
        <Pesan jenis="galat" judul="File belum bisa dipakai">
          {galat.message}
        </Pesan>
      ) : null}

      {sibuk ? (
        <div role="status" className="flex items-center gap-3 rounded-lg bg-info-latar px-4 py-3 font-semibold text-info-teks">
          <Spinner />
          {sibuk}
        </div>
      ) : null}

      {fase === "pilih" || fase === "atur" ? (
        <Kartu judul="1. Pilih file Excel" deskripsi="Gunakan file .xlsx hasil mesin finger, ukuran paling besar 5 MB.">
          <div className="space-y-2">
            <p className="font-semibold">File absensi</p>
            <div className="flex flex-wrap items-center gap-3">
              {/* Input asli disembunyikan karena teks tombolnya mengikuti bahasa browser; labelnya menjadi tombol berbahasa Indonesia. */}
              <input
                id="berkas-absensi"
                ref={inputBerkas}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(e) => void pilihBerkas(e.target.files?.[0])}
                disabled={sibuk !== null}
                className="peer sr-only"
              />
              <label
                htmlFor="berkas-absensi"
                className={`${kelasTombol("utama")} cursor-pointer peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-2 peer-focus-visible:outline-fokus peer-disabled:cursor-not-allowed peer-disabled:opacity-60`}
              >
                {berkas ? "Ganti file" : "Pilih file Excel"}
              </label>
              <span className="text-teks-redup">{berkas ? berkas.name : "Belum ada file dipilih"}</span>
            </div>
          </div>
        </Kartu>
      ) : null}

      {fase === "atur" && bacaan ? (
        <>
          <Kartu judul="2. Pilih sheet" deskripsi="Pilih sheet yang akan dibaca. Sheet gabungan seperti All Depo berisi semua cabang, jadi pilih salah satu saja agar data tidak ganda.">
            <fieldset>
              <legend className="sr-only">Sheet yang dibaca</legend>
              <div className="grid gap-x-6 sm:grid-cols-2">
                {bacaan.sheet.map((s) => (
                  <KotakCentang
                    key={s.nama}
                    label={
                      <span>
                        {s.nama} <span className="text-teks-redup">({angka(s.jumlahBaris)} baris{s.tebakan ? "" : ", kolom tidak dikenali"})</span>
                      </span>
                    }
                    checked={sheetTerpilih.includes(s.nama)}
                    onChange={(e) => setSheetTerpilih((lama) => (e.target.checked ? [...lama, s.nama] : lama.filter((n) => n !== s.nama)))}
                  />
                ))}
              </div>
            </fieldset>
            {bacaan.disarankan.length === 1 && bacaan.sheet.length > 2 ? (
              <p className="mt-2 text-teks-redup">
                Disarankan memakai sheet {bacaan.disarankan[0]} karena sudah memuat gabungan seluruh cabang.
              </p>
            ) : null}
          </Kartu>

          <Kartu judul="3. Cocokkan kolom" deskripsi="Sistem sudah menebak kolom dari judulnya. Periksa kembali dan ubah bila ada yang keliru.">
            {opsiKolom.length === 0 ? (
              <Pesan jenis="peringatan" judul="Judul kolom tidak ditemukan">
                Sheet pertama yang dipilih tidak memiliki baris judul yang dikenali. Pilih sheet lain atau periksa file Anda.
              </Pesan>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <KolomPilih label="Kolom nama karyawan" name="nama" value={pemetaan.nama} onChange={(e) => setPemetaan({ ...pemetaan, nama: e.target.value })} wajib>
                  <option value="">Pilih kolom</option>
                  {opsiKolom.map((o) => <option key={o.nilai} value={o.nilai}>{o.label}</option>)}
                </KolomPilih>
                <KolomPilih label="Kolom tanggal" name="tanggal" value={pemetaan.tanggal} onChange={(e) => setPemetaan({ ...pemetaan, tanggal: e.target.value })} wajib>
                  <option value="">Pilih kolom</option>
                  {opsiKolom.map((o) => <option key={o.nilai} value={o.nilai}>{o.label}</option>)}
                </KolomPilih>
                <KolomPilih
                  label="Kolom jam masuk"
                  name="jamMasuk"
                  value={pemetaan.jamMasuk}
                  onChange={(e) => setPemetaan({ ...pemetaan, jamMasuk: e.target.value })}
                  bantuan="Pilih kolom scan sebenarnya, bukan jadwal jam kerja."
                >
                  <option value="">(tidak dipakai)</option>
                  {opsiKolom.map((o) => <option key={o.nilai} value={o.nilai}>{o.label}</option>)}
                </KolomPilih>
                <KolomPilih label="Kolom jam pulang" name="jamPulang" value={pemetaan.jamPulang} onChange={(e) => setPemetaan({ ...pemetaan, jamPulang: e.target.value })}>
                  <option value="">(tidak dipakai)</option>
                  {opsiKolom.map((o) => <option key={o.nilai} value={o.nilai}>{o.label}</option>)}
                </KolomPilih>
              </div>
            )}

            {sheetAcuan && sheetAcuan.contoh.length > 0 ? (
              <div className="mt-5">
                <p className="mb-2 font-semibold">Contoh isi file</p>
                <Tabel keterangan="Lima baris pertama dari sheet yang dipilih">
                  <KepalaTabel>
                    <tr>{sheetAcuan.header.map((h, i) => <Th key={i}>{h || `Kolom ${i + 1}`}</Th>)}</tr>
                  </KepalaTabel>
                  <tbody>
                    {sheetAcuan.contoh.map((baris, i) => (
                      <Baris key={i}>{baris.map((sel, j) => <Td key={j} className="whitespace-nowrap">{sel}</Td>)}</Baris>
                    ))}
                  </tbody>
                </Tabel>
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-2">
              <Tombol onClick={() => void periksa()} disabled={sibuk !== null || sheetTerpilih.length === 0 || !pemetaan.nama || !pemetaan.tanggal}>
                Periksa file
              </Tombol>
              <Tombol varian="sekunder" onClick={ulangi} disabled={sibuk !== null}>
                Pilih file lain
              </Tombol>
            </div>
            {sheetTerpilih.length === 0 ? <p className="mt-2 font-semibold text-bahaya-teks">Pilih minimal satu sheet yang akan dibaca.</p> : null}
          </Kartu>
        </>
      ) : null}

      {fase === "periksa" && ringkasan ? (
        <>
          <Kartu judul="Hasil pemeriksaan file" deskripsi="Periksa ringkasan berikut sebelum data disimpan. Belum ada yang tersimpan sampai Anda menekan Lanjutkan.">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Statistik label="Baris terbaca" nilai={angka(ringkasan.barisTerbaca)} catatan={`dari ${angka(ringkasan.totalBaris)} baris`} />
              <Statistik label="Karyawan cocok" nilai={angka(ringkasan.karyawanCocok)} />
              <Statistik label="Akan diimpor" nilai={angka(ringkasan.akanDiimpor)} catatan="catatan hadir" />
              <Statistik label="Tanpa scan" nilai={angka(ringkasan.tanpaScan)} catatan="diisi HRD di langkah berikutnya" />
            </div>
            {ringkasan.diLuarPeriode > 0 || ringkasan.duplikat > 0 ? (
              <ul className="mt-4 list-disc space-y-1 pl-5 text-teks-redup">
                {ringkasan.diLuarPeriode > 0 ? <li>{angka(ringkasan.diLuarPeriode)} baris berada di luar periode dan diabaikan.</li> : null}
                {ringkasan.duplikat > 0 ? <li>{angka(ringkasan.duplikat)} baris ganda digabung menjadi satu.</li> : null}
              </ul>
            ) : null}
          </Kartu>

          {ringkasan.jumlahTidakValid > 0 ? (
            <Kartu
              judul={`${angka(ringkasan.jumlahTidakValid)} baris bermasalah`}
              deskripsi="Baris ini dilewati. Baris lain yang benar tetap diimpor. Perbaiki di Excel lalu unggah ulang bila perlu."
            >
              <ul className="max-h-64 space-y-1 overflow-y-auto font-medium">
                {ringkasan.tidakValid.map((b, i) => (
                  <li key={i}>
                    {b.pesan}
                    {bacaan && bacaan.sheet.length > 2 ? <span className="text-teks-redup"> (sheet {b.sheet})</span> : null}
                  </li>
                ))}
              </ul>
              {ringkasan.jumlahTidakValid > ringkasan.tidakValid.length ? (
                <p className="mt-2 text-teks-redup">Dan {angka(ringkasan.jumlahTidakValid - ringkasan.tidakValid.length)} baris lainnya.</p>
              ) : null}
            </Kartu>
          ) : null}

          {ringkasan.namaTakDikenal.length > 0 ? (
            <Kartu
              judul={`${ringkasan.namaTakDikenal.length} nama tidak dikenal`}
              deskripsi="Nama berikut ada di file tetapi tidak cocok dengan satu pun karyawan aktif. Cocokkan dengan karyawan yang benar, atau abaikan. Pilihan Anda diingat untuk bulan berikutnya."
            >
              <Tabel keterangan="Nama dari file yang belum cocok dengan karyawan">
                <KepalaTabel>
                  <tr>
                    <Th>Nama di file</Th>
                    <Th className="text-right">Baris</Th>
                    <Th>Cocokkan dengan</Th>
                  </tr>
                </KepalaTabel>
                <tbody>
                  {ringkasan.namaTakDikenal.map((n) => (
                    <Baris key={n.kunci}>
                      <Td className="font-semibold">
                        {n.nama}
                        {n.ambigu ? <span className="block font-normal text-peringatan-teks">Lebih dari satu karyawan bernama sama. Pilih yang benar.</span> : null}
                      </Td>
                      <Td className="text-right tabular-nums">{n.jumlahBaris}</Td>
                      <Td>
                        <label className="sr-only" htmlFor={`peta-${n.kunci}`}>
                          Cocokkan {n.nama} dengan
                        </label>
                        <select
                          id={`peta-${n.kunci}`}
                          value={petaNama[n.kunci] ?? ""}
                          onChange={(e) => ubahPetaNama(n.kunci, e.target.value)}
                          disabled={sibuk !== null}
                          className="min-h-11 w-full min-w-56 rounded-lg border border-garis-tebal bg-kartu px-3"
                        >
                          <option value="">Pilih karyawan...</option>
                          <option value="abaikan">Abaikan nama ini</option>
                          {ringkasan.kandidatKaryawan.map((k) => (
                            <option key={k.id} value={k.id}>
                              {k.nama} ({k.cabang})
                            </option>
                          ))}
                        </select>
                      </Td>
                    </Baris>
                  ))}
                </tbody>
              </Tabel>
            </Kartu>
          ) : null}

          {ringkasan.bentrokManual > 0 ? (
            <Pesan jenis="peringatan" judul={`${angka(ringkasan.bentrokManual)} tanggal sudah Anda isi manual`}>
              <p>
                Tanggal ini punya isian manual dari Anda, misalnya{" "}
                {ringkasan.contohBentrokManual.slice(0, 3).map((c) => `${c.nama} (${formatTanggal(c.tanggal)})`).join(", ")}. Isian manual tidak
                akan ditimpa kecuali Anda mengizinkannya.
              </p>
              <div className="mt-2">
                <KotakCentang
                  label="Timpa isian manual dengan data mesin finger"
                  checked={timpaManual}
                  onChange={(e) => {
                    setTimpaManual(e.target.checked);
                    void periksa(petaNama, e.target.checked);
                  }}
                />
              </div>
            </Pesan>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Tombol onClick={() => void impor()} memuat={sibuk === "Menyimpan data absensi..."} disabled={sibuk !== null || ringkasan.akanDiimpor === 0}>
              Lanjutkan: simpan {angka(ringkasan.akanDiimpor)} catatan
            </Tombol>
            <Tombol varian="sekunder" onClick={() => setFase("atur")} disabled={sibuk !== null}>
              Ubah pengaturan baca
            </Tombol>
            <Tombol varian="sekunder" onClick={ulangi} disabled={sibuk !== null}>
              Pilih file lain
            </Tombol>
          </div>
          {ringkasan.akanDiimpor === 0 ? (
            <Pesan jenis="peringatan" judul="Belum ada data yang bisa diimpor">
              Tidak ada baris yang cocok dengan karyawan aktif. Cocokkan nama di atas, atau pastikan karyawan sudah ditambahkan.
            </Pesan>
          ) : null}
        </>
      ) : null}

      {fase === "selesai" && hasil ? (
        <Kartu>
          <Pesan jenis="sukses" judul="Absensi berhasil disimpan">
            {angka(hasil.dibuat)} catatan hadir disimpan
            {hasil.diganti > 0 ? `, menggantikan ${angka(hasil.diganti)} catatan unggahan sebelumnya` : ""}
            {hasil.dilewatiKarenaManual > 0 ? `. ${angka(hasil.dilewatiKarenaManual)} tanggal dilewati karena sudah Anda isi manual` : ""}
            {hasil.alias > 0 ? `. ${angka(hasil.alias)} pemetaan nama disimpan untuk bulan depan` : ""}.
          </Pesan>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={`/periode/${periodeId}/absensi`} className={kelasTombol("utama")}>
              Lanjut: Lengkapi Absensi
            </Link>
            <Tombol varian="sekunder" onClick={ulangi}>
              Unggah file lain
            </Tombol>
          </div>
        </Kartu>
      ) : null}
    </div>
  );
}
