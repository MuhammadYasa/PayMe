"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useRef, useState } from "react";
import { KolomInput } from "@/components/ui/kolom";
import { Kartu } from "@/components/ui/kartu";
import { Pesan } from "@/components/ui/pesan";
import { Tombol, kelasTombol } from "@/components/ui/tombol";
import { hitungPeriode, pratinjauPeriode } from "@/domain/periode";
import { adalahTanggalValid } from "@/domain/tanggal";
import { GalatApi, api } from "@/lib/api";
import { fokusKolomPertama } from "@/lib/fokus";

export function FormPeriode({ saran }: { saran: string }) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [tanggal, setTanggal] = useState(saran);
  const [galat, setGalat] = useState<GalatApi | null>(null);
  const [kolom, setKolom] = useState<Record<string, string>>({});
  const [memproses, setMemproses] = useState(false);

  const pratinjau = adalahTanggalValid(tanggal) ? pratinjauPeriode(hitungPeriode(tanggal)) : null;

  async function kirim(e: FormEvent) {
    e.preventDefault();
    setGalat(null);
    if (!adalahTanggalValid(tanggal)) {
      const k = { tanggalAwal: "Pilih tanggal awal periode dari kalender." };
      setKolom(k);
      fokusKolomPertama(form.current, k);
      return;
    }
    setKolom({});
    setMemproses(true);
    try {
      const periode = await api<{ id: string }>("/api/periode", { body: { tanggalAwal: tanggal } });
      router.push(`/periode/${periode.id}`);
    } catch (g) {
      const galatApi = g instanceof GalatApi ? g : new GalatApi(0, "Terjadi kesalahan. Coba lagi.");
      setGalat(galatApi);
      setKolom(galatApi.kolom);
      setMemproses(false);
    }
  }

  const idLanjut = (galat?.data as { periodeId?: string } | undefined)?.periodeId;

  return (
    <Kartu>
      <form ref={form} onSubmit={kirim} noValidate className="max-w-xl space-y-5">
        {galat ? (
          <Pesan
            jenis={galat.kode === "PERIODE_SUDAH_ADA" ? "info" : "galat"}
            judul={galat.kode === "PERIODE_SUDAH_ADA" ? "Periode ini sudah ada" : "Periode belum bisa dibuat"}
            aksi={
              idLanjut ? (
                <Link href={`/periode/${idLanjut}`} className={kelasTombol("sekunder", "kecil")}>
                  Buka periode
                </Link>
              ) : undefined
            }
          >
            {galat.message}
          </Pesan>
        ) : null}

        <KolomInput
          label="Tanggal awal periode"
          name="tanggalAwal"
          type="date"
          value={tanggal}
          onChange={(e) => setTanggal(e.target.value)}
          galat={kolom.tanggalAwal}
          bantuan="Misalnya 26 Januari bila gaji dihitung dari tanggal 26 sampai 25 bulan berikutnya."
          wajib
        />

        <div aria-live="polite" className="min-h-14 rounded-lg bg-merek-lembut px-4 py-3 font-semibold text-info-teks">
          {pratinjau ?? "Pilih tanggal awal untuk melihat rentang periode."}
        </div>

        <Tombol type="submit" memuat={memproses}>
          Buat periode dan lanjut
        </Tombol>
      </form>
    </Kartu>
  );
}
