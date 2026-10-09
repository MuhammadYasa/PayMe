// Tes integrasi selalu memakai basis data uji, tidak pernah basis data pengembangan.
const urlUji = process.env.TEST_DATABASE_URL;

if (!urlUji) {
  throw new Error(
    "TEST_DATABASE_URL belum diisi. Salin .env.example ke .env lalu jalankan `npm run db:up`.",
  );
}

const namaDb = new URL(urlUji).pathname.replace("/", "");
if (!namaDb.endsWith("_test")) {
  throw new Error(`Nama basis data uji harus berakhiran _test, tetapi ditemukan "${namaDb}".`);
}

process.env.DATABASE_URL = urlUji;
process.env.APP_SECRET ||= "x".repeat(32);
process.env.TRUST_PROXY = "false";
