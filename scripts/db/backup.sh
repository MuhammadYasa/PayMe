#!/usr/bin/env sh
# Cadangan basis data PayMe. Jadwalkan sekali sehari (cron, systemd timer, atau penjadwal tugas hosting).
# Cadangan yang lebih tua dari RETENSI_HARI (bawaan 30 hari) dihapus otomatis.
#
# Variabel lingkungan:
#   DATABASE_URL  wajib, alamat basis data (parameter ?schema=... diabaikan)
#   BACKUP_DIR    folder tujuan, bawaan ./backup
#   RETENSI_HARI  lama cadangan disimpan, bawaan 30
#
# Hasilnya berisi data gaji dan nomor rekening, jadi hanya bisa dibaca pemilik berkas (umask 077).
# Simpan juga salinannya di luar server yang sama, misalnya penyimpanan objek terenkripsi.
set -eu

: "${DATABASE_URL:?Isi DATABASE_URL dengan alamat basis data PayMe.}"
tujuan="${BACKUP_DIR:-./backup}"
retensi="${RETENSI_HARI:-30}"

case "$retensi" in
  ''|*[!0-9]*) echo "RETENSI_HARI harus berupa angka bulat, misalnya 30." >&2; exit 1 ;;
esac

umask 077
mkdir -p "$tujuan"

berkas="$tujuan/payme-$(date +%Y%m%d-%H%M%S).dump"
alamat="${DATABASE_URL%%\?*}"

if ! pg_dump --format=custom --no-owner --dbname="$alamat" --file="$berkas"; then
  rm -f "$berkas"
  echo "Cadangan gagal dibuat. Periksa DATABASE_URL dan pastikan basis data dapat dijangkau." >&2
  exit 1
fi

# Berkas yang tidak bisa dibaca kembali dianggap gagal, supaya cadangan rusak tidak terhitung sebagai cadangan.
if ! pg_restore --list "$berkas" >/dev/null 2>&1; then
  rm -f "$berkas"
  echo "Cadangan yang dibuat tidak bisa dibaca kembali dan sudah dihapus. Coba jalankan lagi." >&2
  exit 1
fi

find "$tujuan" -name 'payme-*.dump' -type f -mtime "+$retensi" -delete

echo "Cadangan dibuat: $berkas"
