import { hitungPeriode } from "@/domain/periode";
import type { TanggalISO } from "@/domain/tanggal";
import type { DbPerusahaan } from "@/server/db/tenant";
import { buatKaryawan } from "@/server/services/karyawan";
import { buatPeriode } from "@/server/services/periode";
import { karyawanSkema } from "@/skema/karyawan";

let penghitung = 0;

/** Karyawan aktif dengan nomor rekening unik. Nama persis seperti ditulis pada profil (mis. "Dimas Pratama"). */
export async function karyawanUji(
  db: DbPerusahaan,
  namaLengkap: string,
  ubah: Record<string, unknown> = {},
) {
  penghitung += 1;
  return buatKaryawan(
    db,
    karyawanSkema.parse({
      namaLengkap,
      jabatan: "Staf",
      cabang: "Surabaya",
      gajiPokok: 3_000_000,
      tunjangan: 0,
      nomorRekening: String(7_000_000_000 + penghitung),
      ...ubah,
    }),
  );
}

export function periodeUji(db: DbPerusahaan, awal: TanggalISO) {
  return buatPeriode(db, hitungPeriode(awal).tanggalAwal);
}
