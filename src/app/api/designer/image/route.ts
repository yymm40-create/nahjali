import { handle, UserError } from "@/lib/api";
import { requireDesignerUser } from "@/lib/designer/access";
import { fileBytes } from "@/lib/designer/files";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;

/** «المصمم الذكي» · one of the person's produced pictures, same-origin (so the browser can draw it on a canvas). */
export const GET = handle(async (req: Request) => {
  const { user } = await requireDesignerUser();
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!UUID.test(id)) throw new UserError("صورة غير صحيحة.", 400);
  const bytes = await fileBytes(user.id, id);
  if (!bytes) throw new UserError("ما لقينا الصورة.", 404);
  return new Response(new Uint8Array(bytes), { headers: { "content-type": "image/png", "cache-control": "private, max-age=3600" } });
});
