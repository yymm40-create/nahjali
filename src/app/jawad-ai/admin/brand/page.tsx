import BrandAdmin from "@/components/jawad/admin/BrandAdmin";
import { loadRuntime } from "@/lib/jawad/server/runtime";

export const metadata = { title: "الهوية والشعار" };

export default async function BrandPage() {
  const rt = await loadRuntime();
  return <BrandAdmin logoUrl={rt.brand.logoUrl} custom={rt.brand.customLogo} accent={rt.brand.accent} />;
}
