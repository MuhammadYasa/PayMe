"use client";

import { type ReactNode, useEffect, useId, useRef } from "react";
import { Tombol } from "./tombol";

interface PropDialog {
  buka: boolean;
  onTutup: () => void;
  judul: string;
  children: ReactNode;
  lebar?: string;
  /** false untuk dialog yang tidak boleh ditutup tanpa memilih (mis. sesi berakhir). */
  bisaDitutup?: boolean;
}

/** Dialog modal bawaan browser (<dialog>): fokus terkunci di dalamnya, Esc menutup, dan fokus kembali ke pemicu. */
export function Dialog({ buka, onTutup, judul, children, lebar = "max-w-lg", bisaDitutup = true }: PropDialog) {
  const ref = useRef<HTMLDialogElement>(null);
  const idJudul = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (buka && !dialog.open) dialog.showModal();
    if (!buka && dialog.open) dialog.close();
  }, [buka]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={idJudul}
      onCancel={(e) => {
        e.preventDefault();
        if (bisaDitutup) onTutup();
      }}
      onClick={(e) => {
        if (bisaDitutup && e.target === ref.current) onTutup();
      }}
      className={`m-auto w-[calc(100%-2rem)] ${lebar} rounded-xl border border-garis bg-kartu p-0 text-teks shadow-xl backdrop:bg-slate-900/50`}
    >
      {buka ? (
        <div className="max-h-[85vh] overflow-y-auto p-6">
          <h2 id={idJudul} className="mb-4 text-xl font-bold">
            {judul}
          </h2>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}

interface PropKonfirmasi {
  buka: boolean;
  judul: string;
  pesan: ReactNode;
  labelYa: string;
  labelBatal?: string;
  bahaya?: boolean;
  memproses?: boolean;
  onYa: () => void;
  onBatal: () => void;
}

export function KonfirmasiDialog({ buka, judul, pesan, labelYa, labelBatal = "Batal", bahaya = false, memproses = false, onYa, onBatal }: PropKonfirmasi) {
  return (
    <Dialog buka={buka} onTutup={onBatal} judul={judul} bisaDitutup={!memproses}>
      <div className="text-[15px] text-teks">{pesan}</div>
      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <Tombol varian="sekunder" onClick={onBatal} disabled={memproses} autoFocus>
          {labelBatal}
        </Tombol>
        <Tombol varian={bahaya ? "bahaya" : "utama"} onClick={onYa} memuat={memproses}>
          {labelYa}
        </Tombol>
      </div>
    </Dialog>
  );
}
