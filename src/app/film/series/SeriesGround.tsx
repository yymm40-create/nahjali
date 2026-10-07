"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { postJson } from "@/lib/fetch";
import { credits } from "@/lib/film/credits";
import { openSajjad } from "../SajjadPanel";

export type CastView = { id: string; kind: "style" | "character" | "place"; name: string; description: string; status: "none" | "generating" | "ready" | "failed"; error: string | null; url: string | null };

const PICTURE_USD = 0.46;
const KIND_ICON = { style: "🎨", character: "🧑", place: "🏞️" } as const;

/**
 * The series' groundwork, before and alongside its scenes: its description (developed with سجاد's questions, come
 * back any time), its look, and its characters and places with their pictures — made once, chosen in every scene.
 * Only its leader (or whom the leader gave «📖») changes them; everyone sees them.
 */
export default function SeriesGround({ seriesId, canEdit, about, bible, style, cast }: { seriesId: string; canEdit: boolean; about: string; bible: string; style: string; cast: CastView[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [b, setB] = useState(bible);
  const [st, setSt] = useState(style);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [adding, setAdding] = useState<"character" | "place" | null>(null);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  // pictures being drawn: the page refreshes until they're done
  const drawing = cast.some((c) => c.status === "generating");
  useEffect(() => {
    if (!drawing) return;
    const t = setInterval(() => router.refresh(), 6000);
    return () => clearInterval(t);
  }, [drawing, router]);

  const send = async (key: string, body: Record<string, unknown>, after?: () => void) => {
    setBusy(key);
    setError("");
    try {
      await postJson(`/api/film/series/${seriesId}`, body);
      after?.();
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  const styleCard = cast.find((c) => c.kind === "style");
  const people = cast.filter((c) => c.kind === "character");
  const places = cast.filter((c) => c.kind === "place");
  const develop = () =>
    openSajjad(bible.trim() ? "خلنا نكمل تطوير وصف المسلسل: وش الناقص؟ اسألني." : `أبي أبدأ وصف المسلسل${about ? `، هذي فكرته: ${about}` : ""}. اسألني اللي تحتاجه.`);

  return (
    <div className="space-y-6">
      <section className="card space-y-3 p-5">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="display text-2xl">📖 أساس المسلسل</h2>
          {canEdit && !editing && (
            <span className="flex gap-2">
              <button type="button" className="btn btn-primary min-h-10 px-4 text-sm" onClick={develop}>🧑‍🏫 طوّره مع سجاد</button>
              <button type="button" className="btn btn-ghost min-h-10 px-3 text-sm" onClick={() => setEditing(true)}>✏️ بنفسي</button>
            </span>
          )}
        </header>
        {editing ? (
          <div className="space-y-2">
            <label className="block space-y-1">
              <span className="text-sm font-extrabold">وصف المسلسل</span>
              <textarea className="field min-h-56 text-sm leading-7" maxLength={30000} value={b} onChange={(e) => setB(e.target.value)} placeholder="الفكرة، العالم، الشخصيات الرئيسية، الصراع، الحلقات…" />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-extrabold">شكل المسلسل (الستايل)</span>
              <textarea className="field min-h-20 text-sm" maxLength={4000} value={st} onChange={(e) => setSt(e.target.value)} placeholder="مثلًا: رسوم ثلاثية الأبعاد ناعمة، ألوان دافئة ترابية، إضاءة غروب…" />
            </label>
            <div className="flex gap-2">
              <button type="button" className="btn btn-primary min-h-11 flex-1" disabled={!!busy} onClick={() => send("bible", { action: "bible_save", bible: b, style: st }, () => setEditing(false))}>احفظ</button>
              <button type="button" className="btn btn-ghost min-h-11" onClick={() => { setB(bible); setSt(style); setEditing(false); }}>إلغاء</button>
            </div>
          </div>
        ) : bible.trim() ? (
          <details open className="group">
            <summary className="cursor-pointer text-sm font-extrabold text-muted">الوصف المطوّر</summary>
            <p className="mt-2 whitespace-pre-wrap text-sm font-bold leading-8">{bible}</p>
          </details>
        ) : (
          <p className="text-sm font-bold leading-7 text-muted">
            {canEdit ? "ابدأ بوصف المسلسل: اكتبه لسجاد وهو يسألك اللي يحتاجه. ما يلزم تكمّل كل شي الحين، ترجع وتطوّره متى ما تبي." : "قائد المسلسل لسه ما كتب وصفه. تقدر تسأل سجاد عن أي شي."}
            {about && <span className="mt-2 block">الفكرة الأولى: {about}</span>}
          </p>
        )}
        {!editing && style.trim() && <p className="rounded-2xl bg-surface-2 p-3 text-sm font-bold leading-7">🎨 <b>شكله:</b> {style}</p>}
      </section>

      <section className="space-y-2">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="display text-2xl">🎭 الشخصيات والبيئات</h2>
          {canEdit && (
            <button type="button" className="btn btn-secondary min-h-10 px-4 text-sm" onClick={() => openSajjad("اقترح الشخصيات الرئيسية والبيئات الأساسية من وصف المسلسل، بوصف دقيق لشكل كل وحدة، وأضفها.")}>
              🧑‍🏫 خل سجاد يقترحها
            </button>
          )}
        </header>
        <p className="text-sm font-bold text-muted">تنصنع مرة وحدة، وفي كل مشهد تختارها بس. ترجع لها وتضيف متى ما احتجت.</p>
        <div className="film-swipe">
          <CastCard c={styleCard ?? { id: "", kind: "style", name: "ستايل المسلسل", description: style, status: "none", error: null, url: null }} canEdit={canEdit && !!styleCard} busy={busy} send={send} hint={!styleCard ? "اكتب شكل المسلسل أول (مع سجاد أو بنفسك)" : undefined} />
          {[...people, ...places].map((c) => (
            <CastCard key={c.id} c={c} canEdit={canEdit} busy={busy} send={send} needsStyle={styleCard?.status !== "ready"} />
          ))}
          {canEdit && (
            <div className="film-option justify-start gap-2" data-tone="light" style={{ justifyContent: "flex-start" }}>
              {adding ? (
                <>
                  <h3>{adding === "character" ? "🧑 شخصية جديدة" : "🏞️ بيئة جديدة"}</h3>
                  <input className="field" placeholder="الاسم" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
                  <textarea className="field min-h-24 text-sm" maxLength={6000} placeholder={adding === "character" ? "شكله وعمره ولبسه وشخصيته…" : "الزمان والمكان والمواد والإضاءة…"} value={desc} onChange={(e) => setDesc(e.target.value)} />
                  <div className="flex gap-2">
                    <button type="button" className="btn btn-primary min-h-10 flex-1 text-sm" disabled={!!busy || !name.trim()} onClick={() => send("add", { action: "cast_add", kind: adding, name, description: desc }, () => { setAdding(null); setName(""); setDesc(""); })}>أضف</button>
                    <button type="button" className="btn btn-ghost min-h-10 text-sm" onClick={() => setAdding(null)}>إلغاء</button>
                  </div>
                </>
              ) : (
                <>
                  <span className="film-option-icon" aria-hidden>➕</span>
                  <h3>أضف بنفسك</h3>
                  <div className="grid gap-2">
                    <button type="button" className="btn btn-secondary min-h-11" onClick={() => setAdding("character")}>🧑 شخصية</button>
                    <button type="button" className="btn btn-secondary min-h-11" onClick={() => setAdding("place")}>🏞️ بيئة</button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        {error && <p className="error-box text-sm">{error}</p>}
      </section>
    </div>
  );
}

function CastCard({ c, canEdit, busy, send, needsStyle, hint }: { c: CastView; canEdit: boolean; busy: string; send: (k: string, b: Record<string, unknown>, after?: () => void) => Promise<void>; needsStyle?: boolean; hint?: string }) {
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState(c.name);
  const [desc, setDesc] = useState(c.description);
  return (
    <article className="film-option !min-h-[420px] !justify-start gap-2 !p-3" data-tone={c.kind === "style" ? "gold" : "light"} style={{ width: "min(80vw, 320px)" }}>
      <div className="relative grid aspect-video w-full place-items-center overflow-hidden rounded-2xl bg-black/10">
        {c.status === "generating" ? (
          <span className="text-sm font-extrabold">✨ نرسمها… (دقيقة أو دقيقتين)</span>
        ) : c.url ? (
          // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
          <a href={c.url} target="_blank" rel="noopener" className="block h-full w-full"><img src={c.url} alt={c.name} className="h-full w-full object-cover" /></a>
        ) : (
          <span className="text-5xl" aria-hidden>{KIND_ICON[c.kind]}</span>
        )}
      </div>
      {edit ? (
        <div className="space-y-2">
          {c.kind !== "style" && <input className="field" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />}
          <textarea className="field min-h-28 text-sm" maxLength={6000} value={desc} onChange={(e) => setDesc(e.target.value)} />
          <div className="flex gap-2">
            <button type="button" className="btn btn-primary min-h-10 flex-1 text-sm" disabled={!!busy} onClick={() => send(`e${c.id}`, { action: "cast_edit", castId: c.id, name, description: desc }, () => setEdit(false))}>احفظ</button>
            <button type="button" className="btn btn-ghost min-h-10 text-sm" onClick={() => setEdit(false)}>إلغاء</button>
          </div>
        </div>
      ) : (
        <>
          <h3 className="!text-lg">{KIND_ICON[c.kind]} {c.name}</h3>
          <p className="line-clamp-4 !text-xs">{c.description || hint || "بدون وصف بعد"}</p>
          {c.status === "failed" && <p className="rounded-xl bg-red-500/15 p-2 text-xs font-bold">ما انرسمت: {c.error} — ما انخصم شي.</p>}
          {canEdit && c.id && (
            <div className="mt-auto flex flex-wrap gap-1.5">
              <button
                type="button"
                className="btn btn-primary min-h-9 flex-1 px-2 text-xs"
                disabled={!!busy || c.status === "generating" || (c.kind !== "style" && needsStyle)}
                title={c.kind !== "style" && needsStyle ? "ارسم صورة «ستايل المسلسل» أول" : undefined}
                onClick={() => send(`g${c.id}`, { action: "cast_generate", castId: c.id })}
              >
                {c.url ? "🔁 أعد الرسم" : "🖼️ ارسمها"} · {credits(PICTURE_USD)}
              </button>
              <button type="button" className="btn btn-ghost min-h-9 px-2 text-xs" onClick={() => setEdit(true)}>✏️</button>
              {c.kind !== "style" && (
                <button type="button" className="btn btn-ghost min-h-9 px-2 text-xs" disabled={!!busy} onClick={() => window.confirm(`تحذف «${c.name}»؟`) && send(`r${c.id}`, { action: "cast_remove", castId: c.id })}>🗑️</button>
              )}
            </div>
          )}
          {c.kind !== "style" && needsStyle && canEdit && !c.url && <p className="text-[11px] font-bold opacity-80">ارسم «ستايل المسلسل» أول، وبعدها ترسم الشخصيات والبيئات على شكله.</p>}
        </>
      )}
    </article>
  );
}
