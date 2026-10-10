"use client";

// «🎬 مهارات الموشن» — the gallery حيدرة opens: every kind of motion graphics, every talking-reel look and every
// feeling as a PICTURE drawn by the engine itself (the real background, decoration and layout), so the person looks,
// compares and picks instead of reading names. Pressing a card shows it big with what it is; «استخدمها» hands it to
// the chat. The pictures are drawn once per tab and kept (they never change).

import { useEffect, useMemo, useRef, useState } from "react";
import { MOODS, MOTION_STYLES } from "@/lib/editor/motion-styles";
import { TALK_STYLES } from "@/lib/editor/talk-styles";
import { framePreviewUri, previewUri, talkPreviewUri } from "@/lib/editor/motion-preview";
import Icon from "../Icon";

/** What the person picked: a storyboard skill, a talking-reel skill, a look for its panels, or a feeling. */
export type Picked =
  | { kind: "skill"; id: string; ar: string; talk: boolean }
  | { kind: "look"; id: string; ar: string }
  | { kind: "mood"; id: string; ar: string };

type Tab = "motion" | "talk" | "look" | "mood";
interface Card {
  id: string;
  ar: string;
  icon: string;
  hint: string;
  /** the picture, drawn by the engine */
  img: string;
  /** what it is, under the name in the big view */
  note: string;
  pick: Picked;
  /** the words the search matches */
  words: string;
}

const PACE_AR = { fast: "إيقاع سريع", normal: "إيقاع متوسط", calm: "هادئ" } as const;
const KIND_AR: Record<string, string> = { title: "عنوان", points: "نقاط", stat: "رقم كبير", quote: "اقتباس", steps: "خطوات", compare: "مقارنة", statement: "جملة", outro: "ختام", kinetic: "كلمات طائرة" };
const LAYOUT_AR: Record<string, string> = { shrink: "تصغر في مربع", over: "أنت بملء الشاشة", over3d: "عناصر ثلاثية الأبعاد", split: "الشاشة نصين", corner: "دائرة في الزاوية", mix: "الإطار يتغير كل لحظة" };

const TABS: { id: Tab; label: string; icon: string; blurb: string }[] = [
  { id: "motion", label: "موشن جرافيكس", icon: "🎬", blurb: "فيديو موشن كامل من نصك أو فكرتك — بلا تصوير." },
  { id: "talk", label: "على فيديو كلامك", icon: "🗣️", blurb: "أنت تتكلم للكاميرا، والرسومات تطلع على كلمتك." },
  { id: "look", label: "ستايل اللوحات", icon: "🎨", blurb: "شكل اللوحات والخطوط والألوان في ريل كلامك." },
  { id: "mood", label: "المشاعر", icon: "🎭", blurb: "الإحساس: يغيّر الإيقاع والدخول والمشهد خلف الكلام." },
];

// drawn once (the engine is deterministic), so reopening the gallery is instant
const CACHE = new Map<Tab, Card[]>();
function cardsOf(tab: Tab): Card[] {
  const had = CACHE.get(tab);
  if (had) return had;
  let out: Card[] = [];
  if (tab === "motion") {
    out = MOTION_STYLES.filter((s) => !s.talk).map((s) => ({
      id: s.id,
      ar: s.ar,
      icon: s.icon,
      hint: s.hint,
      img: previewUri({ style: s.id }),
      note: `${PACE_AR[s.look.pace ?? "normal"]} · لقطاتها: ${s.beats.map((k) => KIND_AR[k] ?? k).join("، ")}`,
      pick: { kind: "skill", id: s.id, ar: s.ar, talk: false },
      words: `${s.ar} ${s.aliases.join(" ")} ${s.hint}`,
    }));
  } else if (tab === "talk") {
    out = MOTION_STYLES.filter((s) => s.talk).map((s) => ({
      id: s.id,
      ar: s.ar,
      icon: s.icon,
      hint: s.hint,
      img: framePreviewUri(s.talk!),
      note: LAYOUT_AR[s.talk ?? ""] ?? "على فيديو تتكلم فيه",
      pick: { kind: "skill", id: s.id, ar: s.ar, talk: true },
      words: `${s.ar} ${s.aliases.join(" ")} ${s.hint}`,
    }));
  } else if (tab === "look") {
    out = TALK_STYLES.map((s) => ({
      id: s.id,
      ar: s.ar,
      icon: s.icon,
      hint: s.hint,
      img: talkPreviewUri(s.id),
      note: "لوحات وخطوط وألوان ودخول خاص بها",
      pick: { kind: "look", id: s.id, ar: s.ar },
      words: `${s.ar} ${s.hint} ${s.id}`,
    }));
  } else {
    out = MOODS.map((m) => ({
      id: m.id,
      ar: m.ar,
      icon: m.icon,
      hint: m.hint,
      img: previewUri({ mood: m.id }),
      note: PACE_AR[m.pace],
      pick: { kind: "mood", id: m.id, ar: m.ar },
      words: `${m.ar} ${m.hint}`,
    }));
  }
  CACHE.set(tab, out);
  return out;
}

/** What the gallery writes in the message box for a pick. */
export function askFor(p: Picked): string {
  if (p.kind === "mood") return `موشن جرافيكس بمزاج «${p.ar}» عن: `;
  if (p.kind === "look") return `ركّب موشن على كلامي بستايل «${p.ar}»`;
  return p.talk ? `ركّب موشن على كلامي بمهارة «${p.ar}»` : `موشن جرافيكس بمهارة «${p.ar}» عن: `;
}

export default function SkillGallery({ open, onClose, onPick, startTab = "motion" }: { open: boolean; onClose: () => void; onPick: (p: Picked) => void; startTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(startTab);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const cards = useMemo(() => (open ? cardsOf(tab) : []), [open, tab]);
  const shown = useMemo(() => {
    const t = q.trim();
    return t ? cards.filter((c) => c.words.includes(t)) : cards;
  }, [cards, q]);
  const chosen = shown.find((c) => c.id === sel) ?? null;

  // opening it (or opening it on another door) starts fresh — read during the render, never in an effect
  const [was, setWas] = useState<{ open: boolean; tab: Tab }>({ open, tab: startTab });
  if (was.open !== open || was.tab !== startTab) {
    setWas({ open, tab: startTab });
    if (open) {
      setTab(startTab);
      setSel(null);
      setQ("");
    }
  }
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, [open, onClose]);

  if (!open) return null;
  const use = (c: Card) => {
    onPick(c.pick);
    onClose();
  };
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="مهارات الموشن" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="flex h-[min(88vh,880px)] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl border border-jw-line bg-jw-surface shadow-2xl sm:rounded-2xl" dir="rtl">
        {/* the tabs and the search */}
        <div className="flex flex-wrap items-center gap-2 border-b border-jw-line p-2.5">
          <b className="me-1 text-sm">🎬 اختر بالصورة</b>
          <div className="flex flex-wrap gap-1" role="tablist" aria-label="أنواع المهارات">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                className={`rounded-full border px-2.5 py-1 text-xs ${tab === t.id ? "border-jw-accent bg-jw-accent/10 font-semibold text-jw-ink" : "border-jw-line text-jw-muted hover:border-jw-line-strong"}`}
                onClick={() => {
                  setTab(t.id);
                  setSel(null);
                  box.current?.scrollTo({ top: 0 });
                }}
              >
                {t.icon} {t.label} ({cardsOf(t.id).length})
              </button>
            ))}
          </div>
          <input className="jw-input !min-h-8 ms-auto w-36 text-xs" placeholder="ابحث…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="ابحث في المهارات" />
          <button type="button" className="jw-btn jw-btn-quiet jw-btn-icon" onClick={onClose} aria-label="سدّ">
            <Icon name="x" size={14} />
          </button>
        </div>
        <p className="px-3 pt-2 text-[11px] leading-5 text-jw-muted">{TABS.find((t) => t.id === tab)!.blurb} اضغط أي صورة تشوفها أكبر، و«استخدمها» تكتب الطلب لك في المربع.</p>

        <div className="flex min-h-0 flex-1">
          {/* the grid of pictures */}
          <div ref={box} className="jw-scroll grid min-h-0 flex-1 content-start gap-2 overflow-y-auto p-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(118px, 1fr))" }}>
            {shown.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={sel === c.id}
                className={`overflow-hidden rounded-xl border text-start transition ${sel === c.id ? "border-jw-accent ring-2 ring-jw-accent" : "border-jw-line hover:border-jw-line-strong"}`}
                onClick={() => setSel(c.id)}
                onDoubleClick={() => use(c)}
                title={c.hint}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.img} alt={`شكل «${c.ar}»`} loading="lazy" className="block aspect-[9/16] w-full bg-jw-bg-2 object-cover" />
                <span className="block truncate px-1.5 py-1 text-[11px] font-semibold">
                  {c.icon} {c.ar}
                </span>
              </button>
            ))}
            {!shown.length && <p className="col-span-full py-6 text-center text-xs text-jw-muted">ما فيه مهارة بهذا الاسم. جرّب كلمة ثانية.</p>}
          </div>

          {/* the one chosen, big, with what it is */}
          {chosen && (
            <div className="hidden w-64 shrink-0 flex-col gap-2 border-s border-jw-line p-3 md:flex">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={chosen.img} alt={`شكل «${chosen.ar}»`} className="w-full rounded-xl border border-jw-line bg-jw-bg-2" />
              <b className="text-sm">
                {chosen.icon} {chosen.ar}
              </b>
              <p className="text-[11px] leading-5 text-jw-muted">{chosen.hint}</p>
              <p className="text-[11px] leading-5 text-jw-faint">{chosen.note}</p>
              <button type="button" className="jw-btn jw-btn-primary mt-auto w-full text-sm" onClick={() => use(chosen)}>
                استخدمها
              </button>
            </div>
          )}
        </div>

        {/* a phone: the chosen one's bar at the bottom */}
        {chosen && (
          <div className="flex items-center gap-2 border-t border-jw-line p-2 md:hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={chosen.img} alt="" className="h-14 w-8 rounded border border-jw-line object-cover" />
            <span className="min-w-0 flex-1">
              <b className="block truncate text-xs">
                {chosen.icon} {chosen.ar}
              </b>
              <span className="block truncate text-[10px] text-jw-muted">{chosen.hint}</span>
            </span>
            <button type="button" className="jw-btn jw-btn-primary !min-h-9 text-xs" onClick={() => use(chosen)}>
              استخدمها
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
