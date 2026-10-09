/**
 * Draf isian di penyimpanan lokal browser. Dipakai agar isian yang belum tersimpan tidak hilang saat
 * sesi berakhir di tengah pengisian formulir. Semua akses dibungkus try/catch karena penyimpanan
 * bisa tidak tersedia (mode pribadi, data situs diblokir).
 */
export function drafLokal<T>(kunci: string) {
  const nama = `payme:draf:${kunci}`;
  return {
    baca(): T | null {
      try {
        const mentah = window.localStorage.getItem(nama);
        return mentah ? (JSON.parse(mentah) as T) : null;
      } catch {
        return null;
      }
    },
    simpan(nilai: T): void {
      try {
        window.localStorage.setItem(nama, JSON.stringify(nilai));
      } catch {
        // Draf bersifat tambahan; kegagalan menyimpannya tidak boleh mengganggu pengisian.
      }
    },
    hapus(): void {
      try {
        window.localStorage.removeItem(nama);
      } catch {
        // Abaikan.
      }
    },
  };
}
