"use client";

import { type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes, useId } from "react";
import { formatAngka } from "@/domain/uang";

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
            onChange={(e) => {
              const digit = e.target.value.replace(/\D/g, "").slice(0, 15);
              onUbah(digit === "" ? null : Number(digit));
            }}
            className={`${gayaDasar} pl-10 text-right tabular-nums`}
          />
        </div>
      )}
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
