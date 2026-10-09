"use client";

import { type ClipboardEvent, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes, useId } from "react";
import { formatAngka, parseNominalTempel } from "@/domain/uang";

const gayaDasar =
  "block w-full rounded-lg border border-garis-tebal bg-kartu px-3 min-h-11 text-[15px] text-teks " +
  "aria-[invalid=true]:border-bahaya aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-bahaya/30 " +
  "disabled:cursor-not-allowed disabled:bg-netral-latar disabled:text-teks-redup read-only:bg-halaman";

interface PropKolom {
  label: string;
  galat?: string;
  bantuan?: string;
  wajib?: boolean;
  className?: string;
}

interface PropTurunan {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
  "aria-required"?: true;
}

function Pembungkus({ label, galat, bantuan, wajib, className = "", render }: PropKolom & { render: (p: PropTurunan) => ReactNode }) {
  const id = useId();
  const idBantuan = `${id}-bantuan`;
  const idGalat = `${id}-galat`;
  const deskripsi = [bantuan ? idBantuan : null, galat ? idGalat : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className={`space-y-1.5 ${className}`}>
      <label htmlFor={id} className="block font-semibold text-teks">
        {label}
        {wajib ? (
          <span aria-hidden="true" className="text-bahaya">
            {" "}
            *
          </span>
        ) : null}
      </label>
      {render({
        id,
        "aria-describedby": deskripsi,
        "aria-invalid": galat ? true : undefined,
        "aria-required": wajib ? true : undefined,
      })}
      {bantuan ? (
        <p id={idBantuan} className="text-sm text-teks-redup">
          {bantuan}
        </p>
      ) : null}
      {galat ? (
        <p id={idGalat} className="text-sm font-semibold text-bahaya-teks">
          {galat}
        </p>
      ) : null}
    </div>
  );
}

export function KolomInput({
  label,
  galat,
  bantuan,
  wajib,
  className,
  ...input
}: PropKolom & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Pembungkus
      label={label}
      galat={galat}
      bantuan={bantuan}
      wajib={wajib}
      className={className}
      render={(p) => <input {...input} {...p} className={gayaDasar} />}
    />
  );
}

export function KolomPilih({
  label,
  galat,
  bantuan,
  wajib,
  className,
  children,
  ...pilih
}: PropKolom & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Pembungkus
      label={label}
      galat={galat}
      bantuan={bantuan}
      wajib={wajib}
      className={className}
      render={(p) => (
        <select {...pilih} {...p} className={gayaDasar}>
          {children}
        </select>
      )}
    />
  );
}

export function KolomTeks({
  label,
  galat,
  bantuan,
  wajib,
  className,
  ...area
}: PropKolom & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Pembungkus
      label={label}
      galat={galat}
      bantuan={bantuan}
      wajib={wajib}
      className={className}
      render={(p) => <textarea rows={3} {...area} {...p} className={`${gayaDasar} py-2`} />}
    />
  );
}

interface PropNominal extends PropKolom {
  nilai: number | null;
  onUbah: (nilai: number | null) => void;
  name?: string;
  disabled?: boolean;
  placeholder?: string;
}

/** Isian rupiah: hanya angka, tampil dengan pemisah ribuan titik, dan hasilnya selalu bilangan bulat. */
export function KolomNominal({ label, galat, bantuan, wajib, className, nilai, onUbah, name, disabled, placeholder }: PropNominal) {
  return (
    <Pembungkus
      label={label}
      galat={galat}
      bantuan={bantuan}
      wajib={wajib}
      className={className}
      render={(p) => (
        <div className="relative">
          <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3 flex items-center font-semibold text-teks-redup">
            Rp
          </span>
          <input
            {...p}
            name={name}
            disabled={disabled}
            inputMode="numeric"
            autoComplete="off"
            placeholder={placeholder ?? "0"}
            value={nilai === null ? "" : formatAngka(nilai)}
            onChange={(e) => onUbah(bacaDigit(e.target.value))}
            onPaste={(e) => tempelNominal(e, onUbah)}
            className={`${gayaDasar} pl-10 text-right tabular-nums`}
          />
        </div>
      )}
    />
  );
}

const BATAS_NOMINAL_ISIAN = 999_999_999_999_999;

function bacaDigit(teks: string): number | null {
  const digit = teks.replace(/\D/g, "").slice(0, 15);
  return digit === "" ? null : Number(digit);
}

/**
 * Menempel nominal dari Excel: "2.500.000,00" terbaca 2500000, bukan 250000000. Hanya jalur tempel yang membuang sen;
 * mengetik atau menghapus digit tetap lewat bacaDigit supaya backspace pada "1.250" menghasilkan 125. Teks yang tidak
 * dikenali atau bernilai negatif diabaikan, dan isian yang ada tidak berubah.
 */
function tempelNominal(e: ClipboardEvent<HTMLInputElement>, onUbah: (nilai: number | null) => void): void {
  e.preventDefault();
  const nilai = parseNominalTempel(e.clipboardData.getData("text"));
  if (nilai !== null && nilai <= BATAS_NOMINAL_ISIAN) onUbah(nilai);
}

/** Isian rupiah untuk sel tabel. Labelnya hanya untuk pembaca layar karena judul kolom sudah terlihat. */
export function SelNominal({
  label,
  nilai,
  onUbah,
  name,
  disabled,
  bermasalah,
}: {
  label: string;
  nilai: number | null;
  onUbah: (nilai: number | null) => void;
  name?: string;
  disabled?: boolean;
  bermasalah?: boolean;
}) {
  return (
    <input
      aria-label={label}
      aria-invalid={bermasalah ? true : undefined}
      name={name}
      disabled={disabled}
      inputMode="numeric"
      autoComplete="off"
      placeholder="0"
      value={nilai === null ? "" : formatAngka(nilai)}
      onChange={(e) => onUbah(bacaDigit(e.target.value))}
      onPaste={(e) => tempelNominal(e, onUbah)}
      className={`${gayaDasar} min-w-36 text-right tabular-nums`}
    />
  );
}

/** Isian teks pendek untuk sel tabel, dengan label khusus pembaca layar. */
export function SelTeks({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  disabled,
  name,
}: {
  label: string;
  value: string;
  onChange: (nilai: string) => void;
  placeholder?: string;
  maxLength?: number;
  disabled?: boolean;
  name?: string;
}) {
  return (
    <input
      aria-label={label}
      name={name}
      value={value}
      disabled={disabled}
      maxLength={maxLength}
      placeholder={placeholder}
      autoComplete="off"
      onChange={(e) => onChange(e.target.value)}
      className={`${gayaDasar} min-w-40`}
    />
  );
}

export function KotakCentang({
  label,
  className = "",
  ...input
}: { label: ReactNode; className?: string } & Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return (
    <label className={`flex min-h-11 cursor-pointer items-center gap-3 ${className}`}>
      <input type="checkbox" {...input} className="size-5 shrink-0 accent-merek" />
      <span>{label}</span>
    </label>
  );
}
