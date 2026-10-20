import { notFound } from "next/navigation";
import CodeWatch from "@/app/admin/access/codes/[id]/page";

export const metadata = { title: "مراقبة كود | لوحة التحكم" };
export const dynamic = "force-dynamic";

// «📊 مراقبة الكود» inside the JAWAD AI admin: /admin/access/codes/<id> is redirected here (next.config.ts), and only
// the «السماح والأكواد» panel has codes.
export default async function Page({ params }: { params: Promise<{ panel: string; id: string }> }) {
  const { panel, id } = await params;
  if (panel !== "access") notFound();
  return <CodeWatch params={Promise.resolve({ id })} />;
}
