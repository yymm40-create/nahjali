"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { todayIn } from "@/lib/mahdi/engine";
import { fmtNum, fmtRelativeDay, t } from "@/lib/mahdi/i18n";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import type { SharePayload } from "@/lib/mahdi/client/share";
import Avatar from "./Avatar";
import ConfirmSheet from "./ConfirmSheet";
import Icon from "./Icon";
import { useMahdi } from "./Provider";
import Sheet from "./Sheet";
import { ShareCardView } from "./ShareCard";
import { useLook } from "./ThemeRoot";

type ReactionKind = "dua" | "support";
interface Post {
  id: string;
  mine: boolean;
  author: { displayName: string; avatarUrl: string | null; frame: string };
  kind: string;
  payload: SharePayload;
  closing: string;
  createdAt: string;
  reactions: Record<ReactionKind, number>;
  reacted: ReactionKind[];
}

/** The community wall: shared cards, with دعاء / تشجيع, report, and delete for my own posts. */
export default function CommunityFeed() {
  const { state, toast } = useMahdi();
  const { shrine } = useLook();
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [more, setMore] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [reporting, setReporting] = useState<Post | null>(null);
  const [reason, setReason] = useState("");
  const [deleting, setDeleting] = useState<Post | null>(null);

  const [reload, setReload] = useState(0);
  const fetchPage = (before?: string) => mahdiFetch<{ posts: Post[]; more: boolean }>(`/api/mahdi/community/posts${before ? `?before=${encodeURIComponent(before)}` : ""}`);

  // The newest posts: on opening, and again when «حاول مرة أخرى» is pressed
  useEffect(() => {
    let live = true;
    fetchPage()
      .then((res) => {
        if (!live) return;
        setPosts(res.posts);
        setMore(res.more);
        setError("");
      })
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [reload]);

  async function loadMore(before: string) {
    setLoading(true);
    try {
      const res = await fetchPage(before);
      setPosts((prev) => {
        const known = new Set((prev ?? []).map((p) => p.id));
        return [...(prev ?? []), ...res.posts.filter((p) => !known.has(p.id))];
      });
      setMore(res.more);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
    setLoading(false);
  }

  async function react(p: Post, kind: ReactionKind) {
    const on = !p.reacted.includes(kind);
    const apply = (on2: boolean) =>
      setPosts((list) =>
        (list ?? []).map((x) =>
          x.id === p.id
            ? { ...x, reacted: on2 ? [...x.reacted, kind] : x.reacted.filter((k) => k !== kind), reactions: { ...x.reactions, [kind]: Math.max(0, x.reactions[kind] + (on2 ? 1 : -1)) } }
            : x,
        ),
      );
    apply(on);
    try {
      await mahdiFetch(`/api/mahdi/community/posts/${p.id}`, { method: "POST", json: { react: kind, on } });
    } catch (e) {
      apply(!on);
      toast((e as Error).message);
    }
  }

  if (error && !posts) {
    return (
      <p className="m-error" role="alert">
        {error} <button type="button" className="underline" onClick={() => setReload((n) => n + 1)}>{t.common.retry}</button>
      </p>
    );
  }
  if (!posts) return <p className="m-muted">{t.common.loading}</p>;

  return (
    <div className="space-y-5">
      <Link href="/mahdi/share" className="m-btn m-btn-ghost w-full">
        <Icon name="sparkle" size={18} /> {t.community.share}
      </Link>

      {posts.length === 0 ? (
        <p className="m-card p-6 text-center m-muted">{t.community.empty}</p>
      ) : (
        <ul className="space-y-5" aria-label={t.community.feed}>
          {posts.map((p) => (
            <li key={p.id} className="m-card space-y-3 p-4">
              <div className="flex items-center gap-3">
                <Avatar profile={p.author} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{t.mawla(p.author.displayName)}</p>
                  <p className="text-sm m-muted">{fmtRelativeDay(todayIn(state.snap.profile.timeZone, new Date(p.createdAt)), state.today)}</p>
                </div>
                {p.mine ? (
                  <button type="button" className="m-icon-btn" aria-label={t.community.delete} onClick={() => setDeleting(p)}>
                    <Icon name="trash" size={20} />
                  </button>
                ) : (
                  <button type="button" className="m-icon-btn" aria-label={t.community.report} onClick={() => (setReason(""), setReporting(p))}>
                    <Icon name="info" size={20} />
                  </button>
                )}
              </div>
              <ShareCardView payload={p.payload} name={p.author.displayName} closing={p.closing} image={shrine?.imageUrl ?? null} />
              <div className="flex gap-2" role="group" aria-label={t.community.reactions}>
                {(["dua", "support"] as const).map((k) => (
                  <button key={k} type="button" className="m-btn m-btn-ghost m-btn-sm flex-1" aria-pressed={p.reacted.includes(k)} style={p.reacted.includes(k) ? { borderColor: "var(--m-gold)", color: "var(--m-gold-text)" } : undefined} onClick={() => react(p, k)}>
                    {t.community[k]} <span className="m-num">{fmtNum(p.reactions[k])}</span>
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="m-error" role="alert">{error}</p>}
      {more && (
        <button type="button" className="m-btn m-btn-ghost w-full" disabled={loading} onClick={() => loadMore(posts[posts.length - 1].createdAt)}>
          {loading ? t.common.loading : t.community.loadMore}
        </button>
      )}

      <Sheet open={Boolean(reporting)} onClose={() => setReporting(null)} title={t.community.reportTitle}>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const p = reporting;
            setReporting(null);
            if (!p) return;
            try {
              await mahdiFetch(`/api/mahdi/community/posts/${p.id}`, { method: "POST", json: { report: reason } });
              toast(t.community.reported);
            } catch (err) {
              toast((err as Error).message);
            }
          }}
        >
          <p>{t.community.reportBody}</p>
          <label className="block">
            <span className="m-label">{t.community.reportReason}</span>
            <textarea className="m-field" rows={3} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          <button className="m-btn m-btn-primary w-full">{t.community.reportSend}</button>
        </form>
      </Sheet>

      <ConfirmSheet
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title={t.community.deleteTitle}
        body={t.community.deleteBody}
        onConfirm={async () => {
          const p = deleting;
          if (!p) return;
          await mahdiFetch(`/api/mahdi/community/posts/${p.id}`, { method: "DELETE" });
          setPosts((list) => (list ?? []).filter((x) => x.id !== p.id));
          toast(t.community.deleted);
        }}
      />
    </div>
  );
}
