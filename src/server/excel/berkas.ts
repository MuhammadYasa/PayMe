import "server-only";
import { inflateRawSync } from "node:zlib";
import { MAKS_UKURAN_UNGGAH_BYTE } from "@/domain/batas";
import { PESAN_FILE_KOSONG, PESAN_FILE_RUSAK, PESAN_FILE_TERLALU_BESAR, ekstensiBerkas, pesanFormatTidakDidukung } from "@/lib/berkas";
import { AppError, tidakValid } from "@/server/errors";

const MAKS_ENTRI_ZIP = 2000;
/** File .xlsx dari mesin finger yang wajar terurai jauh di bawah ini. Batas ini menjaga memori proses, bukan membatasi pemakai. */
const MAKS_UKURAN_TERURAI_BYTE = 64 * 1024 * 1024;

/**
 * Pemeriksaan sebelum isi file dibaca: ekstensi harus .xlsx dan ukuran paling besar 5 MB.
 * Dipanggil lebih dulu daripada pemrosesan apa pun agar file yang salah ditolak murah.
 */
export function periksaNamaDanUkuran(nama: string, ukuranByte: number): void {
  const ekstensi = ekstensiBerkas(nama);
  if (ekstensi !== "xlsx") {
    throw tidakValid(pesanFormatTidakDidukung(ekstensi), { file: "Hanya file .xlsx yang diterima." }, "FORMAT_TIDAK_DIDUKUNG");
  }
  if (ukuranByte <= 0) throw tidakValid(PESAN_FILE_KOSONG, undefined, "FILE_KOSONG");
  if (ukuranByte > MAKS_UKURAN_UNGGAH_BYTE) throw new AppError(413, PESAN_FILE_TERLALU_BESAR, { kode: "FILE_TERLALU_BESAR" });
}

interface EntriZip {
  metode: number;
  ukuranTermampat: number;
  offsetLokal: number;
}

const terlaluBesar = () =>
  tidakValid("Isi file terlalu besar setelah dibuka. Pastikan file berasal dari mesin finger, lalu unggah lagi.", undefined, "FILE_TERLALU_BESAR");

/**
 * Pemeriksaan isi: tanda tangan ZIP dan daftar entri di direktori pusat, lalu setiap entri benar-benar dikembangkan
 * dengan batas keras. Ukuran terurai yang tertulis di header tidak dipercaya, karena penyerang bisa memalsukannya
 * sehingga file kecil membengkak menjadi sangat besar saat dibuka ("zip bomb"). Header hanya dipakai sebagai
 * penyaring murah di awal.
 */
export function periksaIsiXlsx(isi: Buffer): void {
  const rusak = () => tidakValid(PESAN_FILE_RUSAK, undefined, "FILE_RUSAK");

  if (isi.length < 22 || isi.readUInt32LE(0) !== 0x04034b50) throw rusak();

  let eocd = -1;
  for (let i = isi.length - 22; i >= Math.max(0, isi.length - 65_557); i--) {
    if (isi.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw rusak();

  const jumlahEntri = isi.readUInt16LE(eocd + 10);
  const offsetDirektori = isi.readUInt32LE(eocd + 16);
  if (jumlahEntri === 0xffff || offsetDirektori === 0xffffffff) {
    throw tidakValid("File Excel ini terlalu kompleks untuk dibaca. Simpan ulang dengan Excel biasa, lalu unggah lagi.", undefined, "FILE_RUSAK");
  }
  if (jumlahEntri > MAKS_ENTRI_ZIP) throw rusak();

  let posisi = offsetDirektori;
  let totalDiklaim = 0;
  const entri: EntriZip[] = [];
  for (let i = 0; i < jumlahEntri; i++) {
    if (posisi + 46 > isi.length || isi.readUInt32LE(posisi) !== 0x02014b50) throw rusak();
    totalDiklaim += isi.readUInt32LE(posisi + 24);
    if (totalDiklaim > MAKS_UKURAN_TERURAI_BYTE) throw terlaluBesar();
    entri.push({
      metode: isi.readUInt16LE(posisi + 10),
      ukuranTermampat: isi.readUInt32LE(posisi + 20),
      offsetLokal: isi.readUInt32LE(posisi + 42),
    });
    posisi += 46 + isi.readUInt16LE(posisi + 28) + isi.readUInt16LE(posisi + 30) + isi.readUInt16LE(posisi + 32);
  }

  let sisaAnggaran = MAKS_UKURAN_TERURAI_BYTE;
  for (const e of entri) {
    if (e.ukuranTermampat === 0xffffffff || e.offsetLokal === 0xffffffff) throw rusak();
    if (e.offsetLokal + 30 > isi.length || isi.readUInt32LE(e.offsetLokal) !== 0x04034b50) throw rusak();
    const awalData = e.offsetLokal + 30 + isi.readUInt16LE(e.offsetLokal + 26) + isi.readUInt16LE(e.offsetLokal + 28);
    if (awalData + e.ukuranTermampat > isi.length) throw rusak();
    const data = isi.subarray(awalData, awalData + e.ukuranTermampat);

    let ukuranNyata: number;
    if (e.metode === 0) {
      ukuranNyata = data.length;
    } else if (e.metode === 8) {
      try {
        ukuranNyata = inflateRawSync(data, { maxOutputLength: sisaAnggaran + 1 }).length;
      } catch (galat) {
        throw (galat as NodeJS.ErrnoException).code === "ERR_BUFFER_TOO_LARGE" ? terlaluBesar() : rusak();
      }
    } else {
      throw rusak();
    }
    sisaAnggaran -= ukuranNyata;
    if (sisaAnggaran < 0) throw terlaluBesar();
  }
}
