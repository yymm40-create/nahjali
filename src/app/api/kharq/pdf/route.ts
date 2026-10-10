import { handle, UserError } from "@/lib/api";
import { requireKharqUser } from "@/lib/kharq/access";
import { getChat } from "@/lib/kharq/chats";
import { fileNameOf, makePdf } from "@/lib/kharq/pdf";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * «محمد الخارق» · the PDF of a delivery, built from the words he wrote (nothing from the page is printed: the message
 * is read from the conversation itself). `{ chatId, turn }` → the file.
 */
export const POST = handle(async (req: Request) => {
  const { user } = await requireKharqUser();
  const b = (await req.json().catch(() => ({}))) as { chatId?: unknown; turn?: unknown };
  if (typeof b.chatId !== "string" || !UUID.test(b.chatId)) throw new UserError("محادثة غير صحيحة.", 400);
  const chat = await getChat(user.id, b.chatId);
  if (!chat) throw new UserError("ما لقينا هذي المحادثة.", 404);
  const at = Number(b.turn);
  const turn = Number.isInteger(at) ? chat.messages[at] : undefined;
  const deliver = turn?.deliver;
  if (!deliver?.text.trim()) throw new UserError("ما في نص أبني منه الملف.", 400);

  try {
    const pdf = await makePdf(deliver.title || chat.title, deliver.text);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-length": String(pdf.length),
        "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileNameOf(deliver.title || chat.title))}`,
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    console.error("kharq pdf", e);
    throw new UserError("ما قدرنا نبني الملف الحين؛ جرّب مرة ثانية.", 502);
  }
});
