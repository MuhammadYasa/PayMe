-- Diperlukan untuk constraint EXCLUDE pada tabel periode (perusahaan_id memakai operator =).
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- CreateEnum
CREATE TYPE "status_periode" AS ENUM ('DRAF', 'FINAL');

-- CreateEnum
CREATE TYPE "status_absensi" AS ENUM ('HADIR', 'IZIN', 'SAKIT', 'CUTI', 'LIBUR', 'LAINNYA');

-- CreateEnum
CREATE TYPE "sumber_absensi" AS ENUM ('MESIN', 'MANUAL');

-- CreateEnum
CREATE TYPE "jenis_potongan_lain" AS ENUM ('PAJAK', 'ASURANSI');

-- CreateTable
CREATE TABLE "perusahaan" (
    "id" UUID NOT NULL,
    "nama" VARCHAR(150) NOT NULL,
    "dibuat_pada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "perusahaan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "akun" (
    "id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "nama" VARCHAR(100) NOT NULL,
    "perusahaan_id" UUID NOT NULL,
    "dibuat_pada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "akun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sesi" (
    "id" UUID NOT NULL,
    "akun_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "dibuat_pada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kedaluwarsa_pada" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sesi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pengaturan_perusahaan" (
    "id" UUID NOT NULL,
    "perusahaan_id" UUID NOT NULL,
    "hari_kerja_mingguan" INTEGER[] DEFAULT ARRAY[1, 2, 3, 4, 5, 6]::INTEGER[],
    "aturan_potongan" JSONB NOT NULL DEFAULT '{}',
    "tingkat_bonus" JSONB NOT NULL DEFAULT '[]',
    "diubah_pada" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "pengaturan_perusahaan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "karyawan" (
    "id" UUID NOT NULL,
    "perusahaan_id" UUID NOT NULL,
    "nama_lengkap" VARCHAR(150) NOT NULL,
    "nama_kunci" VARCHAR(150) NOT NULL,
    "jabatan" VARCHAR(100) NOT NULL,
    "cabang" VARCHAR(100) NOT NULL,
    "gaji_pokok" INTEGER NOT NULL,
    "tunjangan" INTEGER NOT NULL DEFAULT 0,
    "nomor_rekening" VARCHAR(20) NOT NULL,
    "status_aktif" BOOLEAN NOT NULL DEFAULT true,
    "dibuat_pada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diubah_pada" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "karyawan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "karyawan_alias" (
    "id" UUID NOT NULL,
    "perusahaan_id" UUID NOT NULL,
    "karyawan_id" UUID NOT NULL,
    "alias_kunci" VARCHAR(150) NOT NULL,
    "dibuat_pada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "karyawan_alias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "periode" (
    "id" UUID NOT NULL,
    "perusahaan_id" UUID NOT NULL,
    "tanggal_awal" DATE NOT NULL,
    "tanggal_akhir" DATE NOT NULL,
    "status" "status_periode" NOT NULL DEFAULT 'DRAF',
    "difinalkan_pada" TIMESTAMPTZ(3),
    "dibuat_pada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "periode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "absensi" (
    "id" UUID NOT NULL,
    "perusahaan_id" UUID NOT NULL,
    "periode_id" UUID NOT NULL,
    "karyawan_id" UUID NOT NULL,
    "tanggal" DATE NOT NULL,
    "jam_masuk" VARCHAR(5),
    "jam_pulang" VARCHAR(5),
    "status" "status_absensi" NOT NULL,
    "keterangan" VARCHAR(255),
    "sumber" "sumber_absensi" NOT NULL DEFAULT 'MANUAL',
    "diubah_pada" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "absensi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pendapatan_cabang" (
    "id" UUID NOT NULL,
    "perusahaan_id" UUID NOT NULL,
    "periode_id" UUID NOT NULL,
    "cabang" VARCHAR(100) NOT NULL,
    "total_aktual" BIGINT NOT NULL,
    "selisih_diakui" BOOLEAN NOT NULL DEFAULT false,
    "diubah_pada" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "pendapatan_cabang_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pendapatan_sales" (
    "id" UUID NOT NULL,
    "perusahaan_id" UUID NOT NULL,
    "periode_id" UUID NOT NULL,
    "karyawan_id" UUID NOT NULL,
    "cabang" VARCHAR(100) NOT NULL,
    "nominal" BIGINT NOT NULL DEFAULT 0,
    "target" BIGINT NOT NULL DEFAULT 0,
    "persen_capaian" DECIMAL(9,1),
    "diubah_pada" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "pendapatan_sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insentif" (
    "id" UUID NOT NULL,
    "perusahaan_id" UUID NOT NULL,
    "periode_id" UUID NOT NULL,
    "karyawan_id" UUID NOT NULL,
    "jenis" VARCHAR(100) NOT NULL,
    "nominal" INTEGER NOT NULL,

    CONSTRAINT "insentif_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "denda" (
    "id" UUID NOT NULL,
    "perusahaan_id" UUID NOT NULL,
    "karyawan_id" UUID NOT NULL,
    "alasan" VARCHAR(255) NOT NULL,
    "total" INTEGER NOT NULL,
    "jumlah_cicilan" INTEGER NOT NULL,
    "sisa" INTEGER NOT NULL,
    "tanggal_mulai" DATE NOT NULL,
    "dibuat_pada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "denda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "potongan_denda" (
    "id" UUID NOT NULL,
    "perusahaan_id" UUID NOT NULL,
    "denda_id" UUID NOT NULL,
    "periode_id" UUID NOT NULL,
    "nominal" INTEGER NOT NULL,

    CONSTRAINT "potongan_denda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "potongan_lain" (
    "id" UUID NOT NULL,
    "perusahaan_id" UUID NOT NULL,
    "periode_id" UUID NOT NULL,
    "karyawan_id" UUID NOT NULL,
    "jenis" "jenis_potongan_lain" NOT NULL,
    "nominal" INTEGER NOT NULL,

    CONSTRAINT "potongan_lain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hasil_gaji" (
    "id" UUID NOT NULL,
    "perusahaan_id" UUID NOT NULL,
    "periode_id" UUID NOT NULL,
    "karyawan_id" UUID NOT NULL,
    "rincian" JSONB NOT NULL,
    "total_bersih" INTEGER NOT NULL,
    "dibuat_pada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hasil_gaji_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "percobaan_publik" (
    "id" UUID NOT NULL,
    "kunci" VARCHAR(64) NOT NULL,
    "jumlah_gagal" INTEGER NOT NULL DEFAULT 0,
    "jendela_mulai" TIMESTAMPTZ(3) NOT NULL,
    "diblokir_sampai" TIMESTAMPTZ(3),

    CONSTRAINT "percobaan_publik_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catatan_tinjauan" (
    "id" UUID NOT NULL,
    "jenis" VARCHAR(60) NOT NULL,
    "detail" JSONB NOT NULL,
    "dibuat_pada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "catatan_tinjauan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "akun_email_key" ON "akun"("email");

-- CreateIndex
CREATE INDEX "akun_perusahaan_id_idx" ON "akun"("perusahaan_id");

-- CreateIndex
CREATE UNIQUE INDEX "sesi_token_hash_key" ON "sesi"("token_hash");

-- CreateIndex
CREATE INDEX "sesi_akun_id_idx" ON "sesi"("akun_id");

-- CreateIndex
CREATE INDEX "sesi_kedaluwarsa_pada_idx" ON "sesi"("kedaluwarsa_pada");

-- CreateIndex
CREATE UNIQUE INDEX "pengaturan_perusahaan_perusahaan_id_key" ON "pengaturan_perusahaan"("perusahaan_id");

-- CreateIndex
CREATE INDEX "karyawan_perusahaan_id_cabang_idx" ON "karyawan"("perusahaan_id", "cabang");

-- CreateIndex
CREATE INDEX "karyawan_nomor_rekening_nama_kunci_idx" ON "karyawan"("nomor_rekening", "nama_kunci");

-- CreateIndex
CREATE UNIQUE INDEX "karyawan_nama_rekening_unik" ON "karyawan"("perusahaan_id", "nama_kunci", "nomor_rekening");

-- CreateIndex
CREATE INDEX "karyawan_alias_karyawan_id_idx" ON "karyawan_alias"("karyawan_id");

-- CreateIndex
CREATE UNIQUE INDEX "karyawan_alias_perusahaan_id_alias_kunci_key" ON "karyawan_alias"("perusahaan_id", "alias_kunci");

-- CreateIndex
CREATE UNIQUE INDEX "periode_perusahaan_id_tanggal_awal_key" ON "periode"("perusahaan_id", "tanggal_awal");

-- CreateIndex
CREATE INDEX "absensi_perusahaan_id_periode_id_idx" ON "absensi"("perusahaan_id", "periode_id");

-- CreateIndex
CREATE UNIQUE INDEX "absensi_periode_id_karyawan_id_tanggal_key" ON "absensi"("periode_id", "karyawan_id", "tanggal");

-- CreateIndex
CREATE UNIQUE INDEX "pendapatan_cabang_periode_id_cabang_key" ON "pendapatan_cabang"("periode_id", "cabang");

-- CreateIndex
CREATE INDEX "pendapatan_sales_periode_id_cabang_idx" ON "pendapatan_sales"("periode_id", "cabang");

-- CreateIndex
CREATE UNIQUE INDEX "pendapatan_sales_periode_id_karyawan_id_key" ON "pendapatan_sales"("periode_id", "karyawan_id");

-- CreateIndex
CREATE INDEX "insentif_periode_id_karyawan_id_idx" ON "insentif"("periode_id", "karyawan_id");

-- CreateIndex
CREATE INDEX "denda_perusahaan_id_karyawan_id_idx" ON "denda"("perusahaan_id", "karyawan_id");

-- CreateIndex
CREATE INDEX "potongan_denda_periode_id_idx" ON "potongan_denda"("periode_id");

-- CreateIndex
CREATE UNIQUE INDEX "potongan_denda_denda_id_periode_id_key" ON "potongan_denda"("denda_id", "periode_id");

-- CreateIndex
CREATE UNIQUE INDEX "potongan_lain_periode_id_karyawan_id_jenis_key" ON "potongan_lain"("periode_id", "karyawan_id", "jenis");

-- CreateIndex
CREATE INDEX "hasil_gaji_karyawan_id_idx" ON "hasil_gaji"("karyawan_id");

-- CreateIndex
CREATE UNIQUE INDEX "hasil_gaji_periode_id_karyawan_id_key" ON "hasil_gaji"("periode_id", "karyawan_id");

-- CreateIndex
CREATE UNIQUE INDEX "percobaan_publik_kunci_key" ON "percobaan_publik"("kunci");

-- CreateIndex
CREATE INDEX "percobaan_publik_diblokir_sampai_idx" ON "percobaan_publik"("diblokir_sampai");

-- AddForeignKey
ALTER TABLE "akun" ADD CONSTRAINT "akun_perusahaan_id_fkey" FOREIGN KEY ("perusahaan_id") REFERENCES "perusahaan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesi" ADD CONSTRAINT "sesi_akun_id_fkey" FOREIGN KEY ("akun_id") REFERENCES "akun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pengaturan_perusahaan" ADD CONSTRAINT "pengaturan_perusahaan_perusahaan_id_fkey" FOREIGN KEY ("perusahaan_id") REFERENCES "perusahaan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "karyawan" ADD CONSTRAINT "karyawan_perusahaan_id_fkey" FOREIGN KEY ("perusahaan_id") REFERENCES "perusahaan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "karyawan_alias" ADD CONSTRAINT "karyawan_alias_perusahaan_id_fkey" FOREIGN KEY ("perusahaan_id") REFERENCES "perusahaan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "karyawan_alias" ADD CONSTRAINT "karyawan_alias_karyawan_id_fkey" FOREIGN KEY ("karyawan_id") REFERENCES "karyawan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "periode" ADD CONSTRAINT "periode_perusahaan_id_fkey" FOREIGN KEY ("perusahaan_id") REFERENCES "perusahaan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "absensi" ADD CONSTRAINT "absensi_perusahaan_id_fkey" FOREIGN KEY ("perusahaan_id") REFERENCES "perusahaan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "absensi" ADD CONSTRAINT "absensi_periode_id_fkey" FOREIGN KEY ("periode_id") REFERENCES "periode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "absensi" ADD CONSTRAINT "absensi_karyawan_id_fkey" FOREIGN KEY ("karyawan_id") REFERENCES "karyawan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pendapatan_cabang" ADD CONSTRAINT "pendapatan_cabang_perusahaan_id_fkey" FOREIGN KEY ("perusahaan_id") REFERENCES "perusahaan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pendapatan_cabang" ADD CONSTRAINT "pendapatan_cabang_periode_id_fkey" FOREIGN KEY ("periode_id") REFERENCES "periode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pendapatan_sales" ADD CONSTRAINT "pendapatan_sales_perusahaan_id_fkey" FOREIGN KEY ("perusahaan_id") REFERENCES "perusahaan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pendapatan_sales" ADD CONSTRAINT "pendapatan_sales_periode_id_fkey" FOREIGN KEY ("periode_id") REFERENCES "periode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pendapatan_sales" ADD CONSTRAINT "pendapatan_sales_karyawan_id_fkey" FOREIGN KEY ("karyawan_id") REFERENCES "karyawan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insentif" ADD CONSTRAINT "insentif_perusahaan_id_fkey" FOREIGN KEY ("perusahaan_id") REFERENCES "perusahaan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insentif" ADD CONSTRAINT "insentif_periode_id_fkey" FOREIGN KEY ("periode_id") REFERENCES "periode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insentif" ADD CONSTRAINT "insentif_karyawan_id_fkey" FOREIGN KEY ("karyawan_id") REFERENCES "karyawan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "denda" ADD CONSTRAINT "denda_perusahaan_id_fkey" FOREIGN KEY ("perusahaan_id") REFERENCES "perusahaan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "denda" ADD CONSTRAINT "denda_karyawan_id_fkey" FOREIGN KEY ("karyawan_id") REFERENCES "karyawan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "potongan_denda" ADD CONSTRAINT "potongan_denda_perusahaan_id_fkey" FOREIGN KEY ("perusahaan_id") REFERENCES "perusahaan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "potongan_denda" ADD CONSTRAINT "potongan_denda_denda_id_fkey" FOREIGN KEY ("denda_id") REFERENCES "denda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "potongan_denda" ADD CONSTRAINT "potongan_denda_periode_id_fkey" FOREIGN KEY ("periode_id") REFERENCES "periode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "potongan_lain" ADD CONSTRAINT "potongan_lain_perusahaan_id_fkey" FOREIGN KEY ("perusahaan_id") REFERENCES "perusahaan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "potongan_lain" ADD CONSTRAINT "potongan_lain_periode_id_fkey" FOREIGN KEY ("periode_id") REFERENCES "periode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "potongan_lain" ADD CONSTRAINT "potongan_lain_karyawan_id_fkey" FOREIGN KEY ("karyawan_id") REFERENCES "karyawan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hasil_gaji" ADD CONSTRAINT "hasil_gaji_perusahaan_id_fkey" FOREIGN KEY ("perusahaan_id") REFERENCES "perusahaan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hasil_gaji" ADD CONSTRAINT "hasil_gaji_periode_id_fkey" FOREIGN KEY ("periode_id") REFERENCES "periode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hasil_gaji" ADD CONSTRAINT "hasil_gaji_karyawan_id_fkey" FOREIGN KEY ("karyawan_id") REFERENCES "karyawan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Periode dalam satu perusahaan tidak boleh tumpang tindih, termasuk bila dua permintaan masuk bersamaan.
ALTER TABLE "periode" ADD CONSTRAINT "periode_tidak_tumpang_tindih"
  EXCLUDE USING gist ("perusahaan_id" WITH =, daterange("tanggal_awal", "tanggal_akhir", '[]') WITH &&);

-- Pengaman tambahan di level database untuk nilai yang tidak boleh melanggar aturan bisnis.
ALTER TABLE "periode" ADD CONSTRAINT "periode_rentang_valid" CHECK ("tanggal_akhir" >= "tanggal_awal");
ALTER TABLE "karyawan" ADD CONSTRAINT "karyawan_gaji_pokok_positif" CHECK ("gaji_pokok" > 0);
ALTER TABLE "karyawan" ADD CONSTRAINT "karyawan_tunjangan_tidak_negatif" CHECK ("tunjangan" >= 0);
ALTER TABLE "karyawan" ADD CONSTRAINT "karyawan_rekening_angka" CHECK ("nomor_rekening" ~ '^[0-9]{6,20}$');
ALTER TABLE "insentif" ADD CONSTRAINT "insentif_nominal_tidak_negatif" CHECK ("nominal" >= 0);
ALTER TABLE "pendapatan_cabang" ADD CONSTRAINT "pendapatan_cabang_tidak_negatif" CHECK ("total_aktual" >= 0);
ALTER TABLE "pendapatan_sales" ADD CONSTRAINT "pendapatan_sales_tidak_negatif" CHECK ("nominal" >= 0 AND "target" >= 0);
ALTER TABLE "potongan_lain" ADD CONSTRAINT "potongan_lain_tidak_negatif" CHECK ("nominal" >= 0);
ALTER TABLE "denda" ADD CONSTRAINT "denda_nilai_valid" CHECK ("total" > 0 AND "jumlah_cicilan" >= 1 AND "sisa" >= 0 AND "sisa" <= "total");
ALTER TABLE "potongan_denda" ADD CONSTRAINT "potongan_denda_positif" CHECK ("nominal" > 0);
