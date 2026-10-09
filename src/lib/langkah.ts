/** Sembilan langkah penggajian, sesuai alur utama pada PRD (setelah masuk, sebelum halaman karyawan). */
export const LANGKAH = [
  {
    slug: "",
    judul: "Periode",
    bantuan: "Pastikan rentang tanggal gaji sudah benar. Semua perhitungan mengikuti rentang ini.",
  },
  {
    slug: "unggah",
    judul: "Unggah Absensi",
    bantuan: "Unggah file Excel hasil mesin finger. Sistem membacanya dan menunjukkan baris yang bermasalah.",
  },
  {
    slug: "absensi",
    judul: "Lengkapi Absensi",
    bantuan: "Isi tanggal yang masih kosong untuk setiap karyawan. Gaji baru bisa dihitung setelah semua tanggal terisi.",
  },
  {
    slug: "catatan",
    judul: "Libur, Izin & Cuti",
    bantuan: "Catat hari libur, izin, sakit, dan cuti. Satu catatan bisa mencakup beberapa tanggal sekaligus.",
  },
  {
    slug: "pendapatan",
    judul: "Pendapatan & Target",
    bantuan: "Isi pendapatan aktual tiap cabang, lalu bagi ke masing-masing sales beserta targetnya.",
  },
  {
    slug: "insentif",
    judul: "Insentif",
    bantuan: "Isi insentif pengiriman per karyawan. Baris yang dikosongkan tidak disimpan.",
  },
  {
    slug: "potongan",
    judul: "Denda & Potongan",
    bantuan: "Catat denda (boleh dicicil tiap bulan) serta nominal pajak dan asuransi per karyawan.",
  },
  {
    slug: "hitung",
    judul: "Hitung Gaji",
    bantuan: "Tekan Hitung Gaji, periksa rincian setiap karyawan, lalu simpan bila sudah benar.",
  },
  {
    slug: "ekspor",
    judul: "Ekspor",
    bantuan: "Unduh hasil penggajian dalam format Excel untuk dibagikan atau diarsipkan.",
  },
] as const;

export type SlugLangkah = (typeof LANGKAH)[number]["slug"];

export function urlLangkah(periodeId: string, slug: SlugLangkah): string {
  return slug === "" ? `/periode/${periodeId}` : `/periode/${periodeId}/${slug}`;
}

export function cariLangkah(slug: SlugLangkah) {
  const indeks = LANGKAH.findIndex((l) => l.slug === slug);
  return { indeks, nomor: indeks + 1, jumlah: LANGKAH.length, langkah: LANGKAH[indeks], sebelumnya: LANGKAH[indeks - 1], berikutnya: LANGKAH[indeks + 1] };
}
