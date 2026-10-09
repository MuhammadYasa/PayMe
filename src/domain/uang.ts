// Semua nominal disimpan dan dihitung sebagai bilangan bulat rupiah. Modul ini hanya mengurus
// tampilan dan pembacaan input; tidak ada pecahan di mana pun.

/** 1250000 menjadi "1.250.000" (tanpa awalan Rp), dipakai juga oleh kolom isian nominal. */
export function formatAngka(nilai: number): string {
  if (!Number.isSafeInteger(nilai)) {
    throw new RangeError("Nominal rupiah harus berupa bilangan bulat.");
  }
  const digit = Math.abs(nilai)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${nilai < 0 ? "-" : ""}${digit}`;
}

export function formatRupiah(nilai: number): string {
  const angka = formatAngka(Math.abs(nilai));
  return `${nilai < 0 ? "-" : ""}Rp ${angka}`;
}

/**
 * Membaca nominal yang diketik pengguna. Titik atau koma dianggap pemisah ribuan, jadi
 * "1.250.000", "1,250,000", dan "Rp 1250000" semuanya menghasilkan 1250000.
 * Mengembalikan null bila kosong atau formatnya tidak dikenali (misalnya "1,5" atau "12abc").
 */
export function parseNominal(masukan: string): number | null {
  let teks = masukan
    .trim()
    .replace(/^rp\.?\s*/i, "")
    .replace(/\s+/g, "");
  if (teks === "") return null;

  let negatif = false;
  if (teks.startsWith("-")) {
    negatif = true;
    teks = teks.slice(1);
  }

  let digit: string;
  if (/^\d+$/.test(teks)) {
    digit = teks;
  } else if (/^\d{1,3}(\.\d{3})+$/.test(teks) || /^\d{1,3}(,\d{3})+$/.test(teks)) {
    digit = teks.replace(/[.,]/g, "");
  } else {
    return null;
  }

  const nilai = Number(digit);
  if (!Number.isSafeInteger(nilai)) return null;
  return negatif && nilai !== 0 ? -nilai : nilai;
}

/** Persentase per mil (1000 = 100,0%) ditampilkan dengan satu desimal, mis. 853 menjadi "85,3%". */
export function formatPersenPermil(permil: number): string {
  const sisa = Math.abs(permil) % 10;
  const bulat = Math.trunc(Math.abs(permil) / 10);
  const bagianBulat = bulat.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${permil < 0 ? "-" : ""}${bagianBulat},${sisa}%`;
}
