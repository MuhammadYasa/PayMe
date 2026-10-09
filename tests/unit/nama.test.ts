import { describe, expect, it } from "vitest";
import { kunciNama, rapikanNama } from "@/domain/nama";

const spasiLebarNol = String.fromCodePoint(0x200b);
const penandaUrutanByte = String.fromCodePoint(0xfeff);

describe("rapikanNama", () => {
  it("merapikan spasi ganda dan spasi di tepi", () => {
    expect(rapikanNama("  Budi   Santoso ")).toBe("Budi Santoso");
    expect(rapikanNama("Siti\tNur\n Aini")).toBe("Siti Nur Aini");
  });

  it("mempertahankan huruf besar dan kecil", () => {
    expect(rapikanNama("Budi SANTOSO")).toBe("Budi SANTOSO");
  });

  it("membuang karakter tak terlihat", () => {
    expect(rapikanNama(`Bu${spasiLebarNol}di${penandaUrutanByte} Santoso`)).toBe("Budi Santoso");
  });
});

describe("kunciNama", () => {
  it("tidak peka huruf besar-kecil dan spasi ganda", () => {
    expect(kunciNama("BUDI  santoso")).toBe("budi santoso");
    expect(kunciNama(" budi santoso ")).toBe(kunciNama("Budi Santoso"));
  });

  it("menganggap titik dan garis bawah sebagai spasi seperti pada ekspor mesin finger", () => {
    expect(kunciNama("Dimas.Pratama")).toBe("dimas pratama");
    expect(kunciNama("Dimas_Pratama")).toBe("dimas pratama");
    expect(kunciNama("Dimas.Pratama")).toBe(kunciNama("Dimas Pratama"));
  });

  it("tetap membedakan nama dengan gelar", () => {
    expect(kunciNama("Dr Budi Santoso")).not.toBe(kunciNama("Budi Santoso"));
  });

  it("mempertahankan tanda hubung dalam nama", () => {
    expect(kunciNama("Siti Nur-Aini")).toBe("siti nur-aini");
  });

  it("mengabaikan karakter tak terlihat saat mencocokkan", () => {
    expect(kunciNama(`Budi${spasiLebarNol} Santoso`)).toBe("budi santoso");
  });
});
