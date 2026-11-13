import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireDesignerUser } from "@/lib/designer/access";
import { getBrand, setBrand } from "@/lib/designer/brand";
import { uploadLinks } from "@/lib/content/files";

export const dynamic = "force-dynamic";

/** «هوية المأتم»: the person's saved majlis details and logo (with a link to show the logo). */
export const GET = handle(async () => {
  const { user } = await requireDesignerUser();
  const brand = await getBrand(user.id);
  const logoUrl = brand.logo ? ((await uploadLinks(user.id, [brand.logo])).get(brand.logo) ?? null) : null;
  return NextResponse.json({ brand, logoUrl });
});

export const POST = handle(async (req: Request) => {
  const { user } = await requireDesignerUser();
  const brand = await setBrand(user.id, await req.json().catch(() => ({})));
  return NextResponse.json({ brand });
});
