"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { postJson } from "@/lib/fetch";
import { credits } from "@/lib/film/credits";
import { useFilmBase } from "../FilmBase";

type Who = { name: string; existing: boolean; note: string };
type Understanding = { title: string; story: string; understanding: string; characters: Who[]; places: Who[]; questions: { question: string; options: string[] }[]; number: number };

/**
 * A scene with سجاد, the easy way. First: «أكتبه بنفسي» or «خل سجاد يكتبه» (from the series and the episode, with
 * what you want in it). Then سجاد says what he understood — what happens, which of the series' characters and places
 * are in it, which are new, what's unclear — and you confirm («صح، كمّل») or correct him. Confirmed, the scene goes
 * to the screenwriter with everything it needs, and its characters' and places' pictures are reused.
 */
export default function ScenePrep({ seriesId, episodeId, sceneId, initialTitle = "", initialText = "", canAddCast, onClose }: { seriesId: string; episodeId: string; sceneId?: string; initialTitle?: string; initialText?: string; canAddCast: boolean; onClose: () => void }) {
  const router = useRouter();
  const base = useFilmBase();
  const [mode, setMode] = useState<"mine" | "sajjad" | null>(initialText ? "mine" : null);
  const [title, setTitle] = useState(initialTitle);
  const [text, setText] = useState(initialText);
  const [u, setU] = useState<Understanding | null>(null);
  const [story, setStory] = useState("");
  const [fixing, setFixing] = useState(false);
  const [correction, setCorrection] = useState("");
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [addNew, setAddNew] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const understand = async (fix?: string) => {
    setBusy("understand");
    setError("");
    try {
      const r = await postJson<Understanding>(`/api/film/series/${seriesId}`, { action: "scene_understand", episodeId, sceneId, mode, text: mode === "sajjad" && u ? text : mode === "mine" && u ? story : text, title: u?.title || title, correction: fix });
      setU(r);
      setStory(r.story);
      if (!title) setTitle(r.title);
      setFixing(false);
      setCorrection("");
      setAnswers({});
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  };
  const confirm = async () => {
    if (!u) return;
    setBusy("confirm");
    setError("");
    try {
      const r = await postJson<{ id: string }>(`/api/film/series/${seriesId}`, { action: "scene_confirm", episodeId, sceneId, title: title || u.title, story, understanding: u.understanding, characters: u.characters, places: u.places, addNew: canAddCast && addNew });
      router.push(`${base}/${r.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy("");
    }
  };
  const fresh = u ? [...u.characters, ...u.places].filter((x) => !x.existing) : [];
  const answered = u?.questions.map((q, i) => (answers[i]?.trim() ? `${q.question} ← ${answers[i].trim()}` : "")).filter(Boolean) ?? [];

  return (
    <div className="space-y-3 rounded-2xl border-2 border-[#e2a72c] bg-white/80 p-3">
      <header className="flex items-center justify-between gap-2">
        <p className="font-black">🧑‍🏫 {sceneId ? "جهّز المشهد مع سجاد" : "مشهد جديد مع سجاد"}</p>
        <button type="button" className="text-xs font-bold underline" onClick={onClose}>إغلاق</button>
      </header>

      {!u ? (
        <>
          <input className="field" placeholder="عنوان المشهد (اختياري)" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} />
          <p className="text-sm font-extrabold">تبي تكتب المشهد بنفسك، ولا سجاد يكتبه؟</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" aria-pressed={mode === "mine"} className={`rounded-2xl border-2 p-3 text-start ${mode === "mine" ? "border-[#1f63f0] bg-[#1f63f0]/10" : "border-line"}`} onClick={() => setMode("mine")}>
              <span className="block text-2xl" aria-hidden>✍️</span>
              <span className="block text-sm font-black">أكتبه بنفسي</span>
              <span className="block text-xs font-bold text-muted">وسجاد يفهمه ويتأكد</span>
            </button>
            <button type="button" aria-pressed={mode === "sajjad"} className={`rounded-2xl border-2 p-3 text-start ${mode === "sajjad" ? "border-[#1f63f0] bg-[#1f63f0]/10" : "border-line"}`} onClick={() => setMode("sajjad")}>
              <span className="block text-2xl" aria-hidden>🧑‍🏫</span>
              <span className="block text-sm font-black">خل سجاد يكتبه</span>
              <span className="block text-xs font-bold text-muted">من المسلسل والحلقة</span>
            </button>
          </div>
          {mode && (
            <textarea
              className="field min-h-32 text-sm leading-7"
              maxLength={20000}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={mode === "mine" ? "اكتب المشهد: وش يصير، مين فيه، وين، وش يقولون…" : "وش تبي يصير فيه؟ (اختياري: سجاد يكتبه من خطة الحلقة لو تركته فاضي)"}
            />
          )}
          <button type="button" className="btn btn-primary min-h-11 w-full" disabled={!mode || !!busy || (mode === "mine" && text.trim().length < 10)} onClick={() => understand()}>
            {busy ? "سجاد يقرا…" : mode === "sajjad" ? `🧑‍🏫 سجاد، اكتبه · ${credits(0.15)}` : `🧑‍🏫 سجاد، افهمه · ${credits(0.15)}`}
          </button>
        </>
      ) : (
        <>
          <label className="block space-y-1">
            <span className="text-sm font-extrabold">{mode === "sajjad" ? "المشهد كما كتبه سجاد (عدّل عليه لو تبي)" : "مشهدك"}</span>
            <textarea className="field min-h-32 text-sm leading-7" maxLength={20000} value={story} onChange={(e) => setStory(e.target.value)} />
          </label>
          <div className="space-y-2 rounded-2xl bg-[#eef3ff] p-3 text-sm">
            <p className="font-black">فهمي للمشهد {u.number}{title ? ` «${title}»` : ""}:</p>
            <p className="whitespace-pre-wrap font-bold leading-7">{u.understanding}</p>
            <Chips label="الشخصيات" items={u.characters} />
            <Chips label="البيئات" items={u.places} />
          </div>
          {u.questions.length > 0 && (
            <div className="space-y-2 rounded-2xl border border-line p-3">
              <p className="text-xs font-extrabold text-muted">أسئلة سجاد (جاوب اللي تبي، وبعدها «لا، عدّل فهمك»):</p>
              {u.questions.map((q, i) => (
                <div key={i} className="space-y-1">
                  <p className="text-sm font-extrabold">{q.question}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {q.options.map((o) => (
                      <button key={o} type="button" className={`rounded-full border px-3 py-1 text-xs font-bold ${answers[i] === o ? "border-[#1f63f0] bg-[#1f63f0] text-white" : "border-black/15"}`} onClick={() => setAnswers({ ...answers, [i]: o })}>{o}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          {fresh.length > 0 && canAddCast && (
            <label className="flex items-center gap-2 text-sm font-bold">
              <input type="checkbox" checked={addNew} onChange={(e) => setAddNew(e.target.checked)} />
              أضف الجديدين ({fresh.map((f) => f.name).join("، ")}) لشخصيات وبيئات المسلسل
            </label>
          )}
          {fixing ? (
            <div className="space-y-2">
              <textarea className="field min-h-20 text-sm" maxLength={4000} value={correction} onChange={(e) => setCorrection(e.target.value)} placeholder="وش اللي فهمه غلط؟" autoFocus />
              <div className="flex gap-2">
                <button type="button" className="btn btn-secondary min-h-10 flex-1 text-sm" disabled={!!busy || (!correction.trim() && !answered.length)} onClick={() => understand([correction.trim(), ...answered].filter(Boolean).join("\n"))}>{busy ? "سجاد يعيد…" : "أعد الفهم"}</button>
                <button type="button" className="btn btn-ghost min-h-10 text-sm" onClick={() => setFixing(false)}>رجوع</button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button type="button" className="btn btn-primary min-h-12 flex-1" disabled={!!busy || story.trim().length < 10} onClick={confirm}>{busy === "confirm" ? "نجهّز المشهد…" : "صح، كمّل الصناعة ✅"}</button>
              <button type="button" className="btn btn-ghost min-h-12 px-3 text-sm" disabled={!!busy} onClick={() => (answered.length && !fixing ? understand(answered.join("\n")) : setFixing(true))}>
                {answered.length ? "أرسل أجوبتي" : "لا، عدّل فهمك"}
              </button>
            </div>
          )}
        </>
      )}
      {error && <p className="error-box text-sm">{error}</p>}
    </div>
  );
}

function Chips({ label, items }: { label: string; items: Who[] }) {
  if (!items.length) return null;
  return (
    <div className="space-y-1">
      <p className="text-xs font-extrabold text-muted">{label}:</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((x) => (
          <span key={x.name} title={x.note} className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${x.existing ? "bg-[#0b1d47] text-white" : "bg-[#e2a72c]/25"}`}>
            {x.existing ? "✅" : "🆕"} {x.name}
          </span>
        ))}
      </div>
    </div>
  );
}
