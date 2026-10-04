import { NextResponse } from "next/server";
import { mahdiRoute, readJson, requireProfile } from "@/lib/mahdi/server/api";
import { pdfUploadLink } from "@/lib/mahdi/server/book-files";

/** A one-time link to upload a book's PDF straight to storage: `{ size }` → `{ path, token }`. */
export const POST = mahdiRoute(async (req: Request) => {
  const { user } = await requireProfile(req);
  const body = await readJson(req);
  return NextResponse.json(await pdfUploadLink(user.id, Number(body.size)));
});
