"use client";

// «🗺️ ساعدني أكتبها»: the story written station by station (see src/lib/film/story-map.ts). Every change is handed
// up as the composed story text, so the page saves and sends it like a story written freely.
import { useState } from "react";
import { arNum, composeStory, emptyMap, IDEA_EXAMPLE, IDEA_LABEL, parseStory, secondsLabel, stationSeconds, STATIONS, type StoryMapAnswers } from "@/lib/film/story-map";

export default function StoryMap({ story, durationSec, onChange, disabled }: { story: string; durationSec: number | null; onChange: (story: string) => void; disabled?: boolean }) {
  // a story written on the map comes back into its stations; one written freely becomes the idea to build on
  const [a, setA] = useState<StoryMapAnswers>(() => parseStory(story) ?? { ...emptyMap(), idea: story.trim() });
  const secs = stationSeconds(durationSec);
  const set = (k: keyof StoryMapAnswers) => (e: { target: { value: string } }) => {
    const next = { ...a, [k]: e.target.value };
    setA(next);
    onChange(composeStory(next, durationSec));
  };

  return (
    <div className="space-y-3">
      <p className="text-xs font-bold leading-6 text-muted">جاوب على سؤال كل محطة بسطر أو سطرين. ما يلزم تعبّيها كلها: اللي تتركه، سجاد يسألك عنه أو يقترحه.</p>
      <label className="block space-y-1 rounded-2xl border-2 border-[var(--film-hl)] p-3">
        <span className="text-sm font-black">{IDEA_LABEL}: فكرتك في سطر واحد</span>
        <textarea className="field min-h-14 text-sm" value={a.idea} onChange={set("idea")} disabled={disabled} maxLength={600} placeholder={`مثال: ${IDEA_EXAMPLE}`} />
      </label>
      <ol className="space-y-2">
        {STATIONS.map((s, i) => (
          <li key={s.id} className="rounded-2xl border border-line p-3">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-lg font-black text-[var(--film-hl)]">{arNum(i + 1)}</span>
              <b>{s.name}</b>
              {secs[i] && <span className="text-xs font-bold text-muted">{secondsLabel(secs[i])}</span>}
            </div>
            <label className="mt-1 block space-y-1">
              <span className="block text-sm font-extrabold">{s.question}</span>
              <span className="block text-xs font-bold text-muted">{s.hint}</span>
              <textarea className="field min-h-16 text-sm" value={a[s.id]} onChange={set(s.id)} disabled={disabled} maxLength={1500} placeholder={`مثال: ${s.example}`} />
            </label>
          </li>
        ))}
      </ol>
      <details className="rounded-2xl bg-[var(--film-soft)] p-3 text-sm">
        <summary className="cursor-pointer font-black">💡 شوف مثال كامل على الخريطة</summary>
        <div className="mt-2 space-y-1 font-bold leading-7">
          <p>{IDEA_LABEL}: {IDEA_EXAMPLE}</p>
          {STATIONS.map((s, i) => (
            <p key={s.id}>
              <b>{arNum(i + 1)}. {s.name}:</b> {s.example}
            </p>
          ))}
          <p className="text-xs text-muted">شخص واحد، رغبة وحدة، وانقلاب واحد.</p>
        </div>
      </details>
    </div>
  );
}

/** «✍️ أكتب بحرية» or «🗺️ ساعدني أكتبها»: the two ways of writing the story. */
export type StoryWayKey = "free" | "map" | "link" | "upload" | "pdf";

/** How the story is given: written freely, on the story map, or (a new film only) from a video — a YouTube link or one
 * uploaded from the device — with a note. */
export function StoryWay({ way, onWay, withLink, lesson, disabled }: { way: StoryWayKey; onWay: (way: StoryWayKey) => void; withLink?: boolean; lesson?: boolean; disabled?: boolean }) {
  // a lesson: written, a PDF, a video or a YouTube link (no story map)
  const ways: (readonly [StoryWayKey, string, string, string])[] = lesson ? [
    ["free", "✍️", "اكتب الدرس", "الدرس أو فكرته بكلماتك"],
    ["pdf", "📄", "ملف PDF", "درسك من ملف، وسجاد يقراه"],
    ["upload", "📤", "ارفع فيديو", "من جهازك، وسجاد يشوفه"],
    ["link", "🔗", "رابط يوتيوب", "سجاد يشوفه ويبني عليه الدرس"],
  ] : [
    ["free", "✍️", "أكتب بحرية", "قصتك بكلماتك"],
    ["map", "🗺️", "ساعدني أكتبها", "سؤال لكل محطة، مع أمثلة"],
    ...(withLink
      ? ([
          ["link", "🔗", "رابط يوتيوب", "سجاد يحلل الفيديو ويبني عليه"],
          ["upload", "📤", "ارفع فيديو", "من جهازك، وسجاد يقراه"],
        ] as const)
      : []),
  ];
  return (
    <div className={`grid gap-2 ${withLink || lesson ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2"}`} role="group" aria-label="طريقة كتابة القصة">
      {ways.map(([w, icon, label, note]) => (
        <button key={w} type="button" disabled={disabled} aria-pressed={way === w} onClick={() => onWay(w)} className={`rounded-2xl border-2 p-3 text-start ${way === w ? "border-[var(--film-blue)] bg-[var(--film-blue)]/10" : "border-line"}`}>
          <span className="block text-2xl" aria-hidden>{icon}</span>
          <span className="block text-sm font-black">{label}</span>
          <span className="block text-xs font-bold text-muted">{note}</span>
        </button>
      ))}
    </div>
  );
}
