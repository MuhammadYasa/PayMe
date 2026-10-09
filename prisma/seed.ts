import "dotenv/config";
import { pengaturanSchema } from "@/domain/pengaturan";
import { prisma } from "@/server/db/client";
import { dbPerusahaan } from "@/server/db/tenant";
import { daftarAkun } from "@/server/services/auth";
import { buatKaryawan } from "@/server/services/karyawan";
import { simpanPengaturan } from "@/server/services/pengaturan";
import { karyawanSkema } from "@/skema/karyawan";

// Data demo bersifat fiktif. Kata sandi akun demo wajib diberikan lewat SEED_PASSWORD, tidak ditanam di kode.
const kataSandi = process.env.SEED_PASSWORD;
if (!kataSandi || kataSandi.length < 8) {
  console.error("Isi SEED_PASSWORD (minimal 8 karakter), misalnya: SEED_PASSWORD=kata-sandi-demo npx prisma db seed");
  process.exit(1);
}

const EMAIL = "demo@payme.test";

const karyawan = [
  { namaLengkap: "Budi Santoso", jabatan: "Staf Gudang", cabang: "Surabaya", gajiPokok: 4_000_000, tunjangan: 500_000, nomorRekening: "1000000001" },
  { namaLengkap: "Siti Rahayu", jabatan: "Admin", cabang: "Surabaya", gajiPokok: 4_500_000, tunjangan: 300_000, nomorRekening: "1000000002" },
  { namaLengkap: "Agus Wijaya", jabatan: "Sales", cabang: "Malang", gajiPokok: 3_500_000, tunjangan: 250_000, nomorRekening: "1000000003" },
  { namaLengkap: "Dewi Lestari", jabatan: "Sales", cabang: "Malang", gajiPokok: 3_500_000, tunjangan: 250_000, nomorRekening: "1000000004" },
  { namaLengkap: "Rina Kartika", jabatan: "Kasir", cabang: "Bandung", gajiPokok: 3_800_000, tunjangan: 200_000, nomorRekening: "1000000005" },
  { namaLengkap: "Hadi Pranoto", jabatan: "Supir", cabang: "Bandung", gajiPokok: 3_600_000, tunjangan: 400_000, nomorRekening: "1000000006" },
];

async function main(kataSandiDemo: string) {
  const akunAda = await prisma().akun.findUnique({ where: { email: EMAIL } });
  if (akunAda) {
    console.log(`Akun ${EMAIL} sudah ada, seed dilewati.`);
    return;
  }
  const { perusahaanId } = await daftarAkun({
    nama: "Pengguna Demo",
    namaPerusahaan: "CV Contoh Makmur",
    email: EMAIL,
    kataSandi: kataSandiDemo,
  });
  const db = dbPerusahaan(perusahaanId);
  for (const k of karyawan) await buatKaryawan(db, karyawanSkema.parse(k));
  await simpanPengaturan(
    db,
    pengaturanSchema.parse({
      hariKerjaMingguan: [1, 2, 3, 4, 5, 6],
      aturanPotongan: {
        izin: { mode: "per_hari", nominal: 50_000 },
        sakit: { mode: "tidak" },
        cuti: { mode: "tidak" },
        lainnya: { mode: "persen_harian", persen: 100 },
      },
      tingkatBonus: [{ ambangPermil: 1000, jenis: "tetap", nilai: 500_000 }],
    }),
  );
  console.log(`Data demo dibuat. Masuk dengan ${EMAIL} dan kata sandi dari SEED_PASSWORD.`);
}

main(kataSandi)
  .catch((galat) => {
    console.error(galat);
    process.exitCode = 1;
  })
  .finally(() => prisma().$disconnect());
