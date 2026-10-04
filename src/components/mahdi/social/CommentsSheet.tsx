"use client";

import { useEffect, useState } from "react";
import { t } from "@/lib/mahdi/i18n";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import type { CommentView } from "@/lib/mahdi/social";
import Icon from "../Icon";
import { useMahdi } from "../Provider";
import Sheet from "../Sheet";
import { UserChip } from "./PostCard";

const S = t.social;
const when = new Intl.DateTimeFormat("ar-u-nu-latn", { dateStyle: "medium", timeStyle: "short" });

/** The comments of a post: read, write, delete my own (or any on my post). */
export default function CommentsSheet({ open, postId, onClose, onCount }: { open: boolean; postId: string; onClose: () => void; onCount: (n: number) => void }) {
  const { state, toast } = useMahdi();
  const [list, setList] = useState<CommentView[] | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    let live = true;
    mahdiFetch<{ comments: CommentView[] }>(`/api/mahdi/community/posts/${postId}/comments`)
      .then((r) => {
        if (!live) return;
        setList(r.comments);
        onCount(r.comments.length);
      })
      .catch((e) => live && toast((e as Error).message));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, postId]);

  async function send() {
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    try {
      const r = await mahdiFetch<{ comments: CommentView[] }>(`/api/mahdi/community/posts/${postId}/comments`, { method: "POST", json: { body } });
      setList(r.comments);
      onCount(r.comments.length);
      setText("");
    } catch (e) {
      toast((e as Error).message);
    }
    setBusy(false);
  }

  async function remove(id: string) {
    try {
      const r = await mahdiFetch<{ comments: CommentView[] }>(`/api/mahdi/community/posts/${postId}/comments?comment=${id}`, { method: "DELETE" });
      setList(r.comments);
      onCount(r.comments.length);
    } catch (e) {
      toast((e as Error).message);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={S.comments}>
      <div className="space-y-4">
        <ul className="max-h-[50dvh] space-y-3 overflow-y-auto" aria-live="polite">
          {list === null && <li className="m-muted text-sm">{t.common.loading}</li>}
          {list?.length === 0 && <li className="m-muted text-sm">{S.noComments}</li>}
          {list?.map((c) => (
            <li key={c.id} className="m-soft space-y-1.5 p-3">
              <div className="flex items-center gap-2">
                <UserChip user={c.author} size={30} sub={<span className="m-num">{when.format(new Date(c.createdAt))}</span>} />
                {c.canDelete && (
                  <button type="button" className="m-icon-btn" aria-label={S.commentDelete} onClick={() => remove(c.id)}>
                    <Icon name="trash" size={16} />
                  </button>
                )}
              </div>
              <p className="whitespace-pre-line text-[0.95rem]" dir="auto">{c.body}</p>
            </li>
          ))}
        </ul>
        {state.snap.privacy.community ? (
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <label className="sr-only" htmlFor={`c-${postId}`}>{S.commentPlaceholder}</label>
            <textarea id={`c-${postId}`} className="m-field min-h-12 flex-1" rows={2} maxLength={500} dir="auto" placeholder={S.commentPlaceholder} value={text} onChange={(e) => setText(e.target.value)} />
            <button type="submit" className="m-btn m-btn-primary" disabled={busy || !text.trim()}>
              <Icon name="send" size={18} /> {S.commentSend}
            </button>
          </form>
        ) : (
          <p className="m-note text-sm">{S.post.needCommunity}</p>
        )}
      </div>
    </Sheet>
  );
}
