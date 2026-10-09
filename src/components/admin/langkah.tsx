import { Pesan } from "@/components/ui/pesan";
import { TombolTautan } from "@/components/ui/tombol";
import { type SlugLangkah, cariLangkah, urlLangkah } from "@/lib/langkah";

/** Judul langkah dengan indikator "Langkah N dari 9" dan teks bantuan singkat (FR-20). */
export function KepalaLangkah({ slug }: { slug: SlugLangkah }) {
  const { nomor, jumlah, langkah } = cariLangkah(slug);
  return (
    <div className="mb-5">
      <p className="font-semibold text-merek">
        Langkah {nomor} dari {jumlah}
      </p>
      <h2 className="text-xl font-bold">{langkah.judul}</h2>
      <p className="mt-1 max-w-3xl text-teks-redup">{langkah.bantuan}</p>
    </div>
  );
}

export function NavigasiLangkah({ periodeId, slug, tertahan }: { periodeId: string; slug: SlugLangkah; tertahan?: string }) {
  const { sebelumnya, berikutnya } = cariLangkah(slug);
  return (
    <div className="mt-8 space-y-3 border-t border-garis pt-5">
      {tertahan ? <Pesan jenis="info">{tertahan}</Pesan> : null}
      <div className="flex flex-wrap justify-between gap-3">
        {sebelumnya ? (
          <TombolTautan varian="sekunder" href={urlLangkah(periodeId, sebelumnya.slug)}>
            Kembali: {sebelumnya.judul}
          </TombolTautan>
        ) : (
          <span />
        )}
        {berikutnya ? <TombolTautan href={urlLangkah(periodeId, berikutnya.slug)}>Lanjut: {berikutnya.judul}</TombolTautan> : null}
      </div>
    </div>
  );
}
