import "server-only";
import { DURASI_BLOKIR_MENIT, MAKS_PERCOBAAN_GAGAL } from "@/domain/batas";
import { kunciNama } from "@/domain/nama";
import { type RincianGaji } from "@/domain/gaji";
import { labelPeriode } from "@/domain/periode";
import { prisma } from "@/server/db/client";
import { dariDate } from "@/server/db/tanggal";
import { AppError, terlaluBanyakPercobaan } from "@/server/errors";
import { hmacHex, samarkanRekening } from "@/server/kripto";
import { log } from "@/server/log";
import { type AturanBatas, ambilJatahSemua, resetJatah } from "@/server/pembatas";

export const PESAN_TIDAK_DITEMUKAN = "Data tidak ditemukan. Periksa kembali nama dan nomor rekening Anda.";
export const PESAN_TERLALU_BANYAK = `Terlalu banyak percobaan. Coba lagi dalam ${DURASI_BLOKIR_MENIT} menit.`;

const WAKTU_MINIMUM_MS = 450;
const MAKS_PERIODE_DITAMPILKAN = 12;

export interface RincianPublik {
  absensi: RincianGaji["absensi"];
  gajiPokok: number;
  tunjangan: number;
  insentif: { total: number; rinci: { jenis: string; nominal: number }[] };
  bonusTarget: number;
  potonganAbsensi: { total: number; rinci: { status: string; hari: number; nominal: number }[] };
  denda: { total: number; rinci: { alasan: string; nominal: number }[] };
  pajak: number;
  asuransi: number;
  totalPendapatan: number;
  totalPotongan: number;
  totalBersih: number;
}

export interface GajiPublik {
  nama: string;
  jabatan: string;
  cabang: string;
  perusahaan: string;
  rekeningSamar: string;
  periode: { tanggalAwal: string; tanggalAkhir: string; label: string; rincian: RincianPublik }[];
}

/**
 * Titik pemasangan faktor verifikasi tambahan, misalnya PIN atau tanggal lahir. Belum dipakai: PRD menyebutnya
 * sebagai usulan, bukan kebutuhan. Menambahkan faktor cukup dengan mengisi daftar ini dan satu kolom isian.
 */
export type FaktorVerifikasi = (kandidat: { id: string }, masukan: { nama: string; rekening: string }) => Promise<boolean>;
const FAKTOR_TAMBAHAN: FaktorVerifikasi[] = [];

/** Hanya data yang memang boleh dilihat karyawan: tanpa ID internal dan tanpa nomor rekening utuh. */
export function keRincianPublik(r: RincianGaji): RincianPublik {
  return {
    absensi: r.absensi,
    gajiPokok: r.gajiPokok,
    tunjangan: r.tunjangan,
    insentif: { total: r.insentif.total, rinci: r.insentif.rinci },
    bonusTarget: r.bonusTarget.bonus,
    potonganAbsensi: r.potonganAbsensi,
    denda: { total: r.denda.total, rinci: r.denda.rinci.map((d) => ({ alasan: d.alasan, nominal: d.nominal })) },
    pajak: r.pajak,
    asuransi: r.asuransi,
    totalPendapatan: r.totalPendapatan,
    totalPotongan: r.totalPotongan,
    totalBersih: r.totalBersih,
  };
}

/**
 * Batas percobaan: per perangkat dan per IP (bila IP tepercaya diketahui) lima kali berturut-turut, ditambah pagar per
 * nama terhadap tebakan terdistribusi walau IP dan perangkat berganti-ganti. Hanya batas perangkat dan IP yang
 * direset saat berhasil, karena yang dihitung adalah kegagalan berturut-turut dari sumber yang sama.
 */
export function aturanBatasPublik(args: { namaKunci: string; perangkat: string; ip: string | null }): { semua: AturanBatas[]; direset: string[] } {
  const perangkat: AturanBatas = {
    kunci: hmacHex(`publik:perangkat:${args.perangkat}`),
    batas: MAKS_PERCOBAAN_GAGAL,
    jendelaMenit: DURASI_BLOKIR_MENIT,
    blokirMenit: DURASI_BLOKIR_MENIT,
  };
  const nama: AturanBatas = { kunci: hmacHex(`publik:nama:${args.namaKunci}`), batas: 30, jendelaMenit: 60, blokirMenit: DURASI_BLOKIR_MENIT };
  const ip: AturanBatas | null = args.ip
    ? { kunci: hmacHex(`publik:ip:${args.ip}`), batas: MAKS_PERCOBAAN_GAGAL, jendelaMenit: DURASI_BLOKIR_MENIT, blokirMenit: DURASI_BLOKIR_MENIT }
    : null;
  return { semua: ip ? [perangkat, ip, nama] : [perangkat, nama], direset: ip ? [perangkat.kunci, ip.kunci] : [perangkat.kunci] };
}

async function samakanWaktu(mulai: number, minimumMs: number): Promise<void> {
  const sisa = minimumMs - (performance.now() - mulai);
  if (sisa > 0) await new Promise((selesai) => setTimeout(selesai, sisa));
}

function gagal(): AppError {
  return new AppError(404, PESAN_TIDAK_DITEMUKAN, { kode: "TIDAK_DITEMUKAN_PUBLIK" });
}

/**
 * Halaman karyawan (FR-19): nama lengkap dan nomor rekening harus cocok dengan satu karyawan. Jatah percobaan diambil
 * sebelum pencocokan; setiap kegagalan menjawab pesan yang sama dan butuh waktu yang sama. Pencarian ini sengaja
 * lintas perusahaan karena pengunjung tidak dikenali perusahaannya; hanya periode final yang pernah ditampilkan.
 */
export async function lihatGajiKaryawan(
  masukan: { nama: string; rekening: string; ip: string | null; perangkat: string },
  opsi: { sekarang?: Date; waktuMinimumMs?: number } = {},
): Promise<GajiPublik> {
  const mulai = performance.now();
  const minimum = opsi.waktuMinimumMs ?? WAKTU_MINIMUM_MS;
  const rekening = masukan.rekening.replace(/\s+/g, "");
  const kunci = kunciNama(masukan.nama);

  try {
    const aturan = aturanBatasPublik({ namaKunci: kunci, perangkat: masukan.perangkat, ip: masukan.ip });
    const jatah = await ambilJatahSemua(aturan.semua, opsi.sekarang);
    if (!jatah.diizinkan) throw terlaluBanyakPercobaan(PESAN_TERLALU_BANYAK, jatah.sisaDetik);

    const kandidat = await prisma().karyawan.findMany({
      where: { namaKunci: kunci, nomorRekening: rekening },
      select: { id: true, namaLengkap: true, jabatan: true, cabang: true, nomorRekening: true, perusahaan: { select: { nama: true } } },
      take: 3,
    });

    if (kandidat.length > 1) {
      // Nama dan rekening sama di lebih dari satu perusahaan: tidak bisa dipastikan, jadi ditolak dan dicatat untuk ditinjau.
      await prisma().catatanTinjauan.create({
        data: { jenis: "NAMA_REKENING_GANDA_LINTAS_PERUSAHAAN", detail: { namaKunci: kunci, rekening: samarkanRekening(rekening), jumlah: kandidat.length } },
      });
      throw gagal();
    }
    const karyawan = kandidat[0];
    if (!karyawan) {
      log.warn("lihat_gaji_gagal", { nomorRekening: rekening });
      throw gagal();
    }
    for (const faktor of FAKTOR_TAMBAHAN) {
      if (!(await faktor({ id: karyawan.id }, { nama: masukan.nama, rekening }))) throw gagal();
    }

    const baris = await prisma().hasilGaji.findMany({
      where: { karyawanId: karyawan.id, periode: { status: "FINAL" } },
      include: { periode: { select: { tanggalAwal: true, tanggalAkhir: true } } },
      orderBy: { periode: { tanggalAwal: "desc" } },
      take: MAKS_PERIODE_DITAMPILKAN,
    });

    await resetJatah(aturan.direset);
    return {
      nama: karyawan.namaLengkap,
      jabatan: karyawan.jabatan,
      cabang: karyawan.cabang,
      perusahaan: karyawan.perusahaan.nama,
      rekeningSamar: samarkanRekening(karyawan.nomorRekening),
      periode: baris.map((b) => {
        const rentang = { tanggalAwal: dariDate(b.periode.tanggalAwal), tanggalAkhir: dariDate(b.periode.tanggalAkhir) };
        return { ...rentang, label: labelPeriode(rentang), rincian: keRincianPublik(b.rincian as unknown as RincianGaji) };
      }),
    };
  } finally {
    await samakanWaktu(mulai, minimum);
  }
}
