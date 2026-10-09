"use client";

import { type FormEvent, useId, useRef, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { KolomInput, KolomNominal, KotakCentang } from "@/components/ui/kolom";
import { Pesan, RingkasanGalat } from "@/components/ui/pesan";
import { Tombol } from "@/components/ui/tombol";
import { drafLokal } from "@/hooks/use-draf-lokal";
import { GalatApi, api } from "@/lib/api";
import { fokusKolomPertama } from "@/lib/fokus";
import { ringkasGalatZod } from "@/lib/zod-galat";
import { karyawanSkema } from "@/skema/karyawan";
import type { KaryawanDto } from "@/server/services/karyawan";

interface Isian {
  namaLengkap: string;
  jabatan: string;
  cabang: string;
  gajiPokok: number | null;
  tunjangan: number | null;
  nomorRekening: string;
  statusAktif: boolean;
}

const KOSONG: Isian = { namaLengkap: "", jabatan: "", cabang: "", gajiPokok: null, tunjangan: null, nomorRekening: "", statusAktif: true };

interface Prop {
  buka: boolean;
  karyawan: KaryawanDto | null;
  daftarCabang: string[];
  onTutup: () => void;
  onTersimpan: (pesan: string) => void;
}

export function FormKaryawan({ buka, karyawan, daftarCabang, onTutup, onTersimpan }: Prop) {
  return (
    <Dialog buka={buka} onTutup={onTutup} judul={karyawan ? "Ubah karyawan" : "Tambah karyawan"} lebar="max-w-2xl">
      <IsiForm karyawan={karyawan} daftarCabang={daftarCabang} onTutup={onTutup} onTersimpan={onTersimpan} />
    </Dialog>
  );
}

function IsiForm({ karyawan, daftarCabang, onTutup, onTersimpan }: Omit<Prop, "buka">) {
  const form = useRef<HTMLFormElement>(null);
  const idDaftarCabang = useId();
  const draf = drafLokal<Isian>("karyawan-baru");

  const [dipulihkan] = useState(() => (karyawan ? null : draf.baca()));
  const [isian, setIsian] = useState<Isian>(() =>
    karyawan
      ? {
          namaLengkap: karyawan.namaLengkap,
          jabatan: karyawan.jabatan,
          cabang: karyawan.cabang,
          gajiPokok: karyawan.gajiPokok,
          tunjangan: karyawan.tunjangan,
          nomorRekening: karyawan.nomorRekening,
          statusAktif: karyawan.statusAktif,
        }
      : (dipulihkan ?? KOSONG),
  );
  const [kolom, setKolom] = useState<Record<string, string>>({});
  const [pesan, setPesan] = useState<string | null>(null);
  const [memproses, setMemproses] = useState(false);

  function ubah<K extends keyof Isian>(nama: K, nilai: Isian[K]) {
    setIsian((lama) => {
      const baru = { ...lama, [nama]: nilai };
      if (!karyawan) draf.simpan(baru);
      return baru;
    });
  }

  async function kirim(e: FormEvent) {
    e.preventDefault();
    setPesan(null);

    const cek = karyawanSkema.safeParse({
      ...isian,
      gajiPokok: isian.gajiPokok ?? undefined,
      tunjangan: isian.tunjangan ?? 0,
    });
    if (!cek.success) {
      const hasil = ringkasGalatZod(cek.error);
      setKolom(hasil.kolom);
      setPesan(hasil.pesan);
      fokusKolomPertama(form.current, hasil.kolom);
      return;
    }

    setKolom({});
    setMemproses(true);
    try {
      await api(karyawan ? `/api/karyawan/${karyawan.id}` : "/api/karyawan", {
        metode: karyawan ? "PUT" : "POST",
        body: cek.data,
      });
      if (!karyawan) draf.hapus();
      onTersimpan(karyawan ? `Data ${cek.data.namaLengkap} sudah diperbarui.` : `${cek.data.namaLengkap} sudah ditambahkan.`);
    } catch (g) {
      const galat = g instanceof GalatApi ? g : new GalatApi(0, "Terjadi kesalahan. Coba lagi.");
      setPesan(galat.message);
      setKolom(galat.kolom);
      fokusKolomPertama(form.current, galat.kolom);
      setMemproses(false);
    }
  }

  return (
    <form ref={form} onSubmit={kirim} noValidate className="space-y-4">
      {dipulihkan ? (
        <Pesan jenis="info" judul="Isian sebelumnya dipulihkan">
          Isian yang belum sempat disimpan tadi sudah dimuat kembali.
        </Pesan>
      ) : null}
      <RingkasanGalat pesan={pesan} kolom={Object.keys(kolom).length > 1 ? kolom : undefined} />

      <div className="grid gap-4 sm:grid-cols-2">
        <KolomInput
          label="Nama lengkap"
          name="namaLengkap"
          className="sm:col-span-2"
          value={isian.namaLengkap}
          onChange={(e) => ubah("namaLengkap", e.target.value)}
          galat={kolom.namaLengkap}
          bantuan="Tulis sesuai KTP. Nama inilah yang dicocokkan dengan file mesin finger dan halaman karyawan."
          autoFocus
          wajib
        />
        <KolomInput
          label="Jabatan"
          name="jabatan"
          value={isian.jabatan}
          onChange={(e) => ubah("jabatan", e.target.value)}
          galat={kolom.jabatan}
          wajib
        />
        <div>
          <KolomInput
            label="Cabang"
            name="cabang"
            list={idDaftarCabang}
            value={isian.cabang}
            onChange={(e) => ubah("cabang", e.target.value)}
            galat={kolom.cabang}
            wajib
          />
          <datalist id={idDaftarCabang}>
            {daftarCabang.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <KolomNominal
          label="Gaji pokok"
          name="gajiPokok"
          nilai={isian.gajiPokok}
          onUbah={(n) => ubah("gajiPokok", n)}
          galat={kolom.gajiPokok}
          wajib
        />
        <KolomNominal
          label="Tunjangan"
          name="tunjangan"
          nilai={isian.tunjangan}
          onUbah={(n) => ubah("tunjangan", n)}
          galat={kolom.tunjangan}
          bantuan="Kosongkan bila tidak ada."
        />
        <KolomInput
          label="Nomor rekening"
          name="nomorRekening"
          className="sm:col-span-2"
          inputMode="numeric"
          autoComplete="off"
          value={isian.nomorRekening}
          onChange={(e) => ubah("nomorRekening", e.target.value)}
          galat={kolom.nomorRekening}
          bantuan="Hanya angka, 6 sampai 20 digit. Angka nol di depan tetap disimpan."
          wajib
        />
      </div>

      {karyawan ? (
        <KotakCentang
          label="Karyawan aktif (ikut dihitung gajinya)"
          checked={isian.statusAktif}
          onChange={(e) => ubah("statusAktif", e.target.checked)}
        />
      ) : null}

      <div className="flex flex-wrap justify-end gap-2 pt-2">
        <Tombol varian="sekunder" onClick={onTutup} disabled={memproses}>
          Batal
        </Tombol>
        <Tombol type="submit" memuat={memproses}>
          {karyawan ? "Simpan perubahan" : "Tambah karyawan"}
        </Tombol>
      </div>
    </form>
  );
}
