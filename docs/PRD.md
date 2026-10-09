# PRD · PayMe

## Ringkasan

PayMe adalah aplikasi web berbasis Next.js untuk membantu pemilik usaha dan HRD menghitung gaji karyawan secara otomatis. Pengguna memilih tanggal awal periode, mengunggah file Excel hasil mesin finger, melengkapi data absensi yang kosong, mengisi pendapatan cabang dan sales, insentif pengiriman, serta denda. Sistem lalu menghitung hari kerja, cuti, libur, izin/sakit, potongan, bonus/insentif, dan pencapaian target. Karyawan dapat melihat slip gaji, cuti, dan potongan miliknya lewat halaman publik dengan verifikasi nama lengkap dan nomor rekening.

## Latar belakang dan masalah

- Penghitungan payroll masih manual sehingga sering terjadi salah hitung.
- Rata-rata proses penggajian memakan waktu sekitar 2 jam per pengguna.
- Pengguna utama (HRD staff usia 25 sampai 45 tahun) belum terbiasa dengan aplikasi atau web, sehingga alur harus sederhana dan terpandu.
- Data absensi berasal dari mesin finger dalam bentuk Excel dan sering memiliki bagian kosong yang harus dilengkapi per orang.

## Tujuan dan metrik keberhasilan

| Tujuan | Metrik | Target |
|---|---|---|
| Penggunaan rutin | Pengguna terdaftar yang aktif tiap bulan | 60% |
| Efisiensi | Waktu penghitungan gaji per pengguna | dari rata-rata 2 jam menjadi di bawah 10 menit |
| Retensi | Pengguna yang masih aktif setelah 3 bulan pertama | 80% |
| Kepuasan | Rating di platform review | minimal 4.5 dari 5 |

## Pengguna dan persona

**Persona utama: Sari, HRD Staff (usia 25 sampai 45).** Menghitung gaji tiap bulan memakai Excel dan kalkulator. Kurang nyaman dengan aplikasi baru, butuh langkah jelas, pesan error yang mudah dipahami, dan hasil yang bisa diperiksa.

**Persona sekunder: Pak Budi, pemilik usaha.** Ingin gaji akurat dan bisa mengelola data karyawan serta hasil penggajian.

**Persona tambahan: Karyawan.** Ingin melihat rincian gaji, cuti, dan potongan miliknya tanpa membuat akun, cukup dengan nama lengkap dan nomor rekening.

## User story

- **US-01:** Sebagai HRD, saya ingin mendaftar dan masuk dengan akun agar data gaji karyawan saya terlindungi.
- **US-02:** Sebagai HRD, saya ingin mengelola profil karyawan (nama, jabatan, gaji pokok, tunjangan, nomor rekening) agar perhitungan memakai data benar.
- **US-03:** Sebagai HRD, saya ingin memilih tanggal awal periode bulan agar perhitungan sesuai siklus gaji kantor.
- **US-04:** Sebagai HRD, saya ingin mengunggah Excel hasil mesin finger agar tidak perlu mengetik absensi.
- **US-05:** Sebagai HRD, saya ingin melihat dan mengisi data absensi yang kosong per karyawan agar rekap lengkap.
- **US-06:** Sebagai HRD, saya ingin mencatat izin, sakit, cuti, atau keterangan lain agar tercatat benar.
- **US-07:** Sebagai HRD, saya ingin mengisi pendapatan aktual cabang dan memecahnya ke tiap sales agar target dan insentif terhitung.
- **US-08:** Sebagai HRD, saya ingin mengisi insentif pengiriman per karyawan.
- **US-09:** Sebagai HRD, saya ingin mencatat denda, termasuk denda besar yang dicicil dan dipotong per bulan sampai lunas.
- **US-10:** Sebagai HRD, saya ingin menekan satu tombol untuk menghitung gaji dan melihat rinciannya agar bisa diperiksa sebelum disimpan.
- **US-11:** Sebagai HRD, saya ingin menyimpan hasil dan mengekspornya agar dapat dibagikan dan diarsipkan.
- **US-12:** Sebagai karyawan, saya ingin melihat rincian gaji, cuti, dan potongan saya lewat website dengan memasukkan nama lengkap dan nomor rekening.

## Kebutuhan fungsional

| ID | Kebutuhan | Prioritas | Kriteria penerimaan yang terukur |
|---|---|---|---|
| FR-01 | Registrasi, login, dan logout akun HRD/pemilik usaha | Must | Data hanya dapat diakses setelah login; 100% rute admin menolak akses tanpa sesi |
| FR-02 | CRUD profil karyawan (nama, jabatan, gaji pokok, tunjangan, nomor rekening) | Must | Tambah, ubah, hapus tersimpan dan tampil di daftar dalam 2 detik; field wajib divalidasi |
| FR-03 | Pemilihan tanggal awal periode gaji | Must | Periode 1 bulan terhitung dari tanggal terpilih; jumlah hari periode benar pada 100% kasus uji termasuk Februari kabisat |
| FR-04 | Unggah file Excel hasil mesin finger dan parsing | Must | File .xlsx sampai 5 MB dengan 200 karyawan terbaca dalam 10 detik; baris tidak valid ditampilkan dengan nomor baris |
| FR-05 | Tampilan absensi per karyawan dengan penanda tanggal kosong | Must | Semua tanggal tanpa data ditandai; HRD dapat mengisi tiap tanggal, dan penghitungan diblokir selama masih ada tanggal kosong tanpa keterangan |
| FR-06 | Penghitungan hari kerja | Must | Hasil sama dengan kalkulasi manual pada 20 kasus uji (selisih 0 hari) |
| FR-07 | Pencatatan dan penghitungan jumlah libur | Must | Total libur per karyawan akurat pada kasus uji; hari libur dapat ditandai oleh HRD |
| FR-08 | Pencatatan izin, sakit, dan lainnya per karyawan | Must | Tiap entri punya tanggal dan jenis; total per jenis tampil dan cocok dengan entri |
| FR-09 | Pencatatan dan penghitungan jumlah cuti | Must | Total cuti terpakai dalam periode akurat pada kasus uji |
| FR-10 | Input pendapatan aktual cabang dan breakdown ke sales | Must | Sistem memperingatkan bila total breakdown tidak sama dengan pendapatan cabang; selisih ditampilkan dalam rupiah |
| FR-11 | Penghitungan target per sales dan pencapaiannya | Must | Persentase pencapaian benar sampai 1 desimal pada kasus uji; aturan target dapat dikonfigurasi HRD [Asumsi] |
| FR-12 | Input insentif pengiriman dan penghitungan bonus/insentif | Must | Nominal insentif masuk ke total gaji; hasil sama dengan manual pada 20 kasus uji |
| FR-13 | Pencatatan denda dan potongan gaji | Must | Denda tercatat dengan alasan dan nominal; terpotong tepat pada gaji periode terkait |
| FR-14 | Denda cicilan: tentukan jumlah cicilan, potong otomatis per bulan sampai lunas | Must | Sisa denda berkurang tiap periode disimpan; potongan berhenti saat sisa = 0; tidak pernah negatif |
| FR-15 | Hitung gaji dan tampilkan rincian per karyawan sebelum disimpan | Must | Satu klik memproses 200 karyawan dalam 5 detik; rincian menampilkan setiap komponen |
| FR-16 | Simpan hasil penggajian dan riwayat per periode | Must | Riwayat tampil per bulan; data tersimpan tidak berubah bila profil karyawan diedit setelahnya |
| FR-17 | Ekspor hasil penggajian ke Excel | Should | File terunduh dalam 5 detik; total kolom sama dengan layar |
| FR-18 | Potongan pajak dan asuransi sebagai nominal yang diinput/diatur HRD (bukan perhitungan PPh) | Should | Nominal tersimpan per karyawan dan masuk ke perhitungan potongan [Asumsi] |
| FR-19 | Halaman karyawan: lihat gaji, cuti, potongan dengan nama lengkap + nomor rekening | Must | Data tampil hanya bila keduanya cocok; setelah 5 kali gagal, akses diblokir 15 menit; pesan error tidak membocorkan field mana yang salah |
| FR-20 | Pesan panduan dan validasi dalam Bahasa Indonesia di tiap langkah | Should | 100% pesan error memuat penyebab dan langkah perbaikan |

## Alur utama

1. HRD login.
2. Memilih tanggal awal periode.
3. Mengunggah Excel mesin finger; sistem menampilkan hasil baca dan baris bermasalah.
4. HRD mengisi absensi yang kosong per karyawan.
5. HRD mencatat izin, sakit, cuti, atau lainnya.
6. HRD mengisi pendapatan aktual cabang dan breakdown ke tiap sales.
7. HRD mengisi insentif pengiriman.
8. HRD mengisi denda; denda besar dapat dicicil dan dipotong bulanan.
9. HRD menekan "Hitung Gaji", memeriksa rincian, lalu menyimpan.
10. HRD mengekspor hasil.
11. Karyawan membuka halaman publik, memasukkan nama lengkap dan nomor rekening, lalu melihat rincian.

## Kebutuhan non-fungsional

- **NFR-01 Performa:** halaman utama termuat dalam 3 detik pada koneksi 4G; perhitungan 200 karyawan selesai dalam 5 detik.
- **NFR-02 Kemudahan:** pengguna baru menyelesaikan satu siklus penggajian tanpa bantuan dalam 15 menit pada uji dengan 5 HRD; target akhir di bawah 10 menit.
- **NFR-03 Keamanan:** kata sandi di-hash (bcrypt/argon2), seluruh lalu lintas HTTPS, nomor rekening tidak ditampilkan penuh di log.
- **NFR-04 Akurasi:** selisih hasil dengan perhitungan acuan 0 rupiah pada 100% kasus uji.
- **NFR-05 Ketersediaan:** uptime 99,5% per bulan [Asumsi].
- **NFR-06 Kompatibilitas:** dua versi terbaru Chrome, Edge, Firefox, Safari; layar lebar mulai 1280 px, tablet 768 px dapat dipakai.
- **NFR-07 Aksesibilitas:** kontras teks minimal 4.5:1; ukuran font isi minimal 14 px.
- **NFR-08 Pencadangan:** backup data harian, retensi 30 hari [Asumsi].
- **NFR-09 Isolasi data:** akun satu perusahaan tidak dapat mengakses data perusahaan lain; 0 kebocoran pada uji otorisasi.

## Model data

| Entitas | Atribut utama |
|---|---|
| Akun (User) | id, email, password_hash, nama, perusahaan_id |
| Perusahaan | id, nama |
| Karyawan | id, perusahaan_id, nama_lengkap, jabatan, cabang, gaji_pokok, tunjangan, nomor_rekening, status_aktif |
| Periode | id, perusahaan_id, tanggal_awal, tanggal_akhir, status (draf/final) |
| Absensi | id, periode_id, karyawan_id, tanggal, jam_masuk, jam_pulang, status (hadir/izin/sakit/cuti/libur/lainnya), keterangan |
| PendapatanCabang | id, periode_id, cabang, total_aktual |
| PendapatanSales | id, periode_id, karyawan_id, nominal, target, persen_capaian |
| Insentif | id, periode_id, karyawan_id, jenis, nominal |
| Denda | id, karyawan_id, alasan, total, jumlah_cicilan, sisa, tanggal_mulai |
| PotonganDenda | id, denda_id, periode_id, nominal |
| PotonganLain | id, periode_id, karyawan_id, jenis (pajak/asuransi), nominal |
| HasilGaji | id, periode_id, karyawan_id, snapshot rincian (JSON), total_bersih |

## Arah desain dan UX

- Minimalis dan modern, palet biru-putih profesional, terinspirasi BambooHR dalam hal kemudahan navigasi.
- Dashboard bersih dengan tabel data yang jelas; fungsi diutamakan daripada ornamen.
- Tipografi dan spacing konsisten.
- Tombol aksi penting (Hitung Gaji, Simpan, Ekspor) berkontras tinggi.
- Karena pengguna kurang terbiasa, alur dibuat bertahap (stepper) dengan indikator langkah, label jelas dalam Bahasa Indonesia, dan teks bantuan singkat.
- Halaman karyawan sangat sederhana: dua kolom isian dan satu tombol.

## Batasan dan integrasi

- Karyawan dapat melihat gaji, cuti, dan potongan melalui website dengan input nama lengkap dan nomor rekening.
- Input file terbatas pada Excel hasil olahan mesin finger; format kolom pastinya belum diketahui (lihat pertanyaan terbuka).
- Akun wajib dibuat oleh pemilik usaha/HRD.
- Stack: Next.js. Basis data dan hosting [Asumsi]: PostgreSQL dan platform hosting Next.js.
- Batas waktu dan biaya belum ditentukan.

## Di luar cakupan

- Integrasi otomatis dengan sistem payroll bank.
- Laporan pajak penghasilan (PPh) yang sesuai regulasi.
- Manajemen cuti dan absensi terintegrasi.
- Dashboard analytics dan prediksi gaji bulanan.
- Aplikasi mobile native.
- Pembuatan akun untuk karyawan.

## Asumsi, risiko, dan pertanyaan terbuka

**Asumsi**
- [Asumsi] Satu perusahaan dapat memiliki beberapa cabang dan beberapa akun HRD.
- [Asumsi] Rumus gaji: gaji pokok + tunjangan + insentif + bonus target − denda − potongan absensi − pajak/asuransi (nominal input).
- [Asumsi] Ekspor berformat Excel.
- [Asumsi] Satu periode berdurasi satu bulan kalender dari tanggal awal yang dipilih.

**Risiko**
- Verifikasi karyawan dengan nama dan nomor rekening lemah karena informasi itu mudah diketahui orang lain; risiko kebocoran data gaji. Mitigasi awal: pembatasan percobaan (FR-19).
- Format Excel mesin finger bervariasi antar merek sehingga parsing bisa gagal.
- Aturan pemotongan keterlambatan, denda, dan target dapat berbeda antar perusahaan.
- Pengguna yang kurang terbiasa dapat salah memasukkan data; perlu validasi kuat.
- Data gaji dan rekening bersifat sensitif; perlu perhatian pada perlindungan data pribadi.
- Usulan: tambahkan PIN atau tanggal lahir sebagai faktor verifikasi tambahan karyawan.
- Usulan: sediakan templat Excel standar sebagai alternatif bila format mesin finger tidak terbaca.

**Pertanyaan terbuka**
1. Seperti apa struktur kolom file Excel mesin finger (merek dan contoh file)?
2. Bagaimana rumus pasti potongan keterlambatan, absen, dan denda?
3. Bagaimana aturan target dan bonus (ambang, persentase, per sales atau per cabang)?
4. Berapa jumlah karyawan dan cabang terbesar yang perlu didukung?
5. Apakah ada kuota cuti tahunan yang harus dilacak saldonya?
6. Bagaimana aturan cicilan denda (batas nominal, jumlah cicilan ditentukan siapa)?
7. Apa batas waktu dan anggaran rilis?
8. Apakah slip gaji perlu diunduh karyawan?

## Rencana rilis

| Milestone | Cakupan | FR |
|---|---|---|
| M0 Fondasi | Setup Next.js, autentikasi, data karyawan, pemilihan periode | FR-01, FR-02, FR-03 |
| M1 Absensi | Unggah Excel, pengisian absensi kosong, hari kerja, libur, izin/sakit, cuti | FR-04, FR-05, FR-06, FR-07, FR-08, FR-09 |
| M2 Penghasilan dan potongan | Pendapatan, target, insentif, denda dan cicilan, potongan pajak/asuransi, hitung gaji | FR-10, FR-11, FR-12, FR-13, FR-14, FR-15, FR-18 |
| M3 Penyelesaian dan rilis | Simpan riwayat, ekspor, halaman karyawan, panduan UX, uji dan perbaikan | FR-16, FR-17, FR-19, FR-20 |
