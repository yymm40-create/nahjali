import { AlignmentType, Document, ExternalHyperlink, HeadingLevel, Packer, Paragraph, TextRun, type ParagraphChild } from "docx";
import { mahdiRoute, requireProfile, UserError } from "@/lib/mahdi/server/api";
import { myMessage } from "@/lib/mahdi/server/sheikh";
import { plainAnswer } from "@/lib/mahdi/sheikh";

export const dynamic = "force-dynamic";

const FONT = "Traditional Arabic";
const run = (text: string, bold = false) => new TextRun({ text, bold, boldComplexScript: bold, rightToLeft: true, font: FONT, size: 30, sizeComplexScript: 30 });

/** One line of the answer: its text, bold, and its links (live in Word). */
function lineChildren(line: string): ParagraphChild[] {
  const out: ParagraphChild[] = [];
  const re = /https?:\/\/[^\s)»"'<>،]+|\*\*([^*]+)\*\*/g;
  let at = 0;
  for (let m = re.exec(line); m; m = re.exec(line)) {
    if (m.index > at) out.push(run(line.slice(at, m.index)));
    if (m[1]) out.push(run(m[1], true));
    else {
      const url = m[0].replace(/[.,;:]+$/, "");
      out.push(new ExternalHyperlink({ link: url, children: [new TextRun({ text: url, style: "Hyperlink", size: 22 })] }));
      re.lastIndex = m.index + url.length;
    }
    at = re.lastIndex;
  }
  if (at < line.length) out.push(run(line.slice(at)));
  return out;
}

/** «نزّل Word»: a «بحث شامل» answer of the person's as a right-to-left Word file, its question as the title. */
export const GET = mahdiRoute(async (req: Request) => {
  const { user } = await requireProfile(req);
  const id = new URL(req.url).searchParams.get("id") ?? "";
  const answer = await myMessage(user.id, id);
  if (answer.role !== "sheikh") throw new UserError("هذا مو جواب.", 400);
  // the question is the message the person sent just before it
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const q = await createAdminClient()
    .from("mahdi_sheikh_messages")
    .select("body")
    .eq("user_id", user.id)
    .eq("role", "user")
    .lte("created_at", answer.created_at)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const question = (q.data as { body?: string } | null)?.body ?? "الشيخ الذكي";
  const paragraphs = [
    new Paragraph({ bidirectional: true, heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, children: [run(question, true)] }),
    ...plainAnswer(answer.body)
      .split("\n")
      .filter((l) => l.trim())
      .map((l) => new Paragraph({ bidirectional: true, spacing: { after: 160, line: 360 }, children: lineChildren(l) })),
    new Paragraph({ bidirectional: true, spacing: { before: 400 }, children: [run("«الشيخ الذكي» — تطبيق لأجل المهدي · المصدر: مكتبة الثقلين thaqalayn.com. هذا بحث في نصوص الروايات، وليس فتوى.")] }),
  ];
  const doc = new Document({ styles: { default: { document: { run: { font: FONT, rightToLeft: true } } } }, sections: [{ properties: {}, children: paragraphs }] });
  const buf = await Packer.toBuffer(doc);
  const name = `${question.replace(/[\\/:*?"<>|\n]/g, " ").slice(0, 60).trim() || "الشيخ الذكي"}.docx`;
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "private, no-store",
    },
  });
});
