import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireJawadOwner } from "@/lib/jawad/server/access";
import { loadSettings, saveSettings } from "@/lib/khateeb/gate";

export const dynamic = "force-dynamic";

/** The owner's «الخطيب الذكي» settings (never the password: only whether one is set). */
export const GET = handle(async () => {
  await requireJawadOwner();
  return NextResponse.json(await loadSettings());
});

/** `{ slug?, newSlug?, password?, method?, poems? }`: each only when given. */
export const POST = handle(async (req: Request) => {
  await requireJawadOwner();
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  return NextResponse.json(await saveSettings({ slug: b.slug, newSlug: b.newSlug === true, password: b.password, method: b.method, poems: b.poems }));
});
