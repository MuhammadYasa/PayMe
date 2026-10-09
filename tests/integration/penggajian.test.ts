import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { hitungPeriode } from "@/domain/periode";
import { pengaturanSchema } from "@/domain/pengaturan";
import { keDate } from "@/server/db/tanggal";
import { catatKetidakhadiran, simpanCatatan } from "@/server/services/absensi";
import { buatDenda } from "@/server/services/denda";
import { simpanInsentif } from "@/server/services/insentif";
import { ambilHasilTersimpan, bukaKembali, hitungGajiPeriode, simpanFinal } from "@/server/services/penggajian";
import { simpanPendapatanCabang } from "@/server/services/pendapatan";
import { simpanPengaturan } from "@/server/services/pengaturan";
import { simpanPotonganLain } from "@/server/services/potongan-lain";
import { daftarPeriode } from "@/server/services/periode";
import { itemCatatanSkema, ketidakhadiranSkema } from "@/skema/absensi";
import { dendaSkema, pendapatanCabangSkema, simpanInsentifSkema, simpanPotonganLainSkema } from "@/skema/penghasilan";
import { lengkapiAbsensi } from "../support/absensi";
import { karyawanUji, periodeUji } from "../support/data";
import { buatPerusahaanUji, hapusPerusahaan } from "../support/db";

type Perusahaan = Awaited<ReturnType<typeof buatPerusahaanUji>>;

const PENGATURAN_KOSONG = pengaturanSchema.parse({
  hariKerjaMingguan: [1, 2, 3, 4, 5, 6],
  aturanPotongan: { izin: { mode: "tidak" }, sakit: { mode: "tidak" }, cuti: { mode: "tidak" }, lainnya: { mode: "tidak" } },
  tingkatBonus: [],
});

describe("penghitungan dan penyimpanan gaji (FR-15, FR-16)", () => {
  let p: Perusahaan;
  let lain: Perusahaan;
  let periodeId: string;
  let rentang: ReturnType<typeof hitungPeriode>;
  let budi: string;
  let ani: string;

  beforeAll(async () => {
    p = await buatPerusahaanUji("PT Gaji");
    lain = await buatPerusahaanUji("PT Lain");
    rentang = hitungPeriode("2025-04-01");
    periodeId = (await periodeUji(p.db, "2025-04-01")).id;
    budi = (await karyawanUji(p.db, "Budi Santoso", { gajiPokok: 4_000_000, tunjangan: 500_000, cabang: "Malang" })).id;
    ani = (await karyawanUji(p.db, "Ani Wijaya", { gajiPokok: 3_000_000, tunjangan: 0, cabang: "Malang" })).id;
    await karyawanUji(p.db, "Cici Lama", { statusAktif: false });
  });

  afterAll(async () => {
    await hapusPerusahaan(p.perusahaanId);
    await hapusPerusahaan(lain.perusahaanId);
  });

  beforeEach(async () => {
    await p.db.potonganDenda.deleteMany({});
    await p.db.hasilGaji.deleteMany({});
    await p.db.denda.deleteMany({});
    await p.db.insentif.deleteMany({});
    await p.db.potonganLain.deleteMany({});
    await p.db.pendapatanSales.deleteMany({});
    await p.db.pendapatanCabang.deleteMany({});
    await p.db.absensi.deleteMany({});
    await p.db.periode.updateMany({ data: { status: "DRAF", difinalkanPada: null } });
    await simpanPengaturan(p.db, PENGATURAN_KOSONG);
  });

  const lengkapi = () => lengkapiAbsensi(p.db, periodeId, [budi, ani], rentang);

  it("tertahan bila ada tanggal kosong, dengan pesan yang menyebut nama karyawan dan jumlah tanggal kosong", async () => {
    await lengkapiAbsensi(p.db, periodeId, [budi], rentang);
    await p.db.absensi.deleteMany({ where: { karyawanId: budi, tanggal: { in: ["2025-04-02", "2025-04-03", "2025-04-04"].map(keDate) } } });
    await lengkapiAbsensi(p.db, periodeId, [ani], rentang);
    const galat = await hitungGajiPeriode(p.db, periodeId).catch((e) => e);
    expect(galat).toMatchObject({ status: 409, kode: "ABSENSI_BELUM_LENGKAP" });
    expect(galat.message).toContain("Budi Santoso (3 tanggal kosong)");
    expect(galat.message).not.toContain("Ani Wijaya");
    expect(galat.data.karyawan).toEqual([expect.objectContaining({ nama: "Budi Santoso", jumlahKosong: 3 })]);
  });

  it("tertahan bila belum ada karyawan aktif", async () => {
    const pt = await buatPerusahaanUji("PT Kosong");
    try {
      const periode = await periodeUji(pt.db, "2025-04-01");
      await expect(hitungGajiPeriode(pt.db, periode.id)).rejects.toMatchObject({ kode: "TIDAK_ADA_KARYAWAN" });
    } finally {
      await hapusPerusahaan(pt.perusahaanId);
    }
  });

  it("tertahan bila selisih breakdown sales belum diakui, dan lanjut setelah diakui", async () => {
    await lengkapi();
    const masukan = (akui: boolean) =>
      pendapatanCabangSkema.parse({ cabang: "Malang", totalAktual: 10_000_000, akuiSelisih: akui, sales: [{ karyawanId: budi, nominal: 9_850_000, target: 0 }] });
    await simpanPendapatanCabang(p.db, periodeId, masukan(false));
    await expect(hitungGajiPeriode(p.db, periodeId)).rejects.toMatchObject({ kode: "SELISIH_BELUM_DIAKUI" });
    await simpanPendapatanCabang(p.db, periodeId, masukan(true));
    await expect(hitungGajiPeriode(p.db, periodeId)).resolves.toBeDefined();
  });

  it("gaji pokok 4.000.000, tunjangan 500.000, insentif 350.000, denda 100.000, asuransi 150.000 menghasilkan gaji bersih 4.600.000", async () => {
    await lengkapi();
    await simpanInsentif(p.db, periodeId, simpanInsentifSkema.parse({ items: [{ karyawanId: budi, entri: [{ jenis: "Pengiriman", nominal: 350_000 }] }] }));
    await buatDenda(p.db, periodeId, dendaSkema.parse({ karyawanId: budi, alasan: "Kerusakan barang", total: 100_000, jumlahCicilan: 1, mulai: "periode_ini" }));
    await simpanPotonganLain(p.db, periodeId, simpanPotonganLainSkema.parse({ items: [{ karyawanId: budi, pajak: null, asuransi: 150_000 }] }));

    const hasil = await hitungGajiPeriode(p.db, periodeId);
    const rincian = hasil.hasil.find((r) => r.karyawanId === budi)!;
    expect(rincian).toMatchObject({
      gajiPokok: 4_000_000,
      tunjangan: 500_000,
      insentif: { total: 350_000 },
      denda: { total: 100_000, rinci: [expect.objectContaining({ alasan: "Kerusakan barang", nominal: 100_000 })] },
      asuransi: 150_000,
      pajak: 0,
      potonganAbsensi: { total: 0 },
      totalPendapatan: 4_850_000,
      totalPotongan: 250_000,
      totalBersih: 4_600_000,
      nomorRekening: expect.stringMatching(/^\d{10}$/),
    });
    expect(hasil.hasil.find((r) => r.karyawanId === ani)?.totalBersih).toBe(3_000_000);
    expect(hasil.total.totalBersih).toBe(7_600_000);
  });

  it("karyawan nonaktif dikecualikan dari hasil", async () => {
    await lengkapi();
    const hasil = await hitungGajiPeriode(p.db, periodeId);
    expect(hasil.hasil.map((r) => r.namaLengkap).sort()).toEqual(["Ani Wijaya", "Budi Santoso"]);
  });

  it("potongan absensi mengikuti pengaturan perusahaan", async () => {
    await lengkapi();
    await simpanPengaturan(
      p.db,
      pengaturanSchema.parse({ ...PENGATURAN_KOSONG, aturanPotongan: { ...PENGATURAN_KOSONG.aturanPotongan, izin: { mode: "per_hari", nominal: 50_000 } } }),
    );
    await catatKetidakhadiran(
      p.db,
      periodeId,
      ketidakhadiranSkema.parse({ karyawanId: ani, jenis: "IZIN", dari: "2025-04-07", sampai: "2025-04-08", timpa: true }),
    );
    const rincian = (await hitungGajiPeriode(p.db, periodeId)).hasil.find((r) => r.karyawanId === ani)!;
    expect(rincian.potonganAbsensi).toMatchObject({ total: 100_000, rinci: [{ status: "izin", hari: 2, nominal: 100_000 }] });
    expect(rincian.totalBersih).toBe(2_900_000);
  });

  it("deterministik: data yang sama menghasilkan hasil dan sidik jari identik, dan perubahan data mengubah sidik jari", async () => {
    await lengkapi();
    const a = await hitungGajiPeriode(p.db, periodeId);
    const b = await hitungGajiPeriode(p.db, periodeId);
    expect(JSON.stringify(a.hasil)).toBe(JSON.stringify(b.hasil));
    expect(a.hash).toBe(b.hash);
    await simpanInsentif(p.db, periodeId, simpanInsentifSkema.parse({ items: [{ karyawanId: ani, entri: [{ jenis: "Lembur", nominal: 1000 }] }] }));
    expect((await hitungGajiPeriode(p.db, periodeId)).hash).not.toBe(a.hash);
  });

  it("peringatan untuk gaji bersih negatif, dan penyimpanan baru boleh setelah diakui", async () => {
    await lengkapi();
    await buatDenda(p.db, periodeId, dendaSkema.parse({ karyawanId: ani, alasan: "Selisih kas", total: 3_500_000, jumlahCicilan: 1, mulai: "periode_ini" }));
    const hasil = await hitungGajiPeriode(p.db, periodeId);
    const rincian = hasil.hasil.find((r) => r.karyawanId === ani)!;
    expect(rincian.totalBersih).toBe(-500_000);
    expect(rincian.peringatan).toHaveLength(1);
    expect(hasil.total.jumlahBermasalah).toBe(1);

    await expect(simpanFinal(p.db, periodeId, { hash: hasil.hash, akuiPeringatan: false })).rejects.toMatchObject({ kode: "PERINGATAN_BELUM_DIAKUI" });
    await expect(simpanFinal(p.db, periodeId, { hash: hasil.hash, akuiPeringatan: true })).resolves.toMatchObject({ sudahFinal: false });
    expect((await ambilHasilTersimpan(p.db, periodeId)).hasil.find((r) => r.karyawanId === ani)?.totalBersih).toBe(-500_000);
  });

  it("menyimpan memfinalkan periode, menyimpan snapshot, dan tampil di riwayat", async () => {
    await lengkapi();
    const hitung = await hitungGajiPeriode(p.db, periodeId);
    const hasil = await simpanFinal(p.db, periodeId, { hash: hitung.hash, akuiPeringatan: false });
    expect(hasil.sudahFinal).toBe(false);
    expect(hasil.periode.status).toBe("FINAL");
    expect(hasil.total.totalBersih).toBe(hitung.total.totalBersih);

    const riwayat = (await daftarPeriode(p.db)).find((r) => r.id === periodeId)!;
    expect(riwayat).toMatchObject({ status: "FINAL", jumlahKaryawan: 2, totalGaji: 7_500_000 });
  });

  it("rincian tersimpan tetap menampilkan gaji pokok lama walau profil karyawan diubah sesudahnya", async () => {
    await lengkapi();
    const hitung = await hitungGajiPeriode(p.db, periodeId);
    await simpanFinal(p.db, periodeId, { hash: hitung.hash, akuiPeringatan: false });

    await p.db.karyawan.update({ where: { id: budi }, data: { gajiPokok: 9_999_999, namaLengkap: "Nama Diubah", nomorRekening: "9999999999" } });
    try {
      const tersimpan = (await ambilHasilTersimpan(p.db, periodeId)).hasil.find((r) => r.karyawanId === budi)!;
      expect(tersimpan).toMatchObject({ gajiPokok: 4_000_000, namaLengkap: "Budi Santoso", totalBersih: 4_500_000 });
      expect(tersimpan.nomorRekening).not.toBe("9999999999");
    } finally {
      await p.db.karyawan.update({ where: { id: budi }, data: { gajiPokok: 4_000_000, namaLengkap: "Budi Santoso" } });
    }
  });

  it("periode final menolak perubahan absensi dan penghitungan ulang", async () => {
    await lengkapi();
    const hitung = await hitungGajiPeriode(p.db, periodeId);
    await simpanFinal(p.db, periodeId, { hash: hitung.hash, akuiPeringatan: false });
    await expect(
      simpanCatatan(p.db, periodeId, budi, { simpan: [itemCatatanSkema.parse({ tanggal: "2025-04-07", status: "SAKIT" })], hapus: [] }),
    ).rejects.toMatchObject({ kode: "PERIODE_FINAL" });
    await expect(hitungGajiPeriode(p.db, periodeId)).rejects.toMatchObject({ kode: "PERIODE_FINAL" });
  });

  it("hasil yang sudah usang (data berubah setelah dihitung) tidak dapat disimpan", async () => {
    await lengkapi();
    const hitung = await hitungGajiPeriode(p.db, periodeId);
    await simpanInsentif(p.db, periodeId, simpanInsentifSkema.parse({ items: [{ karyawanId: budi, entri: [{ jenis: "Bonus", nominal: 100_000 }] }] }));
    await expect(simpanFinal(p.db, periodeId, { hash: hitung.hash, akuiPeringatan: false })).rejects.toMatchObject({ kode: "HASIL_USANG" });
    expect((await daftarPeriode(p.db)).find((r) => r.id === periodeId)?.status).toBe("DRAF");
  });

  it("klik ganda dan dua penyimpanan serentak menghasilkan satu finalisasi yang konsisten (idempoten)", async () => {
    await lengkapi();
    await buatDenda(p.db, periodeId, dendaSkema.parse({ karyawanId: budi, alasan: "Uji", total: 90_000, jumlahCicilan: 3, mulai: "periode_ini" }));
    const hitung = await hitungGajiPeriode(p.db, periodeId);

    const hasil = await Promise.all([
      simpanFinal(p.db, periodeId, { hash: hitung.hash, akuiPeringatan: false }),
      simpanFinal(p.db, periodeId, { hash: hitung.hash, akuiPeringatan: false }),
    ]);
    expect(hasil.map((h) => h.sudahFinal).sort()).toEqual([false, true]);
    expect(await p.db.hasilGaji.count({ where: { periodeId } })).toBe(2);
    expect(await p.db.potonganDenda.count({ where: { periodeId } })).toBe(1);
    expect((await p.db.denda.findFirstOrThrow()).sisa).toBe(60_000);

    // Permintaan ketiga sesudahnya juga tidak mengubah apa pun.
    await expect(simpanFinal(p.db, periodeId, { hash: hitung.hash, akuiPeringatan: false })).resolves.toMatchObject({ sudahFinal: true });
    expect((await p.db.denda.findFirstOrThrow()).sisa).toBe(60_000);
  });

  it("gagal di tengah penyimpanan tidak meninggalkan data parsial (transaksi atomik)", async () => {
    await lengkapi();
    const dibuat = await buatDenda(p.db, periodeId, dendaSkema.parse({ karyawanId: budi, alasan: "Uji", total: 100_000, jumlahCicilan: 1, mulai: "periode_ini" }));
    const hitung = await hitungGajiPeriode(p.db, periodeId);
    // Baris sisa dengan kunci unik yang sama memaksa pembuatan HasilGaji gagal setelah status periode diubah.
    await p.db.hasilGaji.create({ data: { perusahaanId: p.perusahaanId, periodeId, karyawanId: ani, rincian: {}, totalBersih: 0 } });

    await expect(simpanFinal(p.db, periodeId, { hash: hitung.hash, akuiPeringatan: false })).rejects.toBeDefined();
    expect((await daftarPeriode(p.db)).find((r) => r.id === periodeId)?.status).toBe("DRAF");
    expect(await p.db.potonganDenda.count({ where: { periodeId } })).toBe(0);
    expect((await p.db.denda.findFirstOrThrow({ where: { id: dibuat.id } })).sisa).toBe(100_000);
    expect(await p.db.hasilGaji.count({ where: { periodeId } })).toBe(1);
  });

  it("perusahaan lain mendapat 404 untuk semua operasi penggajian", async () => {
    await lengkapi();
    await expect(hitungGajiPeriode(lain.db, periodeId)).rejects.toMatchObject({ status: 404 });
    await expect(simpanFinal(lain.db, periodeId, { hash: "a".repeat(64), akuiPeringatan: false })).rejects.toMatchObject({ status: 404 });
    await expect(ambilHasilTersimpan(lain.db, periodeId)).rejects.toMatchObject({ status: 404 });
    await expect(bukaKembali(lain.db, periodeId)).rejects.toMatchObject({ status: 404 });
  });
});

describe("siklus cicilan denda lintas periode (FR-14, FR-16)", () => {
  let p: Perusahaan;
  let budi: string;
  let dendaId: string;
  const periode: { id: string; rentang: ReturnType<typeof hitungPeriode> }[] = [];

  beforeAll(async () => {
    p = await buatPerusahaanUji("PT Cicilan");
    budi = (await karyawanUji(p.db, "Budi Santoso", { gajiPokok: 4_000_000, tunjangan: 0 })).id;
    for (const awal of ["2025-04-01", "2025-05-01", "2025-06-01", "2025-07-01"]) {
      const dibuat = await periodeUji(p.db, awal);
      const rentang = hitungPeriode(awal);
      await lengkapiAbsensi(p.db, dibuat.id, [budi], rentang);
      periode.push({ id: dibuat.id, rentang });
    }
    dendaId = (await buatDenda(p.db, periode[0].id, dendaSkema.parse({ karyawanId: budi, alasan: "Uji cicilan", total: 1_000_000, jumlahCicilan: 3, mulai: "periode_ini" }))).id;
  });

  afterAll(async () => hapusPerusahaan(p.perusahaanId));

  const sisa = async () => (await p.db.denda.findFirstOrThrow({ where: { id: dendaId } })).sisa;
  const potongan = async (indeks: number) => (await hitungGajiPeriode(p.db, periode[indeks].id)).hasil[0].denda.total;
  const finalkan = async (indeks: number) => {
    const hitung = await hitungGajiPeriode(p.db, periode[indeks].id);
    return simpanFinal(p.db, periode[indeks].id, { hash: hitung.hash, akuiPeringatan: false });
  };

  it("sisa hanya berkurang saat periode difinalkan, bukan saat pratinjau", async () => {
    for (let i = 0; i < 3; i++) expect(await potongan(0)).toBe(333_333);
    expect(await sisa()).toBe(1_000_000);
  });

  it("tiga periode final memotong 333.333, 333.333, 333.334 sampai lunas, lalu tidak ada potongan lagi", async () => {
    await finalkan(0);
    expect(await sisa()).toBe(666_667);
    expect(await potongan(1)).toBe(333_333);
    await finalkan(1);
    expect(await sisa()).toBe(333_334);
    expect(await potongan(2)).toBe(333_334);
    await finalkan(2);
    expect(await sisa()).toBe(0);
    expect(await potongan(3)).toBe(0);
  });

  it("gaji bersih setiap periode memuat potongan cicilan yang benar", async () => {
    const tersimpan = [0, 1, 2].map(async (i) => (await ambilHasilTersimpan(p.db, periode[i].id)).hasil[0]);
    const nilai = await Promise.all(tersimpan);
    expect(nilai.map((r) => r.denda.total)).toEqual([333_333, 333_333, 333_334]);
    expect(nilai.map((r) => r.totalBersih)).toEqual([3_666_667, 3_666_667, 3_666_666]);
  });

  it("tidak dapat membuka kembali periode lama selagi ada periode yang lebih baru final", async () => {
    await expect(bukaKembali(p.db, periode[0].id)).rejects.toMatchObject({ kode: "PERIODE_LEBIH_BARU_FINAL" });
    await expect(bukaKembali(p.db, periode[1].id)).rejects.toMatchObject({ kode: "PERIODE_LEBIH_BARU_FINAL" });
  });

  it("membuka kembali periode terbaru mengembalikan sisa denda dan menghapus snapshot, lalu hitung ulang memberi hasil yang sama", async () => {
    const dibuka = await bukaKembali(p.db, periode[2].id);
    expect(dibuka.status).toBe("DRAF");
    expect(await sisa()).toBe(333_334);
    expect(await p.db.potonganDenda.count({ where: { periodeId: periode[2].id } })).toBe(0);
    expect((await ambilHasilTersimpan(p.db, periode[2].id)).hasil).toEqual([]);
    expect(await potongan(2)).toBe(333_334);
  });

  it("membuka kembali satu periode lalu yang sebelumnya berurutan sampai awal mengembalikan seluruh sisa", async () => {
    await bukaKembali(p.db, periode[1].id);
    expect(await sisa()).toBe(666_667);
    await bukaKembali(p.db, periode[0].id);
    expect(await sisa()).toBe(1_000_000);
    await expect(bukaKembali(p.db, periode[0].id)).rejects.toMatchObject({ kode: "PERIODE_DRAF" });
  });

  it("periode yang dilewati tanpa gaji tidak memotong cicilan", async () => {
    await finalkan(0);
    // Periode kedua dilewati. Periode ketiga menjadi cicilan kedua.
    expect(await potongan(2)).toBe(333_333);
    await finalkan(2);
    expect(await sisa()).toBe(333_334);
    expect((await p.db.potonganDenda.findMany({ where: { dendaId } })).length).toBe(2);
  });
});

describe("kinerja penghitungan (FR-15)", () => {
  it("200 karyawan dengan absensi lengkap dihitung dalam 5 detik", async () => {
    const pt = await buatPerusahaanUji("PT Dua Ratus");
    try {
      const periode = await periodeUji(pt.db, "2025-04-01");
      const rentang = hitungPeriode("2025-04-01");
      await pt.db.karyawan.createMany({
        data: Array.from({ length: 200 }, (_, i) => ({
          perusahaanId: pt.perusahaanId,
          namaLengkap: `Karyawan ${i}`,
          namaKunci: `karyawan ${i}`,
          jabatan: "Staf",
          cabang: `Cabang ${i % 5}`,
          gajiPokok: 3_000_000 + i,
          tunjangan: 100_000,
          nomorRekening: String(5_000_000_000 + i),
        })),
      });
      const semua = (await pt.db.karyawan.findMany({ select: { id: true } })).map((k) => k.id);
      await lengkapiAbsensi(pt.db, periode.id, semua, rentang);

      const mulai = performance.now();
      const hasil = await hitungGajiPeriode(pt.db, periode.id);
      const durasi = performance.now() - mulai;

      expect(hasil.hasil).toHaveLength(200);
      expect(hasil.total.totalBersih).toBe(hasil.hasil.reduce((total, r) => total + r.totalBersih, 0));
      expect(durasi).toBeLessThan(5000);

      const simpanMulai = performance.now();
      await simpanFinal(pt.db, periode.id, { hash: hasil.hash, akuiPeringatan: false });
      expect(performance.now() - simpanMulai).toBeLessThan(5000);
      expect(await pt.db.hasilGaji.count()).toBe(200);
    } finally {
      await hapusPerusahaan(pt.perusahaanId);
    }
  }, 90_000);
});
