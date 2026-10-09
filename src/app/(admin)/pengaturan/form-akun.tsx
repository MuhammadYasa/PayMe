"use client";

import { type FormEvent, useRef, useState } from "react";
import { Kartu } from "@/components/ui/kartu";
import { KolomInput } from "@/components/ui/kolom";
import { Pesan, RingkasanGalat } from "@/components/ui/pesan";
import { Tombol } from "@/components/ui/tombol";
import { GalatApi, api } from "@/lib/api";
import { fokusKolomPertama } from "@/lib/fokus";
import { ringkasGalatZod } from "@/lib/zod-galat";
import { tambahAkunSkema } from "@/skema/auth";

const KOSONG = { nama: "", email: "", kataSandi: "" };

export function FormAkun() {
  const form = useRef<HTMLFormElement>(null);
  const [isian, setIsian] = useState(KOSONG);
  const [kolom, setKolom] = useState<Record<string, string>>({});
  const [pesan, setPesan] = useState<string | null>(null);
  const [berhasil, setBerhasil] = useState<string | null>(null);
  const [memproses, setMemproses] = useState(false);

  const ubah = (nama: keyof typeof KOSONG) => (e: { target: { value: string } }) => setIsian((lama) => ({ ...lama, [nama]: e.target.value }));

  async function kirim(e: FormEvent) {
    e.preventDefault();
    setPesan(null);
    setBerhasil(null);

    const cek = tambahAkunSkema.safeParse(isian);
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
      await api("/api/akun", { body: cek.data });
      setBerhasil(`Akun untuk ${cek.data.nama} sudah dibuat. Beri tahu email dan kata sandinya secara langsung.`);
      setIsian(KOSONG);
    } catch (g) {
      const galat = g instanceof GalatApi ? g : new GalatApi(0, "Terjadi kesalahan. Coba lagi.");
      setPesan(galat.message);
      setKolom(galat.kolom);
      fokusKolomPertama(form.current, galat.kolom);
    } finally {
      setMemproses(false);
    }
  }

  return (
    <Kartu judul="Tambah akun HRD" deskripsi="Akun baru otomatis bergabung ke perusahaan Anda dan dapat mengelola data gaji yang sama.">
      <form ref={form} onSubmit={kirim} noValidate className="max-w-xl space-y-4">
        <RingkasanGalat pesan={pesan} kolom={Object.keys(kolom).length > 1 ? kolom : undefined} />
        {berhasil ? <Pesan jenis="sukses" judul="Akun dibuat">{berhasil}</Pesan> : null}
        <KolomInput label="Nama" name="nama" value={isian.nama} onChange={ubah("nama")} galat={kolom.nama} wajib />
        <KolomInput label="Email" name="email" type="email" value={isian.email} onChange={ubah("email")} galat={kolom.email} wajib />
        <KolomInput
          label="Kata sandi awal"
          name="kataSandi"
          type="password"
          autoComplete="new-password"
          value={isian.kataSandi}
          onChange={ubah("kataSandi")}
          galat={kolom.kataSandi}
          bantuan="Minimal 8 karakter."
          wajib
        />
        <Tombol type="submit" varian="sekunder" memuat={memproses}>
          Tambah akun
        </Tombol>
      </form>
    </Kartu>
  );
}
