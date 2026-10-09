import { MAKS_CICILAN } from "./batas";
import { formatRupiah } from "./uang";

function pastikanDendaValid(total: number, jumlahCicilan: number): void {
  if (!Number.isSafeInteger(total) || total <= 0) throw new RangeError("Total denda harus lebih dari 0.");
  if (!Number.isSafeInteger(jumlahCicilan) || jumlahCicilan < 1 || jumlahCicilan > MAKS_CICILAN) {
    throw new RangeError(`Jumlah cicilan harus antara 1 dan ${MAKS_CICILAN}.`);
  }
  if (total < jumlahCicilan) throw new RangeError("Jumlah cicilan tidak boleh melebihi total denda dalam rupiah.");
}

/**
 * Jadwal cicilan: setiap cicilan dibulatkan ke bawah ke rupiah dan sisa pembulatan masuk ke
 * cicilan terakhir. Rp 1.000.000 dalam 3 cicilan menjadi 333.333, 333.333, 333.334.
 */
export function jadwalCicilan(total: number, jumlahCicilan: number): number[] {
  pastikanDendaValid(total, jumlahCicilan);
  const standar = Math.floor(total / jumlahCicilan);
  const jadwal = new Array<number>(jumlahCicilan).fill(standar);
  jadwal[jumlahCicilan - 1] = total - standar * (jumlahCicilan - 1);
  return jadwal;
}

/**
 * Ringkasan jadwal untuk layar: "3 kali Rp 333.333" bila sama rata, atau "2 kali Rp 333.333, lalu Rp 333.334"
 * bila cicilan terakhir menampung sisa pembulatan.
 */
export function ringkasJadwal(jadwal: readonly number[]): string {
  if (jadwal.length === 0) return "-";
  const terakhir = jadwal[jadwal.length - 1];
  const awal = jadwal.slice(0, -1);
  if (awal.length === 0) return `1 kali ${formatRupiah(terakhir)}`;
  if (terakhir === awal[0]) return `${jadwal.length} kali ${formatRupiah(terakhir)}`;
  return `${awal.length} kali ${formatRupiah(awal[0])}, lalu ${formatRupiah(terakhir)}`;
}

/**
 * Potongan untuk periode berikutnya berdasarkan jumlah cicilan yang sudah difinalkan.
 * Tidak pernah melebihi sisa, jadi sisa tidak bisa menjadi negatif, dan berhenti di nol saat lunas.
 */
export function nominalCicilanBerikut(args: {
  total: number;
  jumlahCicilan: number;
  terbayar: number;
  sisa: number;
}): number {
  const { total, jumlahCicilan, terbayar, sisa } = args;
  pastikanDendaValid(total, jumlahCicilan);
  if (sisa <= 0 || terbayar >= jumlahCicilan) return 0;
  if (terbayar === jumlahCicilan - 1) return sisa;
  return Math.min(Math.floor(total / jumlahCicilan), sisa);
}

export type StatusDenda = "berjalan" | "lunas";

export function statusDenda(sisa: number): StatusDenda {
  return sisa <= 0 ? "lunas" : "berjalan";
}
