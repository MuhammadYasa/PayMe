import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { formatPersenPermil, formatRupiah } from "@/domain/uang";

/**
 * Bentuk minimum rincian gaji yang bisa ditampilkan. Rincian lengkap milik HRD (RincianGaji) dan rincian untuk
 * karyawan (tanpa ID internal) sama-sama memenuhinya, sehingga keduanya memakai tampilan yang sama.
 */
export interface DataRincian {
  absensi: { hariKerja: number; hadir: number; izin: number; sakit: number; cuti: number; lainnya: number; totalLibur: number };
  gajiPokok: number;
  tunjangan: number;
  insentif: { total: number; rinci: { jenis: string; nominal: number }[] };
  bonusTarget: { bonus: number; penjualan?: number; target?: number; persenCapaianPermil?: number | null };
  potonganAbsensi: { total: number; rinci: { status: string; hari: number; nominal: number }[] };
  denda: { total: number; rinci: { alasan: string; nominal: number }[] };
  pajak: number;
  asuransi: number;
  totalPendapatan: number;
  totalPotongan: number;
  totalBersih: number;
}

const LABEL_STATUS: Record<string, string> = { izin: "Izin", sakit: "Sakit", cuti: "Cuti", lainnya: "Lainnya" };

function Kelompok({ children }: { children: string }) {
  return (
    <tr className="bg-merek-lembut">
      <th scope="rowgroup" colSpan={2} className="px-3 py-2 text-left font-bold">
        {children}
      </th>
    </tr>
  );
}

function BarisRincian({ label, nilai, jenis = "utama", keterangan }: { label: string; nilai: number; jenis?: "utama" | "rinci" | "jumlah"; keterangan?: ReactNode }) {
  const gayaLabel = jenis === "rinci" ? "pl-8 font-normal text-teks-redup" : jenis === "jumlah" ? "font-bold" : "font-normal";
  const gayaNilai = jenis === "rinci" ? "text-teks-redup" : jenis === "jumlah" ? "font-bold" : "";
  return (
    <tr className={jenis === "jumlah" ? "border-t border-garis" : ""}>
      <th scope="row" className={`px-3 py-1.5 text-left ${gayaLabel}`}>
        {label}
        {keterangan ? <span className="block text-sm font-normal text-teks-redup">{keterangan}</span> : null}
      </th>
      <td className={`whitespace-nowrap px-3 py-1.5 text-right align-top tabular-nums ${gayaNilai}`}>{formatRupiah(nilai)}</td>
    </tr>
  );
}

function keteranganBonus(b: DataRincian["bonusTarget"]): string | undefined {
  if (b.penjualan === undefined || b.target === undefined) return undefined;
  if (b.penjualan === 0 && b.target === 0) return undefined;
  if (b.target === 0) return `Penjualan ${formatRupiah(b.penjualan)}, tidak ada target`;
  const capaian = b.persenCapaianPermil == null ? "" : ` (${formatPersenPermil(b.persenCapaianPermil)})`;
  return `Penjualan ${formatRupiah(b.penjualan)} dari target ${formatRupiah(b.target)}${capaian}`;
}

/** Setiap komponen rumus gaji tampil sebagai baris tersendiri, ditambah ringkasan kehadiran (FR-15, FR-19). */
export function TabelRincian({ data }: { data: DataRincian }) {
  const { absensi } = data;
  const ringkasan: [string, number][] = [
    ["Hari kerja", absensi.hariKerja],
    ["Hadir", absensi.hadir],
    ["Izin", absensi.izin],
    ["Sakit", absensi.sakit],
    ["Cuti", absensi.cuti],
    ["Lainnya", absensi.lainnya],
    ["Libur", absensi.totalLibur],
  ];
  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4 lg:grid-cols-7">
        {ringkasan.map(([label, nilai]) => (
          <div key={label}>
            <dt className="text-sm text-teks-redup">{label}</dt>
            <dd className="font-semibold tabular-nums">{nilai} hari</dd>
          </div>
        ))}
      </dl>

      <div className="overflow-x-auto rounded-lg border border-garis bg-kartu">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">Rincian komponen gaji</caption>
          <thead className="sr-only">
            <tr>
              <th scope="col">Komponen</th>
              <th scope="col">Jumlah</th>
            </tr>
          </thead>
          <tbody>
            <Kelompok>Pendapatan</Kelompok>
            <BarisRincian label="Gaji pokok" nilai={data.gajiPokok} />
            <BarisRincian label="Tunjangan" nilai={data.tunjangan} />
            <BarisRincian label="Insentif" nilai={data.insentif.total} />
            {data.insentif.rinci.map((i, n) => (
              <BarisRincian key={`insentif-${n}`} label={i.jenis} nilai={i.nominal} jenis="rinci" />
            ))}
            <BarisRincian label="Bonus target" nilai={data.bonusTarget.bonus} keterangan={keteranganBonus(data.bonusTarget)} />
            <BarisRincian label="Total pendapatan" nilai={data.totalPendapatan} jenis="jumlah" />

            <Kelompok>Potongan</Kelompok>
            <BarisRincian label="Potongan absensi" nilai={data.potonganAbsensi.total} />
            {data.potonganAbsensi.rinci.map((p) => (
              <BarisRincian key={`absensi-${p.status}`} label={`${LABEL_STATUS[p.status] ?? p.status}, ${p.hari} hari`} nilai={p.nominal} jenis="rinci" />
            ))}
            <BarisRincian label="Denda" nilai={data.denda.total} />
            {data.denda.rinci.map((d, n) => (
              <BarisRincian key={`denda-${n}`} label={d.alasan} nilai={d.nominal} jenis="rinci" />
            ))}
            <BarisRincian label="Pajak" nilai={data.pajak} />
            <BarisRincian label="Asuransi" nilai={data.asuransi} />
            <BarisRincian label="Total potongan" nilai={data.totalPotongan} jenis="jumlah" />

            <tr className="border-t-2 border-garis-tebal bg-merek-lembut">
              <th scope="row" className="px-3 py-2.5 text-left text-base font-bold">
                Gaji bersih
                {data.totalBersih < 0 ? (
                  <Badge nada="bahaya" className="ml-2 align-middle">
                    Negatif
                  </Badge>
                ) : null}
              </th>
              <td className="whitespace-nowrap px-3 py-2.5 text-right text-base font-bold tabular-nums">{formatRupiah(data.totalBersih)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
