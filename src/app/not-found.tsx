import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { kelasTombol } from "@/components/ui/tombol";

export default function TidakDitemukan() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <Logo ukuran={40} />
      <h1 className="text-2xl font-bold">Halaman tidak ditemukan</h1>
      <p className="text-teks-redup">
        Alamat yang Anda buka tidak ada atau sudah dipindahkan. Periksa kembali alamatnya, atau kembali ke halaman awal.
      </p>
      <Link href="/" className={kelasTombol("utama")}>
        Kembali ke halaman awal
      </Link>
    </main>
  );
}
