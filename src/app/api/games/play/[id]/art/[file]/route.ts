import { gameFile } from "@/lib/games/build";

export const dynamic = "force-dynamic";

/** A game's picture (each file name is new for each drawing, so it is kept for long). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; file: string }> }) {
  const { id, file } = await params;
  const blob = await gameFile(id, file).catch(() => null);
  if (!blob) return new Response("Not found", { status: 404, headers: { "cache-control": "public, max-age=60" } });
  return new Response(blob, {
    headers: {
      "content-type": file.endsWith(".jpg") ? "image/jpeg" : "image/webp",
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
