/**
 * Dijalankan Next.js sekali saat server Node hidup. Membersihkan baris pembatas percobaan yang sudah kedaluwarsa saat
 * start dan setiap enam jam, supaya tabel percobaan_publik tidak tumbuh tanpa batas. Tidak berjalan pada tes, sehingga
 * tidak mengganggu tes yang memakai tanggal palsu.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { bersihkanKedaluwarsa } = await import("@/server/pembatas");
  const { log } = await import("@/server/log");

  const bersihkan = () => {
    bersihkanKedaluwarsa().catch((galat: unknown) => log.error("pembersihan_pembatas_gagal", { galat }));
  };
  bersihkan();
  setInterval(bersihkan, 6 * 60 * 60 * 1000).unref();
}
