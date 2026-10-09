#!/usr/bin/env sh
# Memulihkan basis data PayMe dari berkas cadangan buatan backup.sh.
# Semua data pada basis data tujuan DIGANTI dengan isi cadangan, jadi skrip ini meminta konfirmasi
# kecuali dijalankan dengan --ya.
#
# Pemakaian:
#   DATABASE_URL=postgresql://... ./scripts/db/restore.sh backup/payme-20261009-020000.dump
#   DATABASE_URL=postgresql://... ./scripts/db/restore.sh --ya backup/payme-20261009-020000.dump
set -eu

: "${DATABASE_URL:?Isi DATABASE_URL dengan alamat basis data tujuan pemulihan.}"

langsung=0
if [ "${1:-}" = "--ya" ]; then
  langsung=1
  shift
fi

berkas="${1:-}"
if [ -z "$berkas" ] || [ ! -f "$berkas" ]; then
  echo "Berkas cadangan tidak ditemukan. Pemakaian: restore.sh [--ya] <berkas.dump>" >&2
  exit 1
fi

alamat="${DATABASE_URL%%\?*}"

if [ "$langsung" -ne 1 ]; then
  echo "Seluruh data pada basis data tujuan akan diganti dengan isi $berkas."
  printf "Ketik PULIHKAN untuk melanjutkan: "
  read -r jawaban
  if [ "$jawaban" != "PULIHKAN" ]; then
    echo "Dibatalkan. Tidak ada yang diubah."
    exit 1
  fi
fi

pg_restore --clean --if-exists --no-owner --exit-on-error --dbname="$alamat" "$berkas"
echo "Pemulihan selesai dari: $berkas"
