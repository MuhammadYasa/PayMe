"use client";

import { type FormEvent, useRef, useState } from "react";
import { Kartu } from "@/components/ui/kartu";
import { KolomInput, KolomNominal, KolomPilih, KotakCentang } from "@/components/ui/kolom";
import { Pesan, RingkasanGalat } from "@/components/ui/pesan";
import { MemuatData } from "@/components/ui/spinner";
import { Tombol } from "@/components/ui/tombol";
import { namaHari } from "@/domain/tanggal";
import { bpsKeTeks, parsePersenKeBps, parsePersenKePermil, permilKeTeks } from "@/domain/persen";
import { type Pengaturan, type StatusBerpotongan, STATUS_BERPOTONGAN, pengaturanSchema } from "@/domain/pengaturan";
import { useData } from "@/hooks/use-data";
import { GalatApi, api } from "@/lib/api";
import { fokusKolomPertama } from "@/lib/fokus";
import { ringkasGalatZod } from "@/lib/zod-galat";

type Mode = "tidak" | "per_hari" | "persen_harian";
interface IsianPotongan {
  mode: Mode;
  nominal: number | null;
  persen: string;
}
interface IsianBonus {
  ambang: string;
  jenis: "tetap" | "persen_penjualan";
  nominal: number | null;
  persen: string;
}
interface Isian {
  hari: number[];
  potongan: Record<StatusBerpotongan, IsianPotongan>;
  bonus: IsianBonus[];
}

const LABEL_STATUS: Record<StatusBerpotongan, string> = { izin: "Izin", sakit: "Sakit", cuti: "Cuti", lainnya: "Lainnya" };
const URUTAN_HARI = [1, 2, 3, 4, 5, 6, 0];

function keIsian(p: Pengaturan): Isian {
  const potongan = {} as Record<StatusBerpotongan, IsianPotongan>;
  for (const status of STATUS_BERPOTONGAN) {
    const aturan = p.aturanPotongan[status];
    potongan[status] = {
      mode: aturan.mode,
      nominal: aturan.mode === "per_hari" ? aturan.nominal : null,
      persen: aturan.mode === "persen_harian" ? String(aturan.persen) : "",
    };
  }
  return {
    hari: p.hariKerjaMingguan,
    potongan,
    bonus: p.tingkatBonus.map((t) => ({
      ambang: permilKeTeks(t.ambangPermil),
      jenis: t.jenis,
      nominal: t.jenis === "tetap" ? t.nilai : null,
      persen: t.jenis === "persen_penjualan" ? bpsKeTeks(t.nilai) : "",
    })),
  };
}

/** Mengubah isian layar menjadi bentuk API. Nilai yang tidak terbaca dibiarkan kosong agar skema memberi pesannya. */
function keBentukApi(i: Isian): unknown {
  const potongan: Record<string, unknown> = {};
  for (const status of STATUS_BERPOTONGAN) {
    const p = i.potongan[status];
    potongan[status] =
      p.mode === "per_hari"
        ? { mode: "per_hari", nominal: p.nominal ?? undefined }
        : p.mode === "persen_harian"
          ? { mode: "persen_harian", persen: /^\d+$/.test(p.persen.trim()) ? Number(p.persen) : undefined }
          : { mode: "tidak" };
  }
  return {
    hariKerjaMingguan: i.hari,
    aturanPotongan: potongan,
    tingkatBonus: i.bonus.map((b) => ({
      ambangPermil: parsePersenKePermil(b.ambang) ?? undefined,
      jenis: b.jenis,
      nilai: b.jenis === "tetap" ? (b.nominal ?? undefined) : (parsePersenKeBps(b.persen) ?? undefined),
    })),
  };
}

export function FormPengaturan() {
  const { data, galat: galatMuat, memuat, muatUlang } = useData<Pengaturan>("/api/pengaturan");
  if (galatMuat) {
    return (
      <Pesan jenis="galat" judul="Pengaturan belum bisa dimuat" aksi={<Tombol ukuran="kecil" varian="sekunder" onClick={muatUlang}>Coba lagi</Tombol>}>
        {galatMuat.message}
      </Pesan>
    );
  }
  if (!data || memuat) return <MemuatData />;
  return <IsiForm awal={keIsian(data)} />;
}

function IsiForm({ awal }: { awal: Isian }) {
  const form = useRef<HTMLFormElement>(null);
  const [isian, setIsian] = useState<Isian>(awal);
  const [kolom, setKolom] = useState<Record<string, string>>({});
  const [pesan, setPesan] = useState<string | null>(null);
  const [berhasil, setBerhasil] = useState(false);
  const [memproses, setMemproses] = useState(false);

  function ubahPotongan(status: StatusBerpotongan, ubah: Partial<IsianPotongan>) {
    setIsian((lama) => ({ ...lama, potongan: { ...lama.potongan, [status]: { ...lama.potongan[status], ...ubah } } }));
  }
  function ubahBonus(indeks: number, ubah: Partial<IsianBonus>) {
    setIsian((lama) => ({ ...lama, bonus: lama.bonus.map((b, i) => (i === indeks ? { ...b, ...ubah } : b)) }));
  }

  async function simpan(e: FormEvent) {
    e.preventDefault();
    setBerhasil(false);
    setPesan(null);

    const cek = pengaturanSchema.safeParse(keBentukApi(isian));
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
      const tersimpan = await api<Pengaturan>("/api/pengaturan", { metode: "PUT", body: cek.data });
      setIsian(keIsian(tersimpan));
      setBerhasil(true);
    } catch (g) {
      const galat = g instanceof GalatApi ? g : new GalatApi(0, "Terjadi kesalahan. Coba lagi.");
      setPesan(galat.message);
      setKolom(galat.kolom);
    } finally {
      setMemproses(false);
    }
  }

  return (
    <form ref={form} onSubmit={simpan} noValidate className="space-y-6">
      <RingkasanGalat pesan={pesan} kolom={Object.keys(kolom).length > 1 ? kolom : undefined} />
      {berhasil ? <Pesan jenis="sukses" judul="Pengaturan tersimpan">Perubahan akan dipakai saat gaji periode draf dihitung ulang.</Pesan> : null}

      <Kartu judul="Hari kerja mingguan" deskripsi="Hari yang tidak dipilih dianggap libur mingguan: tidak perlu diisi absensinya dan tidak dihitung sebagai hari kerja.">
        <fieldset>
          <legend className="sr-only">Pilih hari kerja dalam seminggu</legend>
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            {URUTAN_HARI.map((hari) => (
              <KotakCentang
                key={hari}
                label={namaHari(hari)}
                name="hariKerjaMingguan"
                checked={isian.hari.includes(hari)}
                onChange={(e) =>
                  setIsian((lama) => ({
                    ...lama,
                    hari: e.target.checked ? [...lama.hari, hari].sort((a, b) => a - b) : lama.hari.filter((h) => h !== hari),
                  }))
                }
              />
            ))}
          </div>
          {kolom.hariKerjaMingguan ? <p className="mt-1 font-semibold text-bahaya-teks">{kolom.hariKerjaMingguan}</p> : null}
        </fieldset>
      </Kartu>

      <Kartu
        judul="Potongan karena tidak hadir"
        deskripsi="Atur apakah izin, sakit, cuti, atau keterangan lainnya memotong gaji. Gaji harian dihitung dari gaji pokok dibagi jumlah hari kerja pada periode."
      >
        <div className="space-y-4">
          {STATUS_BERPOTONGAN.map((status) => {
            const p = isian.potongan[status];
            return (
              <div key={status} className="grid items-start gap-3 sm:grid-cols-[10rem_1fr_1fr]">
                <p className="pt-2 font-semibold sm:pt-3">{LABEL_STATUS[status]}</p>
                <KolomPilih
                  label="Cara memotong"
                  name={`potongan.${status}.mode`}
                  value={p.mode}
                  onChange={(e) => ubahPotongan(status, { mode: e.target.value as Mode })}
                >
                  <option value="tidak">Tidak dipotong</option>
                  <option value="per_hari">Nominal tetap per hari</option>
                  <option value="persen_harian">Persen dari gaji harian</option>
                </KolomPilih>
                {p.mode === "per_hari" ? (
                  <KolomNominal
                    label="Potongan per hari"
                    name={`potongan.${status}.nominal`}
                    nilai={p.nominal}
                    onUbah={(n) => ubahPotongan(status, { nominal: n })}
                    galat={kolom[`aturanPotongan.${status}.nominal`]}
                  />
                ) : p.mode === "persen_harian" ? (
                  <KolomInput
                    label="Persen dari gaji harian"
                    name={`potongan.${status}.persen`}
                    inputMode="numeric"
                    value={p.persen}
                    onChange={(e) => ubahPotongan(status, { persen: e.target.value })}
                    galat={kolom[`aturanPotongan.${status}.persen`]}
                    bantuan="Angka 1 sampai 100."
                  />
                ) : (
                  <div />
                )}
              </div>
            );
          })}
        </div>
      </Kartu>

      <Kartu
        judul="Bonus target sales"
        deskripsi="Bonus diberikan sesuai satu tingkat tertinggi yang tercapai, bukan dijumlahkan. Tanpa tingkat, bonus target Rp 0."
        aksi={
          <Tombol
            varian="sekunder"
            ukuran="kecil"
            onClick={() => setIsian((lama) => ({ ...lama, bonus: [...lama.bonus, { ambang: "100", jenis: "tetap", nominal: null, persen: "" }] }))}
          >
            Tambah tingkat
          </Tombol>
        }
      >
        {isian.bonus.length === 0 ? (
          <p className="text-teks-redup">Belum ada tingkat bonus. Klik &quot;Tambah tingkat&quot; untuk membuat aturan, misalnya capaian 100% mendapat bonus Rp 500.000.</p>
        ) : (
          <div className="space-y-4">
            {isian.bonus.map((b, i) => (
              <div key={i} className="grid items-start gap-3 rounded-lg border border-garis p-3 md:grid-cols-[1fr_1.2fr_1.2fr_auto]">
                <KolomInput
                  label="Capaian minimal (%)"
                  name={`tingkatBonus.${i}.ambangPermil`}
                  inputMode="decimal"
                  value={b.ambang}
                  onChange={(e) => ubahBonus(i, { ambang: e.target.value })}
                  galat={kolom[`tingkatBonus.${i}.ambangPermil`]}
                  bantuan="Mis. 100 atau 87,5"
                />
                <KolomPilih
                  label="Jenis bonus"
                  name={`tingkatBonus.${i}.jenis`}
                  value={b.jenis}
                  onChange={(e) => ubahBonus(i, { jenis: e.target.value as IsianBonus["jenis"] })}
                >
                  <option value="tetap">Nominal tetap</option>
                  <option value="persen_penjualan">Persen dari penjualan</option>
                </KolomPilih>
                {b.jenis === "tetap" ? (
                  <KolomNominal
                    label="Nominal bonus"
                    name={`tingkatBonus.${i}.nilai`}
                    nilai={b.nominal}
                    onUbah={(n) => ubahBonus(i, { nominal: n })}
                    galat={kolom[`tingkatBonus.${i}.nilai`]}
                  />
                ) : (
                  <KolomInput
                    label="Persen dari penjualan"
                    name={`tingkatBonus.${i}.nilai`}
                    inputMode="decimal"
                    value={b.persen}
                    onChange={(e) => ubahBonus(i, { persen: e.target.value })}
                    galat={kolom[`tingkatBonus.${i}.nilai`]}
                    bantuan="Maksimal 2 desimal, mis. 2,5"
                  />
                )}
                <Tombol
                  varian="sekunder"
                  ukuran="kecil"
                  className="md:mt-8"
                  onClick={() => setIsian((lama) => ({ ...lama, bonus: lama.bonus.filter((_, idx) => idx !== i) }))}
                >
                  Hapus
                </Tombol>
              </div>
            ))}
          </div>
        )}
        {kolom.tingkatBonus ? <p className="mt-2 font-semibold text-bahaya-teks">{kolom.tingkatBonus}</p> : null}
      </Kartu>

      <div className="flex justify-end">
        <Tombol type="submit" memuat={memproses}>
          Simpan pengaturan
        </Tombol>
      </div>
    </form>
  );
}
