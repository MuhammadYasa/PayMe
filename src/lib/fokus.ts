/**
 * Memindahkan fokus ke kolom pertama (menurut urutan di layar) yang punya galat.
 * Kolom dikenali dari atribut `name` atau `data-kolom`.
 */
export function fokusKolomPertama(wadah: HTMLElement | null, kolom: Record<string, string>): void {
  if (!wadah) return;
  const kandidat = Array.from(wadah.querySelectorAll<HTMLElement>("input, select, textarea, [data-kolom]"));
  const target = kandidat.find((elemen) => {
    const nama = elemen.getAttribute("name") ?? elemen.dataset.kolom;
    return nama != null && nama in kolom;
  });
  target?.focus();
}
