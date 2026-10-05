import { readFile } from "node:fs/promises";
import path from "node:path";
import { FONTS } from "@config/jawad/student";

/** «الطالب الذكي» · the open-licence (OFL) font files, for the live design previews. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const f = FONTS.find((x) => x.id === id);
  const i = Number(new URL(req.url).searchParams.get("i") ?? 0);
  const file = f?.files[i];
  if (!file) return new Response("not found", { status: 404 });
  const body = await readFile(path.join(process.cwd(), "assets", "fonts", file.file));
  return new Response(new Uint8Array(body), { headers: { "content-type": "font/ttf", "cache-control": "public, max-age=31536000, immutable", "access-control-allow-origin": "*" } });
}
