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
import { masukSkema } from "@/skema/auth";

export function FormMasuk({ lanjut }: { lanjut?: string }) {
  const form = useRef<HTMLFormElement>(null);
  const [email, setEmail] = useState("");
  const [kataSandi, setKataSandi] = useState("");
  const [kolom, setKolom] = useState<Record<string, string>>({});
  const [pesan, setPesan] = useState<string | null>(null);
  const [memproses, setMemproses] = useState(false);

  async function kirim(e: FormEvent) {
    e.preventDefault();
    setPesan(null);

    const cek = masukSkema.safeParse({ email, kataSandi });
    if (!cek.success) {
      const hasil = ringkasGalatZod(cek.error);
      setKolom(hasil.kolom);
      fokusKolomPertama(form.current, hasil.kolom);
      return;
    }

    setKolom({});
    setMemproses(true);
    try {
      const { tujuan } = await api<{ tujuan: string }>("/api/auth/masuk", { body: { ...cek.data, lanjut } });
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
    <Kartu judul="Masuk ke PayMe" deskripsi="Gunakan email dan kata sandi yang Anda daftarkan.">
      <form ref={form} onSubmit={kirim} noValidate className="space-y-4">
        <RingkasanGalat judul="Belum bisa masuk" pesan={pesan} kolom={Object.keys(kolom).length > 1 ? kolom : undefined} />
        <KolomInput
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          galat={kolom.email}
          wajib
        />
        <KolomInput
          label="Kata sandi"
          name="kataSandi"
          type="password"
          autoComplete="current-password"
          value={kataSandi}
          onChange={(e) => setKataSandi(e.target.value)}
          galat={kolom.kataSandi}
          wajib
        />
        <Tombol type="submit" className="w-full" memuat={memproses}>
          Masuk
        </Tombol>
      </form>
      <p className="mt-5 text-center text-teks-redup">
        Belum punya akun?{" "}
        <Link href="/daftar" className="font-semibold text-merek underline underline-offset-2">
          Daftar sekarang
        </Link>
      </p>
    </Kartu>
  );
}
