import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { buatFixtureAbsensi, type KaryawanFixture } from "../tests/support/fixture-absensi";

// Berkas contoh berformat mesin finger dengan nama fiktif, untuk mencoba alur unggah tanpa data asli.
const keluaran = process.argv[2] ?? "contoh/absensi-contoh-agustus-2026.xlsx";

const karyawan: KaryawanFixture[] = [
  { nama: "Budi.Santoso", cabang: "Surabaya" },
  { nama: "Siti.Rahayu", cabang: "Surabaya", pola: (t, dow) => (dow === 0 || t === "2026-08-27" ? "kosong" : "penuh") },
  { nama: "Agus.Wijaya", cabang: "Malang", pola: (t, dow) => (dow === 0 ? "kosong" : t === "2026-09-02" ? "hanyaMasuk" : "penuh") },
  { nama: "Dewi.Lestari", cabang: "Malang" },
  { nama: "Rina.Kartika", cabang: "Bandung", pola: (t, dow) => (dow === 0 ? "kosong" : t >= "2026-09-07" && t <= "2026-09-09" ? "kosong" : "penuh") },
  { nama: "Hadi.Pranoto", cabang: "Bandung" },
];

async function main() {
  const isi = await buatFixtureAbsensi({ awal: "2026-08-24", akhir: "2026-09-23", karyawan });
  mkdirSync(dirname(keluaran), { recursive: true });
  writeFileSync(keluaran, isi);
  console.log(`Berkas contoh dibuat: ${keluaran} (${(isi.length / 1024).toFixed(0)} KB, ${karyawan.length} karyawan fiktif)`);
}

main().catch((galat) => {
  console.error(galat);
  process.exit(1);
});
