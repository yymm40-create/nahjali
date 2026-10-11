import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { requireJawadOwner } from "@/lib/jawad/server/access";
import { confirmRef, deleteRef, getPage, listRefs, savePage, startRef, stepRef } from "@/lib/khateeb/reference";

export const dynamic = "force-dynamic";
// a few scanned pages are read by one call: the platform's longest wait, like the other long jobs
export const maxDuration = 300;

const UUID = /^[0-9a-f-]{36}$/i;
const idOf = (v: unknown) => {
  if (typeof v !== "string" || !UUID.test(v)) throw new UserError("مرجع غير صحيح.", 400);
  return v;
};

/** The owner's references (مرجع الأشعار) and how far each is read. */
export const GET = handle(async () => {
  await requireJawadOwner();
  return NextResponse.json(await listRefs());
});

/**
 * `{ action: "start", title, bytes }` → where to upload the PDF · `"confirm", id` → the file is counted and reading starts ·
 * `"step", id` → the next pages are read (called again until it is ready) · `"page", id, page` → one page's text ·
 * `"save_page", id, page, text` → a page corrected · `"delete", id`.
 */
export const POST = handle(async (req: Request) => {
  await requireJawadOwner();
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  switch (b.action) {
    case "start":
      return NextResponse.json(await startRef(String(b.title ?? ""), Number(b.bytes)));
    case "confirm":
      return NextResponse.json({ ref: await confirmRef(idOf(b.id)) });
    case "step":
      return NextResponse.json({ ref: await stepRef(idOf(b.id)) });
    case "page": {
      const page = await getPage(idOf(b.id), Math.round(Number(b.page)));
      if (!page) throw new UserError("هذي الصفحة ما انقرت للحين.", 404);
      return NextResponse.json({ page });
    }
    case "save_page":
      await savePage(idOf(b.id), Math.round(Number(b.page)), String(b.text ?? ""));
      return NextResponse.json({ ok: true });
    case "delete":
      await deleteRef(idOf(b.id));
      return NextResponse.json({ ok: true });
    default:
      throw new UserError("طلب غير صحيح.", 400);
  }
});
