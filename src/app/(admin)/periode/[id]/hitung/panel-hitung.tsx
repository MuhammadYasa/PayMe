"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { TombolEkspor } from "@/components/admin/tombol-ekspor";
import { RingkasanTotal, TabelHasil } from "@/components/gaji/tabel-hasil";
import { KonfirmasiDialog } from "@/components/ui/dialog";
import { Kartu } from "@/components/ui/kartu";
import { KotakCentang } from "@/components/ui/kolom";
import { Pesan } from "@/components/ui/pesan";
import { MemuatData } from "@/components/ui/spinner";
import { Tombol, TombolTautan } from "@/components/ui/tombol";
import { formatRupiah } from "@/domain/uang";
import { useData } from "@/hooks/use-data";
import { GalatApi, api } from "@/lib/api";
import { urlLangkah } from "@/lib/langkah";
import type { HasilHitung, HasilTersimpan } from "@/server/services/penggajian";

type Mode = "draf" | "final";

/** Tujuan perbaikan untuk galat yang menahan perhitungan, supaya HRD langsung tahu ke mana harus pergi. */
const PERBAIKAN: Record<string, { href: (periodeId: string) => string; label: string }> = {
  ABSENSI_BELUM_LENGKAP: { href: (id) => urlLangkah(id, "absensi"), label: "Ke Lengkapi Absensi" },
  SELISIH_BELUM_DIAKUI: { href: (id) => urlLangkah(id, "pendapatan"), label: "Ke Pendapatan dan Target" },
  TIDAK_ADA_KARYAWAN: { href: () => "/karyawan", label: "Ke menu Karyawan" },
};

export function PanelHitung({ periodeId, label, final }: { periodeId: string; label: string; final: boolean }) {
  const router = useRouter();
  // Setelah menyimpan atau membuka kembali, tampilan berganti seketika; data server menyusul lewat refresh.
  const [ubahan, setUbahan] = useState<{ mode: Mode; tersimpan?: HasilTersimpan } | null>(null);
  const mode: Mode = ubahan?.mode ?? (final ? "final" : "draf");

  if (mode === "final") {
    return (
      <HasilFinal
        periodeId={periodeId}
        label={label}
        baruDisimpan={ubahan?.tersimpan}
        onDibuka={() => {
          setUbahan({ mode: "draf" });
          router.refresh();
        }}
      />
    );
  }
  return (
    <HitungDraf
      periodeId={periodeId}
      label={label}
      onTersimpan={(tersimpan) => {
        setUbahan({ mode: "final", tersimpan });
        router.refresh();
      }}
    />
  );
}

function HasilFinal({ periodeId, label, baruDisimpan, onDibuka }: { periodeId: string; label: string; baruDisimpan?: HasilTersimpan; onDibuka: () => void }) {
  const muat = useData<HasilTersimpan>(baruDisimpan ? null : `/api/periode/${periodeId}/hasil`);
  const [dialog, setDialog] = useState(false);
  const [membuka, setMembuka] = useState(false);
  const [galatBuka, setGalatBuka] = useState<string | null>(null);

  const data = baruDisimpan ?? muat.data;
  if (!baruDisimpan && muat.galat) {
    return (
      <Pesan jenis="galat" judul="Hasil belum bisa dimuat" aksi={<Tombol ukuran="kecil" varian="sekunder" onClick={muat.muatUlang}>Coba lagi</Tombol>}>
        {muat.galat.message}
      </Pesan>
    );
  }
  if (!data) return <MemuatData />;

  async function buka() {
    setMembuka(true);
    setGalatBuka(null);
    try {
      await api(`/api/periode/${periodeId}/buka`, { body: { konfirmasi: true } });
      setDialog(false);
      onDibuka();
    } catch (g) {
      setDialog(false);
      setGalatBuka(g instanceof GalatApi ? g.message : "Periode belum bisa dibuka kembali. Coba lagi.");
    } finally {
      setMembuka(false);
    }
  }

  return (
    <div className="space-y-5">
      <Pesan jenis="sukses" judul={baruDisimpan ? "Penggajian tersimpan" : "Periode ini sudah final"}>
        Hasil penggajian {label} untuk {data.total.jumlahKaryawan} karyawan sudah tersimpan dan tidak dapat diubah. Karyawan dapat melihat gajinya di halaman karyawan.
      </Pesan>
      {galatBuka ? (
        <Pesan jenis="galat" judul="Periode belum bisa dibuka kembali">
          {galatBuka}
        </Pesan>
      ) : null}

      <RingkasanTotal total={data.total} />

      <Kartu judul="Hasil tersimpan" deskripsi="Angka di sini adalah salinan saat disimpan. Mengubah data karyawan sesudahnya tidak mengubah hasil ini.">
        <div className="space-y-4">
          <div className="flex flex-wrap items-start gap-3">
            <TombolEkspor periodeId={periodeId} />
            <Tombol varian="sekunder" onClick={() => setDialog(true)}>
              Buka kembali periode
            </Tombol>
          </div>
          <TabelHasil hasil={data.hasil} total={data.total} />
        </div>
      </Kartu>

      <KonfirmasiDialog
        buka={dialog}
        judul="Buka kembali periode ini?"
        pesan={
          <div className="space-y-2">
            <p>
              Periode <strong>{label}</strong> akan kembali menjadi draf dan hasil yang tersimpan dihapus.
            </p>
            <p>Cicilan denda yang sudah dipotong pada periode ini dikembalikan ke sisa denda. Setelah data diperbaiki, Anda perlu menghitung dan menyimpan ulang.</p>
          </div>
        }
        labelYa="Ya, buka kembali"
        bahaya
        memproses={membuka}
        onYa={() => void buka()}
        onBatal={() => setDialog(false)}
      />
    </div>
  );
}

function PesanTahan({ galat, periodeId }: { galat: GalatApi; periodeId: string }) {
  const perbaikan = galat.kode ? PERBAIKAN[galat.kode] : undefined;
  return (
    <Pesan
      jenis="galat"
      judul="Gaji belum bisa dihitung"
      aksi={perbaikan ? <TombolTautan varian="sekunder" ukuran="kecil" href={perbaikan.href(periodeId)}>{perbaikan.label}</TombolTautan> : undefined}
    >
      {galat.message}
    </Pesan>
  );
}

function HitungDraf({ periodeId, label, onTersimpan }: { periodeId: string; label: string; onTersimpan: (hasil: HasilTersimpan) => void }) {
  const [hasil, setHasil] = useState<HasilHitung | null>(null);
  const [galat, setGalat] = useState<GalatApi | null>(null);
  const [menghitung, setMenghitung] = useState(false);
  const [usang, setUsang] = useState(false);
  const [akui, setAkui] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [menyimpan, setMenyimpan] = useState(false);
  const [galatSimpan, setGalatSimpan] = useState<string | null>(null);
  const judulHasil = useRef<HTMLHeadingElement>(null);

  // Hasil baru yang tampil menerima fokus, agar pembaca layar langsung mendengar bahwa perhitungan selesai.
  useEffect(() => {
    if (hasil) judulHasil.current?.focus();
  }, [hasil]);

  // Bila data diubah di tab lain, hasil yang sedang tampil sudah tidak sama dengan data sekarang (FR-15).
  useEffect(() => {
    if (!hasil || usang) return;
    const hashLama = hasil.hash;
    let aktif = true;
    async function periksa() {
      if (document.visibilityState !== "visible") return;
      try {
        const baru = await api<HasilHitung>(`/api/periode/${periodeId}/hitung`, { metode: "POST" });
        if (aktif && baru.hash !== hashLama) setUsang(true);
      } catch (g) {
        if (aktif && g instanceof GalatApi && g.status === 409) setUsang(true);
      }
    }
    document.addEventListener("visibilitychange", periksa);
    return () => {
      aktif = false;
      document.removeEventListener("visibilitychange", periksa);
    };
  }, [hasil, usang, periodeId]);

  async function hitung() {
    setMenghitung(true);
    setGalat(null);
    setGalatSimpan(null);
    try {
      const baru = await api<HasilHitung>(`/api/periode/${periodeId}/hitung`, { metode: "POST" });
      setHasil(baru);
      setUsang(false);
      setAkui(false);
    } catch (g) {
      // Hasil lama dibuang: data sudah berubah sehingga hasil itu tidak boleh disimpan.
      setHasil(null);
      setGalat(g instanceof GalatApi ? g : new GalatApi(0, "Gaji belum bisa dihitung. Coba lagi."));
    } finally {
      setMenghitung(false);
    }
  }

  async function simpan() {
    if (!hasil) return;
    setMenyimpan(true);
    setGalatSimpan(null);
    try {
      const tersimpan = await api<HasilTersimpan>(`/api/periode/${periodeId}/simpan`, { body: { hash: hasil.hash, akuiPeringatan: akui } });
      setDialog(false);
      onTersimpan({ periode: tersimpan.periode, hasil: tersimpan.hasil, total: tersimpan.total });
    } catch (g) {
      const galatApi = g instanceof GalatApi ? g : new GalatApi(0, "Hasil belum bisa disimpan. Coba lagi.");
      setDialog(false);
      if (galatApi.kode === "HASIL_USANG") setUsang(true);
      setGalatSimpan(galatApi.message);
    } finally {
      setMenyimpan(false);
    }
  }

  if (!hasil) {
    return (
      <div className="space-y-5">
        {galat ? <PesanTahan galat={galat} periodeId={periodeId} /> : null}
        <Kartu judul="Hitung gaji" deskripsi="Satu tombol untuk semua karyawan aktif.">
          <div className="space-y-4">
            <p className="max-w-3xl">
              Sistem menghitung gaji dari absensi, insentif, bonus target, denda, pajak, dan asuransi yang sudah Anda isi. Hasilnya belum disimpan, jadi aman dihitung berkali-kali.
            </p>
            <Tombol memuat={menghitung} onClick={() => void hitung()}>
              Hitung Gaji
            </Tombol>
          </div>
        </Kartu>
      </div>
    );
  }

  const bermasalah = hasil.hasil.filter((r) => r.peringatan.length > 0);
  const jam = new Date(hasil.dihitungPada).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

  return (
    <section aria-labelledby="judul-hasil" className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="judul-hasil" ref={judulHasil} tabIndex={-1} className="text-lg font-bold">
            Hasil perhitungan {label}
          </h2>
          <p className="text-teks-redup">Dihitung pukul {jam}. Hasil ini belum disimpan.</p>
        </div>
        <div className="flex flex-wrap items-start gap-3">
          <Tombol varian="sekunder" memuat={menghitung} onClick={() => void hitung()}>
            Hitung ulang
          </Tombol>
          <TombolEkspor periodeId={periodeId} />
        </div>
      </div>

      {galat ? <PesanTahan galat={galat} periodeId={periodeId} /> : null}
      {usang ? (
        <Pesan
          jenis="peringatan"
          judul="Perlu hitung ulang"
          aksi={
            <Tombol ukuran="kecil" memuat={menghitung} onClick={() => void hitung()}>
              Hitung ulang
            </Tombol>
          }
        >
          Data berubah setelah gaji ini dihitung, jadi hasil di bawah sudah tidak sama dengan data sekarang. Hitung ulang dan periksa hasilnya sebelum menyimpan.
        </Pesan>
      ) : null}
      {bermasalah.length > 0 ? (
        <Pesan jenis="peringatan" judul={`${bermasalah.length} karyawan bergaji bersih negatif`}>
          {bermasalah.map((r) => r.namaLengkap).join(", ")}. Potongan mereka melebihi pendapatan. Karyawan ini ditampilkan paling atas. Periksa denda, potongan absensi, pajak, dan asuransinya.
        </Pesan>
      ) : null}

      <RingkasanTotal total={hasil.total} />
      <TabelHasil hasil={hasil.hasil} total={hasil.total} />

      <Kartu judul="Simpan hasil gaji" deskripsi="Setelah disimpan, periode menjadi final dan tidak bisa diubah, kecuali Anda membukanya kembali.">
        <div className="space-y-3">
          {galatSimpan ? (
            <Pesan jenis="galat" judul="Hasil belum bisa disimpan">
              {galatSimpan}
            </Pesan>
          ) : null}
          {bermasalah.length > 0 ? (
            <KotakCentang
              label={`Saya sudah memeriksa ${bermasalah.length} karyawan dengan gaji bersih negatif dan tetap ingin menyimpan`}
              checked={akui}
              onChange={(e) => setAkui(e.target.checked)}
            />
          ) : null}
          <Tombol onClick={() => setDialog(true)} disabled={usang || (bermasalah.length > 0 && !akui)}>
            Simpan Hasil Gaji
          </Tombol>
        </div>
      </Kartu>

      <KonfirmasiDialog
        buka={dialog}
        judul="Simpan penggajian ini?"
        pesan={
          <div className="space-y-2">
            <p>
              Periode <strong>{label}</strong> akan disimpan untuk <strong>{hasil.total.jumlahKaryawan} karyawan</strong> dengan total gaji bersih{" "}
              <strong>{formatRupiah(hasil.total.totalBersih)}</strong>.
            </p>
            <p>Setelah disimpan, periode menjadi final dan tidak bisa diubah, kecuali Anda membukanya kembali.</p>
          </div>
        }
        labelYa="Ya, simpan"
        memproses={menyimpan}
        onYa={() => void simpan()}
        onBatal={() => setDialog(false)}
      />
    </section>
  );
}
