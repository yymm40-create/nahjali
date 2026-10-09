"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, postJson } from "@/lib/fetch";
import { LEARN, fmtDuration } from "@config/learn";
import { PRODUCT_LABEL, type Product } from "@config/course";
import type { CourseView, DayView, LessonView } from "@/lib/learn/server";

interface Grant { id: string; course_id: string; email: string; created_at: string }
interface Flag { id: string; email: string; lesson_id: string | null; session_id: string | null; kind: string; detail: string; created_at: string }
interface Sess { id: string; email: string; lesson_id: string; started_at: string; last_seen: string; served_s: number; pieces: number; revoked: boolean; revoked_reason: string; ip: string }
interface Data { courses: CourseView[]; grants: Grant[]; flags: Flag[]; sessions: Sess[] }
interface Up { p: number; label: string; err?: string }

const URL = "/api/learn/admin";
const KIND: Record<string, string> = { tamper: "عبث بعلامة الحساب", too_fast: "طلب أجزاء أسرع من المشاهدة", day_cap: "وصل الحد اليومي", many_sessions: "جلسات كثيرة معًا" };
const when = (iso: string) => new Date(iso).toLocaleString("ar-SA", { dateStyle: "short", timeStyle: "short" });

export default function LearnAdmin() {
  const [d, setD] = useState<Data | null>(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [newCourse, setNewCourse] = useState("");
  const [ups, setUps] = useState<Record<string, Up>>({});
  const busy = useRef(0);

  const load = useCallback(async () => {
    try {
      setD(await api<Data>(URL));
    } catch (e) {
      setErr((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (busy.current > 0) e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  async function act(body: Record<string, unknown>, ok?: string) {
    setErr("");
    try {
      const r = await postJson<Record<string, unknown>>(URL, body);
      if (ok) setMsg(ok);
      await load();
      return r;
    } catch (e) {
      setErr((e as Error).message);
      return null;
    }
  }

  /** Cut, lock and upload one lesson's video from this browser. */
  async function upload(lessonId: string, key: string, file: File) {
    busy.current++;
    setErr("");
    setUps((u) => ({ ...u, [lessonId]: { p: 0, label: "يجهّز…" } }));
    try {
      const { ingest } = await import("@/components/learn/ingest");
      const manifest = await ingest(file, {
        lessonId,
        key,
        sign: async (ns) => (await postJson<{ urls: Record<string, string> }>(URL, { action: "lesson_sign", id: lessonId, ns })).urls,
        onProgress: (p, label) => setUps((u) => ({ ...u, [lessonId]: { p, label } })),
      });
      await postJson(URL, { action: "lesson_finish", id: lessonId, manifest });
      setUps((u) => { const n = { ...u }; delete n[lessonId]; return n; });
      setMsg("✅ انرفع الفيديو وصار محميًا.");
      await load();
    } catch (e) {
      setUps((u) => ({ ...u, [lessonId]: { p: 0, label: "", err: (e as Error).message } }));
    } finally {
      busy.current--;
    }
  }

  async function addVideo(day: DayView, file: File) {
    const title = file.name.replace(/\.[^.]+$/, "").slice(0, LEARN.maxTitle) || "فيديو";
    const r = await act({ action: "lesson_create", dayId: day.id, title });
    if (r && typeof r.id === "string" && typeof r.key === "string") void upload(r.id, r.key, file);
  }
  async function reupload(l: LessonView, file: File) {
    const r = await act({ action: "lesson_restart", id: l.id });
    if (r && typeof r.key === "string") void upload(l.id, r.key, file);
  }

  const name = (id: string | null) => d?.courses.flatMap((c) => c.days.flatMap((x) => x.lessons)).find((l) => l.id === id)?.title ?? "—";
  const confirmDel = (what: string) => window.confirm(`تحذف ${what}؟ ما ينرجع.`);

  if (!d) return <p className="font-bold text-muted">{err || "…"}</p>;
  return (
    <div className="space-y-6">
      <div className="card space-y-2 p-4 text-sm font-bold leading-7">
        <p>🔒 الفيديو يتقطّع ويتقفّل داخل متصفحك قبل ما يطلع من جهازك، ويتخزن في مكان خاص ما له رابط عام. الطالب يشوفه داخل المشغّل فقط: بدون زر تحميل، وبدون رابط ملف، وعليه علامة باسم حسابه، والموقع يعطيه الأجزاء بسرعة المشاهدة فقط.</p>
        <p className="text-muted">صيغة الرفع: MP4 (H.264 + AAC) هي الأفضل. ما يوجد حل يمنع تصوير الشاشة بالكامل بدون خدمة مدفوعة (DRM)، لكن كل طريقة سهلة للتحميل مقفولة وكل نسخة مسرّبة عليها اسم صاحبها.</p>
      </div>
      {err && <p className="rounded-lg bg-red-500/10 p-3 text-sm font-bold text-red-400">{err}</p>}
      {msg && <p className="rounded-lg bg-emerald-500/10 p-3 text-sm font-bold text-emerald-400">{msg}</p>}

      <div className="card flex flex-wrap items-end gap-2 p-4">
        <label className="grid flex-1 gap-1 text-sm font-bold">
          دورة جديدة
          <input className="field" value={newCourse} onChange={(e) => setNewCourse(e.target.value)} placeholder="اسم الدورة" maxLength={LEARN.maxTitle} />
        </label>
        <button type="button" className="btn btn-primary" onClick={async () => { if (await act({ action: "course_save", title: newCourse }, "انضافت الدورة")) setNewCourse(""); }}>➕ أضف الدورة</button>
      </div>

      {d.courses.map((c) => (
        <CourseCard
          key={c.id}
          c={c}
          grants={d.grants.filter((g) => g.course_id === c.id)}
          ups={ups}
          act={act}
          addVideo={addVideo}
          reupload={reupload}
          confirmDel={confirmDel}
        />
      ))}
      {!d.courses.length && <p className="font-bold text-muted">ما فيه دورات بعد. أضف أول دورة من فوق.</p>}

      <section className="card space-y-2 p-4">
        <h2 className="text-xl font-extrabold">🚩 تنبيهات الحماية</h2>
        {!d.flags.length && <p className="text-sm font-bold text-muted">ما فيه شيء مريب.</p>}
        {d.flags.map((f) => (
          <p key={f.id} className="text-sm font-bold">
            <span className="text-amber-400">{KIND[f.kind] ?? f.kind}</span> · {f.email || "—"} · {name(f.lesson_id)} · <span className="text-muted">{when(f.created_at)}</span>
            {f.detail && <span className="text-muted" dir="ltr"> · {f.detail}</span>}
          </p>
        ))}
      </section>

      <section className="card space-y-2 p-4">
        <h2 className="text-xl font-extrabold">👁️ آخر المشاهدات</h2>
        {d.sessions.map((s) => (
          <p key={s.id} className="flex flex-wrap items-center gap-2 text-sm font-bold">
            <span>{s.email || "—"}</span> · <span>{name(s.lesson_id)}</span> · <span className="text-muted">{when(s.started_at)}</span> · <span>{fmtDuration(s.served_s)} من الفيديو</span>
            {s.revoked ? <span className="text-muted">({s.revoked_reason === "tamper" ? "أُوقفت: عبث" : s.revoked_reason === "newer" ? "أُغلقت: جلسة أحدث" : s.revoked_reason === "ended" ? "انتهت" : "أُغلقت"})</span> : Date.now() - new Date(s.last_seen).getTime() < LEARN.staleAfter * 1000 ? <button type="button" className="chip" onClick={() => void act({ action: "kill", id: s.id }, "أُغلقت المشاهدة")}>⛔ أغلقها</button> : null}
          </p>
        ))}
        {!d.sessions.length && <p className="text-sm font-bold text-muted">لا مشاهدات بعد.</p>}
      </section>
    </div>
  );
}

type Act = (body: Record<string, unknown>, ok?: string) => Promise<Record<string, unknown> | null>;

function CourseCard({ c, grants, ups, act, addVideo, reupload, confirmDel }: { c: CourseView; grants: Grant[]; ups: Record<string, Up>; act: Act; addVideo: (d: DayView, f: File) => void; reupload: (l: LessonView, f: File) => void; confirmDel: (w: string) => boolean }) {
  const [title, setTitle] = useState(c.title);
  const [summary, setSummary] = useState(c.summary);
  const [email, setEmail] = useState("");
  const [day, setDay] = useState("");
  const save = (patch: Record<string, unknown>, ok?: string) => act({ action: "course_save", id: c.id, ...patch }, ok);
  return (
    <section className="card space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <input className="field flex-1 text-lg font-extrabold" value={title} maxLength={LEARN.maxTitle} onChange={(e) => setTitle(e.target.value)} onBlur={() => title.trim() && title !== c.title && void save({ title }, "انحفظ الاسم")} />
        <button type="button" className="chip" onClick={() => void act({ action: "move", kind: "course", id: c.id, dir: "up" })} aria-label="فوق">⬆️</button>
        <button type="button" className="chip" onClick={() => void act({ action: "move", kind: "course", id: c.id, dir: "down" })} aria-label="تحت">⬇️</button>
        <button type="button" className="chip" onClick={() => confirmDel(`دورة «${c.title}» بكل أيامها وفيديوهاتها`) && void act({ action: "delete", kind: "course", id: c.id }, "انحذفت الدورة")}>🗑️</button>
      </div>
      <textarea className="field" rows={2} placeholder="وصف قصير للدورة (اختياري)" maxLength={LEARN.maxSummary} value={summary} onChange={(e) => setSummary(e.target.value)} onBlur={() => summary !== c.summary && void save({ summary }, "انحفظ الوصف")} />
      <div className="flex flex-wrap items-center gap-3 text-sm font-bold">
        <label className="flex items-center gap-1"><input type="checkbox" checked={c.published} onChange={(e) => void save({ published: e.target.checked }, e.target.checked ? "الدورة ظاهرة للطلاب" : "الدورة مخفية")} /> ظاهرة للطلاب</label>
        <span className="text-muted">تفتح لمن اشترى:</span>
        {(["live", "recorded", "combo"] as Product[]).map((p) => (
          <label key={p} className="flex items-center gap-1">
            <input type="checkbox" checked={c.unlock.includes(p)} onChange={(e) => void save({ unlock: e.target.checked ? [...c.unlock, p] : c.unlock.filter((x) => x !== p) }, "انحفظ")} /> {PRODUCT_LABEL[p]}
          </label>
        ))}
      </div>

      {c.days.map((x) => (
        <div key={x.id} className="space-y-2 rounded-xl border border-white/10 p-3">
          <DayHead x={x} act={act} confirmDel={confirmDel} />
          {x.lessons.map((l) => (
            <LessonRow key={l.id} l={l} up={ups[l.id]} act={act} reupload={reupload} confirmDel={confirmDel} />
          ))}
          <label className="btn btn-ghost cursor-pointer">
            ➕ أضف فيديو لهذا اليوم
            <input type="file" accept="video/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) addVideo(x, f); e.target.value = ""; }} />
          </label>
        </div>
      ))}
      <div className="flex flex-wrap items-end gap-2">
        <input className="field flex-1" value={day} onChange={(e) => setDay(e.target.value)} placeholder="يوم جديد (مثلًا: اليوم ١ — الأساسيات)" maxLength={LEARN.maxTitle} />
        <button type="button" className="btn btn-ghost" onClick={async () => { if (await act({ action: "day_save", courseId: c.id, title: day }, "انضاف اليوم")) setDay(""); }}>➕ أضف يوم</button>
      </div>

      <div className="space-y-2 border-t border-white/10 pt-3">
        <h3 className="font-extrabold">👥 أشخاص تضيفهم بالإيميل (بدون شراء)</h3>
        <div className="flex flex-wrap gap-2">
          <input className="field flex-1" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
          <button type="button" className="btn btn-ghost" onClick={async () => { if (await act({ action: "grant", courseId: c.id, email }, "انضاف")) setEmail(""); }}>أضف</button>
        </div>
        {grants.map((g) => (
          <p key={g.id} className="flex items-center gap-2 text-sm font-bold" dir="ltr"><span>{g.email}</span><button type="button" className="chip" onClick={() => void act({ action: "ungrant", id: g.id }, "انشال")}>✖</button></p>
        ))}
      </div>
    </section>
  );
}

function DayHead({ x, act, confirmDel }: { x: DayView; act: Act; confirmDel: (w: string) => boolean }) {
  const [t, setT] = useState(x.title);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input className="field flex-1 font-extrabold" value={t} maxLength={LEARN.maxTitle} onChange={(e) => setT(e.target.value)} onBlur={() => t.trim() && t !== x.title && void act({ action: "day_save", id: x.id, title: t }, "انحفظ")} />
      <button type="button" className="chip" onClick={() => void act({ action: "move", kind: "day", id: x.id, dir: "up" })}>⬆️</button>
      <button type="button" className="chip" onClick={() => void act({ action: "move", kind: "day", id: x.id, dir: "down" })}>⬇️</button>
      <button type="button" className="chip" onClick={() => confirmDel(`«${x.title}» بفيديوهاته`) && void act({ action: "delete", kind: "day", id: x.id }, "انحذف اليوم")}>🗑️</button>
    </div>
  );
}

function LessonRow({ l, up, act, reupload, confirmDel }: { l: LessonView; up?: Up; act: Act; reupload: (l: LessonView, f: File) => void; confirmDel: (w: string) => boolean }) {
  const [t, setT] = useState(l.title);
  return (
    <div className="space-y-1 rounded-lg bg-white/[.03] p-2">
      <div className="flex flex-wrap items-center gap-2">
        <span>🎬</span>
        <input className="field flex-1" value={t} maxLength={LEARN.maxTitle} onChange={(e) => setT(e.target.value)} onBlur={() => t.trim() && t !== l.title && void act({ action: "lesson_rename", id: l.id, title: t }, "انحفظ")} />
        <span className="text-xs font-bold text-muted">{l.status === "ready" ? `✅ ${fmtDuration(l.duration)}` : "⚠️ غير مكتمل"}</span>
        <label className="chip cursor-pointer">
          {l.status === "ready" ? "استبدل" : "ارفع"}
          <input type="file" accept="video/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) reupload(l, f); e.target.value = ""; }} />
        </label>
        <button type="button" className="chip" onClick={() => void act({ action: "move", kind: "lesson", id: l.id, dir: "up" })}>⬆️</button>
        <button type="button" className="chip" onClick={() => void act({ action: "move", kind: "lesson", id: l.id, dir: "down" })}>⬇️</button>
        <button type="button" className="chip" onClick={() => confirmDel(`«${l.title}»`) && void act({ action: "delete", kind: "lesson", id: l.id }, "انحذف الفيديو")}>🗑️</button>
      </div>
      {up && !up.err && (
        <div className="space-y-1">
          <div className="h-2 overflow-hidden rounded bg-white/10"><div className="h-full bg-emerald-400 transition-all" style={{ width: `${Math.round(up.p * 100)}%` }} /></div>
          <p className="text-xs font-bold text-muted">{up.label} {Math.round(up.p * 100)}% — لا تقفل الصفحة</p>
        </div>
      )}
      {up?.err && <p className="text-sm font-bold text-red-400">{up.err}</p>}
    </div>
  );
}
