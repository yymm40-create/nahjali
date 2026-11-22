import { NextResponse } from "next/server";
import { isLeader } from "@/lib/film/anthropic";
import { HADITH_BOOK_NUMBERS, HADITH_BOOKS } from "@/lib/mahdi/hadiths";
import { mahdiRoute, readJson, requireProfile, UserError } from "@/lib/mahdi/server/api";
import { hadithCounts, importBook } from "@/lib/mahdi/server/hadiths";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** The sheikh's library (owner only): each book and how many of its hadiths are loaded. */
export const GET = mahdiRoute(async (req: Request) => {
  const { user } = await requireProfile(req);
  if (!isLeader(user.email)) throw new UserError("هذا لصاحب التطبيق فقط.", 403);
  const counts = await hadithCounts();
  const books = HADITH_BOOK_NUMBERS.map((n) => ({ book: n, name: HADITH_BOOKS[n].name, hadiths: counts[n] ?? 0 }));
  return NextResponse.json({ books, total: books.reduce((s, b) => s + b.hadiths, 0) });
});

/** `{ book }` → loads (or refreshes) that book from the open GitHub copy of thaqalayn (owner only). */
export const POST = mahdiRoute(async (req: Request) => {
  const { user } = await requireProfile(req);
  if (!isLeader(user.email)) throw new UserError("هذا لصاحب التطبيق فقط.", 403);
  const b = await readJson(req);
  const book = Number(b.book);
  if (!HADITH_BOOKS[book]) throw new UserError("رقم كتاب غير معروف.", 400);
  return NextResponse.json(await importBook(book));
});
