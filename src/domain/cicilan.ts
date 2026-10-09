import { MAKS_CICILAN } from "./batas";

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
