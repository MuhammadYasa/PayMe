// Seluruh tanggal di aplikasi berupa string "YYYY-MM-DD" tanpa jam dan zona waktu.
// Perhitungan memakai nomor hari sipil, sehingga tidak bergeser karena UTC atau perubahan zona waktu.

export type TanggalISO = string;

const POLA_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

const BULAN_PENDEK = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const BULAN_PANJANG = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];
const NAMA_HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const NAMA_HARI_PENDEK = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

export function adalahKabisat(tahun: number): boolean {
  return (tahun % 4 === 0 && tahun % 100 !== 0) || tahun % 400 === 0;
}

export function hariDalamBulan(tahun: number, bulan: number): number {
  if (bulan === 2) return adalahKabisat(tahun) ? 29 : 28;
  return bulan === 4 || bulan === 6 || bulan === 9 || bulan === 11 ? 30 : 31;
}

export function adalahTanggalValid(nilai: unknown): nilai is TanggalISO {
  if (typeof nilai !== "string") return false;
  const cocok = POLA_ISO.exec(nilai);
  if (!cocok) return false;
  const tahun = Number(cocok[1]);
  const bulan = Number(cocok[2]);
  const hari = Number(cocok[3]);
  return (
    tahun >= 1900 && tahun <= 2200 && bulan >= 1 && bulan <= 12 && hari >= 1 && hari <= hariDalamBulan(tahun, bulan)
  );
}

export function uraiTanggal(iso: TanggalISO): { tahun: number; bulan: number; hari: number } {
  if (!adalahTanggalValid(iso)) throw new RangeError(`Tanggal tidak valid: ${String(iso)}`);
  const cocok = POLA_ISO.exec(iso)!;
  return { tahun: Number(cocok[1]), bulan: Number(cocok[2]), hari: Number(cocok[3]) };
}

export function buatTanggal(tahun: number, bulan: number, hari: number): TanggalISO {
  const hasil = `${String(tahun).padStart(4, "0")}-${String(bulan).padStart(2, "0")}-${String(hari).padStart(2, "0")}`;
  if (!adalahTanggalValid(hasil)) throw new RangeError(`Tanggal tidak valid: ${hasil}`);
  return hasil;
}

/** Jumlah hari sejak 1970-01-01 (algoritma days_from_civil). */
export function keNomorHari(iso: TanggalISO): number {
  const { tahun, bulan, hari } = uraiTanggal(iso);
  const y = bulan <= 2 ? tahun - 1 : tahun;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (bulan + (bulan > 2 ? -3 : 9)) + 2) / 5) + hari - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

export function dariNomorHari(nomor: number): TanggalISO {
  const z = nomor + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const hari = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const bulan = mp < 10 ? mp + 3 : mp - 9;
  const tahun = yoe + era * 400 + (bulan <= 2 ? 1 : 0);
  return buatTanggal(tahun, bulan, hari);
}

export function tambahHari(iso: TanggalISO, jumlah: number): TanggalISO {
  return dariNomorHari(keNomorHari(iso) + jumlah);
}

/** Selisih hari dari `dari` ke `sampai` (positif bila `sampai` lebih akhir). */
export function selisihHari(dari: TanggalISO, sampai: TanggalISO): number {
  return keNomorHari(sampai) - keNomorHari(dari);
}

/** 0 = Minggu, 1 = Senin, ..., 6 = Sabtu. */
export function hariMinggu(iso: TanggalISO): number {
  return (((keNomorHari(iso) + 4) % 7) + 7) % 7;
}

/** Menambah bulan; bila tanggalnya tidak ada di bulan tujuan, dipakai hari terakhir bulan itu. */
export function tambahBulan(iso: TanggalISO, jumlah: number): TanggalISO {
  const { tahun, bulan, hari } = uraiTanggal(iso);
  const indeks = tahun * 12 + (bulan - 1) + jumlah;
  const tahunBaru = Math.floor(indeks / 12);
  const bulanBaru = (((indeks % 12) + 12) % 12) + 1;
  return buatTanggal(tahunBaru, bulanBaru, Math.min(hari, hariDalamBulan(tahunBaru, bulanBaru)));
}

/** Semua tanggal dari `awal` sampai `akhir`, keduanya termasuk. Kosong bila `akhir` lebih awal. */
export function rentangTanggal(awal: TanggalISO, akhir: TanggalISO): TanggalISO[] {
  const mulai = keNomorHari(awal);
  const selesai = keNomorHari(akhir);
  if (selesai < mulai) return [];
  if (selesai - mulai > 3660) throw new RangeError("Rentang tanggal terlalu panjang.");
  const hasil: TanggalISO[] = [];
  for (let nomor = mulai; nomor <= selesai; nomor++) hasil.push(dariNomorHari(nomor));
  return hasil;
}

export function namaHari(indeks: number): string {
  return NAMA_HARI[indeks] ?? "";
}

export function namaHariPendek(indeks: number): string {
  return NAMA_HARI_PENDEK[indeks] ?? "";
}

export function namaBulan(bulan: number): string {
  return BULAN_PANJANG[bulan - 1] ?? "";
}

/** "26 Jan 2025" */
export function formatTanggal(iso: TanggalISO): string {
  const { tahun, bulan, hari } = uraiTanggal(iso);
  return `${hari} ${BULAN_PENDEK[bulan - 1]} ${tahun}`;
}

/** "Senin, 26 Januari 2025" */
export function formatTanggalPanjang(iso: TanggalISO): string {
  const { tahun, bulan, hari } = uraiTanggal(iso);
  return `${NAMA_HARI[hariMinggu(iso)]}, ${hari} ${BULAN_PANJANG[bulan - 1]} ${tahun}`;
}

/** Tanggal hari ini menurut waktu Jakarta. */
export function hariIniJakarta(): TanggalISO {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
