import { readFileSync } from "node:fs";
import type { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hitungPeriode } from "@/domain/periode";
import { buatDenda } from "@/server/services/denda";
import { dendaSkema } from "@/skema/penghasilan";
import { panggil, tokenUntuk } from "../support/api";
import { karyawanUji, periodeUji } from "../support/data";
import { buatPerusahaanUji, hapusPerusahaan } from "../support/db";

type Penangan = (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;
type ModulRute = Partial<Record<"GET" | "POST" | "PUT" | "PATCH" | "DELETE", Penangan>>;

const METODE = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
const berkasRute = import.meta.glob<ModulRute>("../../src/app/api/**/route.ts");

/** Route tanpa sesi. Semua yang lain wajib menolak permintaan tanpa sesi dengan 401. */
const PUBLIK = new Set(["/api/auth/daftar", "/api/auth/masuk", "/api/auth/keluar", "/api/publik/gaji"]);

function jalurDari(kunci: string): string {
  return `/api${kunci.split("/src/app/api")[1].replace(/\/route\.ts$/, "")}`;
}

interface Rute {
  kunci: string;
  jalur: string;
  metode: (typeof METODE)[number];
  penangan: Penangan;
}

async function semuaRute(): Promise<Rute[]> {
  const daftar: Rute[] = [];
  for (const [kunci, muat] of Object.entries(berkasRute)) {
    const modul = await muat();
    for (const metode of METODE) {
      const penangan = modul[metode];
      if (penangan) daftar.push({ kunci, jalur: jalurDari(kunci), metode, penangan });
    }
  }
  return daftar;
}

const UUID_CONTOH = "11111111-1111-4111-8111-111111111111";

function isiParam(jalur: string, nilai: Record<string, string>): string {
  return jalur.replace(/\[(\w+)\]/g, (_, nama: string) => nilai[nama] ?? UUID_CONTOH);
}

function paramDari(jalur: string, nilai: Record<string, string>): Record<string, string> {
  return Object.fromEntries([...jalur.matchAll(/\[(\w+)\]/g)].map((m) => [m[1], nilai[m[1]] ?? UUID_CONTOH]));
}

describe("setiap endpoint dilindungi (FR-01, NFR-09)", () => {
  it("setiap berkas route.ts memakai pembungkus sesi: ruteAdmin, atau rutePublik hanya pada daftar publik", () => {
    expect(Object.keys(berkasRute).length).toBeGreaterThan(20);
    for (const kunci of Object.keys(berkasRute)) {
      const teks = readFileSync(kunci.replace("../../", ""), "utf8");
      const publik = PUBLIK.has(jalurDari(kunci));
      expect(teks, kunci).toContain(publik ? "rutePublik" : "ruteAdmin");
      if (!publik) expect(teks, kunci).not.toContain("rutePublik");
    }
  });

  it("tanpa sesi, setiap metode pada setiap route admin mengembalikan 401 dan tidak ada data", async () => {
    const diperiksa: string[] = [];
    for (const r of await semuaRute()) {
      if (PUBLIK.has(r.jalur)) continue;
      const hasil = await panggil(r.penangan as never, {
        metode: r.metode,
        jalur: isiParam(r.jalur, {}),
        params: paramDari(r.jalur, {}),
        body: r.metode === "GET" || r.metode === "DELETE" ? undefined : {},
      });
      expect(hasil.status, `${r.metode} ${r.jalur}`).toBe(401);
      expect(JSON.stringify(hasil.json)).not.toMatch(/karyawan"|gaji|periode"/);
      diperiksa.push(`${r.metode} ${r.jalur}`);
    }
    expect(diperiksa.length).toBeGreaterThan(30);
  });

  it("route publik tidak meminta sesi", async () => {
    for (const r of await semuaRute()) {
      if (!PUBLIK.has(r.jalur)) continue;
      const hasil = await panggil(r.penangan as never, { metode: r.metode, jalur: r.jalur, body: {} });
      expect(hasil.status, `${r.metode} ${r.jalur}`).not.toBe(401);
    }
  });
});

describe("perusahaan lain mendapat 404 pada setiap sumber daya berID (NFR-09)", () => {
  let a: Awaited<ReturnType<typeof buatPerusahaanUji>>;
  let b: Awaited<ReturnType<typeof buatPerusahaanUji>>;
  let tokenB: string;
  let nilai: Record<string, string>;

  beforeAll(async () => {
    a = await buatPerusahaanUji("PT Pemilik");
    b = await buatPerusahaanUji("PT Penyusup");
    tokenB = await tokenUntuk(b.akunId);
    const periode = await periodeUji(a.db, "2025-04-01");
    const karyawan = await karyawanUji(a.db, "Budi Santoso");
    const denda = await buatDenda(a.db, periode.id, dendaSkema.parse({ karyawanId: karyawan.id, alasan: "Uji", total: 100_000, jumlahCicilan: 1, mulai: "periode_ini" }));
    nilai = { id: periode.id, karyawanId: karyawan.id, dendaId: denda.id };
  });

  afterAll(async () => {
    await hapusPerusahaan(a.perusahaanId);
    await hapusPerusahaan(b.perusahaanId);
  });

  const hari = ["2025-04-02"];
  // Isi minimum yang lolos validasi, supaya yang menolak adalah pemeriksaan kepemilikan, bukan validasi isian.
  const BODY: Record<string, unknown> = {
    "PUT /api/karyawan/[id]": { namaLengkap: "X", jabatan: "X", cabang: "X", gajiPokok: 1, nomorRekening: "1234567" },
    "PUT /api/periode/[id]/absensi/[karyawanId]": { simpan: [], hapus: [] },
    "POST /api/periode/[id]/absensi/[karyawanId]/massal": { tanggal: hari, status: "HADIR" },
    "POST /api/periode/[id]/libur": { tanggal: hari, karyawanIds: "semua" },
    "DELETE /api/periode/[id]/libur": { tanggal: hari, karyawanIds: "semua" },
    "POST /api/periode/[id]/ketidakhadiran": { karyawanId: UUID_CONTOH, jenis: "IZIN", dari: "2025-04-02", sampai: "2025-04-02" },
    "PUT /api/periode/[id]/pendapatan": { cabang: "X", totalAktual: 0, sales: [] },
    "PUT /api/periode/[id]/insentif": { items: [] },
    "POST /api/periode/[id]/denda": { karyawanId: UUID_CONTOH, alasan: "x", total: 100, jumlahCicilan: 1, mulai: "periode_ini" },
    "PUT /api/periode/[id]/potongan": { items: [] },
    "POST /api/periode/[id]/simpan": { hash: "a".repeat(64) },
    "POST /api/periode/[id]/buka": { konfirmasi: true },
  };

  it("daftar isian uji mencakup setiap route yang memuat ID, sehingga route baru tidak lolos tanpa pemeriksaan", async () => {
    const berID = (await semuaRute()).filter((r) => r.jalur.includes("["));
    const tanpaIsian = berID.filter((r) => ["POST", "PUT", "DELETE", "PATCH"].includes(r.metode) && !(`${r.metode} ${r.jalur}` in BODY) && !r.jalur.endsWith("/impor"));
    const perluIsian = tanpaIsian.filter((r) => `${r.metode} ${r.jalur}` !== "DELETE /api/karyawan/[id]" && `${r.metode} ${r.jalur}` !== "DELETE /api/periode/[id]" && `${r.metode} ${r.jalur}` !== "DELETE /api/denda/[id]" && `${r.metode} ${r.jalur}` !== "POST /api/periode/[id]/hitung");
    expect(perluIsian.map((r) => `${r.metode} ${r.jalur}`)).toEqual([]);
  });

  it("setiap metode pada setiap route berID menjawab 404 bagi perusahaan lain", async () => {
    let jumlah = 0;
    for (const r of await semuaRute()) {
      if (!r.jalur.includes("[") || PUBLIK.has(r.jalur)) continue;
      const kunci = `${r.metode} ${r.jalur}`;
      const berkas = r.jalur.endsWith("/impor");
      const form = new FormData();
      form.set("file", new File([new Uint8Array([80, 75, 3, 4])], "a.xlsx"));
      form.set("tahap", "baca");

      const hasil = await panggil(r.penangan as never, {
        metode: r.metode,
        jalur: isiParam(r.jalur, nilai),
        params: paramDari(r.jalur, nilai),
        token: tokenB,
        ...(berkas ? { isiMentah: form } : r.metode === "GET" || !(kunci in BODY) ? {} : { body: BODY[kunci] }),
      });
      expect(hasil.status, kunci).toBe(404);
      jumlah++;
    }
    expect(jumlah).toBeGreaterThan(25);
  });

  it("pemilik sendiri tidak mendapat 404 pada sumber daya yang sama", async () => {
    const tokenA = await tokenUntuk(a.akunId);
    for (const jalur of ["/api/periode/[id]", "/api/periode/[id]/absensi", "/api/periode/[id]/pendapatan", "/api/periode/[id]/denda", "/api/karyawan/[id]"]) {
      const modul = await berkasRute[`../../src/app/api${jalur === "/api/karyawan/[id]" ? "/karyawan/[id]" : jalur.replace("/api", "")}/route.ts`]();
      const hasil = await panggil(modul.GET as never, { jalur: isiParam(jalur, { ...nilai, id: jalur.includes("karyawan") ? nilai.karyawanId : nilai.id }), params: paramDari(jalur, { ...nilai, id: jalur.includes("karyawan") ? nilai.karyawanId : nilai.id }), token: tokenA });
      expect(hasil.status, jalur).toBe(200);
    }
  });
});

describe("konsistensi perhitungan periode contoh", () => {
  it("rentang periode uji sesuai", () => {
    expect(hitungPeriode("2025-04-01").jumlahHari).toBe(30);
  });
});
