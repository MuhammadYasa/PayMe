import { describe, expect, it } from "vitest";
import { amankanTujuan } from "@/lib/tujuan";

describe("amankanTujuan", () => {
  it("menerima jalur internal beserta query", () => {
    expect(amankanTujuan("/periode/abc/unggah")).toBe("/periode/abc/unggah");
    expect(amankanTujuan("/karyawan?cari=budi")).toBe("/karyawan?cari=budi");
  });

  it("memakai bawaan bila kosong", () => {
    expect(amankanTujuan(null)).toBe("/dashboard");
    expect(amankanTujuan(undefined)).toBe("/dashboard");
    expect(amankanTujuan("")).toBe("/dashboard");
    expect(amankanTujuan("", "/")).toBe("/");
  });

  it("menolak alamat luar agar tidak bisa dipakai untuk pengalihan ke situs lain", () => {
    for (const berbahaya of [
      "https://situs-jahat.example",
      "//situs-jahat.example",
      "/\\situs-jahat.example",
      "javascript:alert(1)",
      "situs-jahat.example",
    ]) {
      expect(amankanTujuan(berbahaya)).toBe("/dashboard");
    }
  });

  it("menolak karakter kontrol", () => {
    expect(amankanTujuan("/dashboard\r\nSet-Cookie: x=y")).toBe("/dashboard");
  });

  it("tidak mengarahkan kembali ke halaman masuk, daftar, atau API", () => {
    expect(amankanTujuan("/masuk")).toBe("/dashboard");
    expect(amankanTujuan("/masuk?lanjut=/karyawan")).toBe("/dashboard");
    expect(amankanTujuan("/daftar")).toBe("/dashboard");
    expect(amankanTujuan("/api/karyawan")).toBe("/dashboard");
  });
});
