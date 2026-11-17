import { NextResponse } from "next/server";
import { handle, requireApiUser, UserError } from "@/lib/api";
import { claudeTrouble } from "@/lib/film/anthropic";
import { getVisibility, setVisibility } from "@/lib/content/access";
import { getPersona, resetPersona, savePersona } from "@/lib/content/persona";
import { makeTemplateImage, TEMPLATE_PICTURE_USD, templateImageStatus } from "@/lib/content/templates";
import { deleteRun, ESTIMATE_USD, listRuns, runStatus, startRun, stepRun, worst, type Mode } from "@/lib/content/tests";
import { CONTENT_KINDS } from "@config/content";
import { EXAMPLES_PER_KIND } from "@config/content-examples";
import { TEMPLATE_EXAMPLES_PER } from "@config/content-template-examples";
import { isAdmin } from "@config/site";
import { createAdminClient } from "@/lib/supabase/admin";
import { setChatSpent, userContentChats } from "@/lib/content/spent";
import { getChat } from "@/lib/content/chats";
import { planSlideFix, previewCodeSlide } from "@/lib/content/produce";
import { producedLinks, producedRow } from "@/lib/content/files";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function owner() {
  const user = await requireApiUser();
  if (!isAdmin(user.email)) throw new UserError("غير مسموح.", 404);
  return user;
}

/** The dashboard's view: the persona, the example bank's size, the latest test runs. */
export const GET = handle(async (req: Request) => {
  await owner();
  const run = new URL(req.url).searchParams.get("run");
  if (run) return NextResponse.json({ status: await runStatus(run), worst: await worst(run) });
  const [persona, runs, visibility, templates] = await Promise.all([getPersona(), listRuns(), getVisibility(), templateImageStatus().catch(() => [])]);
  return NextResponse.json({
    visibility,
    persona,
    runs,
    estimate: ESTIMATE_USD,
    kinds: CONTENT_KINDS.map((k) => ({ id: k.id, name: k.name, examples: EXAMPLES_PER_KIND })),
    templates,
    templateExamples: TEMPLATE_EXAMPLES_PER,
    pictureUsd: Math.round(TEMPLATE_PICTURE_USD * 1000) / 1000,
  });
});

/** One action of the dashboard (see /admin/content). */
export const POST = handle(async (req: Request) => {
  await owner();
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = String(b.id ?? "");
  try {
    switch (b.action) {
      case "visibility":
        await setVisibility(b.value as "owner" | "codes" | "all");
        return NextResponse.json({ ok: true });
      case "persona_save":
        await savePersona(String(b.text ?? ""));
        return NextResponse.json({ ok: true });
      case "persona_reset":
        await resetPersona();
        return NextResponse.json({ ok: true });
      case "template_image":
        // one template's gallery picture (drawn again if it already has one); the page calls it template by template
        return NextResponse.json(await makeTemplateImage(id));
      case "test_start": {
        const mode: Mode = b.mode === "deep" ? "deep" : "quick";
        const count = Math.max(1, Math.min(1000, Math.floor(Number(b.count)) || 100));
        return NextResponse.json(await startRun(count, mode, String(b.label ?? "")));
      }
      case "test_step":
        return NextResponse.json(await stepRun(id, 3));
      case "test_delete":
        await deleteRun(id);
        return NextResponse.json({ ok: true });
      // a person's conversations with what each shows, and the owner's correction of one conversation's shown cost
      case "user_chats":
        return NextResponse.json({ chats: await userContentChats(String(b.userId ?? "")) });
      // a person's conversation as the owner needs it to help (the texts, the picks, the carousel's look and references; no file links)
      case "chat_detail": {
        const { data } = await createAdminClient().from("content_chats").select("id,user_id,messages,pending,record,updated_at").eq("id", id).maybeSingle();
        if (!data) throw new UserError("ما لقينا المحادثة.", 404);
        const msgs = (Array.isArray(data.messages) ? data.messages : []) as Record<string, unknown>[];
        return NextResponse.json({
          updatedAt: data.updated_at,
          record: String(data.record ?? "").slice(0, 4000),
          pending: data.pending,
          messages: msgs.map((m, i) => ({
            i,
            role: m.role,
            text: String(m.text ?? "").slice(0, 1500),
            files: Array.isArray(m.files) ? (m.files as Record<string, unknown>[]).map((f) => `${f.kind}:${f.id}:${f.name}`) : undefined,
            questions: Array.isArray(m.questions) ? (m.questions as Record<string, unknown>[]).map((q) => q.label) : undefined,
            slides: m.slides ? (({ items, ...rest }) => ({ ...rest, items: Array.isArray(items) ? (items as Record<string, unknown>[]).map((x) => `${x.n}:${x.name}:${x.fileId}`) : [] }))(m.slides as Record<string, unknown>) : undefined,
          })),
        });
      }
      // the owner sets a person's slide right for them: its sound time (and a change in words); their page makes the video
      // the next time it is open (the slide keeps its picture and its program)
      case "plan_slide_fix": {
        const { data } = await createAdminClient().from("content_chats").select("user_id").eq("id", id).maybeSingle();
        const chat = data ? await getChat(String(data.user_id), id) : null;
        if (!data || !chat) throw new UserError("ما لقينا المحادثة.", 404);
        const n = Math.round(Number(b.n));
        const from = Number(b.from);
        const to = Number(b.to);
        if (!(n > 0) || !(from >= 0) || !(to > from) || to - from > 60) throw new UserError("الشريحة أو الوقت غير صحيح.");
        const planned = await planSlideFix(String(data.user_id), chat, n, { from, to }, typeof b.said === "string" ? b.said : "");
        return NextResponse.json({ ok: true, pending: { slides: planned.pending?.slides.map((s) => s.n), soundTimes: planned.pending?.soundTimes, edits: planned.pending?.edits, programs: planned.pending?.programs, arts: Object.keys(planned.pending?.arts ?? {}), picturesOk: planned.pending?.picturesOk } });
      }
      // what a person's page will be handed for a waiting slide (checked before it runs)
      case "slide_brief": {
        const { data } = await createAdminClient().from("content_chats").select("user_id").eq("id", id).maybeSingle();
        if (!data) throw new UserError("ما لقينا المحادثة.", 404);
        return NextResponse.json(await previewCodeSlide(String(data.user_id), id, Math.round(Number(b.n))));
      }
      // a made slide of a person's chat as the owner checks it: its record and links to its picture and video (1 hour)
      case "slide_file": {
        const { data } = await createAdminClient().from("content_chats").select("user_id").eq("id", id).maybeSingle();
        if (!data) throw new UserError("ما لقينا المحادثة.", 404);
        const uid = String(data.user_id);
        const row = await producedRow(uid, String(b.fileId ?? ""));
        if (!row) throw new UserError("ما لقينا الملف.", 404);
        const links = await producedLinks(uid, id);
        const video = typeof row.meta.video === "string" ? row.meta.video : null;
        const meta = { ...row.meta, prompt: undefined };
        return NextResponse.json({ name: row.name, meta, url: links.get(row.id) ?? null, video: video ? (links.get(video) ?? null) : null });
      }
      case "set_chat_spent": {
        const halalas = Math.round(Number(b.halalas));
        if (!Number.isFinite(halalas) || halalas < 0) throw new UserError("المبلغ غير صحيح.");
        return NextResponse.json(await setChatSpent(id, halalas));
      }
    }
  } catch (e) {
    const why = claudeTrouble(e);
    if (why) throw new UserError(why, 503);
    throw e;
  }
  throw new UserError("إجراء غير معروف.");
});
