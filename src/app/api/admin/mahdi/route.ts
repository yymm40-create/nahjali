import { NextResponse } from "next/server";
import { handle, requireApiUser, UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@config/site";
import { fromDbError } from "@/lib/mahdi/server/api";
import { cleanIcon, cleanLine, cleanText, oneOf, parseBool, parseConfig, parseDate, parseIntIn, requireName } from "@/lib/mahdi/server/validate";
import { t } from "@/lib/mahdi/i18n";
import { UUID_RE } from "@/lib/mahdi/server/api";
import { normalizeTitle } from "@/lib/mahdi/engine";
import { COVER_BUCKET } from "@/lib/mahdi/server/reading";
import { notify } from "@/lib/mahdi/server/inbox";
import { removePdf } from "@/lib/mahdi/server/book-files";
import { deletePost } from "@/lib/mahdi/server/social";
import { deleteStory } from "@/lib/mahdi/server/stories";

const A = t.admin;
const CONTEXTS = ["home", "day_complete", "weekly", "monthly", "comeback", "milestone", "notification"] as const;

const id = (v: unknown) => {
  if (typeof v !== "string" || !UUID_RE.test(v)) throw new UserError(A.errors.badId, 400);
  return v;
};
const optId = (v: unknown) => (v === undefined || v === null || v === "" ? null : id(v));
const contexts = (v: unknown) => {
  const list = Array.isArray(v) ? [...new Set(v.filter((x): x is (typeof CONTEXTS)[number] => CONTEXTS.includes(x as never)))] : [];
  if (!list.length) throw new UserError(A.errors.contexts, 400);
  return list;
};
const bad = (msg: string) => new UserError(msg, 400);

/**
 * Owner-only content management for «لأجل المهدي». One route, one `action` per change:
 *   section.save / section.delete · challenge.save / challenge.status / challenge.delete
 *   text.save / text.delete · phrase.save / phrase.delete · post.hide / post.unhide / post.delete · reports.dismiss
 *   story.delete / story.reports.dismiss
 *   book.save / book.hide / book.unhide / book.dismiss / book.pdf.remove · assistant.reply / assistant.read
 * Everything runs with the service role, after checking that the caller is the owner. Anyone else gets 404.
 */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser().catch(() => null);
  if (!user || !isAdmin(user.email)) throw new UserError("غير مسموح.", 404);
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const db = createAdminClient();
  const run = async <T,>(p: PromiseLike<{ data: T; error: unknown }>) => {
    const { data, error } = await p;
    if (error) throw fromDbError(error) ?? error;
    return data;
  };

  switch (body.action) {
    // ── challenge sections ──
    case "section.save": {
      const row = {
        name: requireName(body.name, 60, A.errors.name),
        description: cleanText(body.description, 500),
        icon: cleanIcon(body.icon),
        sort_order: parseIntIn(body.sortOrder ?? 0, -1000, 1000),
        active: parseBool(body.active),
      };
      const sid = optId(body.id);
      await run(sid ? db.from("mahdi_challenge_sections").update(row).eq("id", sid) : db.from("mahdi_challenge_sections").insert(row));
      break;
    }
    case "section.delete": {
      const sid = id(body.id);
      const { count } = await db.from("mahdi_challenges").select("id", { count: "exact", head: true }).eq("section_id", sid);
      if (count) throw bad(A.errors.sectionNotEmpty);
      await run(db.from("mahdi_challenge_sections").delete().eq("id", sid));
      break;
    }

    // ── unified challenges ──
    case "challenge.save": {
      const freq = oneOf(body.freq, ["daily", "weekly", "monthly"] as const);
      const cfg = parseConfig({ ...body, freq });
      const startsOn = parseDate(body.startsOn);
      const endsOn = body.endsOn ? parseDate(body.endsOn) : null;
      if (endsOn && endsOn < startsOn) throw bad(A.errors.dates);
      const status = oneOf(body.status ?? "draft", ["draft", "published", "archived"] as const);
      const row = {
        section_id: id(body.sectionId),
        title: requireName(body.title, 80, A.errors.name),
        description: cleanText(body.description, 1000),
        rules: cleanText(body.rules, 2000),
        measure: cfg.measure,
        target: cfg.target,
        unit: cfg.unit,
        freq,
        starts_on: startsOn,
        ends_on: endsOn,
        leaderboard: parseBool(body.leaderboard),
        status,
      };
      const cid = optId(body.id);
      if (cid) {
        // Once people have joined, the goal and the dates are fixed: changing them would rewrite everyone's past days
        const { count } = await db.from("mahdi_challenge_members").select("user_id", { count: "exact", head: true }).eq("challenge_id", cid);
        if (count) {
          const cur = (await run(db.from("mahdi_challenges").select("measure, target, unit, freq, starts_on").eq("id", cid).single())) as { measure: string; target: number | string; unit: string; freq: string; starts_on: string };
          if (cur.measure !== row.measure || Number(cur.target) !== row.target || cur.unit !== row.unit || cur.freq !== row.freq || cur.starts_on !== row.starts_on) {
            throw bad(A.errors.locked);
          }
        }
        await run(db.from("mahdi_challenges").update(row).eq("id", cid));
      } else {
        await run(db.from("mahdi_challenges").insert(row));
      }
      break;
    }
    case "challenge.status": {
      const status = oneOf(body.status, ["draft", "published", "archived"] as const);
      const cid = id(body.id);
      if (status === "draft") {
        const { count } = await db.from("mahdi_challenge_members").select("user_id", { count: "exact", head: true }).eq("challenge_id", cid);
        if (count) throw bad(A.errors.hasMembers);
      }
      await run(db.from("mahdi_challenges").update({ status }).eq("id", cid));
      break;
    }
    case "challenge.delete": {
      const cid = id(body.id);
      // Deleting removes every member's logs for it, so only a challenge nobody joined can go; others are archived
      const { count } = await db.from("mahdi_challenge_members").select("user_id", { count: "exact", head: true }).eq("challenge_id", cid);
      if (count) throw bad(A.errors.hasMembers);
      await run(db.from("mahdi_challenges").delete().eq("id", cid));
      break;
    }

    // ── religious texts: written by the owner with a source; shown to users only when verified ──
    case "text.save": {
      const status = oneOf(body.verificationStatus, ["pending", "verified", "rejected"] as const);
      const source = cleanLine(body.source, 300);
      if (source.length < 2) throw bad(A.errors.source);
      const text = cleanText(body.text, 2000);
      if (text.length < 2) throw bad(A.errors.text);
      const tid = optId(body.id);
      const prev = tid ? ((await run(db.from("mahdi_religious_texts").select("verification_status, verified_at").eq("id", tid).single())) as { verification_status: string; verified_at: string | null }) : null;
      const verifiedBy = cleanLine(body.verifiedBy, 120);
      if (status === "verified" && !verifiedBy) throw bad(A.errors.verifiedBy);
      const row = {
        kind: oneOf(body.kind, ["quran", "hadith", "dua", "ziyara", "scholar"] as const),
        text,
        attribution: cleanLine(body.attribution, 200),
        source,
        reference: cleanLine(body.reference, 300),
        verification_status: status,
        verified_by: status === "verified" ? verifiedBy : "",
        verified_at: status === "verified" ? (prev?.verification_status === "verified" && prev.verified_at ? prev.verified_at : new Date().toISOString()) : null,
        notes: cleanText(body.notes, 1000),
        contexts: contexts(body.contexts),
        active: parseBool(body.active),
      };
      await run(tid ? db.from("mahdi_religious_texts").update(row).eq("id", tid) : db.from("mahdi_religious_texts").insert(row));
      break;
    }
    case "text.delete":
      await run(db.from("mahdi_religious_texts").delete().eq("id", id(body.id)));
      break;

    // ── motivational phrases: original lines, not attributed to anyone ──
    case "phrase.save": {
      const text = cleanLine(body.text, 200);
      if (text.length < 2) throw bad(A.errors.text);
      const row = { text, contexts: contexts(body.contexts), active: parseBool(body.active), sort_order: parseIntIn(body.sortOrder ?? 0, -1000, 1000) };
      const pid = optId(body.id);
      await run(pid ? db.from("mahdi_phrases").update(row).eq("id", pid) : db.from("mahdi_phrases").insert(row));
      break;
    }
    case "phrase.delete":
      await run(db.from("mahdi_phrases").delete().eq("id", id(body.id)));
      break;

    // ── community moderation ──
    case "post.hide":
      await run(db.from("mahdi_posts").update({ hidden_at: new Date().toISOString(), hidden_reason: cleanLine(body.reason, 200) }).eq("id", id(body.id)));
      break;
    case "post.unhide":
      await run(db.from("mahdi_posts").update({ hidden_at: null, hidden_reason: "" }).eq("id", id(body.id)));
      break;
    case "reports.dismiss":
      await run(db.from("mahdi_post_reports").delete().eq("post_id", id(body.postId)));
      break;
    case "post.delete":
      await deletePost(id(body.id));
      break;
    case "story.delete":
      await deleteStory(id(body.id));
      break;
    case "story.reports.dismiss":
      await run(db.from("mahdi_story_reports").delete().eq("story_id", id(body.storyId)));
      break;

    // ── shared book catalogue ──
    case "book.save": {
      const bid = id(body.id);
      const title = cleanLine(body.title, 120);
      if (!title) throw bad(A.errors.name);
      const pages = parseIntIn(body.pages, 1, 10000);
      const row: Record<string, unknown> = {
        title,
        title_norm: normalizeTitle(title),
        author: cleanLine(body.author, 80),
        pages,
        unit: body.unit === "narration" ? "narration" : "page",
        description: cleanText(body.description, 500),
      };
      if (body.removeCover === true) {
        const { data: cur } = await db.from("mahdi_books").select("cover_path").eq("id", bid).single();
        if (cur?.cover_path) await db.storage.from(COVER_BUCKET).remove([cur.cover_path]);
        row.cover_path = null;
      }
      await run(db.from("mahdi_books").update(row).eq("id", bid));
      break;
    }
    case "book.hide":
      await run(db.from("mahdi_books").update({ hidden_at: new Date().toISOString(), hidden_reason: cleanLine(body.reason, 200) }).eq("id", id(body.id)));
      break;
    case "book.pdf.remove": {
      const bid = id(body.id);
      const { data: b } = await db.from("mahdi_books").select("*").eq("id", bid).maybeSingle();
      if (b?.pdf_path) {
        await run(db.from("mahdi_books").update({ pdf_path: null, pdf_size: null, pdf_added_by: null }).eq("id", bid));
        await removePdf(b.pdf_path as string);
      }
      break;
    }
    case "book.unhide":
      await run(db.from("mahdi_books").update({ hidden_at: null, hidden_reason: "" }).eq("id", id(body.id)));
      break;
    case "book.dismiss":
      await run(db.from("mahdi_book_reports").delete().eq("book_id", id(body.id)));
      break;

    // ── «المساعد»: the owner answers by hand; the person gets a notification ──
    case "assistant.reply": {
      const uid = id(body.userId);
      const text = cleanText(body.text, 2000);
      if (!text) throw bad(t.admin.assistant.empty);
      const now = new Date().toISOString();
      await run(db.from("mahdi_assistant_messages").insert({ user_id: uid, from_owner: true, body: text }));
      await run(db.from("mahdi_assistant_messages").update({ read_at: now }).eq("user_id", uid).eq("from_owner", false).is("read_at", null));
      await notify([uid], { kind: "assistant_reply", title: t.assistant.replyTitle, body: text, url: "/mahdi?assistant=1" });
      break;
    }
    case "assistant.read":
      await run(db.from("mahdi_assistant_messages").update({ read_at: new Date().toISOString() }).eq("user_id", id(body.userId)).eq("from_owner", false).is("read_at", null));
      break;

    default:
      throw bad(A.errors.unknown);
  }
  return NextResponse.json({ ok: true });
});
