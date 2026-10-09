-- DropForeignKey
ALTER TABLE "absensi" DROP CONSTRAINT "absensi_karyawan_id_fkey";

-- DropForeignKey
ALTER TABLE "denda" DROP CONSTRAINT "denda_karyawan_id_fkey";

-- DropForeignKey
ALTER TABLE "hasil_gaji" DROP CONSTRAINT "hasil_gaji_karyawan_id_fkey";

-- DropForeignKey
ALTER TABLE "insentif" DROP CONSTRAINT "insentif_karyawan_id_fkey";

-- DropForeignKey
ALTER TABLE "pendapatan_sales" DROP CONSTRAINT "pendapatan_sales_karyawan_id_fkey";

-- DropForeignKey
ALTER TABLE "potongan_lain" DROP CONSTRAINT "potongan_lain_karyawan_id_fkey";

-- AddForeignKey
ALTER TABLE "absensi" ADD CONSTRAINT "absensi_karyawan_id_fkey" FOREIGN KEY ("karyawan_id") REFERENCES "karyawan"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pendapatan_sales" ADD CONSTRAINT "pendapatan_sales_karyawan_id_fkey" FOREIGN KEY ("karyawan_id") REFERENCES "karyawan"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insentif" ADD CONSTRAINT "insentif_karyawan_id_fkey" FOREIGN KEY ("karyawan_id") REFERENCES "karyawan"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "denda" ADD CONSTRAINT "denda_karyawan_id_fkey" FOREIGN KEY ("karyawan_id") REFERENCES "karyawan"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "potongan_lain" ADD CONSTRAINT "potongan_lain_karyawan_id_fkey" FOREIGN KEY ("karyawan_id") REFERENCES "karyawan"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hasil_gaji" ADD CONSTRAINT "hasil_gaji_karyawan_id_fkey" FOREIGN KEY ("karyawan_id") REFERENCES "karyawan"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
