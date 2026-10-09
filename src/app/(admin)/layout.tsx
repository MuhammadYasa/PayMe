import { CangkangAdmin } from "@/components/admin/cangkang";
import { wajibSesi } from "@/server/auth/halaman";

export default async function LayoutAdmin({ children }: LayoutProps<"/">) {
  const sesi = await wajibSesi();
  return <CangkangAdmin sesi={sesi}>{children}</CangkangAdmin>;
}
