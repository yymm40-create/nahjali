import BrandAdmin from "@/components/jawad/admin/BrandAdmin";
import { loadRuntime } from "@/lib/jawad/server/runtime";
import { requireJawadOwnerPage } from "@/lib/jawad/server/access";

export const metadata = { title: "الهوية والشعار" };

export default async function BrandPage() {
  await requireJawadOwnerPage("/jawad-ai/admin/brand");
  const rt = await loadRuntime();
  return <BrandAdmin logoUrl={rt.brand.logoUrl} custom={rt.brand.customLogo} accent={rt.brand.accent} />;
}
