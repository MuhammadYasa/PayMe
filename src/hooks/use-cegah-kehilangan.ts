"use client";

import { useEffect } from "react";

const PESAN = "Ada perubahan yang belum disimpan. Bila Anda pergi sekarang, perubahan itu hilang. Tinggalkan halaman ini?";

// Beberapa formulir bisa belum tersimpan sekaligus. Satu klik hanya boleh memunculkan satu pertanyaan.
const sudahDitanya = new WeakSet<Event>();

/**
 * Memperingatkan sebelum pengguna meninggalkan halaman dengan isian yang belum disimpan: menutup tab, memuat ulang,
 * atau mengklik tautan ke halaman lain di aplikasi (mis. langkah berikutnya pada stepper).
 */
export function useCegahKehilangan(adaPerubahan: boolean): void {
  useEffect(() => {
    if (!adaPerubahan) return;

    const sebelumKeluar = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };

    const klikTautan = (e: MouseEvent) => {
      if (sudahDitanya.has(e) || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const tautan = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!tautan || tautan.target === "_blank" || tautan.origin !== window.location.origin) return;
      if (tautan.pathname === window.location.pathname) return;
      sudahDitanya.add(e);
      if (!window.confirm(PESAN)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener("beforeunload", sebelumKeluar);
    // Fase tangkap, supaya pertanyaan muncul sebelum navigasi Next.js berjalan.
    document.addEventListener("click", klikTautan, true);
    return () => {
      window.removeEventListener("beforeunload", sebelumKeluar);
      document.removeEventListener("click", klikTautan, true);
    };
  }, [adaPerubahan]);
}
