"use client";

import Link from "next/link";
import { type FormEvent, useRef, useState } from "react";
import { KolomInput } from "@/components/ui/kolom";
import { RingkasanGalat } from "@/components/ui/pesan";
import { Kartu } from "@/components/ui/kartu";
import { Tombol } from "@/components/ui/tombol";
import { GalatApi, api } from "@/lib/api";
import { fokusKolomPertama } from "@/lib/fokus";
import { ringkasGalatZod } from "@/lib/zod-galat";
import { daftarSkema } from "@/skema/auth";

export function FormDaftar() {
  const form = useRef<HTMLFormElement>(null);
  const [isian, setIsian] = useState({ nama: "", namaPerusahaan: "", email: "", kataSandi: "" });
  const [kolom, setKolom] = useState<Record<string, string>>({});
  const [pesan, setPesan] = useState<string | null>(null);
  const [memproses, setMemproses] = useState(false);

  const ubah = (nama: keyof typeof isian) => (e: { target: { value: string } }) =>
    setIsian((lama) => ({ ...lama, [nama]: e.target.value }));

  async function kirim(e: FormEvent) {
    e.preventDefault();
    setPesan(null);

    const cek = daftarSkema.safeParse(isian);
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
      const { tujuan } = await api<{ tujuan: string }>("/api/auth/daftar", { body: cek.data });
      window.location.assign(tujuan);
    } catch (galat) {
      const g = galat instanceof GalatApi ? galat : new GalatApi(0, "Terjadi kesalahan. Coba lagi.");
      setPesan(g.message);
      setKolom(g.kolom);
      fokusKolomPertama(form.current, g.kolom);
      setMemproses(false);
    }
  }

  return (
    <Kartu judul="Buat akun PayMe" deskripsi="Akun ini akan menjadi pemilik data gaji perusahaan Anda.">
      <form ref={form} onSubmit={kirim} noValidate className="space-y-4">
        <RingkasanGalat judul="Belum bisa mendaftar" pesan={pesan} kolom={Object.keys(kolom).length > 1 ? kolom : undefined} />
        <KolomInput label="Nama Anda" name="nama" autoComplete="name" value={isian.nama} onChange={ubah("nama")} galat={kolom.nama} wajib />
        <KolomInput
          label="Nama perusahaan"
          name="namaPerusahaan"
          autoComplete="organization"
          value={isian.namaPerusahaan}
          onChange={ubah("namaPerusahaan")}
          galat={kolom.namaPerusahaan}
          wajib
        />
        <KolomInput
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          value={isian.email}
          onChange={ubah("email")}
          galat={kolom.email}
          bantuan="Dipakai untuk masuk. Satu email hanya bisa dipakai di satu akun."
          wajib
        />
        <KolomInput
          label="Kata sandi"
          name="kataSandi"
          type="password"
          autoComplete="new-password"
          value={isian.kataSandi}
          onChange={ubah("kataSandi")}
          galat={kolom.kataSandi}
          bantuan="Minimal 8 karakter."
          wajib
        />
        <Tombol type="submit" className="w-full" memuat={memproses}>
          Daftar
        </Tombol>
      </form>
      <p className="mt-5 text-center text-teks-redup">
        Sudah punya akun?{" "}
        <Link href="/masuk" className="font-semibold text-merek underline underline-offset-2">
          Masuk
        </Link>
      </p>
    </Kartu>
  );
}
