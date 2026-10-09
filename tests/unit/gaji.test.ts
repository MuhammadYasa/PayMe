import { describe, expect, it } from "vitest";
import { type InputGaji, hitungGaji, hitungPotonganAbsensi, jumlahkanGaji } from "@/domain/gaji";
import { PENGATURAN_BAWAAN } from "@/domain/pengaturan";

function buatInput(ubah: Partial<InputGaji> = {}): InputGaji {
  return {
    karyawan: {
      id: "k-1",
      namaLengkap: "Budi Santoso",
      jabatan: "Staf Gudang",
      cabang: "Surabaya",
      nomorRekening: "0012345678",
      gajiPokok: 4_000_000,
      tunjangan: 500_000,
    },
    absensi: { hariKerja: 26, hadir: 26, izin: 0, sakit: 0, cuti: 0, lainnya: 0, totalLibur: 5 },
    aturanPotongan: PENGATURAN_BAWAAN.aturanPotongan,
    insentif: [],
    bonusTarget: null,
    denda: [],
    pajak: 0,
    asuransi: 0,
    ...ubah,
  };
}

describe("hitungGaji (FR-15)", () => {
  it("gaji pokok 4.000.000, tunjangan 500.000, insentif 350.000, denda 100.000, asuransi 150.000 menghasilkan 4.600.000", () => {
    const hasil = hitungGaji(
      buatInput({
        insentif: [{ jenis: "pengiriman", nominal: 350_000 }],
        denda: [{ dendaId: "d-1", alasan: "Kerusakan barang", nominal: 100_000 }],
        asuransi: 150_000,
      }),
    );
    expect(hasil.totalBersih).toBe(4_600_000);
    expect(hasil.totalPendapatan).toBe(4_850_000);
    expect(hasil.totalPotongan).toBe(250_000);
    expect(hasil.peringatan).toEqual([]);
  });

  it("menampilkan setiap komponen sebagai nilai tersendiri", () => {
    const hasil = hitungGaji(
      buatInput({
        insentif: [{ jenis: "pengiriman", nominal: 200_000 }],
        bonusTarget: { bonus: 500_000, penjualan: 10_000_000, target: 10_000_000, persenCapaianPermil: 1000 },
        denda: [{ dendaId: "d-1", alasan: "Terlambat", nominal: 50_000 }],
        pajak: 50_000,
        asuransi: 150_000,
      }),
    );
    expect(hasil).toMatchObject({
      gajiPokok: 4_000_000,
      tunjangan: 500_000,
      insentif: { total: 200_000 },
      bonusTarget: { bonus: 500_000 },
      denda: { total: 50_000 },
      potonganAbsensi: { total: 0 },
      pajak: 50_000,
      asuransi: 150_000,
      totalBersih: 4_950_000,
    });
  });

  it("insentif Rp 350.000 dan bonus target Rp 500.000 menjadi komponen Rp 850.000", () => {
    const hasil = hitungGaji(
      buatInput({
        insentif: [
          { jenis: "pengiriman", nominal: 200_000 },
          { jenis: "pengiriman", nominal: 150_000 },
        ],
        bonusTarget: { bonus: 500_000, penjualan: 10_000_000, target: 10_000_000, persenCapaianPermil: 1000 },
      }),
    );
    expect(hasil.insentif.total + hasil.bonusTarget.bonus).toBe(850_000);
  });

  it("pajak Rp 50.000 dan asuransi Rp 150.000 mengurangi Rp 200.000", () => {
    const tanpa = hitungGaji(buatInput());
    const dengan = hitungGaji(buatInput({ pajak: 50_000, asuransi: 150_000 }));
    expect(tanpa.totalBersih - dengan.totalBersih).toBe(200_000);
  });

  it("deterministik: input sama menghasilkan rincian identik", () => {
    const input = buatInput({
      insentif: [{ jenis: "pengiriman", nominal: 123_456 }],
      denda: [{ dendaId: "d-1", alasan: "A", nominal: 33_333 }],
      pajak: 12_345,
    });
    expect(JSON.stringify(hitungGaji(input))).toBe(JSON.stringify(hitungGaji(input)));
  });

  it("memberi peringatan, bukan memotong otomatis, saat gaji bersih negatif", () => {
    const hasil = hitungGaji(
      buatInput({
        karyawan: { ...buatInput().karyawan, gajiPokok: 1_000_000, tunjangan: 0 },
        denda: [{ dendaId: "d-1", alasan: "Selisih kas", nominal: 1_500_000 }],
      }),
    );
    expect(hasil.totalBersih).toBe(-500_000);
    expect(hasil.peringatan).toHaveLength(1);
    expect(hasil.peringatan[0]).toContain("-Rp 500.000");
    expect(hasil.denda.total).toBe(1_500_000);
  });

  it("gaji bersih tepat nol tidak dianggap bermasalah", () => {
    const hasil = hitungGaji(
      buatInput({
        karyawan: { ...buatInput().karyawan, gajiPokok: 1_000_000, tunjangan: 0 },
        denda: [{ dendaId: "d-1", alasan: "Selisih kas", nominal: 1_000_000 }],
      }),
    );
    expect(hasil.totalBersih).toBe(0);
    expect(hasil.peringatan).toEqual([]);
  });

  it("menolak nominal pecahan atau negatif agar kesalahan data tidak lolos diam-diam", () => {
    expect(() => hitungGaji(buatInput({ pajak: -1 }))).toThrow(RangeError);
    expect(() => hitungGaji(buatInput({ asuransi: 10.5 }))).toThrow(RangeError);
    expect(() => hitungGaji(buatInput({ insentif: [{ jenis: "x", nominal: -5 }] }))).toThrow(RangeError);
  });
});

describe("hitungPotonganAbsensi", () => {
  const absensi = { hariKerja: 26, hadir: 20, izin: 2, sakit: 3, cuti: 1, lainnya: 0, totalLibur: 5 };

  it("tanpa aturan tidak ada potongan", () => {
    expect(hitungPotonganAbsensi(absensi, 3_000_000, PENGATURAN_BAWAAN.aturanPotongan)).toEqual({ total: 0, rinci: [] });
  });

  it("mode nominal per hari dikalikan jumlah hari", () => {
    const hasil = hitungPotonganAbsensi(absensi, 3_000_000, {
      ...PENGATURAN_BAWAAN.aturanPotongan,
      izin: { mode: "per_hari", nominal: 50_000 },
    });
    expect(hasil.total).toBe(100_000);
    expect(hasil.rinci).toEqual([{ status: "izin", hari: 2, nominal: 100_000 }]);
  });

  it("mode persen gaji harian dibulatkan ke bawah satu kali di akhir", () => {
    // 2 hari x 3.000.000 x 50 / (26 x 100) = 115.384,6 -> 115.384
    const hasil = hitungPotonganAbsensi(absensi, 3_000_000, {
      ...PENGATURAN_BAWAAN.aturanPotongan,
      izin: { mode: "persen_harian", persen: 50 },
    });
    expect(hasil.total).toBe(115_384);
  });

  it("menjumlahkan beberapa status dan tidak membagi dengan nol bila hari kerja 0", () => {
    const aturan = {
      izin: { mode: "per_hari", nominal: 10_000 },
      sakit: { mode: "per_hari", nominal: 20_000 },
      cuti: { mode: "tidak" },
      lainnya: { mode: "persen_harian", persen: 100 },
    } as const;
    expect(hitungPotonganAbsensi(absensi, 3_000_000, aturan).total).toBe(2 * 10_000 + 3 * 20_000);
    const nolHari = { ...absensi, hariKerja: 0, lainnya: 2 };
    expect(hitungPotonganAbsensi(nolHari, 3_000_000, aturan).total).toBe(2 * 10_000 + 3 * 20_000);
  });

  it("potongan absensi ikut mengurangi gaji bersih", () => {
    const hasil = hitungGaji(
      buatInput({
        absensi,
        aturanPotongan: { ...PENGATURAN_BAWAAN.aturanPotongan, sakit: { mode: "per_hari", nominal: 40_000 } },
      }),
    );
    expect(hasil.potonganAbsensi.total).toBe(120_000);
    expect(hasil.totalBersih).toBe(4_500_000 - 120_000);
  });
});

describe("jumlahkanGaji", () => {
  it("total tiap kolom sama dengan penjumlahan baris dan menghitung karyawan bermasalah", () => {
    const a = hitungGaji(buatInput({ insentif: [{ jenis: "p", nominal: 100_000 }], pajak: 10_000 }));
    const b = hitungGaji(
      buatInput({
        karyawan: { ...buatInput().karyawan, id: "k-2", gajiPokok: 1_000_000, tunjangan: 0 },
        denda: [{ dendaId: "d", alasan: "x", nominal: 2_000_000 }],
      }),
    );
    const total = jumlahkanGaji([a, b]);
    expect(total.jumlahKaryawan).toBe(2);
    expect(total.jumlahBermasalah).toBe(1);
    expect(total.gajiPokok).toBe(5_000_000);
    expect(total.insentif).toBe(100_000);
    expect(total.pajak).toBe(10_000);
    expect(total.denda).toBe(2_000_000);
    expect(total.totalBersih).toBe(a.totalBersih + b.totalBersih);
  });
});
