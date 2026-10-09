import { Logo } from "@/components/ui/logo";

export default function LayoutAuth({ children }: LayoutProps<"/">) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 flex flex-col items-center gap-2 text-center">
        <Logo ukuran={40} />
        <p className="text-teks-redup">Hitung gaji karyawan dari data absensi, tanpa kalkulator.</p>
      </div>
      {children}
    </main>
  );
}
