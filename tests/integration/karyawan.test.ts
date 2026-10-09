import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { karyawanSkema } from "@/skema/karyawan";
import { keDate } from "@/server/db/tanggal";
import { AppError } from "@/server/errors";
import { buatKaryawan, daftarKaryawan, hapusKaryawan, ubahKaryawan, ambilKaryawan } from "@/server/services/karyawan";
import { buatPerusahaanUji, hapusPerusahaan } from "../support/db";

type Perusahaan = Awaited<ReturnType<typeof buatPerusahaanUji>>;

function masukan(ubah: Record<string, unknown> = {}) {
  return karyawanSkema.parse({
    namaLengkap: "Budi Santoso",
    jabatan: "Staf Gudang",
    cabang: "Surabaya",
    gajiPokok: 4_000_000,
    tunjangan: 500_000,
    nomorRekening: "0012345678",
    ...ubah,
  });
}

function pesanKolom(data: Record<string, unknown>, kolom: string): string | undefined {
  const hasil = karyawanSkema.safeParse(data);
  if (hasil.success) return undefined;
  return hasil.error.issues.find((i) => i.path[0] === kolom)?.message;
}

const dasar = { namaLengkap: "Budi", jabatan: "Staf", cabang: "Surabaya", gajiPokok: 1_000_000, nomorRekening: "1234567890" };

describe("validasi karyawan (FR-02)", () => {
  it("gaji pokok kosong atau 0 ditolak dengan pesan pada field tersebut", () => {
    expect(pesanKolom({ ...dasar, gajiPokok: 0 }, "gajiPokok")).toMatch(/lebih dari 0/);
    expect(pesanKolom({ ...dasar, gajiPokok: undefined }, "gajiPokok")).toMatch(/Isi gaji pokok/);
    expect(pesanKolom({ ...dasar, gajiPokok: -5 }, "gajiPokok")).toMatch(/lebih dari 0/);
  });

  it('nomor rekening berisi huruf ditolak dengan pesan "Nomor rekening hanya boleh berisi angka."', () => {
    expect(pesanKolom({ ...dasar, nomorRekening: "12345abc90" }, "nomorRekening")).toBe("Nomor rekening hanya boleh berisi angka.");
    expect(pesanKolom({ ...dasar, nomorRekening: "1234-5678" }, "nomorRekening")).toBe("Nomor rekening hanya boleh berisi angka.");
  });

  it("nomor rekening harus 6 sampai 20 digit", () => {
    expect(pesanKolom({ ...dasar, nomorRekening: "12345" }, "nomorRekening")).toMatch(/6 sampai 20 digit/);
    expect(pesanKolom({ ...dasar, nomorRekening: "1".repeat(21) }, "nomorRekening")).toMatch(/6 sampai 20 digit/);
    expect(pesanKolom({ ...dasar, nomorRekening: "123456" }, "nomorRekening")).toBeUndefined();
    expect(pesanKolom({ ...dasar, nomorRekening: "1".repeat(20) }, "nomorRekening")).toBeUndefined();
  });

  it("hanya melaporkan satu pesan rekening yang paling relevan", () => {
    const hasil = karyawanSkema.safeParse({ ...dasar, nomorRekening: "abc" });
    expect(hasil.success).toBe(false);
    if (!hasil.success) expect(hasil.error.issues.filter((i) => i.path[0] === "nomorRekening")).toHaveLength(1);
  });

  it("spasi pada nomor rekening dibuang dan spasi ganda pada nama dirapikan", () => {
    const hasil = karyawanSkema.parse({ ...dasar, namaLengkap: "  Siti   Nur  Aini ", nomorRekening: "123 456 7890" });
    expect(hasil.namaLengkap).toBe("Siti Nur Aini");
    expect(hasil.nomorRekening).toBe("1234567890");
    expect(hasil.tunjangan).toBe(0);
    expect(hasil.statusAktif).toBe(true);
  });

  it("field wajib yang kosong menghasilkan pesan berisi langkah perbaikan", () => {
    for (const kolom of ["namaLengkap", "jabatan", "cabang"] as const) {
      expect(pesanKolom({ ...dasar, [kolom]: "   " }, kolom)).toMatch(/^Isi /);
    }
  });
});

describe("CRUD karyawan (FR-02)", () => {
  let p: Perusahaan;
  let lain: Perusahaan;

  beforeAll(async () => {
    p = await buatPerusahaanUji("PT Karyawan");
    lain = await buatPerusahaanUji("PT Lain");
  });
  afterAll(async () => {
    await hapusPerusahaan(p.perusahaanId);
    await hapusPerusahaan(lain.perusahaanId);
  });

  it("karyawan baru muncul di daftar dan nomor rekening berawalan nol tetap sebagai teks", async () => {
    const dibuat = await buatKaryawan(p.db, masukan());
    expect(dibuat.nomorRekening).toBe("0012345678");
    const { karyawan } = await daftarKaryawan(p.db);
    expect(karyawan.find((k) => k.id === dibuat.id)?.nomorRekening).toBe("0012345678");
  });

  it("nama ganda dengan rekening berbeda diizinkan, nama dan rekening yang sama ditolak", async () => {
    await buatKaryawan(p.db, masukan({ namaLengkap: "Ani Wijaya", nomorRekening: "1000000001" }));
    await expect(buatKaryawan(p.db, masukan({ namaLengkap: "Ani Wijaya", nomorRekening: "1000000002" }))).resolves.toBeDefined();
    await expect(buatKaryawan(p.db, masukan({ namaLengkap: "Ani Wijaya", nomorRekening: "1000000001" }))).rejects.toMatchObject({
      status: 409,
      kode: "KARYAWAN_GANDA",
    });
  });

  it("keunikan tidak peka huruf besar-kecil dan spasi ganda", async () => {
    await buatKaryawan(p.db, masukan({ namaLengkap: "Candra Putra", nomorRekening: "2000000001" }));
    await expect(
      buatKaryawan(p.db, masukan({ namaLengkap: "  CANDRA   putra ", nomorRekening: "2000000001" })),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("nama dan rekening yang sama boleh ada di perusahaan lain", async () => {
    await buatKaryawan(p.db, masukan({ namaLengkap: "Dewi Lestari", nomorRekening: "3000000001" }));
    await expect(
      buatKaryawan(lain.db, masukan({ namaLengkap: "Dewi Lestari", nomorRekening: "3000000001" })),
    ).resolves.toBeDefined();
  });

  it("mengubah data tersimpan, dan keunikan tetap dijaga saat mengubah", async () => {
    const a = await buatKaryawan(p.db, masukan({ namaLengkap: "Eko Prasetyo", nomorRekening: "4000000001" }));
    await buatKaryawan(p.db, masukan({ namaLengkap: "Fajar Nugroho", nomorRekening: "4000000002" }));
    const diubah = await ubahKaryawan(p.db, a.id, masukan({ namaLengkap: "Eko Prasetyo", nomorRekening: "4000000001", gajiPokok: 5_500_000 }));
    expect(diubah.gajiPokok).toBe(5_500_000);
    await expect(
      ubahKaryawan(p.db, a.id, masukan({ namaLengkap: "Fajar Nugroho", nomorRekening: "4000000002" })),
    ).rejects.toMatchObject({ kode: "KARYAWAN_GANDA" });
  });

  it("pencarian nama dan filter cabang bekerja bersama", async () => {
    await buatKaryawan(p.db, masukan({ namaLengkap: "Gita Anjani", cabang: "Malang", nomorRekening: "5000000001" }));
    await buatKaryawan(p.db, masukan({ namaLengkap: "Gita Permata", cabang: "Surabaya", nomorRekening: "5000000002" }));
    const semuaGita = await daftarKaryawan(p.db, { cari: "gita" });
    expect(semuaGita.karyawan.length).toBe(2);
    const gitaMalang = await daftarKaryawan(p.db, { cari: "GITA", cabang: "Malang" });
    expect(gitaMalang.karyawan.map((k) => k.namaLengkap)).toEqual(["Gita Anjani"]);
    expect(semuaGita.daftarCabang).toEqual(expect.arrayContaining(["Malang", "Surabaya"]));
  });

  it("pencarian menganggap titik sebagai spasi seperti pada nama dari mesin finger", async () => {
    await buatKaryawan(p.db, masukan({ namaLengkap: "Hadi Kurniawan", nomorRekening: "6000000001" }));
    const hasil = await daftarKaryawan(p.db, { cari: "Hadi.Kurniawan" });
    expect(hasil.karyawan.map((k) => k.namaLengkap)).toEqual(["Hadi Kurniawan"]);
  });

  it("akun perusahaan lain menerima 404 saat meminta, mengubah, atau menghapus karyawan lewat ID", async () => {
    const milikP = await buatKaryawan(p.db, masukan({ namaLengkap: "Indra Gunawan", nomorRekening: "7000000001" }));
    await expect(ambilKaryawan(lain.db, milikP.id)).rejects.toMatchObject({ status: 404 });
    await expect(ubahKaryawan(lain.db, milikP.id, masukan())).rejects.toMatchObject({ status: 404 });
    await expect(hapusKaryawan(lain.db, milikP.id)).rejects.toMatchObject({ status: 404 });
    expect((await ambilKaryawan(p.db, milikP.id)).namaLengkap).toBe("Indra Gunawan");
  });

  it("karyawan tanpa riwayat dihapus permanen", async () => {
    const k = await buatKaryawan(p.db, masukan({ namaLengkap: "Joko Susilo", nomorRekening: "8000000001" }));
    expect(await hapusKaryawan(p.db, k.id)).toEqual({ hasil: "dihapus" });
    await expect(ambilKaryawan(p.db, k.id)).rejects.toMatchObject({ status: 404 });
  });

  it("karyawan yang sudah punya hasil gaji dinonaktifkan dan riwayatnya tetap utuh", async () => {
    const k = await buatKaryawan(p.db, masukan({ namaLengkap: "Kartika Sari", nomorRekening: "9000000001" }));
    const periode = await p.db.periode.create({
      data: { perusahaanId: p.perusahaanId, tanggalAwal: keDate("2024-05-01"), tanggalAkhir: keDate("2024-05-31"), status: "FINAL" },
    });
    await p.db.hasilGaji.create({
      data: { perusahaanId: p.perusahaanId, periodeId: periode.id, karyawanId: k.id, rincian: { gajiPokok: 4_000_000 }, totalBersih: 4_000_000 },
    });

    expect(await hapusKaryawan(p.db, k.id)).toEqual({ hasil: "dinonaktifkan" });
    expect((await ambilKaryawan(p.db, k.id)).statusAktif).toBe(false);
    expect(await p.db.hasilGaji.count({ where: { karyawanId: k.id } })).toBe(1);
  });

  it("menghapus karyawan ikut membersihkan isian drafnya", async () => {
    const k = await buatKaryawan(p.db, masukan({ namaLengkap: "Lina Marlina", nomorRekening: "9100000001" }));
    const pid = p.perusahaanId;
    const periode = await p.db.periode.create({
      data: { perusahaanId: pid, tanggalAwal: keDate("2024-07-01"), tanggalAkhir: keDate("2024-07-31") },
    });
    await p.db.absensi.create({
      data: { perusahaanId: pid, periodeId: periode.id, karyawanId: k.id, tanggal: keDate("2024-07-02"), status: "HADIR" },
    });
    await p.db.insentif.create({
      data: { perusahaanId: pid, periodeId: periode.id, karyawanId: k.id, jenis: "pengiriman", nominal: 100_000 },
    });
    await p.db.denda.create({
      data: { perusahaanId: pid, karyawanId: k.id, alasan: "Uji", total: 100_000, jumlahCicilan: 1, sisa: 100_000, tanggalMulai: keDate("2024-07-01") },
    });

    expect(await hapusKaryawan(p.db, k.id)).toEqual({ hasil: "dihapus" });
    expect(await p.db.absensi.count({ where: { karyawanId: k.id } })).toBe(0);
    expect(await p.db.denda.count({ where: { karyawanId: k.id } })).toBe(0);
  });

  it("daftar memuat 200 karyawan dengan cepat (FR-02: tampil dalam 2 detik)", async () => {
    const pt = await buatPerusahaanUji("PT Banyak");
    try {
      await pt.db.karyawan.createMany({
        data: Array.from({ length: 200 }, (_, i) => ({
          perusahaanId: pt.perusahaanId,
          namaLengkap: `Karyawan ${i}`,
          namaKunci: `karyawan ${i}`,
          jabatan: "Staf",
          cabang: `Cabang ${i % 5}`,
          gajiPokok: 3_000_000,
          nomorRekening: String(1_000_000_000 + i),
        })),
      });
      const mulai = performance.now();
      const { karyawan } = await daftarKaryawan(pt.db);
      expect(karyawan).toHaveLength(200);
      expect(performance.now() - mulai).toBeLessThan(2000);
    } finally {
      await hapusPerusahaan(pt.perusahaanId);
    }
  });
});
