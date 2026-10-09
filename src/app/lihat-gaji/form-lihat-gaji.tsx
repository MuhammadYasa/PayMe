"use client";

import { type FormEvent, useRef, useState } from "react";
import { TabelRincian } from "@/components/gaji/tabel-rincian";
import { Kartu } from "@/components/ui/kartu";
import { KolomInput } from "@/components/ui/kolom";
import { Pesan, RingkasanGalat } from "@/components/ui/pesan";
import { Tombol } from "@/components/ui/tombol";
import { formatRupiah } from "@/domain/uang";
import { GalatApi, api } from "@/lib/api";
import { fokusKolomPertama } from "@/lib/fokus";
import type { GajiPublik } from "@/server/services/publik";

export function FormLihatGaji() {
  const form = useRef<HTMLFormElement>(null);
  const [nama, setNama] = useState("");
  const [rekening, setRekening] = useState("");
  const [kolom, setKolom] = useState<Record<string, string>>({});
  const [pesan, setPesan] = useState<string | null>(null);
  const [memproses, setMemproses] = useState(false);
  const [hasil, setHasil] = useState<GajiPublik | null>(null);

  async function kirim(e: FormEvent) {
    e.preventDefault();
    setPesan(null);

    const k: Record<string, string> = {};
    if (!nama.trim()) k.nama = "Isi nama lengkap Anda, sesuai data di perusahaan.";
    if (!rekening.trim()) k.rekening = "Isi nomor rekening Anda.";
    setKolom(k);
    if (Object.keys(k).length > 0) {
      fokusKolomPertama(form.current, k);
      return;
    }

    setMemproses(true);
    try {
      setHasil(await api<GajiPublik>("/api/publik/gaji", { body: { nama, rekening } }));
      // Isian dikosongkan begitu hasil tampil, supaya nomor rekening tidak tertinggal di layar atau perangkat.
      setNama("");
      setRekening("");
    } catch (g) {
      setPesan(g instanceof GalatApi ? g.message : "Terjadi kesalahan. Coba lagi beberapa saat lagi.");
    } finally {
      setMemproses(false);
    }
  }

  if (hasil) return <HasilGaji data={hasil} onSelesai={() => setHasil(null)} />;

  return (
    <Kartu judul="Data Anda" deskripsi="Nama dan nomor rekening harus sama persis dengan yang terdaftar di perusahaan.">
      <form ref={form} onSubmit={(e) => void kirim(e)} noValidate className="space-y-4">
        <RingkasanGalat judul="Gaji belum bisa ditampilkan" pesan={pesan} />
        <KolomInput
          label="Nama lengkap"
          name="nama"
          autoComplete="off"
          spellCheck={false}
          value={nama}
          onChange={(e) => setNama(e.target.value)}
          galat={kolom.nama}
          wajib
        />
        <KolomInput
          label="Nomor rekening"
          name="rekening"
          inputMode="numeric"
          autoComplete="off"
          spellCheck={false}
          value={rekening}
          onChange={(e) => setRekening(e.target.value)}
          galat={kolom.rekening}
          wajib
        />
        <Tombol type="submit" className="w-full sm:w-auto" memuat={memproses}>
          Lihat Gaji Saya
        </Tombol>
      </form>
    </Kartu>
  );
}

function HasilGaji({ data, onSelesai }: { data: GajiPublik; onSelesai: () => void }) {
  return (
    <div className="space-y-5">
      <Kartu
        judul={data.nama}
        deskripsi={`${data.jabatan}, cabang ${data.cabang}, ${data.perusahaan}`}
        aksi={
          <Tombol varian="sekunder" onClick={onSelesai}>
            Selesai, hapus dari layar
          </Tombol>
        }
      >
        <p>
          Nomor rekening: <strong className="tabular-nums">{data.rekeningSamar}</strong>
        </p>
      </Kartu>

      {data.periode.length === 0 ? (
        <Pesan jenis="info" judul="Belum ada gaji yang tersimpan">
          Perusahaan belum menyimpan gaji final atas nama Anda. Hubungi bagian HRD bila seharusnya sudah ada.
        </Pesan>
      ) : (
        data.periode.map((p, n) => (
          <details key={`${p.tanggalAwal}-${p.tanggalAkhir}`} open={n === 0} className="rounded-xl border border-garis bg-kartu shadow-sm">
            <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-5 py-4 font-bold">
              <span>{p.label}</span>
              <span className="tabular-nums">Gaji bersih {formatRupiah(p.rincian.totalBersih)}</span>
            </summary>
            <div className="border-t border-garis px-5 py-4">
              <TabelRincian data={{ ...p.rincian, bonusTarget: { bonus: p.rincian.bonusTarget } }} />
            </div>
          </details>
        ))
      )}
    </div>
  );
}
