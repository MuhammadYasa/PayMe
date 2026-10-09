# Spec Fitur · PayMe

## Konvensi

- Semua teks antarmuka, pesan error, dan label memakai Bahasa Indonesia; kode, nama variabel, dan nama tabel memakai Bahasa Inggris atau mengikuti nama entitas pada PRD secara konsisten.
- Semua nominal uang disimpan sebagai bilangan bulat rupiah (tanpa desimal) dan ditampilkan berformat `Rp 1.250.000`. Persentase ditampilkan 1 desimal.
- Tanda **[Asumsi]** berarti aturan belum dikonfirmasi; implementasikan sebagai konfigurasi yang mudah diubah, bukan angka tertanam di kode.
- Setiap query data wajib difilter `perusahaan_id` dari sesi pengguna (NFR-09). Setiap fitur wajib punya uji otomatis untuk kriteria penerimaannya.
- Setiap fitur hanya mencakup FR yang tercantum; jangan menambah fitur di luar PRD.

## Fitur

### FR-01 · Registrasi, login, dan logout akun HRD/pemilik usaha

**Deskripsi:** Pemilik usaha atau HRD membuat akun, masuk, dan keluar. Akun terikat ke satu perusahaan.

**Aturan bisnis:**
- Email unik; kata sandi minimal 8 karakter, di-hash dengan argon2 atau bcrypt.
- Registrasi membuat Perusahaan baru dan Akun terkait. Akun tambahan dalam perusahaan yang sama **[Asumsi]** dibuat oleh akun yang sudah ada.
- Semua rute admin (`/dashboard`, `/karyawan`, `/periode`, dan turunannya) mewajibkan sesi valid. Halaman karyawan (FR-19) adalah satu-satunya rute publik selain login dan registrasi.

**Perilaku:**
- Form registrasi: nama, nama perusahaan, email, kata sandi.
- Login gagal menampilkan pesan umum tanpa menyebut email atau sandi mana yang salah.
- Logout menghapus sesi dan mengarahkan ke halaman login.
- Akses rute admin tanpa sesi diarahkan ke login lalu kembali ke halaman tujuan setelah berhasil.

**Kriteria penerimaan:**
- [ ] Diberikan pengunjung tanpa sesi, ketika membuka setiap rute admin, maka diarahkan ke login dan tidak ada data dikembalikan (API mengembalikan 401).
- [ ] Diberikan email yang sudah terdaftar, ketika registrasi, maka muncul pesan "Email sudah terdaftar. Silakan masuk atau gunakan email lain."
- [ ] Diberikan kredensial salah, ketika login, maka pesan tidak menyebutkan apakah email atau sandi yang salah.
- [ ] Diberikan pengguna login, ketika logout, maka menekan tombol kembali browser tidak menampilkan data admin.
- [ ] Diberikan database, ketika diperiksa setelah registrasi, maka kolom `password_hash` tidak berisi sandi asli.

**Kasus tepi:** sesi kedaluwarsa saat mengisi form (simpan draf lokal dan minta login ulang); email berbeda huruf besar/kecil dianggap sama; spasi di awal/akhir email dipangkas.

**Data terkait:** Akun, Perusahaan.

### FR-02 · CRUD profil karyawan

**Deskripsi:** HRD menambah, mengubah, melihat, dan menghapus profil karyawan yang menjadi dasar perhitungan.

**Aturan bisnis:**
- Field wajib: nama lengkap, jabatan, cabang, gaji pokok (> 0), nomor rekening. Tunjangan default 0.
- Nomor rekening hanya angka, 6 sampai 20 digit.
- Kombinasi nama lengkap + nomor rekening unik dalam satu perusahaan (diperlukan FR-19).
- Karyawan yang sudah punya HasilGaji tidak dihapus permanen; diubah menjadi `status_aktif = false`.

**Perilaku:**
- Daftar karyawan berupa tabel dengan pencarian nama dan filter cabang.
- Form tambah/ubah memvalidasi per field dengan pesan jelas.
- Hapus meminta konfirmasi dengan menyebut nama karyawan.

**Kriteria penerimaan:**
- [ ] Diberikan form valid, ketika disimpan, maka karyawan muncul di daftar dalam 2 detik.
- [ ] Diberikan gaji pokok kosong atau 0, ketika disimpan, maka ditolak dengan pesan pada field tersebut.
- [ ] Diberikan nomor rekening berisi huruf, ketika disimpan, maka ditolak dengan pesan "Nomor rekening hanya boleh berisi angka."
- [ ] Diberikan karyawan yang sudah punya riwayat gaji, ketika dihapus, maka statusnya menjadi nonaktif dan riwayat tetap utuh.
- [ ] Diberikan akun perusahaan A, ketika meminta karyawan perusahaan B lewat ID, maka respons 404.

**Kasus tepi:** nama ganda dengan rekening berbeda diizinkan; nomor rekening diawali nol harus tetap tersimpan sebagai teks; nama dengan spasi ganda dinormalisasi.

**Data terkait:** Karyawan.

### FR-03 · Pemilihan tanggal awal periode gaji

**Deskripsi:** HRD memilih tanggal awal; sistem membentuk periode satu bulan kalender dari tanggal itu.

**Aturan bisnis:**
- `tanggal_akhir` = tanggal awal + 1 bulan − 1 hari. Contoh: 26 Jan menjadi 25 Feb; 1 Feb 2024 menjadi 29 Feb 2024.
- Bila bulan berikutnya tidak punya tanggal yang sama (mis. mulai 31 Jan), tanggal akhir adalah 1 hari sebelum tanggal yang dikoreksi ke akhir bulan; uji harus mencakup kasus ini.
- Periode berstatus `draf` sampai disimpan final (FR-16). Periode yang tumpang tindih pada perusahaan sama ditolak.

**Perilaku:**
- Langkah pertama stepper berisi pemilih tanggal dan pratinjau "Periode: 26 Jan 2025 sampai 25 Feb 2025 (31 hari)".
- Jika periode dengan tanggal awal sama sudah ada, tawarkan melanjutkan draf tersebut.

**Kriteria penerimaan:**
- [ ] Diberikan tanggal awal 1 Februari 2024, ketika dipilih, maka tanggal akhir 29 Februari 2024 dan jumlah hari 29.
- [ ] Diberikan tanggal awal 1 Februari 2025, ketika dipilih, maka jumlah hari 28.
- [ ] Diberikan tanggal awal 26 Desember, ketika dipilih, maka tanggal akhir 25 Januari tahun berikutnya.
- [ ] Diberikan periode final yang bersinggungan, ketika membuat periode baru yang tumpang tindih, maka ditolak dengan pesan menyebut periode yang bentrok.

**Kasus tepi:** tanggal awal 29/30/31; pergantian tahun; zona waktu (simpan sebagai tanggal tanpa jam, hindari pergeseran UTC).

**Data terkait:** Periode.

### FR-04 · Unggah file Excel mesin finger dan parsing

**Deskripsi:** HRD mengunggah .xlsx hasil mesin finger; sistem membaca absensi per karyawan per tanggal.

**Aturan bisnis:**
- Hanya .xlsx, maksimal 5 MB. Pencocokan baris ke karyawan memakai nama (dinormalisasi huruf kecil, spasi dirapikan).
- Struktur kolom pasti belum diketahui (pertanyaan terbuka 1): implementasikan pemetaan kolom (nama, tanggal, jam masuk, jam pulang) yang dapat dipilih HRD setelah unggah, dengan tebakan otomatis dari header.
- Tanggal di luar periode diabaikan dan dilaporkan jumlahnya.
- Unggah ulang pada periode yang sama menggantikan data hasil unggah sebelumnya, tetapi tidak menimpa isian manual HRD tanpa konfirmasi.

**Perilaku:**
- Setelah unggah, tampil ringkasan: jumlah baris terbaca, karyawan cocok, nama tak dikenal, baris tidak valid dengan nomor baris dan alasannya.
- Nama tak dikenal dapat dipetakan manual ke karyawan atau diabaikan.
- Baris valid tetap diimpor meski ada baris bermasalah, setelah HRD menekan "Lanjutkan".

**Kriteria penerimaan:**
- [ ] Diberikan .xlsx 200 karyawan di bawah 5 MB, ketika diunggah, maka parsing selesai dalam 10 detik.
- [ ] Diberikan baris dengan jam masuk bukan format waktu, ketika diparsing, maka ditampilkan "Baris 37: jam masuk tidak dapat dibaca" dan baris lain tetap terbaca.
- [ ] Diberikan file .xls atau .csv, ketika diunggah, maka ditolak dengan pesan format yang diterima.
- [ ] Diberikan file lebih dari 5 MB, ketika diunggah, maka ditolak sebelum diproses.
- [ ] Diberikan nama di Excel yang tidak ada di daftar karyawan, ketika diparsing, maka muncul di daftar "Nama tidak dikenal" dengan opsi pemetaan.

**Kasus tepi:** sel tanggal berupa teks atau angka serial Excel; jam pulang kosong (hanya satu kali scan); beberapa sheet (pilih sheet); file kosong atau tanpa header; rumus makro tidak dieksekusi.

**Data terkait:** Absensi, Karyawan, Periode.

### FR-05 · Tampilan absensi per karyawan dengan penanda tanggal kosong

**Deskripsi:** Menampilkan kalender/tabel absensi per karyawan sepanjang periode dan menandai tanggal tanpa data agar HRD mengisinya.

**Aturan bisnis:**
- Tanggal dianggap kosong bila tidak ada record Absensi atau tidak ada status.
- Tanggal yang ditandai libur (FR-07) tidak dianggap kosong.
- Tombol "Hitung Gaji" (FR-15) diblokir selama ada tanggal kosong pada karyawan aktif.

**Perilaku:**
- Daftar karyawan dengan badge jumlah tanggal kosong; filter "Hanya yang belum lengkap".
- Detail per karyawan: baris per tanggal dengan status, jam masuk/pulang, keterangan; tanggal kosong berlatar kuning dan label teks "Kosong" (tidak hanya warna).
- HRD mengisi status dan jam per tanggal; penyimpanan langsung memperbarui hitungan kosong.

**Kriteria penerimaan:**
- [ ] Diberikan karyawan dengan 3 tanggal tanpa data, ketika membuka detailnya, maka ketiganya ditandai "Kosong" dan badge menunjukkan 3.
- [ ] Diberikan HRD mengisi satu tanggal kosong dengan status "hadir", ketika disimpan, maka badge menjadi 2 tanpa muat ulang halaman penuh.
- [ ] Diberikan masih ada tanggal kosong, ketika menekan "Hitung Gaji", maka diblokir dengan pesan menyebut nama karyawan dan jumlah tanggal kosong.
- [ ] Diberikan semua tanggal terisi, ketika membuka daftar, maka badge menunjukkan "Lengkap" dan penghitungan dapat dilanjutkan.

**Kasus tepi:** karyawan nonaktif tidak diperiksa; karyawan baru masuk di tengah periode (tanggal sebelum masuk diberi status "lainnya" dengan keterangan); isi massal untuk banyak tanggal sekaligus pada satu karyawan.

**Data terkait:** Absensi, Karyawan, Periode.

### FR-06 · Penghitungan hari kerja

**Deskripsi:** Menghitung jumlah hari kerja efektif per karyawan dalam periode.

**Aturan bisnis:**
- Hari kerja = hari dalam periode − hari libur (FR-07), dengan hari libur mencakup hari mingguan yang dikonfigurasi dan tanggal merah yang ditandai HRD. Hari kerja minggu default Senin–Sabtu **[Asumsi]**, dapat dikonfigurasi.
- Hari hadir = hari kerja dengan status hadir. Izin, sakit, cuti, dan lainnya tetap dihitung terpisah dan tidak masuk hari hadir.
- Hari tidak hadir tanpa keterangan tidak mungkin ada saat perhitungan karena diblokir FR-05; status "alpa" tidak ada, gunakan "lainnya" dengan keterangan.

**Perilaku:**
- Ringkasan per karyawan: hari kerja, hari hadir, dan rincian per status.
- Dihitung ulang otomatis saat absensi atau penanda libur berubah.

**Kriteria penerimaan:**
- [ ] Diberikan periode 1–30 April 2025 dengan Minggu libur (4 Minggu), ketika dihitung, maka hari kerja = 26.
- [ ] Diberikan 20 kasus uji acuan, ketika dibandingkan dengan hitungan manual, maka selisih 0 hari pada semua kasus.
- [ ] Diberikan karyawan dengan 2 hari sakit, ketika dihitung, maka hari hadir = hari kerja − 2 − (izin + cuti + lainnya).
- [ ] Diberikan satu tanggal merah ditambahkan, ketika disimpan, maka hari kerja semua karyawan berkurang 1.

**Kasus tepi:** periode 29 hari; tanggal merah jatuh pada hari Minggu (tidak dihitung dua kali); karyawan masuk di tengah periode.

**Data terkait:** Absensi, Periode.

### FR-07 · Pencatatan dan penghitungan jumlah libur

**Deskripsi:** HRD menandai hari libur dan sistem menghitung total libur per karyawan.

**Aturan bisnis:**
- Libur dapat berupa libur perusahaan (berlaku untuk semua karyawan di perusahaan) atau libur individual (mis. giliran libur).
- Libur mingguan tetap mengikuti konfigurasi hari kerja FR-06.
- Total libur per karyawan = jumlah tanggal berstatus `libur` dalam periode.

**Perilaku:**
- HRD memilih satu atau beberapa tanggal dan menandainya libur untuk semua atau karyawan terpilih, dengan keterangan.
- Total libur tampil di ringkasan per karyawan.
- Menghapus penanda libur mengembalikan tanggal menjadi kosong bila tidak ada data lain.

**Kriteria penerimaan:**
- [ ] Diberikan 2 tanggal merah ditandai untuk semua karyawan, ketika disimpan, maka setiap karyawan aktif punya 2 record berstatus libur pada tanggal itu.
- [ ] Diberikan libur individual untuk satu karyawan, ketika disimpan, maka karyawan lain tidak terpengaruh.
- [ ] Diberikan tanggal yang sudah berstatus hadir dari mesin finger, ketika ditandai libur, maka sistem meminta konfirmasi sebelum menimpa.
- [ ] Diberikan kasus uji libur, ketika total dihitung, maka sama dengan hitungan manual.

**Kasus tepi:** tanggal di luar periode ditolak; menandai libur pada tanggal yang sudah izin/sakit; libur pada karyawan nonaktif diabaikan.

**Data terkait:** Absensi, Periode, Karyawan.

### FR-08 · Pencatatan izin, sakit, dan lainnya

**Deskripsi:** HRD mencatat ketidakhadiran berjenis izin, sakit, atau lainnya per karyawan.

**Aturan bisnis:**
- Tiap entri wajib punya tanggal dalam periode dan jenis (izin/sakit/lainnya). Jenis "lainnya" wajib berisi keterangan.
- Satu karyawan hanya punya satu status per tanggal.
- Dampak potongan gaji untuk izin/sakit/lainnya mengikuti aturan yang dikonfigurasi HRD **[Asumsi]** (pertanyaan terbuka 2); default tanpa potongan hingga dikonfigurasi.

**Perilaku:**
- Form entri bisa rentang tanggal (mis. sakit 3 hari) yang dipecah menjadi record per tanggal.
- Ringkasan total per jenis per karyawan; daftar entri dapat diubah dan dihapus.

**Kriteria penerimaan:**
- [ ] Diberikan rentang sakit 10–12 Maret, ketika disimpan, maka terbentuk 3 record berstatus sakit dan total sakit bertambah 3.
- [ ] Diberikan jenis "lainnya" tanpa keterangan, ketika disimpan, maka ditolak dengan pesan pada field keterangan.
- [ ] Diberikan tanggal yang sudah punya status, ketika entri baru disimpan, maka sistem menawarkan menimpa dan tidak membuat duplikat.
- [ ] Diberikan entri dihapus, ketika disimpan, maka total per jenis berkurang dan tanggal kembali kosong.

**Kasus tepi:** rentang melewati batas periode (dipotong dan diberi peringatan); rentang mencakup hari libur (hari libur dilewati).

**Data terkait:** Absensi.

### FR-09 · Pencatatan dan penghitungan jumlah cuti

**Deskripsi:** HRD mencatat cuti dan sistem menghitung total cuti terpakai dalam periode.

**Aturan bisnis:**
- Cuti dicatat sebagai status `cuti` per tanggal kerja; hari libur dalam rentang cuti tidak dihitung.
- Hanya cuti terpakai dalam periode yang dihitung. Saldo kuota tahunan tidak dilacak (pertanyaan terbuka 5; di luar cakupan sampai dijawab).
- Cuti berbayar atau tidak mengikuti konfigurasi potongan **[Asumsi]**; default tidak memotong.

**Perilaku:**
- Entri rentang tanggal cuti per karyawan dengan keterangan opsional.
- Total cuti terpakai tampil di ringkasan dan slip.

**Kriteria penerimaan:**
- [ ] Diberikan cuti 5 hari yang mencakup 1 hari Minggu libur, ketika disimpan, maka total cuti = 4.
- [ ] Diberikan cuti pada tanggal berstatus hadir, ketika disimpan, maka diminta konfirmasi sebelum menimpa.
- [ ] Diberikan kasus uji cuti, ketika total dihitung, maka sesuai hitungan manual.
- [ ] Diberikan cuti melewati akhir periode, ketika disimpan, maka hanya tanggal dalam periode tersimpan dan sistem memberi peringatan.

**Kasus tepi:** cuti setengah hari tidak didukung (tolak input pecahan); cuti tumpang tindih dengan sakit.

**Data terkait:** Absensi.

### FR-10 · Input pendapatan aktual cabang dan breakdown ke sales

**Deskripsi:** HRD mengisi pendapatan aktual per cabang dan membaginya ke tiap personil sales.

**Aturan bisnis:**
- Total nominal sales per cabang harus sama dengan `total_aktual` cabang. Selisih menimbulkan peringatan (bukan blokir) dan HRD dapat melanjutkan setelah mengakui selisih.
- Nominal ≥ 0, bilangan bulat rupiah. Hanya karyawan dari cabang tersebut yang dapat menjadi sales di breakdown.

**Perilaku:**
- Per cabang: satu kolom total aktual dan tabel sales dengan kolom nominal.
- Indikator selisih real-time: "Selisih: Rp 150.000 (kurang dari total cabang)".

**Kriteria penerimaan:**
- [ ] Diberikan total cabang Rp 10.000.000 dan breakdown total Rp 9.850.000, ketika disimpan, maka tampil peringatan "Selisih Rp 150.000".
- [ ] Diberikan breakdown yang pas, ketika disimpan, maka tidak ada peringatan.
- [ ] Diberikan nominal negatif, ketika disimpan, maka ditolak.
- [ ] Diberikan cabang tanpa sales, ketika disimpan, maka total tetap tersimpan dan tampil informasi bahwa belum ada breakdown.

**Kasus tepi:** isian dengan titik/koma pemisah ribuan dinormalisasi; sales pindah cabang di tengah periode; cabang dengan total 0.

**Data terkait:** PendapatanCabang, PendapatanSales, Karyawan.

### FR-11 · Penghitungan target per sales dan pencapaiannya

**Deskripsi:** Menghitung persentase pencapaian target tiap sales dan menentukan bonus target.

**Aturan bisnis:**
- `persen_capaian` = nominal / target × 100, dibulatkan 1 desimal (half-up). Target 0 atau kosong menghasilkan "tidak ada target", tanpa pembagian dengan nol.
- **[Asumsi]** Aturan bonus dapat dikonfigurasi HRD berupa tingkat: ambang persen → nominal tetap atau persen dari nominal penjualan. Tanpa konfigurasi, bonus target = 0.

**Perilaku:**
- HRD mengisi target per sales per periode dan mengatur tingkat bonus.
- Tabel menampilkan nominal, target, % capaian, dan bonus.

**Kriteria penerimaan:**
- [ ] Diberikan nominal Rp 8.500.000 dan target Rp 10.000.000, ketika dihitung, maka capaian 85,0%.
- [ ] Diberikan nominal Rp 3.333.333 dan target Rp 10.000.000, ketika dihitung, maka capaian 33,3%.
- [ ] Diberikan target 0, ketika dihitung, maka capaian tampil "Tidak ada target" dan tidak terjadi error.
- [ ] Diberikan aturan "≥100% bonus Rp 500.000", ketika sales mencapai 100,0%, maka bonus Rp 500.000.

**Kasus tepi:** capaian di atas 100% (tidak dibatasi); ambang tepat sama dengan capaian; pembulatan di batas ambang memakai nilai tak dibulatkan untuk penentuan tingkat.

**Data terkait:** PendapatanSales, Karyawan.

### FR-12 · Input insentif pengiriman dan penghitungan bonus/insentif

**Deskripsi:** HRD mengisi insentif pengiriman per karyawan; sistem menjumlahkannya bersama bonus target.

**Aturan bisnis:**
- Insentif punya jenis (mis. "pengiriman") dan nominal ≥ 0; satu karyawan dapat punya banyak entri.
- Total insentif = jumlah semua entri + bonus target (FR-11).

**Perilaku:**
- Tabel input per karyawan dengan tombol tambah baris; total otomatis.
- Total insentif masuk ke rincian gaji (FR-15).

**Kriteria penerimaan:**
- [ ] Diberikan 2 entri insentif Rp 200.000 dan Rp 150.000, ketika dihitung, maka total insentif Rp 350.000.
- [ ] Diberikan insentif Rp 350.000 dan bonus target Rp 500.000, ketika gaji dihitung, maka komponen insentif+bonus = Rp 850.000.
- [ ] Diberikan nominal kosong, ketika disimpan, maka dianggap 0 dan baris kosong tidak tersimpan.
- [ ] Diberikan 20 kasus uji, ketika dibandingkan dengan manual, maka selisih Rp 0.

**Kasus tepi:** karyawan tanpa insentif; entri duplikat (peringatan, tidak diblokir).

**Data terkait:** Insentif, PendapatanSales.

### FR-13 · Pencatatan denda dan potongan gaji

**Deskripsi:** HRD mencatat denda dengan alasan dan nominal yang dipotong dari gaji.

**Aturan bisnis:**
- Denda wajib punya alasan dan total > 0. Bila `jumlah_cicilan` = 1, seluruhnya dipotong di periode tanggal mulai.
- Potongan absensi mengikuti aturan terkonfigurasi **[Asumsi]**; denda dan potongan absensi ditampilkan sebagai baris terpisah.
- Potongan tidak boleh membuat gaji bersih negatif; bila terjadi, tampilkan peringatan dan HRD memutuskan (lihat Aturan lintas fitur).

**Perilaku:**
- Form denda: karyawan, alasan, total, jumlah cicilan, periode mulai.
- Daftar denda per karyawan dengan status (berjalan/lunas).

**Kriteria penerimaan:**
- [ ] Diberikan denda Rp 100.000 satu kali pada periode Maret, ketika gaji Maret dihitung, maka potongan denda Rp 100.000 muncul dan periode lain tidak.
- [ ] Diberikan denda tanpa alasan, ketika disimpan, maka ditolak.
- [ ] Diberikan denda total 0 atau negatif, ketika disimpan, maka ditolak.
- [ ] Diberikan potongan melebihi gaji kotor, ketika dihitung, maka peringatan ditampilkan pada karyawan tersebut.

**Kasus tepi:** denda dibuat setelah periode difinalkan (hanya berlaku mulai periode berikutnya); denda dihapus sebelum dipotong.

**Data terkait:** Denda, PotonganDenda, PotonganLain.

### FR-14 · Denda cicilan

**Deskripsi:** Denda besar dipecah menjadi cicilan dan dipotong otomatis tiap periode sampai lunas.

**Aturan bisnis:**
- Cicilan per periode = total / jumlah_cicilan, dibulatkan ke bawah ke rupiah; sisa pembulatan masuk ke cicilan terakhir.
- `sisa` = total − jumlah potongan yang sudah difinalkan; tidak pernah negatif. Potongan berhenti saat sisa = 0.
- Sisa hanya berkurang saat periode difinalkan (FR-16), bukan saat pratinjau.
- Siapa yang menentukan jumlah cicilan: HRD, tanpa batas nominal **[Asumsi]** (pertanyaan terbuka 6).

**Perilaku:**
- Jadwal cicilan ditampilkan saat denda dibuat: periode ke-n dan nominalnya.
- Tiap perhitungan gaji menambahkan potongan cicilan untuk denda berjalan yang `tanggal_mulai` ≤ periode.

**Kriteria penerimaan:**
- [ ] Diberikan denda Rp 1.000.000 dengan 3 cicilan, ketika jadwal dibuat, maka cicilan Rp 333.333, Rp 333.333, Rp 333.334.
- [ ] Diberikan periode final ketiga, ketika disimpan, maka sisa = 0 dan status lunas.
- [ ] Diberikan denda lunas, ketika periode berikutnya dihitung, maka tidak ada potongan denda tersebut.
- [ ] Diberikan penghitungan ulang periode draf berkali-kali, ketika belum difinalkan, maka sisa tidak berubah.

**Kasus tepi:** sisa lebih kecil dari cicilan standar (potong sebesar sisa); periode dilewati (tidak ada gaji) tidak memotong; cicilan 1 kali; membatalkan finalisasi mengembalikan sisa.

**Data terkait:** Denda, PotonganDenda, Periode.

### FR-15 · Hitung gaji dan tampilkan rincian sebelum disimpan

**Deskripsi:** Satu tombol "Hitung Gaji" memproses semua karyawan aktif dan menampilkan rincian yang dapat diperiksa.

**Aturan bisnis:**
- Rumus **[Asumsi]**: gaji bersih = gaji pokok + tunjangan + insentif + bonus target − denda − potongan absensi − pajak/asuransi.
- Perhitungan diblokir bila ada tanggal kosong (FR-05) atau selisih breakdown belum diakui (FR-10).
- Hasil pada tahap ini belum disimpan permanen (draf).

**Perilaku:**
- Tabel ringkas semua karyawan dengan total bersih; klik baris membuka rincian tiap komponen.
- Karyawan bermasalah (gaji bersih negatif, peringatan) ditandai di atas.
- Tombol "Simpan" tersedia setelah hasil tampil.

**Kriteria penerimaan:**
- [ ] Diberikan 200 karyawan lengkap, ketika menekan "Hitung Gaji", maka hasil tampil dalam 5 detik.
- [ ] Diberikan gaji pokok Rp 4.000.000, tunjangan Rp 500.000, insentif Rp 350.000, denda Rp 100.000, asuransi Rp 150.000, ketika dihitung, maka gaji bersih Rp 4.600.000.
- [ ] Diberikan rincian dibuka, ketika dilihat, maka setiap komponen rumus tampil sebagai baris tersendiri.
- [ ] Diberikan hasil yang sama untuk input sama, ketika dihitung dua kali, maka hasil identik (deterministik).

**Kasus tepi:** nol karyawan aktif (pesan arahan); karyawan nonaktif dikecualikan; perubahan data setelah hitung membuat hasil usang (tampilkan tanda "perlu hitung ulang").

**Data terkait:** HasilGaji, semua entitas masukan.

### FR-16 · Simpan hasil penggajian dan riwayat per periode

**Deskripsi:** Menyimpan hasil sebagai snapshot dan menampilkan riwayat per bulan.

**Aturan bisnis:**
- Menyimpan memfinalkan periode (`status = final`) dan menyimpan snapshot JSON rincian per karyawan; perubahan profil sesudahnya tidak mengubah snapshot.
- Periode final bersifat baca-saja; pembukaan kembali ke draf membutuhkan konfirmasi eksplisit dan mengembalikan efek cicilan (FR-14).

**Perilaku:**
- Konfirmasi sebelum simpan menyebut periode dan jumlah karyawan.
- Halaman riwayat: daftar periode per bulan dengan total gaji dan jumlah karyawan; klik untuk melihat rincian tersimpan.

**Kriteria penerimaan:**
- [ ] Diberikan hasil terhitung, ketika menekan "Simpan" dan mengonfirmasi, maka periode berstatus final dan muncul di riwayat.
- [ ] Diberikan periode final, ketika gaji pokok karyawan diedit, maka rincian tersimpan tetap menampilkan gaji pokok lama.
- [ ] Diberikan periode final, ketika HRD mencoba mengubah absensinya, maka ditolak kecuali dibuka kembali.
- [ ] Diberikan penyimpanan gagal di tengah proses, ketika terjadi error, maka tidak ada data parsial tersimpan (transaksi atomik).

**Kasus tepi:** klik ganda tombol simpan (idempoten); dua HRD memfinalkan bersamaan.

**Data terkait:** HasilGaji, Periode, PotonganDenda.

### FR-17 · Ekspor hasil penggajian ke Excel

**Deskripsi:** HRD mengunduh hasil penggajian sebagai file .xlsx.

**Aturan bisnis:**
- Kolom mengikuti rincian layar; total sama persis dengan layar. Nomor rekening ditulis sebagai teks agar angka nol di depan tidak hilang.

**Perilaku:**
- Tombol "Ekspor ke Excel" pada hasil hitung dan pada riwayat; nama file `PayMe_<tanggal-awal>_<tanggal-akhir>.xlsx`.
- Baris total di bagian bawah.

**Kriteria penerimaan:**
- [ ] Diberikan 200 karyawan, ketika ekspor, maka file terunduh dalam 5 detik.
- [ ] Diberikan file ekspor, ketika total kolom dijumlahkan, maka sama dengan angka di layar.
- [ ] Diberikan nomor rekening berawalan 0, ketika dibuka di Excel, maka angka 0 tetap ada.
- [ ] Diberikan pengguna tanpa sesi, ketika memanggil endpoint ekspor, maka ditolak 401.

**Kasus tepi:** nama berisi karakter khusus; nilai diawali `=`, `+`, `-`, `@` harus di-escape agar tidak dieksekusi sebagai rumus.

**Data terkait:** HasilGaji, Karyawan.

### FR-18 · Potongan pajak dan asuransi sebagai nominal input

**Deskripsi:** HRD mengatur nominal potongan pajak dan asuransi per karyawan; bukan perhitungan PPh.

**Aturan bisnis:**
- Nominal ≥ 0, jenis `pajak` atau `asuransi`. Dapat diisi per periode atau diteruskan dari periode sebelumnya **[Asumsi]**.
- Sistem tidak menghitung PPh atau iuran otomatis.

**Perilaku:**
- Tabel input per karyawan dengan dua kolom (pajak, asuransi), opsi "Salin dari periode sebelumnya".
- Nominal masuk sebagai pengurang pada FR-15.

**Kriteria penerimaan:**
- [ ] Diberikan asuransi Rp 150.000 dan pajak Rp 50.000, ketika gaji dihitung, maka total pengurang dari kedua jenis ini Rp 200.000.
- [ ] Diberikan nominal negatif, ketika disimpan, maka ditolak.
- [ ] Diberikan "Salin dari periode sebelumnya", ketika dipakai, maka nominal terisi dan masih dapat diubah.

**Kasus tepi:** tidak ada periode sebelumnya (pesan informasi); karyawan baru tanpa data.

**Data terkait:** PotonganLain.

### FR-19 · Halaman karyawan

**Deskripsi:** Halaman publik tempat karyawan melihat gaji, cuti, dan potongan dengan memasukkan nama lengkap dan nomor rekening.

**Aturan bisnis:**
- Data tampil hanya bila nama lengkap (tidak peka huruf besar/kecil, spasi dirapikan) dan nomor rekening cocok dengan satu karyawan.
- Setelah 5 kali gagal berturut-turut dari kombinasi IP dan/atau perangkat, akses diblokir 15 menit.
- Pesan gagal selalu sama: "Data tidak ditemukan. Periksa kembali nama dan nomor rekening Anda."
- Hanya data periode final yang tampil. Usulan PIN/tanggal lahir di PRD belum menjadi kebutuhan; jangan diimplementasikan, tetapi susun kode agar faktor tambahan mudah ditambahkan.
- Karena perusahaan tidak dikenali dari input, jika nama + rekening cocok pada lebih dari satu perusahaan, tampilkan pesan generik gagal dan catat untuk ditinjau (kasus langka).

**Perilaku:**
- Dua kolom isian dan satu tombol "Lihat Gaji Saya".
- Hasil: daftar periode final terbaru dengan rincian gaji, jumlah cuti, dan potongan; nomor rekening ditampilkan tersamar (mis. `••••1234`).
- Tidak ada sesi persisten; menutup halaman menghapus data dari layar.

**Kriteria penerimaan:**
- [ ] Diberikan nama dan rekening yang cocok, ketika dikirim, maka rincian periode final terbaru tampil.
- [ ] Diberikan nama benar tetapi rekening salah, ketika dikirim, maka pesan sama persis dengan kasus nama salah rekening benar.
- [ ] Diberikan 5 kali gagal berturut-turut, ketika percobaan ke-6 dalam 15 menit, maka ditolak dengan pesan "Terlalu banyak percobaan. Coba lagi dalam 15 menit." walau input benar.
- [ ] Diberikan periode masih draf, ketika karyawan mencari, maka data periode itu tidak tampil.
- [ ] Diberikan log server, ketika diperiksa setelah percobaan, maka nomor rekening tidak tercatat utuh.

**Kasus tepi:** nama dengan gelar atau spasi ganda; karyawan nonaktif (data riwayat tetap tampil); respons waktu harus seragam agar tidak membocorkan keberadaan data; pembatasan tidak boleh dapat dilewati dengan mengganti header.

**Data terkait:** Karyawan, HasilGaji, Absensi.

### FR-20 · Pesan panduan dan validasi Bahasa Indonesia

**Deskripsi:** Semua langkah memiliki panduan singkat dan pesan error yang jelas dalam Bahasa Indonesia.

**Aturan bisnis:**
- Setiap pesan error memuat penyebab dan langkah perbaikan, tanpa istilah teknis (tanpa kode error mentah).
- Alur penggajian ditampilkan sebagai stepper 9 langkah sesuai Alur utama PRD.

**Perilaku:**
- Stepper menunjukkan langkah aktif, selesai, dan belum; tiap langkah memiliki teks bantuan 1–2 kalimat.
- Validasi ditampilkan di samping field yang bermasalah; ringkasan error di atas form bila banyak.
- Kesalahan server menampilkan pesan ramah dan opsi "Coba lagi".

**Kriteria penerimaan:**
- [ ] Diberikan daftar seluruh pesan error di kode, ketika diaudit, maka 100% berisi penyebab dan langkah perbaikan.
- [ ] Diberikan pengguna di langkah mana pun, ketika melihat layar, maka indikator langkah dan teks bantuan terlihat.
- [ ] Diberikan form kosong yang dikirim, ketika divalidasi, maka fokus berpindah ke field pertama yang salah.
- [ ] Diberikan teks antarmuka, ketika diperiksa, maka tidak ada string Inggris yang terlihat pengguna.

**Kasus tepi:** error dari pustaka pihak ketiga dipetakan ke pesan Indonesia; pesan panjang tidak memotong tata letak.

**Data terkait:** tidak ada entitas khusus.

## Aturan lintas fitur

- **Isolasi data:** semua akses data memakai `perusahaan_id` dari sesi, bukan dari parameter klien; uji otorisasi lintas perusahaan wajib ada untuk setiap endpoint (NFR-09).
- **Keuangan:** gunakan bilangan bulat rupiah dan fungsi perhitungan murni yang dapat diuji; pembulatan half-up hanya pada tampilan persentase, cicilan memakai pembulatan ke bawah dengan sisa di cicilan terakhir.
- **Gaji bersih negatif:** tampilkan peringatan per karyawan; penyimpanan tetap diizinkan setelah HRD mengakui peringatan, dan tidak ada nilai dipotong otomatis.
- **Status periode:** `draf` dapat diubah; `final` baca-saja. Hanya finalisasi yang mengubah sisa denda.
- **Keamanan dan privasi:** HTTPS, kata sandi ter-hash, nomor rekening disamarkan di log dan UI publik, data karyawan tidak muncul di URL atau pesan error.
- **Aksesibilitas:** kontras teks minimal 4.5:1, font isi minimal 14 px, status tidak hanya dibedakan lewat warna; layar minimal 1280 px dan tablet 768 px.
- **Konfigurasi [Asumsi]:** hari kerja mingguan, aturan potongan izin/sakit/cuti, dan tingkat bonus target disimpan sebagai pengaturan per perusahaan, bukan tertanam di kode.
- **Di luar cakupan:** integrasi bank, laporan PPh, manajemen cuti/absensi terintegrasi, dashboard analitik, aplikasi mobile native, dan akun karyawan tidak boleh dikerjakan.
