import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireBookletUser } from "@/lib/tables-booklet/access";
import { startBooklet, type StartRequest } from "@/lib/tables-booklet/server";
import { TB } from "@config/tables-booklet";

export const dynamic = "force-dynamic";

/** «اصنع الكتيب»: the ready booklet (`kind: "ready"`) or the one designed with «نور» (`kind: "custom"`), paid from the balance. */
export const POST = handle(async (req: Request) => {
  const user = await requireBookletUser();
  const b = (await req.json().catch(() => ({}))) as StartRequest;
  const r = await startBooklet(user, b.kind === "custom" ? { kind: "custom", chatId: b.chatId } : { kind: "ready", audience: (b as { audience?: unknown }).audience, style: (b as { style?: unknown }).style, message: (b as { message?: unknown }).message });
  return NextResponse.json({ id: r.id, next: r.next === "upload" ? `${TB.base}/${r.id}/upload` : `${TB.base}/${r.id}` });
});
