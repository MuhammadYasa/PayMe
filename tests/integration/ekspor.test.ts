import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { type InputGaji, type RincianGaji, hitungGaji, jumlahkanGaji } from "@/domain/gaji";
import { PENGATURAN_BAWAAN } from "@/domain/pengaturan";
import { amankanSelTeks, buatBerkasGaji, namaBerkasGaji } from "@/server/excel/ekspor-gaji";

const PERIODE = { tanggalAwal: "2026-08-24", tanggalAkhir: "2026-09-23" };

function rincian(indeks: number, ubah: Partial<InputGaji["karyawan"]> = {}, ekstra: Partial<InputGaji> = {}): RincianGaji {
  return hitungGaji({
    karyawan: {
      id: `k-${indeks}`,
      namaLengkap: `Karyawan ${indeks}`,
      jabatan: "Staf",
      cabang: `Cabang ${indeks % 3}`,
      nomorRekening: String(1_000_000_000 + indeks),
      gajiPokok: 3_000_000 + indeks * 1_000,
      tunjangan: 250_000,
      ...ubah,
    },
    absensi: { hariKerja: 27, hadir: 27, izin: 0, sakit: 0, cuti: 0, lainnya: 0, totalLibur: 4 },
    aturanPotongan: PENGATURAN_BAWAAN.aturanPotongan,
    insentif: [{ jenis: "Pengiriman", nominal: 10_000 * (indeks % 5) }],
    bonusTarget: null,
    denda: [],
    pajak: 5_000,
    asuransi: 15_000,
    ...ekstra,
  });
}

async function baca(buffer: Buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as Parameters<typeof wb.xlsx.load>[0]);
  return wb.getWorksheet("Gaji")!;
}

const BARIS_HEADER = 4;

describe("ekspor hasil penggajian ke Excel (FR-17)", () => {
  it("nama berkas mengikuti PayMe_<tanggal-awal>_<tanggal-akhir>.xlsx", () => {
    expect(namaBerkasGaji(PERIODE)).toBe("PayMe_2026-08-24_2026-09-23.xlsx");
  });

  it("memuat judul, periode, dan baris header yang dibekukan", async () => {
    const ws = await baca(await buatBerkasGaji(PERIODE, [rincian(1)]));
    expect(ws.getCell("A1").value).toBe("Rekap Gaji Karyawan");
    expect(ws.getCell("A2").value).toBe("Periode: 24 Agu 2026 sampai 23 Sep 2026");
    expect(ws.getRow(BARIS_HEADER).getCell(1).value).toBe("Nama");
    expect(ws.getRow(BARIS_HEADER).getCell(21).value).toBe("Gaji Bersih");
    expect(ws.views[0]).toMatchObject({ state: "frozen", ySplit: BARIS_HEADER });
  });

  it("nomor rekening berawalan nol ditulis sebagai teks sehingga angka nol tidak hilang", async () => {
    const ws = await baca(await buatBerkasGaji(PERIODE, [rincian(1, { nomorRekening: "0012345678" })]));
    const sel = ws.getRow(BARIS_HEADER + 1).getCell(4);
    expect(sel.value).toBe("0012345678");
    expect(typeof sel.value).toBe("string");
    expect(sel.numFmt).toBe("@");
  });

  it("nominal ditulis sebagai angka, bukan teks", async () => {
    const ws = await baca(await buatBerkasGaji(PERIODE, [rincian(2)]));
    const baris = ws.getRow(BARIS_HEADER + 1);
    for (const kolom of [11, 12, 13, 19, 20, 21]) expect(typeof baris.getCell(kolom).value).toBe("number");
  });

  it("jumlah setiap kolom pada baris total sama dengan penjumlahan baris dan dengan angka di layar", async () => {
    const hasil = Array.from({ length: 12 }, (_, i) => rincian(i));
    const ws = await baca(await buatBerkasGaji(PERIODE, hasil));
    const layar = jumlahkanGaji(hasil);
    const barisTotal = ws.getRow(BARIS_HEADER + 1 + hasil.length);

    expect(barisTotal.getCell(1).value).toBe("TOTAL");
    for (const kolom of [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]) {
      let jumlah = 0;
      for (let n = BARIS_HEADER + 1; n <= BARIS_HEADER + hasil.length; n++) jumlah += Number(ws.getRow(n).getCell(kolom).value);
      expect(barisTotal.getCell(kolom).value).toBe(jumlah);
    }
    expect(barisTotal.getCell(11).value).toBe(layar.gajiPokok);
    expect(barisTotal.getCell(13).value).toBe(layar.insentif);
    expect(barisTotal.getCell(19).value).toBe(layar.totalPendapatan);
    expect(barisTotal.getCell(21).value).toBe(layar.totalBersih);
  });

  it("nilai yang diawali = + - @ diberi awalan apostrof agar tidak dibaca sebagai rumus", async () => {
    expect(amankanSelTeks("=SUM(A1:A9)")).toBe("'=SUM(A1:A9)");
    expect(amankanSelTeks("+62 812")).toBe("'+62 812");
    expect(amankanSelTeks("-Budi")).toBe("'-Budi");
    expect(amankanSelTeks("@sales")).toBe("'@sales");
    expect(amankanSelTeks("Budi")).toBe("Budi");
    expect(amankanSelTeks("Budi=1")).toBe("Budi=1");

    const ws = await baca(
      await buatBerkasGaji(PERIODE, [rincian(1, { namaLengkap: '=HYPERLINK("http://contoh.test","klik")', jabatan: "+cmd", cabang: "@cabang" })]),
    );
    const baris = ws.getRow(BARIS_HEADER + 1);
    expect(baris.getCell(1).value).toBe(`'=HYPERLINK("http://contoh.test","klik")`);
    expect(baris.getCell(2).value).toBe("'+cmd");
    expect(baris.getCell(3).value).toBe("'@cabang");
    expect(typeof baris.getCell(1).value).toBe("string");
  });

  it("nama berisi karakter khusus tetap utuh", async () => {
    const nama = `Ahmad "Dodi" O'Brien & Putra <Sales> / Ñandú`;
    const ws = await baca(await buatBerkasGaji(PERIODE, [rincian(1, { namaLengkap: nama })]));
    expect(ws.getRow(BARIS_HEADER + 1).getCell(1).value).toBe(nama);
  });

  it("karyawan dengan gaji bersih negatif diberi catatan", async () => {
    const negatif = rincian(1, { gajiPokok: 1_000_000, tunjangan: 0 }, { denda: [{ dendaId: "d", alasan: "Kas", nominal: 2_000_000 }], insentif: [] });
    const ws = await baca(await buatBerkasGaji(PERIODE, [negatif]));
    expect(ws.getRow(BARIS_HEADER + 1).getCell(21).value).toBeLessThan(0);
    expect(String(ws.getRow(BARIS_HEADER + 1).getCell(22).value)).toContain("negatif");
  });

  it("berkas untuk 200 karyawan selesai dibuat dalam 5 detik", async () => {
    const hasil = Array.from({ length: 200 }, (_, i) => rincian(i));
    const mulai = performance.now();
    const isi = await buatBerkasGaji(PERIODE, hasil);
    expect(performance.now() - mulai).toBeLessThan(5000);
    const ws = await baca(isi);
    expect(ws.rowCount).toBe(BARIS_HEADER + 200 + 1);
  });

  it("tanpa karyawan tetap menghasilkan berkas yang valid dengan total nol", async () => {
    const ws = await baca(await buatBerkasGaji(PERIODE, []));
    expect(ws.getRow(BARIS_HEADER + 1).getCell(1).value).toBe("TOTAL");
    expect(ws.getRow(BARIS_HEADER + 1).getCell(21).value).toBe(0);
  });
});
