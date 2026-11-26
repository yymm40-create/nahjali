"use client";

import { useEffect, useRef, useState } from "react";
import { t } from "@/lib/mahdi/i18n";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import { deferDelete } from "@/lib/mahdi/client/undo";
import { UNDO_MS } from "@config/mahdi";
import type { CommentView } from "@/lib/mahdi/social";
import Icon from "../Icon";
import { useMahdi } from "../Provider";
import Sheet from "../Sheet";
import { UserChip } from "./PostCard";

const S = t.social;
const when = new Intl.DateTimeFormat("ar-u-nu-latn", { dateStyle: "medium", timeStyle: "short" });

/** The comments of a post: read, write, delete my own (or any on my post) — at once, with «تراجع» for a few seconds. */
export default function CommentsSheet({ open, postId, onClose, onCount }: { open: boolean; postId: string; onClose: () => void; onCount: (n: number) => void }) {
  const { state, toast } = useMahdi();
  const [list, setList] = useState<CommentView[] | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  // the list as it is now, for «تراجع» (which runs later, from the toast)
  const current = useRef(list);
  useEffect(() => {
    current.current = list;
  }, [list]);
  // deleted here but not sent yet (still within «تراجع»): never shown again by a reload
  const hidden = useRef(new Set<string>());
  const visible = (all: CommentView[]) => all.filter((c) => !hidden.current.has(c.id));

  useEffect(() => {
    if (!open) return;
    let live = true;
    mahdiFetch<{ comments: CommentView[] }>(`/api/mahdi/community/posts/${postId}/comments`)
      .then((r) => {
        if (!live) return;
        const shown = visible(r.comments);
        setList(shown);
        onCount(shown.length);
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
      const shown = visible(r.comments);
      setList(shown);
      onCount(shown.length);
      setText("");
    } catch (e) {
      toast((e as Error).message);
    }
    setBusy(false);
  }

  // A small deletion: gone at once, with «تراجع»; sent to the server only when the undo time is over
  function remove(id: string) {
    const before = list ?? [];
    const at = before.findIndex((c) => c.id === id);
    if (at < 0) return;
    const gone = before[at];
    const shown = before.filter((c) => c.id !== id);
    setList(shown);
    onCount(shown.length);
    hidden.current.add(id);
    const pending = deferDelete({
      ms: UNDO_MS,
      run: () => mahdiFetch(`/api/mahdi/community/posts/${postId}/comments?comment=${id}`, { method: "DELETE", keepalive: true }),
      restore: (error) => {
        hidden.current.delete(id);
        const next = [...(current.current ?? [])];
        if (!next.some((c) => c.id === id)) next.splice(Math.min(at, next.length), 0, gone);
        setList(next);
        onCount(next.length);
        if (error) toast(error.message);
      },
    });
    toast(t.groups.kind.commentDeleted, { label: t.groups.kind.undo, run: pending.undo });
  }

  return (
    <Sheet open={open} onClose={onClose} title={S.comments}>
      <div className="space-y-4">
        <ul className="max-h-[50dvh] space-y-3 overflow-y-auto" aria-live="polite">
          {list === null && (
            <li aria-hidden="true" className="space-y-2">
              <div className="m-skel h-14" />
              <div className="m-skel h-14" />
            </li>
          )}
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
