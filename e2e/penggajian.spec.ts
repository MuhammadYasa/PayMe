import path from "node:path";
import { type Page, expect, test } from "@playwright/test";
import ExcelJS from "exceljs";

// Alur utama PRD dari ujung ke ujung: HRD mendaftar, mengunggah absensi, mengisi data, menghitung, menyimpan,
// mengekspor, lalu karyawan melihat gajinya sendiri. Seluruh data fiktif; setiap jalannya membuat perusahaan baru.

const KATA_SANDI = "kata-sandi-e2e-123";
const FILE_CONTOH = path.resolve("contoh/absensi-contoh-agustus-2026.xlsx");
const PESAN_TIDAK_DITEMUKAN = "Data tidak ditemukan. Periksa kembali nama dan nomor rekening Anda.";
const PESAN_TERLALU_BANYAK = "Terlalu banyak percobaan. Coba lagi dalam 15 menit.";

// Nomor rekening dibuat unik per jalan. Halaman karyawan sengaja menolak nama dan rekening yang cocok di lebih dari
// satu perusahaan, jadi sisa data dari jalan sebelumnya pada database uji tidak boleh ikut cocok.
// Tangkapan layar tiap langkah penting disimpan ke test-results/tangkapan untuk ditinjau secara visual.
const tangkap = (halaman: Page, nama: string) => halaman.screenshot({ path: `test-results/tangkapan/${nama}.png`, fullPage: true });

const AWAL_REKENING = String(Date.now());
const rekening = (urutan: number) => `${AWAL_REKENING}${urutan}`;
const samarkan = (urutan: number) => `••••${rekening(urutan).slice(-4)}`;

const KARYAWAN = [
  { namaLengkap: "Budi Santoso", jabatan: "Staf Gudang", cabang: "Surabaya", gajiPokok: 4_000_000, tunjangan: 500_000, nomorRekening: rekening(1) },
  { namaLengkap: "Siti Rahayu", jabatan: "Admin", cabang: "Surabaya", gajiPokok: 4_500_000, tunjangan: 300_000, nomorRekening: rekening(2) },
  { namaLengkap: "Agus Wijaya", jabatan: "Sales", cabang: "Malang", gajiPokok: 3_500_000, tunjangan: 250_000, nomorRekening: rekening(3) },
  { namaLengkap: "Dewi Lestari", jabatan: "Sales", cabang: "Malang", gajiPokok: 3_500_000, tunjangan: 250_000, nomorRekening: rekening(4) },
  { namaLengkap: "Rina Kartika", jabatan: "Kasir", cabang: "Bandung", gajiPokok: 3_800_000, tunjangan: 200_000, nomorRekening: rekening(5) },
  { namaLengkap: "Hadi Pranoto", jabatan: "Supir", cabang: "Bandung", gajiPokok: 3_600_000, tunjangan: 400_000, nomorRekening: rekening(6) },
];

const PENGATURAN = {
  hariKerjaMingguan: [1, 2, 3, 4, 5, 6],
  aturanPotongan: {
    izin: { mode: "per_hari", nominal: 50_000 },
    sakit: { mode: "tidak" },
    cuti: { mode: "tidak" },
    lainnya: { mode: "persen_harian", persen: 100 },
  },
  tingkatBonus: [{ ambangPermil: 1000, jenis: "tetap", nilai: 500_000 }],
};

// Cookie sesi dan cookie perangkat bertanda Secure pada mode produksi. WebKit menolak cookie Secure di luar HTTPS,
// termasuk di localhost, sehingga alur yang bergantung pada cookie hanya diuji di Chromium dan Firefox.
// Di WebKit tetap berjalan pemeriksaan tampilan dan validasi yang tidak memakai cookie.
const ALASAN_WEBKIT = "WebKit menolak cookie Secure pada http://localhost. Alur ini diuji di Chromium dan Firefox, dan perlu dicoba manual di HTTPS (staging) untuk Safari.";

test("alur lengkap penggajian: dari pendaftaran sampai karyawan melihat gajinya", async ({ page, browser, browserName }) => {
  test.skip(browserName === "webkit", ALASAN_WEBKIT);
  test.setTimeout(240_000);
  const galatHalaman: string[] = [];
  page.on("pageerror", (galat) => galatHalaman.push(galat.message));

  let periodeId = "";
  const idKaryawan = new Map<string, string>();

  await test.step("HRD mendaftar dan masuk ke dashboard", async () => {
    await page.goto("/daftar");
    await page.getByLabel("Nama Anda").fill("HRD Uji");
    await page.getByLabel("Nama perusahaan").fill("PT Uji Ujung ke Ujung");
    await page.getByLabel("Email").fill(`e2e-${Date.now()}@contoh.test`);
    await page.getByLabel("Kata sandi").fill(KATA_SANDI);
    await page.getByRole("button", { name: "Daftar", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  await test.step("pengaturan dan enam karyawan disiapkan", async () => {
    const pengaturan = await page.request.put("/api/pengaturan", { data: PENGATURAN });
    expect(pengaturan.ok(), await pengaturan.text()).toBeTruthy();
    for (const karyawan of KARYAWAN) {
      const res = await page.request.post("/api/karyawan", { data: karyawan });
      expect(res.ok(), await res.text()).toBeTruthy();
    }
    const daftar = (await (await page.request.get("/api/karyawan?status=aktif")).json()) as { karyawan: { id: string; namaLengkap: string }[] };
    for (const k of daftar.karyawan) idKaryawan.set(k.namaLengkap, k.id);
    expect(idKaryawan.size).toBe(KARYAWAN.length);
  });

  await test.step("langkah 1: periode 24 Agustus sampai 23 September dibuat", async () => {
    await page.goto("/periode/baru");
    await page.getByLabel("Tanggal awal periode").fill("2026-08-24");
    await page.getByRole("button", { name: "Buat periode dan lanjut" }).click();
    await page.waitForURL(/\/periode\/[0-9a-f-]{36}/);
    periodeId = /\/periode\/([0-9a-f-]{36})/.exec(page.url())![1];
    await expect(page.getByRole("heading", { level: 1 })).toContainText("24 Agu 2026 sampai 23 Sep 2026");
  });

  await test.step("langkah 2: file absensi contoh diunggah dan disimpan", async () => {
    await page.goto(`/periode/${periodeId}/unggah`);
    await page.locator("#berkas-absensi").setInputFiles(FILE_CONTOH);
    const periksa = page.getByRole("button", { name: "Periksa file" });
    await expect(periksa).toBeEnabled();
    await periksa.click();
    await page.getByRole("button", { name: /Lanjutkan: simpan/ }).click();
    await expect(page.getByText("Absensi berhasil disimpan")).toBeVisible();
  });

  await test.step("langkah 8 ditahan selama absensi belum lengkap, dengan tautan perbaikan", async () => {
    await page.goto(`/periode/${periodeId}/hitung`);
    await page.getByRole("button", { name: "Hitung Gaji" }).click();
    const pesan = page.locator('[role="alert"]', { hasText: "Gaji belum bisa dihitung" });
    await expect(pesan).toContainText("Absensi belum lengkap");
    await expect(pesan).toContainText("Rina Kartika");
    await expect(pesan).toContainText("Siti Rahayu");
    await pesan.getByRole("link", { name: "Ke Lengkapi Absensi" }).click();
    await expect(page).toHaveURL(/\/absensi$/);
  });

  await test.step("langkah 3: tanggal kosong dilengkapi", async () => {
    const isi = async (nama: string, tanggal: string[]) => {
      const res = await page.request.post(`/api/periode/${periodeId}/absensi/${idKaryawan.get(nama)}/massal`, { data: { tanggal, status: "HADIR" } });
      expect(res.ok(), await res.text()).toBeTruthy();
    };
    await isi("Siti Rahayu", ["2026-08-27"]);
    await isi("Rina Kartika", ["2026-09-07", "2026-09-08", "2026-09-09"]);
  });

  await test.step("langkah 5: pendapatan dan target per cabang", async () => {
    await page.goto(`/periode/${periodeId}/pendapatan`);
    const kartu = (cabang: string) => page.locator("section", { has: page.getByRole("heading", { name: `Cabang ${cabang}` }) });
    await expect(page.getByRole("heading", { name: "Cabang Malang" })).toBeVisible();

    const malang = kartu("Malang");
    await malang.getByLabel("Total pendapatan aktual cabang").fill("18500000");
    await malang.getByRole("button", { name: "Tambahkan semua karyawan cabang" }).click();
    await malang.getByLabel("Pendapatan Agus Wijaya").fill("10000000");
    await malang.getByLabel("Target Agus Wijaya").fill("10000000");
    await malang.getByLabel("Pendapatan Dewi Lestari").fill("8500000");
    await malang.getByLabel("Target Dewi Lestari").fill("10000000");
    await expect(malang.getByText("100,0%")).toBeVisible();
    await expect(malang.getByText("85,0%")).toBeVisible();
    await malang.getByRole("button", { name: "Simpan cabang Malang" }).click();
    await expect(malang.getByText("Pendapatan cabang Malang tersimpan.")).toBeVisible();

    const surabaya = kartu("Surabaya");
    await surabaya.getByLabel("Total pendapatan aktual cabang").fill("12000000");
    await surabaya.getByLabel("Tambah sales").selectOption({ label: "Budi Santoso" });
    // Memilih saja belum menambah baris, supaya panah pada pilihan tidak menambah karyawan tanpa disengaja.
    await expect(surabaya.getByLabel("Pendapatan Budi Santoso")).toHaveCount(0);
    await surabaya.getByRole("button", { name: "Tambahkan yang dipilih" }).click();
    await surabaya.getByLabel("Pendapatan Budi Santoso").fill("9000000");
    await surabaya.getByLabel("Target Budi Santoso").fill("10000000");
    await expect(surabaya.getByText("Selisih Rp 3.000.000")).toBeVisible();
    await tangkap(page, "5-pendapatan-selisih");
    await surabaya.getByRole("button", { name: "Simpan cabang Surabaya" }).click();
    await expect(surabaya.getByText("Tersimpan dengan catatan")).toBeVisible();
  });

  await test.step("selisih breakdown yang belum diakui menahan perhitungan, lalu diakui", async () => {
    await page.goto(`/periode/${periodeId}/hitung`);
    await page.getByRole("button", { name: "Hitung Gaji" }).click();
    const pesan = page.locator('[role="alert"]', { hasText: "Gaji belum bisa dihitung" });
    await expect(pesan).toContainText("Selisih pendapatan cabang Surabaya sebesar Rp 3.000.000 belum diakui");

    await pesan.getByRole("link", { name: "Ke Pendapatan dan Target" }).click();
    const surabaya = page.locator("section", { has: page.getByRole("heading", { name: "Cabang Surabaya" }) });
    await surabaya.getByLabel("Saya sudah memeriksa dan mengakui selisih ini").check();
    await surabaya.getByRole("button", { name: "Simpan cabang Surabaya" }).click();
    await expect(surabaya.getByText("Pendapatan cabang Surabaya tersimpan.")).toBeVisible();
  });

  await test.step("langkah 6: dua baris insentif untuk satu karyawan", async () => {
    await page.goto(`/periode/${periodeId}/insentif`);
    await page.getByLabel("Jenis insentif Budi Santoso baris 1").fill("Pengiriman");
    // Menempel dari Excel: "2.500.000,00" terbaca Rp 2.500.000 (bukan 250.000.000), dan teks negatif diabaikan.
    // Event tempel sintetis di Firefox tidak membawa isi papan klip, jadi pemeriksaan ini hanya berjalan di Chromium.
    const nominalBaris1 = page.getByLabel("Nominal insentif Budi Santoso baris 1");
    if (browserName === "chromium") {
      const tempel = (teks: string) =>
        nominalBaris1.evaluate((el, isi) => {
          const data = new DataTransfer();
          data.setData("text/plain", isi);
          el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
        }, teks);
      await tempel("2.500.000,00");
      await expect(nominalBaris1).toHaveValue("2.500.000");
      await tempel("-9.000");
      await expect(nominalBaris1).toHaveValue("2.500.000");
    }
    await nominalBaris1.fill("200000");
    await page.getByRole("button", { name: /Tambah baris untuk Budi Santoso/ }).click();
    await page.getByLabel("Jenis insentif Budi Santoso baris 2").fill("Lembur");
    await page.getByLabel("Nominal insentif Budi Santoso baris 2").fill("150000");

    // Pindah langkah dengan isian belum tersimpan memunculkan peringatan; membatalkan menahan pengguna di halaman ini.
    let pertanyaan = "";
    page.once("dialog", (dialog) => {
      pertanyaan = dialog.message();
      void dialog.dismiss();
    });
    await page.getByRole("link", { name: /Lanjut: Denda/ }).click();
    expect(pertanyaan).toContain("belum disimpan");
    await expect(page).toHaveURL(/\/insentif$/);

    await page.getByRole("button", { name: "Simpan insentif" }).click();
    await expect(page.getByText("2 baris insentif tersimpan")).toBeVisible();
  });

  await test.step("langkah 7: denda sekali potong, pajak, dan asuransi", async () => {
    await page.goto(`/periode/${periodeId}/potongan`);
    await page.getByLabel(/^Karyawan/).selectOption({ label: "Budi Santoso (Surabaya)" });
    await page.getByLabel("Alasan denda").fill("Kerusakan barang");
    await page.getByLabel("Total denda").fill("100000");
    await expect(page.getByText("Jadwal potongan: 1 kali Rp 100.000")).toBeVisible();
    await page.getByRole("button", { name: "Simpan denda" }).click();
    await expect(page.getByText("Denda Budi Santoso sebesar Rp 100.000 dicatat")).toBeVisible();
    await expect(page.getByText("Ke-1 dari 1")).toBeVisible();

    await page.getByLabel("Pajak Budi Santoso").fill("50000");
    await page.getByLabel("Asuransi Budi Santoso").fill("150000");
    await page.getByRole("button", { name: "Simpan pajak dan asuransi" }).click();
    await expect(page.getByText("Pajak dan asuransi tersimpan")).toBeVisible();
    await tangkap(page, "7-denda-potongan");
  });

  await test.step("langkah 8: gaji dihitung dan rinciannya sesuai hitungan manual", async () => {
    await page.goto(`/periode/${periodeId}/hitung`);
    await page.getByRole("button", { name: "Hitung Gaji" }).click();
    await expect(page.getByRole("heading", { name: /Hasil perhitungan/ })).toBeVisible();

    // Budi: 4.000.000 + 500.000 + insentif 350.000 - denda 100.000 - pajak 50.000 - asuransi 150.000.
    await expect(page.getByRole("row", { name: /Budi Santoso/ })).toContainText("Rp 4.550.000");
    // Agus: 3.500.000 + 250.000 + bonus target 500.000 (capaian 100,0%).
    await expect(page.getByRole("row", { name: /Agus Wijaya/ })).toContainText("Rp 4.250.000");

    await page.getByRole("button", { name: /Lihat rincian.*Budi Santoso/ }).click();
    for (const baris of ["Kerusakan barang", "Pengiriman", "Lembur", "Total potongan", "Gaji bersih"]) {
      await expect(page.getByText(baris, { exact: true }).first()).toBeVisible();
    }
    await tangkap(page, "8-hasil-hitung");
  });

  await test.step("hasil disimpan dan periode menjadi final", async () => {
    await page.getByRole("button", { name: "Simpan Hasil Gaji" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("6 karyawan");
    await dialog.getByRole("button", { name: "Ya, simpan" }).click();
    await expect(page.getByText("Penggajian tersimpan")).toBeVisible();
    await expect(page.getByText("Final", { exact: true }).first()).toBeVisible();

    // Setelah final, data masukan tidak bisa diubah lewat API.
    const ubah = await page.request.put(`/api/periode/${periodeId}/insentif`, { data: { items: [] } });
    expect(ubah.status()).toBe(409);
  });

  await test.step("langkah 9: berkas Excel berisi angka yang sama dengan layar", async () => {
    await page.goto(`/periode/${periodeId}/ekspor`);
    const [unduhan] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Ekspor ke Excel" }).click()]);
    expect(unduhan.suggestedFilename()).toBe("PayMe_2026-08-24_2026-09-23.xlsx");

    const buku = new ExcelJS.Workbook();
    await buku.xlsx.readFile(await unduhan.path());
    let nilaiBudi: unknown[] = [];
    buku.worksheets[0].eachRow((baris) => {
      const nilai = baris.values as unknown[];
      if (nilai.includes("Budi Santoso")) nilaiBudi = nilai;
    });
    expect(nilaiBudi).toContain(4_550_000);
  });

  await test.step("karyawan melihat gajinya sendiri, dan pesan gagal selalu sama", async () => {
    const konteks = await browser.newContext({ baseURL: test.info().project.use.baseURL });
    const publik = await konteks.newPage();
    await publik.goto("/lihat-gaji");

    await publik.getByLabel("Nama lengkap").fill("Budi Santoso");
    await publik.getByLabel("Nomor rekening").fill(rekening(9));
    await publik.getByRole("button", { name: "Lihat Gaji Saya" }).click();
    await expect(publik.getByText(PESAN_TIDAK_DITEMUKAN)).toBeVisible();

    await publik.getByLabel("Nama lengkap").fill("Orang Lain");
    await publik.getByLabel("Nomor rekening").fill(rekening(1));
    await publik.getByRole("button", { name: "Lihat Gaji Saya" }).click();
    await expect(publik.getByText(PESAN_TIDAK_DITEMUKAN)).toBeVisible();

    // Huruf besar atau kecil dan spasi berlebih tidak berpengaruh.
    await publik.getByLabel("Nama lengkap").fill("  budi   SANTOSO ");
    await publik.getByLabel("Nomor rekening").fill(rekening(1));
    await publik.getByRole("button", { name: "Lihat Gaji Saya" }).click();
    await expect(publik.getByText("Gaji bersih Rp 4.550.000")).toBeVisible();
    await expect(publik.getByText(samarkan(1))).toBeVisible();
    await expect(publik.getByText(rekening(1))).toHaveCount(0);
    await tangkap(publik, "10-halaman-karyawan");

    await konteks.close();
  });

  await test.step("periode dibuka kembali: karyawan tidak lagi melihat data yang kembali menjadi draf", async () => {
    await page.goto(`/periode/${periodeId}/hitung`);
    await page.getByRole("button", { name: "Buka kembali periode" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Ya, buka kembali" }).click();
    await expect(page.getByRole("button", { name: "Hitung Gaji" })).toBeVisible();

    const konteks = await browser.newContext({ baseURL: test.info().project.use.baseURL });
    const publik = await konteks.newPage();
    await publik.goto("/lihat-gaji");
    await publik.getByLabel("Nama lengkap").fill("Budi Santoso");
    await publik.getByLabel("Nomor rekening").fill(rekening(1));
    await publik.getByRole("button", { name: "Lihat Gaji Saya" }).click();
    await expect(publik.getByText("Belum ada gaji yang tersimpan")).toBeVisible();
    await konteks.close();
  });

  expect(galatHalaman).toEqual([]);
});

test("tanpa sesi, halaman admin diarahkan ke halaman masuk dan login salah ditolak dengan pesan jelas", async ({ page }) => {
  await page.goto("/periode");
  await expect(page).toHaveURL(/\/masuk\?lanjut=%2Fperiode/);

  // Formulir kosong: fokus berpindah ke kolom pertama yang salah.
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(page.getByLabel("Email")).toBeFocused();

  await page.getByLabel("Email").fill("tidak-ada@contoh.test");
  await page.getByLabel("Kata sandi").fill("salah-salah-123");
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(page.getByText("Email atau kata sandi tidak sesuai")).toBeVisible();
});

test("halaman karyawan tampil dan memindahkan fokus ke kolom yang kosong", async ({ page }) => {
  await page.goto("/lihat-gaji");
  await expect(page.getByRole("heading", { name: "Lihat Gaji Saya", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Lihat Gaji Saya" }).click();
  await expect(page.getByLabel("Nama lengkap")).toBeFocused();
  await expect(page.getByText("Isi nama lengkap Anda, sesuai data di perusahaan.")).toBeVisible();
  await expect(page.getByText("Isi nomor rekening Anda.")).toBeVisible();

  // Rekening bertanda hubung ditolak di formulir dan tidak dikirim, jadi tidak menghabiskan jatah percobaan.
  await page.getByLabel("Nama lengkap").fill("Budi Santoso");
  await page.getByLabel("Nomor rekening").fill("123-456-7890");
  await page.getByRole("button", { name: "Lihat Gaji Saya" }).click();
  await expect(page.getByText("Nomor rekening hanya berisi angka. Hapus tanda hubung atau huruf, lalu coba lagi.")).toBeVisible();
  await expect(page.getByLabel("Nomor rekening")).toBeFocused();
});

test("halaman karyawan memblokir setelah lima kali gagal berturut-turut", async ({ page, browserName }) => {
  test.skip(browserName === "webkit", ALASAN_WEBKIT);
  await page.goto("/lihat-gaji");
  // Pembatas per nama bertahan di database selama satu jam, jadi nama dibuat unik agar tes tidak saling memengaruhi.
  const namaTidakAda = `Nama Tidak Ada ${Date.now()}`;
  const kirim = async () => {
    await page.getByLabel("Nama lengkap").fill(namaTidakAda);
    await page.getByLabel("Nomor rekening").fill("9999999999");
    await page.getByRole("button", { name: "Lihat Gaji Saya" }).click();
  };

  for (let i = 0; i < 5; i++) {
    await kirim();
    await expect(page.getByText(PESAN_TIDAK_DITEMUKAN)).toBeVisible();
  }
  await kirim();
  await expect(page.getByText(PESAN_TERLALU_BANYAK)).toBeVisible();
});
