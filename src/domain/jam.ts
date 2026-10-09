const POLA_JAM = /^([01]?\d|2[0-3])[.:]([0-5]\d)(?:[.:][0-5]\d)?$/;
const POLA_JAM_BAKU = /^([01]\d|2[0-3]):([0-5]\d)$/;

export type HasilJam = { valid: true; nilai: string | null } | { valid: false };

/**
 * Membaca jam dari berbagai bentuk yang ditemui pada ekspor mesin finger dan input manual:
 * "6.58", "06.58", "06:58", dan "06:58:12" menjadi "06:58". Teks kosong menghasilkan nilai null.
 */
export function parseJam(masukan: string | null | undefined): HasilJam {
  const teks = (masukan ?? "").trim();
  if (teks === "") return { valid: true, nilai: null };
  const cocok = POLA_JAM.exec(teks);
  if (!cocok) return { valid: false };
  return { valid: true, nilai: `${cocok[1].padStart(2, "0")}:${cocok[2]}` };
}

/** Bentuk simpan yang baku: tepat "HH:MM" dengan jam 00 sampai 23. */
export function adalahJamBaku(nilai: unknown): nilai is string {
  return typeof nilai === "string" && POLA_JAM_BAKU.test(nilai);
}

/** Sel waktu Excel berupa pecahan hari (0.5 = 12:00). */
export function jamDariPecahanHari(pecahan: number): string | null {
  if (!Number.isFinite(pecahan) || pecahan < 0) return null;
  const sisaHari = pecahan - Math.floor(pecahan);
  const menit = Math.round(sisaHari * 1440) % 1440;
  const jam = Math.floor(menit / 60);
  return `${String(jam).padStart(2, "0")}:${String(menit % 60).padStart(2, "0")}`;
}
