"use client";

import Link from "next/link";
import { useState } from "react";
import { todayIn } from "@/lib/mahdi/engine";
import { fmtNum, fmtRelativeDay, t } from "@/lib/mahdi/i18n";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import type { PostView, SocialUser } from "@/lib/mahdi/social";
import Avatar from "../Avatar";
import ConfirmSheet from "../ConfirmSheet";
import Icon from "../Icon";
import { useMahdi } from "../Provider";
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

/** The quote card (text on a calm gold background). */
export function QuoteCard({ text, by, compact = false }: { text: string; by?: string; compact?: boolean }) {
  return (
    <figure
      className={`grid place-items-center rounded-3xl text-center ${compact ? "aspect-square p-3" : "min-h-56 p-7"}`}
      style={{ background: "radial-gradient(120% 120% at 50% 0%, #3a2f1c, #14110c 70%)", color: "#f7f0e3" }}
    >
      <blockquote className={`m-display leading-relaxed ${compact ? "line-clamp-5 text-sm" : "text-2xl"}`} dir="auto" style={{ color: "#f4da95" }}>
        «{text}»
      </blockquote>
      {by && !compact && <figcaption className="mt-3 text-sm opacity-85" dir="auto">— {by}</figcaption>}
    </figure>
  );
}

const secs = (ms: number | null) => (ms ? `0:${String(Math.round(ms / 1000)).padStart(2, "0")}` : "");

/**
 * One post in a feed or on its own page: the content, «أحسنت», comments, views, report or delete. `flat` is the
 * home screen's «المتابَعون» look: no card, the picture from edge to edge on phones, round action buttons.
 */
export default function PostCard({ post, onChange, onRemoved, openComments = false, flat = false }: { post: PostView; onChange: (p: PostView) => void; onRemoved: (id: string) => void; openComments?: boolean; flat?: boolean }) {
  const { state, toast } = useMahdi();
  const { shrine } = useLook();
  const [comments, setComments] = useState(openComments);
  const [reporting, setReporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const when = fmtRelativeDay(todayIn(state.snap.profile.timeZone, new Date(post.createdAt)), state.today);
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
        {post.mine ? (
          <button type="button" className="m-icon-btn" aria-label={t.community.delete} onClick={() => setDeleting(true)}>
            <Icon name="trash" size={20} />
          </button>
        ) : (
          <button type="button" className="m-icon-btn" aria-label={S.report.title} title={S.report.title} onClick={() => setReporting(true)}>
            <Icon name="flag" size={20} />
          </button>
        )}
      </div>

      {post.media?.kind === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.media.url} alt={post.caption || ""} loading="lazy" className={`max-h-[70vh] w-full bg-black object-contain ${flat ? "m-post-media" : "rounded-2xl"}`} style={post.media.width && post.media.height ? { aspectRatio: `${post.media.width} / ${post.media.height}` } : undefined} />
      ) : post.media?.kind === "video" ? (
        <div className="relative">
          <video src={`${post.media.url}#t=0.1`} controls playsInline preload="metadata" className="max-h-[70vh] w-full rounded-2xl bg-black" style={post.media.width && post.media.height ? { aspectRatio: `${post.media.width} / ${post.media.height}` } : undefined} />
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
