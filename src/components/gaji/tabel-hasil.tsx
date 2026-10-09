"use client";

import { Fragment, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Baris, KepalaTabel, Tabel, Td, TdAngka, Th } from "@/components/ui/tabel";
import { Tombol } from "@/components/ui/tombol";
import type { RincianGaji, TotalGaji } from "@/domain/gaji";
import { formatRupiah } from "@/domain/uang";
import { TabelRincian } from "./tabel-rincian";

/** Empat angka utama di atas hasil, supaya HRD melihat gambaran besarnya sebelum memeriksa per karyawan. */
export function RingkasanTotal({ total }: { total: TotalGaji }) {
  const butir: [string, string][] = [
    ["Karyawan", String(total.jumlahKaryawan)],
    ["Total pendapatan", formatRupiah(total.totalPendapatan)],
    ["Total potongan", formatRupiah(total.totalPotongan)],
    ["Total gaji bersih", formatRupiah(total.totalBersih)],
  ];
  return (
    <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {butir.map(([label, nilai]) => (
        <div key={label} className="rounded-xl border border-garis bg-kartu px-4 py-3 shadow-sm">
          <dt className="text-sm text-teks-redup">{label}</dt>
          <dd className="text-xl font-bold tabular-nums">{nilai}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Tabel ringkas semua karyawan dengan rincian yang bisa dibuka per baris. Karyawan bermasalah (gaji bersih negatif)
 * ditaruh paling atas dan diberi tanda teks, bukan hanya warna (FR-15).
 */
export function TabelHasil({ hasil, total }: { hasil: RincianGaji[]; total: TotalGaji }) {
  const [terbuka, setTerbuka] = useState<ReadonlySet<string>>(new Set());
  const urut = [...hasil.filter((r) => r.peringatan.length > 0), ...hasil.filter((r) => r.peringatan.length === 0)];

  function alih(id: string) {
    setTerbuka((lama) => {
      const baru = new Set(lama);
      if (!baru.delete(id)) baru.add(id);
      return baru;
    });
  }

  return (
    <Tabel keterangan="Hasil perhitungan gaji semua karyawan. Setiap baris bisa dibuka untuk melihat rinciannya">
      <KepalaTabel>
        <tr>
          <Th>Karyawan</Th>
          <Th>Cabang</Th>
          <Th className="text-right">Pendapatan</Th>
          <Th className="text-right">Potongan</Th>
          <Th className="text-right">Gaji bersih</Th>
          <Th>
            <span className="sr-only">Rincian</span>
          </Th>
        </tr>
      </KepalaTabel>
      <tbody>
        {urut.map((r) => {
          const buka = terbuka.has(r.karyawanId);
          const idRincian = `rincian-${r.karyawanId}`;
          return (
            <Fragment key={r.karyawanId}>
              <Baris className={r.peringatan.length > 0 ? "bg-bahaya-latar/50" : ""}>
                <Td>
                  <span className="font-semibold">{r.namaLengkap}</span>
                  <span className="block text-teks-redup">{r.jabatan}</span>
                  {r.peringatan.length > 0 ? <Badge nada="bahaya" className="mt-1">Gaji bersih negatif</Badge> : null}
                </Td>
                <Td>{r.cabang}</Td>
                <TdAngka>{formatRupiah(r.totalPendapatan)}</TdAngka>
                <TdAngka>{formatRupiah(r.totalPotongan)}</TdAngka>
                <TdAngka className="font-bold">{formatRupiah(r.totalBersih)}</TdAngka>
                <Td>
                  <div className="flex justify-end">
                    <Tombol varian="sekunder" ukuran="kecil" aria-expanded={buka} aria-controls={idRincian} onClick={() => alih(r.karyawanId)}>
                      {buka ? "Tutup rincian" : "Lihat rincian"}
                      <span className="sr-only"> {r.namaLengkap}</span>
                    </Tombol>
                  </div>
                </Td>
              </Baris>
              {buka ? (
                <tr id={idRincian} className="border-b border-garis bg-halaman">
                  <td colSpan={6} className="px-4 py-4">
                    {r.peringatan.map((p, n) => (
                      <p key={n} className="mb-3 rounded-lg border-l-4 border-bahaya bg-bahaya-latar px-3 py-2 font-semibold text-bahaya-teks">
                        {p}
                      </p>
                    ))}
                    <TabelRincian data={r} />
                  </td>
                </tr>
              ) : null}
            </Fragment>
          );
        })}
      </tbody>
      <tfoot>
        <tr className="border-t-2 border-garis-tebal bg-merek-lembut font-bold">
          <th scope="row" colSpan={2} className="px-3 py-2.5 text-left">
            Total {total.jumlahKaryawan} karyawan
          </th>
          <TdAngka>{formatRupiah(total.totalPendapatan)}</TdAngka>
          <TdAngka>{formatRupiah(total.totalPotongan)}</TdAngka>
          <TdAngka>{formatRupiah(total.totalBersih)}</TdAngka>
          <td />
        </tr>
      </tfoot>
    </Tabel>
  );
}
