import { handle, UserError } from "@/lib/api";
import { requirePhotoUser } from "@/lib/photo/access";
import { fileBytes } from "@/lib/photo/files";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;

/** «زهراء فوتو ماستر» · one of the person's pictures, same-origin (so the browser can draw it on a canvas). */
export const GET = handle(async (req: Request) => {
  const { user } = await requirePhotoUser();
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!UUID.test(id)) throw new UserError("صورة غير صحيحة.", 400);
  const f = await fileBytes(user.id, id);
  if (!f) throw new UserError("ما لقينا الصورة.", 404);
  return new Response(new Uint8Array(f.bytes), { headers: { "content-type": f.mime, "cache-control": "private, max-age=3600" } });
});
