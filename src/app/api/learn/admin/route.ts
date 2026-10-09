import { NextResponse } from "next/server";
import { handle, requireApiUser, UserError } from "@/lib/api";
import * as L from "@/lib/learn/server";
import { isAdmin } from "@config/site";
import type { Manifest } from "@config/learn";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function owner() {
  const user = await requireApiUser();
  if (!isAdmin(user.email)) throw new UserError("غير مسموح.", 404);
  return user;
}

/** The owner's view of the courses place: the tree, who was let in, the latest viewings and what was flagged. */
export const GET = handle(async () => {
  await owner();
  const [courses, extras] = await Promise.all([L.loadTree(), L.adminExtras()]);
  return NextResponse.json({ courses, ...extras });
});

const str = (v: unknown) => (typeof v === "string" ? v : "");

/**
 * course_save {id?, title, summary, unlock[], published} · day_save {id?, courseId, title} · lesson_create {dayId, title} → {id, key}
 * lesson_restart {id} → {key} · lesson_sign {id, ns[]} → {urls} · lesson_finish {id, manifest} · lesson_rename {id, title}
 * delete {kind, id} · move {kind, id, dir} · grant {courseId, email} · ungrant {id} · kill {id}
 */
export const POST = handle(async (req: Request) => {
  const user = await owner();
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  switch (b.action) {
    case "course_save":
      return NextResponse.json({ id: await L.saveCourse({ id: str(b.id) || undefined, title: b.title, summary: b.summary, unlock: b.unlock, published: b.published }) });
    case "day_save":
      return NextResponse.json({ id: await L.saveDay({ id: str(b.id) || undefined, courseId: str(b.courseId), title: b.title }) });
    case "lesson_create":
      return NextResponse.json(await L.createLesson(str(b.dayId), b.title));
    case "lesson_restart":
      return NextResponse.json(await L.restartLesson(str(b.id)));
    case "lesson_sign":
      return NextResponse.json({ urls: await L.signPieces(str(b.id), b.ns) });
    case "lesson_finish": {
      const m = b.manifest as Manifest | undefined;
      if (!m || !Array.isArray(m.segments)) throw new UserError("طلب غير صحيح.", 400);
      await L.finishLesson(str(b.id), { mime: str(m.mime), duration: Number(m.duration), initBytes: Number(m.initBytes), segments: m.segments.map((s) => ({ n: Number(s.n), start: Number(s.start), dur: Number(s.dur), bytes: Number(s.bytes) })) });
      return NextResponse.json({ ok: true });
    }
    case "lesson_rename":
      await L.renameLesson(str(b.id), b.title);
      return NextResponse.json({ ok: true });
    case "delete": {
      const id = str(b.id);
      if (b.kind === "course") await L.deleteCourse(id);
      else if (b.kind === "day") await L.deleteDay(id);
      else if (b.kind === "lesson") await L.deleteLesson(id);
      else throw new UserError("طلب غير صحيح.", 400);
      return NextResponse.json({ ok: true });
    }
    case "move": {
      if (b.kind !== "course" && b.kind !== "day" && b.kind !== "lesson") throw new UserError("طلب غير صحيح.", 400);
      await L.move(b.kind, str(b.id), b.dir === "up" ? "up" : "down");
      return NextResponse.json({ ok: true });
    }
    case "grant":
      await L.grant(str(b.courseId), b.email, user.email ?? user.id);
      return NextResponse.json({ ok: true });
    case "ungrant":
      await L.ungrant(str(b.id));
      return NextResponse.json({ ok: true });
    case "kill":
      await L.revokeSession(str(b.id));
      return NextResponse.json({ ok: true });
    default:
      throw new UserError("طلب غير معروف.", 400);
  }
});
