import type { TanggalISO } from "@/domain/tanggal";

// Kolom DATE dibaca dan ditulis sebagai tengah malam UTC, sehingga tanggal kalender tidak bergeser
// walau server berjalan di zona waktu lain.

export function keDate(tanggal: TanggalISO): Date {
  return new Date(`${tanggal}T00:00:00.000Z`);
}

export function dariDate(tanggal: Date): TanggalISO {
  return tanggal.toISOString().slice(0, 10);
}
