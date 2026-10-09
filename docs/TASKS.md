# Daftar Task - PayMe

> Cara memakai: kerjakan task secara berurutan dari atas ke bawah, karena urutan sudah mengikuti dependensi. Setelah selesai, ubah `- [ ]` menjadi `- [x]` hanya jika kondisi "selesai bila" sudah dicek dan uji otomatis lulus. Semua teks antarmuka memakai Bahasa Indonesia, nominal disimpan sebagai bilangan bulat rupiah dan ditampilkan `Rp 1.250.000`, dan setiap query data wajib difilter `perusahaan_id` dari sesi. Aturan bertanda [Asumsi] (potongan absensi, target, bonus, hari kerja mingguan) dibuat sebagai konfigurasi, bukan angka tertanam di kode. Jangan menambah fitur di luar PRD.

## Milestone 0 - Fondasi

- [x] T-001 Setup proyek Next.js, TypeScript, linter, test runner, dan koneksi PostgreSQL dengan ORM - selesai bila: `npm run dev`, `npm run lint`, dan `npm test` berjalan tanpa galat serta migrasi awal berhasil dijalankan
- [x] T-002 Buat skema database untuk Akun, Perusahaan, Karyawan, dan Periode (FR-01, FR-02, FR-03) - selesai bila: migrasi membuat tabel dengan kunci asing `perusahaan_id` dan indeks unik nama lengkap + nomor rekening per perusahaan
- [x] T-003 Buat helper format rupiah, parsing input nominal (titik/koma ribuan), dan normalisasi nama - selesai bila: uji unit membuktikan `1250000` tampil `Rp 1.250.000`, `1.250.000` terbaca 1250000, dan spasi ganda pada nama dirapikan
- [x] T-004 Buat layout aplikasi, tema biru-putih, komponen dasar (tombol, input, tabel, badge, pesan galat) dengan font isi minimal 14 px - selesai bila: halaman contoh menampilkan komponen dengan kontras teks minimal 4.5:1
- [x] T-005 Implementasi registrasi akun dan perusahaan dengan hash argon2/bcrypt (FR-01) - selesai bila: email duplikat (tanpa membedakan huruf besar/kecil) menampilkan "Email sudah terdaftar. Silakan masuk atau gunakan email lain." dan `password_hash` di database bukan sandi asli
- [x] T-006 Implementasi login, logout, dan sesi (FR-01) - selesai bila: kredensial salah menampilkan pesan umum tanpa menyebut email atau sandi, dan logout menghapus sesi
- [x] T-007 Pasang middleware proteksi rute admin dan pengalihan balik setelah login (FR-01) - selesai bila: uji otomatis membuktikan semua rute admin mengalihkan ke login dan API mengembalikan 401 tanpa sesi, dan tombol kembali browser setelah logout tidak menampilkan data
- [x] T-008 Buat lapisan akses data yang otomatis memfilter `perusahaan_id` dari sesi (NFR-09) - selesai bila: uji otorisasi membuktikan akun perusahaan A menerima 404 saat meminta data perusahaan B
- [x] T-009 Implementasi CRUD karyawan: daftar, pencarian nama, filter cabang, form dengan validasi (FR-02) - selesai bila: karyawan baru tampil di daftar dalam 2 detik, gaji pokok 0 ditolak, rekening berhuruf ditolak dengan "Nomor rekening hanya boleh berisi angka.", dan rekening berawalan nol tersimpan sebagai teks
- [x] T-010 Implementasi hapus karyawan dengan konfirmasi dan penonaktifan bila punya riwayat gaji (FR-02) - selesai bila: karyawan dengan HasilGaji menjadi `status_aktif = false` dan riwayatnya tetap utuh
- [x] T-011 Implementasi pemilih tanggal awal, perhitungan tanggal akhir, pratinjau periode, dan penolakan tumpang tindih (FR-03) - selesai bila: uji unit lulus untuk 1 Feb 2024 (29 hari), 1 Feb 2025 (28 hari), 26 Des (berakhir 25 Jan tahun berikutnya), mulai 31 Jan, dan periode bentrok ditolak dengan pesan menyebut periode tersebut

## Milestone 1 - Absensi

- [x] T-012 Buat skema Absensi dan konfigurasi perusahaan (hari kerja mingguan default Senin-Sabtu, aturan potongan absensi) (FR-05, FR-06, FR-08) - selesai bila: migrasi berjalan dan konfigurasi dapat dibaca dan diubah tanpa mengubah kode
- [x] T-013 Buat layanan parsing .xlsx dengan pemilihan sheet, deteksi header, dan tebakan pemetaan kolom (FR-04) - selesai bila: uji unit dengan file contoh membaca sel tanggal berupa teks dan angka serial Excel serta jam pulang kosong
- [x] T-014 Buat endpoint unggah dengan validasi tipe dan ukuran (FR-04) - selesai bila: file .xls/.csv ditolak dengan pesan format yang diterima dan file di atas 5 MB ditolak sebelum diproses
- [x] T-015 Buat UI langkah unggah: pemetaan kolom, ringkasan hasil, daftar baris tidak valid dengan nomor baris, dan tombol "Lanjutkan" (FR-04, FR-20) - selesai bila: baris bermasalah tampil seperti "Baris 37: jam masuk tidak dapat dibaca" dan baris valid tetap diimpor
- [x] T-016 Implementasi pencocokan nama, pemetaan manual nama tak dikenal, pengabaian tanggal di luar periode, dan aturan unggah ulang (FR-04) - selesai bila: nama tak dikenal dapat dipetakan atau diabaikan, jumlah tanggal di luar periode dilaporkan, dan isian manual tidak tertimpa tanpa konfirmasi
- [x] T-017 Uji performa parsing 200 karyawan dalam satu file (FR-04) - selesai bila: uji otomatis menunjukkan parsing selesai di bawah 10 detik
- [x] T-018 Implementasi tampilan daftar absensi dengan badge tanggal kosong dan filter "Hanya yang belum lengkap" (FR-05) - selesai bila: karyawan dengan 3 tanggal tanpa data menampilkan badge 3 dan karyawan lengkap menampilkan "Lengkap"
- [x] T-019 Implementasi detail absensi per karyawan dengan pengisian status dan jam per tanggal, serta isi massal (FR-05) - selesai bila: tanggal kosong berlatar kuning dengan label teks "Kosong" dan badge turun tanpa muat ulang penuh setelah disimpan
- [x] T-020 Implementasi penandaan libur perusahaan dan individual beserta konfirmasi sebelum menimpa (FR-07) - selesai bila: dua tanggal merah untuk semua membuat 2 record libur per karyawan aktif, libur individual tidak memengaruhi karyawan lain, dan tanggal di luar periode ditolak
- [x] T-021 Implementasi entri izin, sakit, dan lainnya dengan rentang tanggal (FR-08) - selesai bila: sakit 10-12 Maret membuat 3 record, "lainnya" tanpa keterangan ditolak, dan tanggal yang sudah berstatus menawarkan menimpa tanpa duplikat
- [x] T-022 Implementasi entri cuti dengan rentang tanggal dan pengecualian hari libur (FR-09) - selesai bila: cuti 5 hari yang memuat 1 Minggu libur menghasilkan total 4 dan tanggal di luar periode dipotong dengan peringatan
- [x] T-023 Implementasi layanan hitung hari kerja, hari hadir, dan ringkasan per status (FR-06) - selesai bila: 20 kasus uji acuan selisih 0 hari, termasuk April 2025 dengan Minggu libur menghasilkan 26 dan tanggal merah pada hari Minggu tidak dihitung ganda
- [x] T-024 Tampilkan ringkasan per karyawan (hari kerja, hadir, libur, izin, sakit, cuti, lainnya) yang terhitung ulang otomatis (FR-06, FR-07, FR-08, FR-09) - selesai bila: mengubah absensi atau penanda libur langsung memperbarui angka ringkasan

## Milestone 2 - Penghasilan dan potongan

- [x] T-025 Buat skema PendapatanCabang, PendapatanSales, Insentif, Denda, PotonganDenda, dan PotonganLain (FR-10 sampai FR-14, FR-18) - selesai bila: migrasi berjalan dengan kunci asing dan `perusahaan_id` terfilter
- [x] T-026 Implementasi form pendapatan cabang dan breakdown sales dengan indikator selisih real-time (FR-10) - selesai bila: total Rp 10.000.000 dengan breakdown Rp 9.850.000 menampilkan "Selisih Rp 150.000", nominal negatif ditolak, dan cabang tanpa sales menampilkan informasi belum ada breakdown
- [x] T-027 Implementasi konfigurasi aturan target dan bonus serta layanan hitung persen capaian (FR-11) - selesai bila: uji unit membuktikan persen capaian akurat sampai 1 desimal dan aturan dapat diubah HRD tanpa mengubah kode
- [x] T-028 Implementasi input insentif pengiriman per karyawan dan layanan total bonus/insentif (FR-12) - selesai bila: nominal insentif masuk ke total dan 20 kasus uji sama dengan hitungan manual
- [x] T-029 Implementasi pencatatan denda dengan alasan dan nominal (FR-13) - selesai bila: denda tersimpan dan terpotong pada periode terkait
- [x] T-030 Implementasi denda cicilan dengan jumlah cicilan dan potongan otomatis per periode (FR-14) - selesai bila: sisa berkurang tiap periode disimpan, potongan berhenti saat sisa 0, dan sisa tidak pernah negatif
- [x] T-031 Implementasi input nominal pajak dan asuransi per karyawan sebagai potongan (FR-18) - selesai bila: nominal tersimpan per karyawan dan masuk ke total potongan tanpa perhitungan PPh
- [x] T-032 Implementasi layanan inti perhitungan gaji sesuai rumus [Asumsi] dan pemblokiran bila masih ada tanggal kosong (FR-15, FR-05) - selesai bila: uji otomatis membuktikan selisih 0 rupiah pada kasus uji acuan dan pesan blokir menyebut nama karyawan serta jumlah tanggal kosong
- [x] T-033 Buat tombol "Hitung Gaji" dan tampilan rincian per karyawan sebelum disimpan (FR-15) - selesai bila: setiap komponen (pokok, tunjangan, insentif, bonus, denda, potongan absensi, pajak/asuransi, total bersih) tampil dan 200 karyawan terproses dalam 5 detik
- [x] T-034 Buat alur stepper terpandu yang menghubungkan semua langkah dengan indikator langkah dan teks bantuan (FR-20) - selesai bila: pengguna dapat berpindah antar langkah dan kembali tanpa kehilangan data yang sudah diisi

## Milestone 3 - Penyelesaian dan rilis

- [x] T-035 Implementasi simpan hasil final sebagai snapshot JSON dan riwayat per periode (FR-16) - selesai bila: riwayat tampil per bulan dan data tersimpan tidak berubah setelah profil karyawan diedit
- [x] T-036 Implementasi ekspor hasil penggajian ke Excel (FR-17) - selesai bila: file terunduh dalam 5 detik dan total kolom sama dengan tampilan layar
- [x] T-037 Implementasi halaman publik karyawan dengan verifikasi nama lengkap + nomor rekening (FR-19) - selesai bila: rincian gaji, cuti, dan potongan tampil hanya bila keduanya cocok, dan pesan galat tidak menyebut field mana yang salah
- [x] T-038 Implementasi pembatasan percobaan: blokir 15 menit setelah 5 kali gagal, serta masking nomor rekening di log (FR-19, NFR-03) - selesai bila: uji otomatis membuktikan percobaan ke-6 diblokir dan log tidak memuat nomor rekening penuh
- [x] T-039 Tinjau seluruh pesan galat dan validasi agar berbahasa Indonesia dengan penyebab dan langkah perbaikan, serta tambahkan halaman galat umum dan penanganan galat server (FR-20) - selesai bila: audit menunjukkan 100% pesan galat memuat penyebab dan langkah perbaikan
- [ ] T-040 Tulis uji end-to-end untuk alur utama dari login sampai ekspor dan halaman karyawan - selesai bila: skenario lulus otomatis di CI. Status: lulus otomatis di Chromium dan Firefox secara lokal; workflow `.github/workflows/ci.yml` sudah ada tetapi belum terbukti hijau di GitHub
- [x] T-041 Tulis uji otorisasi lintas perusahaan untuk semua endpoint dan halaman admin (NFR-09) - selesai bila: 0 kebocoran data pada seluruh uji
- [x] T-042 Audit performa, aksesibilitas, dan kompatibilitas browser (NFR-01, NFR-06, NFR-07) - selesai bila: halaman utama termuat di bawah 3 detik pada profil 4G dan kontras serta ukuran font memenuhi batas. Hasil: LCP 1,2 detik pada Fast 4G dengan CPU 4x lebih lambat, Lighthouse aksesibilitas 100, E2E lulus di Chromium dan Firefox. Safari baru teruji sebagian (lihat README)
- [ ] T-043 Siapkan konfigurasi produksi: variabel lingkungan, HTTPS, backup harian dengan retensi 30 hari, dan skrip migrasi (NFR-03, NFR-08) - selesai bila: dokumen langkah rilis tersedia di README dan migrasi berjalan di lingkungan staging. Status: README, skrip backup dan restore (sudah diuji pada PostgreSQL 17) siap; migrasi baru dijalankan di database lokal dan uji karena belum ada lingkungan staging
- [ ] T-044 Deploy ke staging, jalankan uji asap, lalu rilis produksi - selesai bila: alur registrasi, perhitungan, dan halaman karyawan berjalan di URL produksi tanpa galat. Status: belum dikerjakan, butuh akun hosting dari pemilik proyek
