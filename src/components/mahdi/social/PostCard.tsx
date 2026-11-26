"use client";

import Link from "next/link";
import { useState } from "react";
import { todayFor } from "@/lib/mahdi/engine";
import { fmtNum, fmtRelativeDay, t } from "@/lib/mahdi/i18n";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import type { PostView, SocialUser } from "@/lib/mahdi/social";
import Avatar from "../Avatar";
import ConfirmSheet from "../ConfirmSheet";
import Icon from "../Icon";
import { useMahdi } from "../Provider";
import Sheet from "../Sheet";
import { ShareCardView } from "../ShareCard";
import { useLook } from "../ThemeRoot";
import CommentsSheet from "./CommentsSheet";
import ReportSheet from "./ReportSheet";

const S = t.social;
export const userHref = (u: SocialUser) => (u.username ? `/mahdi/u/${encodeURIComponent(u.username)}` : null);

/** Name and picture, linking to the person's page. */
export function UserChip({ user, sub, size = 40 }: { user: SocialUser; sub?: React.ReactNode; size?: number }) {
  const href = userHref(user);
  const inner = (
    <>
      <Avatar profile={user} size={size} />
      <span className="min-w-0">
        <span className="block truncate font-semibold">{user.displayName}</span>
        {(user.username || sub) && (
          <span className="block truncate text-xs m-muted">
            {user.username && <bdi dir="ltr">@{user.username}</bdi>}
            {user.username && sub ? " · " : ""}
            {sub}
          </span>
        )}
      </span>
    </>
  );
  return href ? (
    <Link href={href} className="flex min-w-0 flex-1 items-center gap-3">{inner}</Link>
  ) : (
    <span className="flex min-w-0 flex-1 items-center gap-3">{inner}</span>
  );
}

/** The quote card: the words in ink on a light wash of the achievement yellow (light, like every screen now). */
export function QuoteCard({ text, by, compact = false }: { text: string; by?: string; compact?: boolean }) {
  return (
    <figure
      className={`grid place-items-center rounded-3xl text-center ${compact ? "aspect-square p-3" : "min-h-56 p-7"}`}
      style={{ background: "radial-gradient(120% 120% at 50% 0%, color-mix(in srgb, var(--m-gold) 30%, var(--m-surface-solid)), color-mix(in srgb, var(--m-gold) 10%, var(--m-surface-solid)) 70%)", color: "var(--m-ink)" }}
    >
      <blockquote className={`m-display leading-relaxed ${compact ? "line-clamp-5 text-sm" : "text-2xl"}`} dir="auto">
        «{text}»
      </blockquote>
      {by && !compact && <figcaption className="mt-3 text-sm m-muted" dir="auto">— {by}</figcaption>}
    </figure>
  );
}

const secs = (ms: number | null) => (ms ? `0:${String(Math.round(ms / 1000)).padStart(2, "0")}` : "");

/**
 * One post in a feed or on its own page: the content, «أحسنت», comments, views; report or delete wait behind «⋯» so
 * the card stays calm (solid, no blur). `flat` is the home screen's «المتابَعون» look: no card, the picture from edge
 * to edge on phones, round action buttons.
 */
export default function PostCard({ post, onChange, onRemoved, openComments = false, flat = false }: { post: PostView; onChange: (p: PostView) => void; onRemoved: (id: string) => void; openComments?: boolean; flat?: boolean }) {
  const { state, toast } = useMahdi();
  const { shrine } = useLook();
  const [comments, setComments] = useState(openComments);
  const [reporting, setReporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [menu, setMenu] = useState(false);
  const when = fmtRelativeDay(todayFor(state.snap.profile, new Date(post.createdAt)), state.today);
  const joined = state.snap.privacy.community;

  async function toggleAhsant() {
    if (!joined) return toast(S.post.needCommunity);
    const on = !post.ahsantByMe;
    onChange({ ...post, ahsantByMe: on, ahsant: Math.max(0, post.ahsant + (on ? 1 : -1)) });
    try {
      await mahdiFetch(`/api/mahdi/community/posts/${post.id}`, { method: "POST", json: { react: "ahsant", on } });
    } catch (e) {
      onChange(post);
      toast((e as Error).message);
    }
  }

  return (
    <article className={flat ? "m-post-flat space-y-3" : "m-card space-y-3 p-4"} data-post={post.id}>
      <div className="flex items-center gap-2">
        <UserChip user={post.author} sub={when} />
        <button type="button" className="m-icon-btn m-muted" aria-label={t.groups.kind.postMenu} aria-haspopup="dialog" onClick={() => setMenu(true)}>
          <Icon name="more" size={22} />
        </button>
      </div>

      {post.media?.kind === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.media.url} alt={post.caption || ""} loading="lazy" className={`max-h-[70vh] w-full bg-[var(--m-surface-2)] object-contain ${flat ? "m-post-media" : "rounded-2xl"}`} style={post.media.width && post.media.height ? { aspectRatio: `${post.media.width} / ${post.media.height}` } : undefined} />
      ) : post.media?.kind === "video" ? (
        <div className="relative">
          <video src={`${post.media.url}#t=0.1`} controls playsInline preload="metadata" className="max-h-[70vh] w-full rounded-2xl bg-[var(--m-surface-2)]" style={post.media.width && post.media.height ? { aspectRatio: `${post.media.width} / ${post.media.height}` } : undefined} />
          {post.media.ms && <span className="m-num absolute start-2 top-2 rounded-md bg-black/70 px-1.5 py-0.5 text-xs text-white" dir="ltr">{secs(post.media.ms)}</span>}
        </div>
      ) : post.quote ? (
        <QuoteCard text={post.quote.text} by={post.quote.by} />
      ) : post.payload ? (
        <ShareCardView payload={post.payload} name={post.author.displayName} closing={post.closing} image={shrine?.imageUrl ?? null} />
      ) : null}
      {post.caption && <p className="whitespace-pre-line" dir="auto">{post.caption}</p>}

      <div className="flex items-center gap-2">
        <button
          type="button"
          className={flat ? "m-post-act" : "m-btn m-btn-ghost m-btn-sm"}
          aria-pressed={post.ahsantByMe}
          onClick={toggleAhsant}
          style={post.ahsantByMe ? { borderColor: "var(--m-gold)", color: "var(--m-gold-text)" } : undefined}
        >
          <Icon name="star" size={18} /> {S.ahsant} <span className="m-num">{fmtNum(post.ahsant)}</span>
        </button>
        <button type="button" className={flat ? "m-post-act" : "m-btn m-btn-ghost m-btn-sm"} onClick={() => setComments(true)} aria-label={S.commentsCount(post.comments)}>
          <Icon name="chat" size={18} /> <span className="m-num">{fmtNum(post.comments)}</span>
        </button>
        <span className="m-muted ms-auto flex items-center gap-1 text-sm" title={S.views(post.views)} aria-label={S.views(post.views)}>
          <Icon name="eye" size={18} /> <span className="m-num">{fmtNum(post.views)}</span>
        </span>
      </div>

      <CommentsSheet open={comments} postId={post.id} onClose={() => setComments(false)} onCount={(n) => n !== post.comments && onChange({ ...post, comments: n })} />
      <Sheet open={menu} onClose={() => setMenu(false)} title={t.groups.kind.postMenu}>
        <div className="m-card m-rows">
          {post.mine ? (
            <button type="button" className="m-row w-full text-start" onClick={() => (setMenu(false), setDeleting(true))} style={{ color: "var(--m-error)" }}>
              <span className="m-row-ic" aria-hidden="true"><Icon name="trash" size={20} /></span>
              {t.community.delete}
            </button>
          ) : (
            <button type="button" className="m-row w-full text-start" onClick={() => (setMenu(false), setReporting(true))}>
              <span className="m-row-ic" aria-hidden="true"><Icon name="flag" size={20} /></span>
              {S.report.title}
            </button>
          )}
        </div>
      </Sheet>
      <ReportSheet open={reporting} onClose={() => setReporting(false)} target={{ post: post.id }} />
      <ConfirmSheet
        open={deleting}
        onClose={() => setDeleting(false)}
        title={t.community.deleteTitle}
        body={t.community.deleteBody}
        onConfirm={async () => {
          await mahdiFetch(`/api/mahdi/community/posts/${post.id}`, { method: "DELETE" });
          onRemoved(post.id);
          toast(t.community.deleted);
        }}
      />
    </article>
  );
}
