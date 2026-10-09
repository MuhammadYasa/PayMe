import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { type InputGaji, type RincianGaji, type TotalGaji, hitungGaji, jumlahkanGaji } from "@/domain/gaji";
import { labelPeriode } from "@/domain/periode";
import { formatRupiah } from "@/domain/uang";
import { dariDate, keDate } from "@/server/db/tanggal";
import type { DbPerusahaan } from "@/server/db/tenant";
import { bentrok } from "@/server/errors";
import { sha256Hex } from "@/server/kripto";
import { ringkasanPeriode } from "./absensi";
import { cicilanUntukPeriode } from "./denda";
import { ambilPengaturan } from "./pengaturan";
import { muatSalesUntukGaji, selisihBelumDiakui } from "./pendapatan";
import { type PeriodeDto, muatPeriode, muatPeriodeDraf } from "./periode";

export interface HasilHitung {
  periode: PeriodeDto;
  hasil: RincianGaji[];
  total: TotalGaji;
  /** Sidik jari hasil. Dikirim kembali saat menyimpan agar hasil yang disimpan sama dengan yang diperiksa HRD. */
  hash: string;
  dihitungPada: string;
}

export interface HasilTersimpan {
  periode: PeriodeDto;
  hasil: RincianGaji[];
  total: TotalGaji;
}

class SudahFinal extends Error {}

function urutkan(daftar: RincianGaji[]): RincianGaji[] {
  return [...daftar].sort(
    (a, b) => a.cabang.localeCompare(b.cabang, "id") || a.namaLengkap.localeCompare(b.namaLengkap, "id") || a.karyawanId.localeCompare(b.karyawanId),
  );
}

/** Menahan perhitungan bila data belum siap, dengan pesan yang menyebut siapa dan apa yang perlu dilengkapi (FR-05, FR-10, FR-15). */
function periksaKesiapan(args: {
  jumlahAktif: number;
  belumLengkap: { id: string; nama: string; jumlahKosong: number }[];
  selisih: { cabang: string; selisih: number }[];
}): void {
  if (args.jumlahAktif === 0) {
    throw bentrok("Belum ada karyawan aktif. Tambahkan karyawan di menu Karyawan, lalu hitung gaji lagi.", undefined, "TIDAK_ADA_KARYAWAN");
  }
  if (args.belumLengkap.length > 0) {
    const contoh = args.belumLengkap
      .slice(0, 5)
      .map((k) => `${k.nama} (${k.jumlahKosong} tanggal kosong)`)
      .join(", ");
    const sisa = args.belumLengkap.length > 5 ? `, dan ${args.belumLengkap.length - 5} karyawan lainnya` : "";
    throw bentrok(
      `Absensi belum lengkap: ${contoh}${sisa}. Isi tanggal yang kosong di langkah Lengkapi Absensi, lalu hitung gaji lagi.`,
      { karyawan: args.belumLengkap },
      "ABSENSI_BELUM_LENGKAP",
    );
  }
  if (args.selisih.length > 0) {
    const s = args.selisih[0];
    throw bentrok(
      `Selisih pendapatan cabang ${s.cabang} sebesar ${formatRupiah(Math.abs(s.selisih))} belum diakui. Periksa breakdown sales di langkah Pendapatan dan Target, atau akui selisihnya, lalu hitung gaji lagi.`,
      { selisih: args.selisih },
      "SELISIH_BELUM_DIAKUI",
    );
  }
}

async function susunInput(db: DbPerusahaan, periode: PeriodeDto): Promise<InputGaji[]> {
  const pengaturan = await ambilPengaturan(db);
  const [aktif, ringkas, sales, insentif, cicilan, potongan, selisih] = await Promise.all([
    db.karyawan.findMany({ where: { statusAktif: true }, orderBy: [{ cabang: "asc" }, { namaLengkap: "asc" }, { id: "asc" }] }),
    ringkasanPeriode(db, periode.id),
    muatSalesUntukGaji(db, periode.id, pengaturan.tingkatBonus),
    db.insentif.findMany({ where: { periodeId: periode.id }, orderBy: [{ jenis: "asc" }, { nominal: "asc" }, { id: "asc" }] }),
    cicilanUntukPeriode(db, periode),
    db.potonganLain.findMany({ where: { periodeId: periode.id } }),
    selisihBelumDiakui(db, periode.id),
  ]);

  periksaKesiapan({
    jumlahAktif: aktif.length,
    belumLengkap: ringkas.karyawan
      .filter((k) => k.ringkasan.jumlahKosong > 0)
      .map((k) => ({ id: k.karyawanId, nama: k.nama, jumlahKosong: k.ringkasan.jumlahKosong })),
    selisih,
  });

  const absensi = new Map(ringkas.karyawan.map((k) => [k.karyawanId, k.ringkasan]));
  return aktif.map((k) => {
    const r = absensi.get(k.id)!;
    return {
      karyawan: {
        id: k.id,
        namaLengkap: k.namaLengkap,
        jabatan: k.jabatan,
        cabang: k.cabang,
        nomorRekening: k.nomorRekening,
        gajiPokok: k.gajiPokok,
        tunjangan: k.tunjangan,
      },
      absensi: { hariKerja: r.hariKerja, hadir: r.hadir, izin: r.izin, sakit: r.sakit, cuti: r.cuti, lainnya: r.lainnya, totalLibur: r.totalLibur },
      aturanPotongan: pengaturan.aturanPotongan,
      insentif: insentif.filter((i) => i.karyawanId === k.id).map((i) => ({ jenis: i.jenis, nominal: i.nominal })),
      bonusTarget: sales.get(k.id) ?? null,
      denda: cicilan.filter((c) => c.karyawanId === k.id).map((c) => ({ dendaId: c.dendaId, alasan: c.alasan, nominal: c.nominal })),
      pajak: potongan.find((p) => p.karyawanId === k.id && p.jenis === "PAJAK")?.nominal ?? 0,
      asuransi: potongan.find((p) => p.karyawanId === k.id && p.jenis === "ASURANSI")?.nominal ?? 0,
    };
  });
}

/** Menghitung gaji semua karyawan aktif. Tidak menyimpan apa pun: hasilnya masih draf yang diperiksa HRD. */
export async function hitungGajiPeriode(db: DbPerusahaan, periodeId: string): Promise<HasilHitung> {
  const periode = await muatPeriodeDraf(db, periodeId);
  const hasil = urutkan((await susunInput(db, periode)).map(hitungGaji));
  return {
    periode,
    hasil,
    total: jumlahkanGaji(hasil),
    hash: sha256Hex(JSON.stringify({ periode: periode.id, hasil })),
    dihitungPada: new Date().toISOString(),
  };
}

async function ringkasTersimpan(db: DbPerusahaan, periode: PeriodeDto): Promise<HasilTersimpan> {
  const baris = await db.hasilGaji.findMany({ where: { periodeId: periode.id } });
  const hasil = urutkan(baris.map((b) => b.rincian as unknown as RincianGaji));
  return { periode, hasil, total: jumlahkanGaji(hasil) };
}

/** Hasil yang sudah disimpan (snapshot). Tidak terpengaruh perubahan profil karyawan sesudahnya (FR-16). */
export async function ambilHasilTersimpan(db: DbPerusahaan, periodeId: string): Promise<HasilTersimpan> {
  return ringkasTersimpan(db, await muatPeriode(db, periodeId));
}

/**
 * Memfinalkan periode: hasil dihitung ulang di server dan harus sama dengan yang diperiksa HRD (hash). Semua
 * perubahan (status, snapshot, potongan denda, sisa denda) terjadi dalam satu transaksi, jadi bila gagal tidak ada
 * data parsial. Klik ganda atau dua HRD serentak menghasilkan satu finalisasi; sisanya menerima hasil yang sama.
 */
export async function simpanFinal(db: DbPerusahaan, periodeId: string, input: { hash: string; akuiPeringatan: boolean }) {
  const periode = await muatPeriode(db, periodeId);
  if (periode.status === "FINAL") return { sudahFinal: true, ...(await ringkasTersimpan(db, periode)) };

  const hitung = await hitungGajiPeriode(db, periodeId);
  if (hitung.hash !== input.hash) {
    throw bentrok(
      "Data berubah sejak gaji terakhir dihitung, jadi hasil yang Anda periksa sudah tidak sama dengan data sekarang. Tekan Hitung Gaji lagi, periksa hasilnya, lalu simpan.",
      undefined,
      "HASIL_USANG",
    );
  }
  const bermasalah = hitung.hasil.filter((r) => r.peringatan.length > 0);
  if (bermasalah.length > 0 && !input.akuiPeringatan) {
    throw bentrok(
      `Ada ${bermasalah.length} karyawan dengan gaji bersih negatif (${bermasalah.map((r) => r.namaLengkap).slice(0, 3).join(", ")}${bermasalah.length > 3 ? ", dan lainnya" : ""}). Periksa dendanya, atau centang pengakuan bahwa Anda sudah memeriksa lalu simpan.`,
      { jumlah: bermasalah.length },
      "PERINGATAN_BELUM_DIAKUI",
    );
  }

  try {
    await db.$transaction(async (tx) => {
      const diubah = await tx.periode.updateMany({
        where: { id: periodeId, status: "DRAF" },
        data: { status: "FINAL", difinalkanPada: new Date() },
      });
      if (diubah.count === 0) throw new SudahFinal();

      await tx.hasilGaji.createMany({
        data: hitung.hasil.map((r) => ({
          perusahaanId: db.$perusahaanId,
          periodeId,
          karyawanId: r.karyawanId,
          rincian: r as unknown as Prisma.InputJsonValue,
          totalBersih: r.totalBersih,
        })),
      });

      for (const r of hitung.hasil) {
        for (const d of r.denda.rinci) {
          const kurang = await tx.denda.updateMany({ where: { id: d.dendaId, sisa: { gte: d.nominal } }, data: { sisa: { decrement: d.nominal } } });
          if (kurang.count === 0) {
            throw bentrok("Sisa denda berubah saat disimpan. Tekan Hitung Gaji lagi lalu simpan.", undefined, "HASIL_USANG");
          }
          await tx.potonganDenda.create({ data: { perusahaanId: db.$perusahaanId, dendaId: d.dendaId, periodeId, nominal: d.nominal } });
        }
      }
    });
  } catch (galat) {
    if (galat instanceof SudahFinal) {
      const terbaru = await muatPeriode(db, periodeId);
      if (terbaru.status === "FINAL") return { sudahFinal: true, ...(await ringkasTersimpan(db, terbaru)) };
    }
    throw galat;
  }

  return { sudahFinal: false, ...(await ringkasTersimpan(db, { ...periode, status: "FINAL" })) };
}

/**
 * Membuka kembali periode final menjadi draf. Efek cicilan dikembalikan (sisa denda bertambah lagi) dan snapshot
 * dihapus. Hanya periode final paling akhir yang boleh dibuka, supaya urutan cicilan tidak kacau.
 */
export async function bukaKembali(db: DbPerusahaan, periodeId: string): Promise<PeriodeDto> {
  const periode = await muatPeriode(db, periodeId);
  if (periode.status !== "FINAL") throw bentrok("Periode ini masih berupa draf, jadi tidak perlu dibuka kembali.", undefined, "PERIODE_DRAF");

  const lebihBaru = await db.periode.findFirst({
    where: { status: "FINAL", tanggalAwal: { gt: keDate(periode.tanggalAwal) } },
    orderBy: { tanggalAwal: "asc" },
  });
  if (lebihBaru) {
    const label = labelPeriode({ tanggalAwal: dariDate(lebihBaru.tanggalAwal), tanggalAkhir: dariDate(lebihBaru.tanggalAkhir) });
    throw bentrok(
      `Periode ${label} yang lebih baru sudah final. Buka kembali periode terbaru lebih dulu, supaya cicilan denda tetap berurutan.`,
      { periodeId: lebihBaru.id },
      "PERIODE_LEBIH_BARU_FINAL",
    );
  }

  await db.$transaction(async (tx) => {
    const diubah = await tx.periode.updateMany({ where: { id: periodeId, status: "FINAL" }, data: { status: "DRAF", difinalkanPada: null } });
    if (diubah.count === 0) throw bentrok("Periode ini sudah dibuka kembali oleh pengguna lain. Muat ulang halaman.", undefined, "PERIODE_DRAF");
    const potongan = await tx.potonganDenda.findMany({ where: { periodeId } });
    for (const p of potongan) await tx.denda.update({ where: { id: p.dendaId }, data: { sisa: { increment: p.nominal } } });
    await tx.potonganDenda.deleteMany({ where: { periodeId } });
    await tx.hasilGaji.deleteMany({ where: { periodeId } });
  });
  return muatPeriode(db, periodeId);
}
