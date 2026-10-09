# PayMe

Aplikasi web untuk menghitung gaji karyawan dari data absensi mesin finger. HRD mengunggah file Excel hasil mesin, melengkapi data yang kurang, lalu sistem menghitung gaji bersih, menyimpannya sebagai riwayat, dan mengekspornya ke Excel. Karyawan melihat gajinya sendiri lewat halaman publik, cukup dengan nama lengkap dan nomor rekening.

Seluruh tampilan dan pesan berbahasa Indonesia.

## Alur penggajian

HRD dipandu sembilan langkah, masing-masing dengan teks bantuan:

1. **Periode**: pilih tanggal awal, rentang satu bulan dihitung otomatis.
2. **Unggah absensi**: baca file `.xlsx` mesin finger, cocokkan kolom, periksa baris bermasalah, lalu simpan.
3. **Lengkapi absensi**: isi tanggal yang masih kosong per karyawan.
4. **Libur, izin, dan cuti**: catat libur perusahaan dan ketidakhadiran, boleh banyak hari sekaligus.
5. **Pendapatan dan target**: total pendapatan cabang, pembagian per sales, capaian target, dan bonus bertingkat.
6. **Insentif**: beberapa baris insentif per karyawan.
7. **Denda dan potongan**: denda bercicil, serta pajak dan asuransi sebagai nominal isian.
8. **Hitung gaji**: rincian setiap komponen per karyawan, penanda gaji bersih negatif, lalu simpan sebagai final.
9. **Ekspor**: unduh hasil ke Excel.

Halaman karyawan ada di `/lihat-gaji`. Hanya periode yang sudah final yang tampil, nomor rekening selalu tersamar, dan akses diblokir 15 menit setelah lima kali gagal berturut-turut.

## Teknologi

Next.js 16 (App Router), React 19, TypeScript, Prisma 7 dengan PostgreSQL 17, Tailwind CSS 4, Zod, ExcelJS, argon2id untuk kata sandi, Vitest, dan Playwright.

## Menjalankan di komputer sendiri

Prasyarat: Node.js 22 atau lebih baru, npm, dan Docker (untuk PostgreSQL lokal).

```bash
npm install
cp .env.example .env        # Windows PowerShell: copy .env.example .env
# isi nilai di .env, lihat bagian Konfigurasi
npm run db:up               # PostgreSQL lokal di port 5440
npm run db:deploy           # terapkan migrasi
npm run dev                 # http://localhost:3000
```

Data demo fiktif (perusahaan dan enam karyawan) bersifat opsional. Kata sandi akun demo diberikan lewat variabel `SEED_PASSWORD`, tidak ditanam di kode:

```bash
SEED_PASSWORD=isi-kata-sandi-anda npm run db:seed          # Windows PowerShell: $env:SEED_PASSWORD="..."; npm run db:seed
```

Masuk dengan `demo@payme.test`. File contoh format mesin finger tersedia di `contoh/absensi-contoh-agustus-2026.xlsx` (periode 24 Agustus sampai 23 September 2026, enam karyawan fiktif yang sama dengan data demo). Berkas itu dibuat ulang dengan `npm run contoh:absensi`. Jangan menaruh data absensi asli di repositori; `.gitignore` sudah mengecualikan `absenall4yani.xlsx` dan `*.local.xlsx`.

## Perintah

| Perintah | Fungsi |
|---|---|
| `npm run dev` | server pengembangan |
| `npm run build` lalu `npm start` | build dan jalankan produksi |
| `npm run check` | typecheck, lint, dan seluruh tes |
| `npm test` | tes unit dan integrasi (menerapkan migrasi ke database uji lebih dulu) |
| `npm run test:e2e` | build, lalu tes end-to-end Playwright |
| `npm run db:up` / `db:down` | nyalakan atau matikan PostgreSQL lokal |
| `npm run db:migrate` | buat migrasi baru saat mengubah `prisma/schema.prisma` |
| `npm run db:deploy` | terapkan migrasi yang belum berjalan (dipakai juga di produksi) |

## Pengujian

- **Unit**: seluruh rumus uang, periode, absensi, bonus target, cicilan, dan gaji adalah fungsi murni di `src/domain` dengan tes di `tests/unit`.
- **Integrasi**: layanan dan route API diuji terhadap PostgreSQL sungguhan di `tests/integration`, termasuk tes otorisasi yang memastikan setiap route menolak permintaan tanpa sesi dan menjawab 404 bagi perusahaan lain.
- **End-to-end**: `e2e/penggajian.spec.ts` menjalankan alur dari pendaftaran, unggah absensi, pengisian data, hitung, simpan, ekspor, sampai karyawan melihat gajinya. Pasang browser sekali dengan `npx playwright install chromium firefox webkit`. Alur penuh berjalan di Chromium dan Firefox. Di WebKit (Safari) hanya pemeriksaan tampilan dan validasi yang berjalan, karena WebKit menolak cookie `Secure` pada `http://localhost`; alur penuh di Safari perlu dicoba manual lewat HTTPS. Tangkapan layar tiap langkah penting tersimpan di `test-results/tangkapan`.
- **CI**: `.github/workflows/ci.yml` menjalankan typecheck, lint, tes unit dan integrasi, lalu E2E dengan PostgreSQL sekali pakai pada setiap push dan pull request ke `main`.

## Aturan perhitungan

```
gaji bersih = gaji pokok + tunjangan + insentif + bonus target
              - denda - potongan absensi - pajak - asuransi
```

- Semua nominal adalah bilangan bulat rupiah. Tidak ada pecahan di mana pun.
- Persentase capaian target dibulatkan setengah ke atas satu desimal untuk tampilan; penentuan tingkat bonus memakai nilai yang belum dibulatkan, dan yang berlaku adalah tingkat tertinggi yang terpenuhi.
- Cicilan denda dibulatkan ke bawah, sisa pembulatan masuk ke cicilan terakhir. Sisa denda hanya berkurang saat periode disimpan final, bukan saat pratinjau.
- Hari libur mingguan otomatis tidak dianggap kosong. Gaji tidak bisa dihitung selama masih ada tanggal kosong atau selisih pendapatan cabang yang belum diakui.
- Gaji bersih negatif hanya memberi peringatan. HRD harus mengakuinya sebelum menyimpan, dan sistem tidak memotong angka secara otomatis.
- Menyimpan berarti memfinalkan periode dan membuat snapshot per karyawan dalam satu transaksi. Perubahan profil karyawan sesudahnya tidak mengubah hasil tersimpan. Periode final bisa dibuka kembali, dan efek cicilan dikembalikan.

## Keamanan

- Kata sandi di-hash dengan argon2id. Sesi disimpan di database dan dikirim lewat cookie `HttpOnly`.
- Setiap route admin memeriksa sesi dan memfilter data berdasarkan perusahaan dari sesi, bukan dari parameter klien.
- Permintaan yang mengubah data diperiksa asal (Origin). Percobaan masuk dan halaman karyawan dibatasi lewat penghitung atomik di database.
- Unggahan Excel divalidasi ukuran dan isi arsipnya. Sel ekspor yang diawali `=`, `+`, `-`, atau `@` di-escape agar tidak dijalankan sebagai rumus.
- Nomor rekening disamarkan di log dan di halaman publik. Halaman dan API yang memuat data gaji tidak boleh disimpan cache browser.
- Pendaftaran akun dan halaman karyawan dibatasi per perangkat, per IP (hanya bila `TRUST_PROXY=true`), dan secara menyeluruh atau per nama. Penyerang yang membuang cookie perangkat di tiap permintaan hanya tertahan oleh batas per nama dan batas IP, jadi aktifkan `TRUST_PROXY` di belakang proxy tepercaya. Baris pembatas yang sudah kedaluwarsa dibersihkan otomatis saat server hidup dan setiap enam jam.
- Halaman karyawan hanya memakai nama lengkap dan nomor rekening sebagai faktor. Faktor tambahan (PIN atau tanggal lahir) belum diaktifkan karena belum menjadi kebutuhan di PRD, tetapi titik pemasangannya sudah disiapkan di `src/server/services/publik.ts`.
- Unggahan Excel dikembangkan dengan batas keras 64 MB di memori, sehingga ukuran terurai yang dipalsukan di header tidak berguna.
- Tidak ada rahasia di kode. Semua dibaca dari variabel lingkungan.

## Konfigurasi

| Variabel | Wajib | Keterangan |
|---|---|---|
| `DATABASE_URL` | ya | alamat PostgreSQL aplikasi |
| `APP_SECRET` | ya | kunci acak minimal 32 karakter untuk menyamarkan IP dan perangkat; buat dengan `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `TRUST_PROXY` | tidak | `true` hanya bila aplikasi berada di belakang proxy tepercaya yang menimpa `X-Forwarded-For`. Bawaan `false` |
| `POSTGRES_PASSWORD`, `DB_PORT` | lokal | dipakai `docker-compose.yml` |
| `TEST_DATABASE_URL` | tes | database terpisah (`payme_test`) agar tes tidak menyentuh data pengembangan |
| `SEED_PASSWORD` | seed | kata sandi akun demo, hanya untuk `db:seed` |
| `PORT` | tidak | port server produksi, bawaan 3000 |

## Rilis ke produksi

Hosting belum ditetapkan di dokumen rencana. Langkah di bawah berlaku untuk host Node.js mana pun dengan PostgreSQL terkelola.

### Persiapan satu kali

1. Siapkan PostgreSQL 15 atau lebih baru, satu database dan satu pengguna khusus aplikasi. Bila penyedia mewajibkan TLS, tambahkan `sslmode=require` pada `DATABASE_URL`.
2. Isi variabel lingkungan pada penyedia hosting: `DATABASE_URL`, `APP_SECRET` (nilai baru, jangan sama dengan lokal), dan `TRUST_PROXY=true` bila ada proxy atau CDN tepercaya di depan aplikasi. Tanpa itu pembatas per IP tidak aktif, dan perlindungan pendaftaran serta halaman karyawan hanya bertumpu pada cookie perangkat dan batas per nama.
3. Pasang sertifikat HTTPS di hosting atau proxy. Aplikasi mengirim header `Strict-Transport-Security` pada mode produksi, jadi pastikan HTTPS sudah aktif sebelum membuka alamat ke pengguna.
4. Jadwalkan cadangan harian (bagian di bawah).

### Setiap rilis

```bash
npm ci
npm run db:deploy     # terapkan migrasi, harus selesai sebelum versi baru melayani lalu lintas
npm run build
npm start
```

Jalankan `db:deploy` pada tahap rilis dengan seluruh dependensi terpasang (CLI Prisma ada di `devDependencies`). Migrasi hanya bergerak maju, jadi buat cadangan sebelum rilis yang memuat migrasi baru.

### Uji asap setelah rilis

1. Buka `/masuk` lewat HTTPS dan pastikan tidak ada peringatan sertifikat.
2. Daftar akun baru, buat periode, unggah file contoh dari folder `contoh`.
3. Lengkapi data, hitung gaji, simpan, lalu unduh Excel dan cocokkan totalnya dengan layar.
4. Buka `/lihat-gaji` dari perangkat lain, masukkan nama dan rekening salah satu karyawan, dan pastikan rekening tampil tersamar.
5. Hapus data uji (periode dan perusahaan percobaan) sebelum dipakai nyata.

### Cadangan dan pemulihan

`scripts/db/backup.sh` membuat cadangan `pg_dump` berformat custom, memastikan berkasnya terbaca kembali, dan menghapus cadangan yang lebih tua dari 30 hari. Berkas hanya bisa dibaca pemilik karena berisi data gaji dan nomor rekening. Jadwalkan sekali sehari, misalnya lewat cron:

```cron
15 2 * * * cd /opt/payme && DATABASE_URL=postgresql://... BACKUP_DIR=/var/backups/payme ./scripts/db/backup.sh
```

Simpan juga salinannya di luar server yang sama. Bila memakai PostgreSQL terkelola dengan cadangan otomatis, atur retensinya ke 30 hari dan gunakan skrip ini sebagai tambahan.

Pemulihan mengganti seluruh isi database tujuan, jadi skrip meminta konfirmasi:

```bash
DATABASE_URL=postgresql://... ./scripts/db/restore.sh backup/payme-20261009-021500.dump
```

Latih pemulihan ke database sementara secara berkala. Cadangan yang belum pernah dicoba dipulihkan belum bisa dianggap cadangan.

### Rollback

Pulihkan kode ke versi sebelumnya dan jalankan `npm run build` lalu `npm start`. Bila rilis memuat migrasi yang tidak kompatibel dengan versi lama, pulihkan database dari cadangan sebelum rilis.

### Catatan operasional

- Pendaftaran akun (`/daftar`) terbuka untuk siapa pun yang mengetahui alamatnya, dan setiap pendaftar mendapat perusahaan terpisah. Bila aplikasi hanya untuk satu perusahaan, batasi akses ke `/daftar` di level proxy setelah akun HRD dibuat.
- Pengaturan hari kerja mingguan, aturan potongan izin, sakit, dan cuti, serta tingkat bonus target disimpan per perusahaan di menu Pengaturan, bukan di kode.

## Dokumen

- [docs/PRD.md](docs/PRD.md): kebutuhan produk.
- [docs/SPEC.md](docs/SPEC.md): spesifikasi fitur beserta kriteria penerimaan.
- [docs/TASKS.md](docs/TASKS.md): daftar tugas dan statusnya.
