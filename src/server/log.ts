import "server-only";

// Log tidak boleh memuat kata sandi, token, atau nomor rekening utuh (NFR-03, FR-19).
const KUNCI_RAHASIA = /(sandi|password|token|secret|cookie|authorization)/i;
const KUNCI_REKENING = /rekening/i;
const URUTAN_DIGIT_PANJANG = /\b\d{6,20}\b/g;

function samarkan(nilai: string): string {
  const digit = nilai.replace(/\D/g, "");
  return digit.length <= 4 ? "••••" : `••••${digit.slice(-4)}`;
}

export function bersihkanUntukLog(nilai: unknown, kedalaman = 0): unknown {
  if (kedalaman > 5) return "[dipotong]";
  if (typeof nilai === "string") return nilai.replace(URUTAN_DIGIT_PANJANG, (cocok) => samarkan(cocok));
  if (Array.isArray(nilai)) return nilai.map((item) => bersihkanUntukLog(item, kedalaman + 1));
  if (nilai instanceof Error) return { nama: nilai.name, pesan: bersihkanUntukLog(nilai.message, kedalaman + 1) };
  if (nilai && typeof nilai === "object") {
    const hasil: Record<string, unknown> = {};
    for (const [kunci, isi] of Object.entries(nilai as Record<string, unknown>)) {
      if (KUNCI_RAHASIA.test(kunci)) hasil[kunci] = "[disembunyikan]";
      else if (KUNCI_REKENING.test(kunci) && typeof isi === "string") hasil[kunci] = samarkan(isi);
      else hasil[kunci] = bersihkanUntukLog(isi, kedalaman + 1);
    }
    return hasil;
  }
  return nilai;
}

type Tingkat = "info" | "warn" | "error";

function tulis(tingkat: Tingkat, peristiwa: string, data?: Record<string, unknown>): void {
  const baris = JSON.stringify({
    waktu: new Date().toISOString(),
    tingkat,
    peristiwa,
    ...(data ? (bersihkanUntukLog(data) as Record<string, unknown>) : {}),
  });
  if (tingkat === "error") console.error(baris);
  else if (tingkat === "warn") console.warn(baris);
  else console.log(baris);
}

export const log = {
  info: (peristiwa: string, data?: Record<string, unknown>) => tulis("info", peristiwa, data),
  warn: (peristiwa: string, data?: Record<string, unknown>) => tulis("warn", peristiwa, data),
  error: (peristiwa: string, data?: Record<string, unknown>) => tulis("error", peristiwa, data),
};
