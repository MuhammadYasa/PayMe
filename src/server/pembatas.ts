import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "./db/client";

export interface AturanBatas {
  /** Kunci yang sudah di-hash (jangan menyimpan IP atau email mentah). */
  kunci: string;
  /** Jumlah percobaan yang masih diizinkan dalam satu jendela. */
  batas: number;
  jendelaMenit: number;
  blokirMenit: number;
}

export interface HasilBatas {
  diizinkan: boolean;
  sisaDetik: number;
}

const MENIT = 60_000;

/**
 * Mengambil satu jatah percobaan secara atomik (satu pernyataan SQL), sebelum kredensial diperiksa.
 * Karena jatah diambil di depan, ratusan permintaan paralel pun hanya memperoleh `batas` jatah;
 * sisanya langsung ditolak tanpa sempat menguji tebakan. Percobaan ke-(batas+1) memulai blokir.
 */
export async function ambilJatah(aturan: AturanBatas, sekarang: Date = new Date()): Promise<HasilBatas> {
  const awalJendela = new Date(sekarang.getTime() - aturan.jendelaMenit * MENIT);

  const baris = await prisma().$queryRaw<{ jumlah_gagal: number; diblokir_sampai: Date | null }[]>(Prisma.sql`
    INSERT INTO percobaan_publik AS p (id, kunci, jumlah_gagal, jendela_mulai, diblokir_sampai)
    VALUES (gen_random_uuid(), ${aturan.kunci}, 1, ${sekarang}::timestamptz, NULL)
    ON CONFLICT (kunci) DO UPDATE SET
      jumlah_gagal = CASE
        WHEN p.diblokir_sampai > ${sekarang}::timestamptz THEN p.jumlah_gagal
        WHEN p.jendela_mulai <= ${awalJendela}::timestamptz OR p.diblokir_sampai IS NOT NULL THEN 1
        ELSE p.jumlah_gagal + 1
      END,
      jendela_mulai = CASE
        WHEN p.diblokir_sampai > ${sekarang}::timestamptz THEN p.jendela_mulai
        WHEN p.jendela_mulai <= ${awalJendela}::timestamptz OR p.diblokir_sampai IS NOT NULL THEN ${sekarang}::timestamptz
        ELSE p.jendela_mulai
      END,
      diblokir_sampai = CASE
        WHEN p.diblokir_sampai > ${sekarang}::timestamptz THEN p.diblokir_sampai
        ELSE NULL
      END
    RETURNING p.jumlah_gagal, p.diblokir_sampai
  `);

  const { jumlah_gagal: jumlah, diblokir_sampai: blokirAktif } = baris[0];

  if (blokirAktif && blokirAktif.getTime() > sekarang.getTime()) {
    return { diizinkan: false, sisaDetik: Math.ceil((blokirAktif.getTime() - sekarang.getTime()) / 1000) };
  }

  if (jumlah > aturan.batas) {
    const sampai = new Date(sekarang.getTime() + aturan.blokirMenit * MENIT);
    await prisma().$executeRaw(
      Prisma.sql`UPDATE percobaan_publik SET diblokir_sampai = ${sampai}::timestamptz WHERE kunci = ${aturan.kunci}`,
    );
    return { diizinkan: false, sisaDetik: aturan.blokirMenit * 60 };
  }

  return { diizinkan: true, sisaDetik: 0 };
}

/** Semua aturan harus lolos. Jatah diambil dari setiap kunci, juga bila salah satunya sudah menolak. */
export async function ambilJatahSemua(aturan: readonly AturanBatas[], sekarang: Date = new Date()): Promise<HasilBatas> {
  const hasil = await Promise.all(aturan.map((a) => ambilJatah(a, sekarang)));
  return {
    diizinkan: hasil.every((h) => h.diizinkan),
    sisaDetik: Math.max(0, ...hasil.map((h) => h.sisaDetik)),
  };
}

const SIMPAN_SETELAH_JENDELA_MS = 24 * 60 * MENIT;

/**
 * Menghapus baris yang sudah tidak berpengaruh: jendelanya berakhir lebih dari sehari lalu dan blokirnya (bila ada)
 * sudah selesai. Tanpa ini, setiap email atau nama acak yang pernah dicoba meninggalkan satu baris selamanya, sebab
 * baris hanya dihapus saat percobaan berhasil.
 */
export async function bersihkanKedaluwarsa(sekarang: Date = new Date()): Promise<number> {
  const batasJendela = new Date(sekarang.getTime() - SIMPAN_SETELAH_JENDELA_MS);
  const hasil = await prisma().percobaanPublik.deleteMany({
    where: { jendelaMulai: { lt: batasJendela }, OR: [{ diblokirSampai: null }, { diblokirSampai: { lt: sekarang } }] },
  });
  return hasil.count;
}

/** Dipanggil setelah percobaan berhasil, sehingga hitungannya benar-benar "gagal berturut-turut". */
export async function resetJatah(kunci: readonly string[]): Promise<void> {
  if (kunci.length === 0) return;
  await prisma().percobaanPublik.deleteMany({ where: { kunci: { in: [...kunci] } } });
}
