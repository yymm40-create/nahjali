"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { fmtNum, t } from "@/lib/mahdi/i18n";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import type { SocialUser, StoryGroup } from "@/lib/mahdi/social";
import Avatar from "../Avatar";
import Icon from "../Icon";
import { useMahdi } from "../Provider";
import Sheet from "../Sheet";
import { QuoteCard, UserChip } from "./PostCard";
import ReportSheet from "./ReportSheet";

const S = t.social.stories;
const PHOTO_MS = 6000;
const clock = new Intl.DateTimeFormat("ar-u-nu-latn", { hour: "numeric", minute: "2-digit" });

/** The row of people with stories (mine first). Tapping one opens the viewer. */
export function StoriesBar({ compact = false }: { compact?: boolean }) {
  const { state } = useMahdi();
  const [groups, setGroups] = useState<StoryGroup[] | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let live = true;
    mahdiFetch<{ groups: StoryGroup[] }>("/api/mahdi/social/stories")
      .then((r) => live && setGroups(r.groups))
      .catch(() => live && setGroups([]));
    return () => {
      live = false;
    };
  }, [reload]);

  if (!groups) return compact ? null : <p className="m-muted text-sm">{t.common.loading}</p>;
  const mine = groups.find((g) => g.mine);
  const me = state.snap.profile;

  return (
    <section aria-label={S.title}>
      <ul className="m-scroll-x -mx-1 flex gap-3 px-1 pb-1">
        <li className="shrink-0">
          {mine ? (
            <button type="button" className="flex w-[72px] flex-col items-center gap-1" onClick={() => setOpen(groups.indexOf(mine))}>
              <Ring fresh={false}>
                <Avatar profile={{ displayName: me.displayName, avatarUrl: me.avatarUrl }} size={58} />
              </Ring>
              <span className="w-full truncate text-center text-xs font-semibold">{S.yours}</span>
            </button>
          ) : (
            <Link href="/mahdi/post/new?story=1" className="flex w-[72px] flex-col items-center gap-1">
              <span className="relative">
                <Ring fresh={false}>
                  <Avatar profile={{ displayName: me.displayName, avatarUrl: me.avatarUrl }} size={58} />
                </Ring>
                <span className="absolute -bottom-0.5 -end-0.5 grid size-6 place-items-center rounded-full border-2 text-[var(--m-gold-ink)]" style={{ background: "var(--m-gold)", borderColor: "var(--m-bg)" }}>
                  <Icon name="plus" size={14} strokeWidth={2.6} />
                </span>
              </span>
              <span className="w-full truncate text-center text-xs font-semibold">{S.add}</span>
            </Link>
          )}
        </li>
        {groups.map((g, i) =>
          g.mine ? null : (
            <li key={g.user.id} className="shrink-0">
              <button type="button" className="flex w-[72px] flex-col items-center gap-1" onClick={() => setOpen(i)}>
                <Ring fresh={g.fresh}>
                  <Avatar profile={g.user} size={58} />
                </Ring>
                <span className="w-full truncate text-center text-xs">{g.user.displayName}</span>
              </button>
            </li>
          ),
        )}
      </ul>
      {!compact && groups.length === 0 && <p className="m-muted mt-2 text-sm">{S.empty}</p>}
      {open !== null && groups[open] && (
        <StoryViewer
          groups={groups}
          start={open}
          onClose={() => {
            setOpen(null);
            setReload((n) => n + 1);
          }}
        />
      )}
    </section>
  );
}

function Ring({ fresh, children }: { fresh: boolean; children: React.ReactNode }) {
  return (
    <span className="grid rounded-full p-[3px]" style={{ background: fresh ? "conic-gradient(from 200deg, var(--m-gold-2), var(--m-gold), #b8862f, var(--m-gold-2))" : "var(--m-line)" }}>
      <span className="grid rounded-full p-[2px]" style={{ background: "var(--m-bg)" }}>{children}</span>
    </span>
  );
}

const QUOTE_BG: Record<string, string> = {
  gold: "radial-gradient(120% 120% at 50% 0%, #3a2f1c, #14110c 70%)",
  night: "radial-gradient(120% 120% at 50% 0%, #1b2440, #0b0e18 70%)",
  green: "radial-gradient(120% 120% at 50% 0%, #163a2c, #0a1510 70%)",
  rose: "radial-gradient(120% 120% at 50% 0%, #3a1c26, #150b0f 70%)",
};

/** Full screen, one person after another; tap the far side for the next story, the near side for the previous. */
function StoryViewer({ groups, start, onClose }: { groups: StoryGroup[]; start: number; onClose: () => void }) {
  const { toast } = useMahdi();
  const [gi, setGi] = useState(start);
  const [si, setSi] = useState(() => Math.max(0, groups[start].stories.findIndex((s) => !s.seen)));
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [viewers, setViewers] = useState<SocialUser[] | null>(null);
  const ref = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const counted = useRef(new Set<string>());
  const g = groups[gi];
  const story = g?.stories[si];

  const next = useCallback(() => {
    setProgress(0);
    if (si + 1 < g.stories.length) setSi(si + 1);
    else if (gi + 1 < groups.length) {
      setGi(gi + 1);
      setSi(0);
    } else onClose();
  }, [si, gi, g, groups.length, onClose]);
  const prev = () => {
    setProgress(0);
    if (si > 0) setSi(si - 1);
    else if (gi > 0) {
      setGi(gi - 1);
      setSi(0);
    }
  };

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  // Seen once (never my own)
  useEffect(() => {
    if (!story || g.mine || story.seen || counted.current.has(story.id)) return;
    counted.current.add(story.id);
    mahdiFetch(`/api/mahdi/social/stories/${story.id}`, { method: "POST", json: { view: true } }).catch(() => {});
  }, [story, g]);

  // Photos and quotes move on by themselves; a video moves on when it ends
  useEffect(() => {
    if (!story || story.kind === "video" || paused || reporting || viewers) return;
    const began = Date.now() - progress * PHOTO_MS;
    const timer = setInterval(() => {
      const p = (Date.now() - began) / PHOTO_MS;
      if (p >= 1) next();
      else setProgress(p);
    }, 50);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story, paused, reporting, viewers, next]);

  if (!g || !story) return null;

  return (
    <dialog
      ref={ref}
      className="m-0 h-dvh max-h-none w-screen max-w-none bg-black p-0 text-white"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      aria-label={`${S.title}: ${g.user.displayName}`}
    >
      <div className="relative mx-auto flex h-full max-w-[520px] flex-col">
        <div className="absolute inset-x-0 top-0 z-10 space-y-2 bg-gradient-to-b from-black/70 to-transparent p-3">
          <div className="flex gap-1" aria-hidden="true">
            {g.stories.map((s, i) => (
              <span key={s.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/30">
                <span className="block h-full bg-white" style={{ width: `${i < si ? 100 : i > si ? 0 : progress * 100}%` }} />
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <UserChip user={g.user} size={34} sub={<span className="m-num text-white/80">{clock.format(new Date(story.createdAt))}</span>} />
            <button type="button" className="grid size-10 place-items-center rounded-full bg-white/10" onClick={onClose} aria-label={S.close}>
              <Icon name="close" size={20} />
            </button>
          </div>
        </div>

        <div className="relative grid flex-1 place-items-center overflow-hidden" onPointerDown={() => setPaused(true)} onPointerUp={() => setPaused(false)} onPointerLeave={() => setPaused(false)}>
          {story.kind === "quote" ? (
            <div className="grid size-full place-items-center p-6" style={{ background: QUOTE_BG[story.style] ?? QUOTE_BG.gold }}>
              <div className="w-full max-w-sm"><QuoteCard text={story.text} /></div>
            </div>
          ) : story.media?.kind === "video" ? (
            <video
              ref={video}
              key={story.id}
              src={story.media.url}
              autoPlay
              playsInline
              className="max-h-full w-full object-contain"
              onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime / (e.currentTarget.duration || 1))}
              onEnded={next}
              onError={() => toast(t.social.media.unplayable)}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={story.id} src={story.media?.url} alt={story.text} className="max-h-full w-full object-contain" />
          )}
          {story.kind !== "quote" && story.text && <p className="absolute inset-x-4 bottom-24 rounded-xl bg-black/55 p-3 text-center" dir="auto">{story.text}</p>}
          {/* Tap zones (right-to-left: the far, left side goes forward) */}
          <button type="button" className="absolute inset-y-0 start-0 w-2/5" aria-label={S.previous} onClick={prev} />
          <button type="button" className="absolute inset-y-0 end-0 w-3/5" aria-label={S.next} onClick={next} />
        </div>

        <div className="flex items-center justify-between gap-2 p-3">
          {g.mine ? (
            <>
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-2 text-sm"
                onClick={() =>
                  mahdiFetch<{ viewers: SocialUser[] }>(`/api/mahdi/social/stories/${story.id}`)
                    .then((r) => setViewers(r.viewers))
                    .catch((e) => toast((e as Error).message))
                }
              >
                <Icon name="eye" size={18} /> {S.viewers(story.views ?? 0)}
              </button>
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-2 text-sm"
                onClick={async () => {
                  try {
                    await mahdiFetch(`/api/mahdi/social/stories/${story.id}`, { method: "DELETE" });
                    toast(S.deleted);
                    onClose();
                  } catch (e) {
                    toast((e as Error).message);
                  }
                }}
              >
                <Icon name="trash" size={18} /> {S.delete}
              </button>
            </>
          ) : (
            <button type="button" className="ms-auto flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-2 text-sm" onClick={() => setReporting(true)}>
              <Icon name="flag" size={18} /> {t.social.report.title}
            </button>
          )}
        </div>
      </div>
      <ReportSheet open={reporting} onClose={() => setReporting(false)} target={{ story: story.id }} />
      <Sheet open={viewers !== null} onClose={() => setViewers(null)} title={S.viewers(viewers?.length ?? 0)}>
        <ul className="space-y-2">
          {viewers?.length === 0 && <li className="m-muted text-sm">{t.social.profile.listEmpty}</li>}
          {viewers?.map((u) => (
            <li key={u.id}><UserChip user={u} /></li>
          ))}
        </ul>
        <p className="m-hint mt-3"><span className="m-num">{fmtNum(viewers?.length ?? 0)}</span> · {S.expires}</p>
      </Sheet>
    </dialog>
  );
}
