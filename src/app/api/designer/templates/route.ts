import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { requireDesignerUser } from "@/lib/designer/access";
import { addTemplate, listTemplates, setStatus } from "@/lib/designer/user-templates";
import { isAdmin } from "@config/site";

export const dynamic = "force-dynamic";

/** «قوالب المصممين»: the approved templates for everyone, the person's own waiting ones, and (for the owner) all waiting. */
export const GET = handle(async () => {
  const { user } = await requireDesignerUser();
  const owner = isAdmin(user.email);
  const rows = await listTemplates();
  return NextResponse.json({
    approved: rows.filter((r) => r.status === "approved").map((r) => r.template),
    waiting: rows.filter((r) => r.status === "pending" && (owner || r.by === user.id)).map((r) => ({ template: r.template, byEmail: owner ? r.byEmail : "" })),
    owner,
  });
});

/** A new template ({template, upload}), or the owner's decision ({id, decision: "approve" | "remove"}). */
export const POST = handle(async (req: Request) => {
  const { user } = await requireDesignerUser();
  const b = (await req.json().catch(() => ({}))) as { template?: unknown; upload?: unknown; id?: unknown; decision?: unknown };
  if (typeof b.id === "string") {
    if (!isAdmin(user.email)) throw new UserError("الاعتماد للرئيس فقط.", 403);
    await setStatus(b.id, b.decision === "approve" ? "approved" : "removed");
    return NextResponse.json({ ok: true });
  }
  const row = await addTemplate(user, b.template, b.upload);
  return NextResponse.json({ template: row.template, status: row.status });
});
