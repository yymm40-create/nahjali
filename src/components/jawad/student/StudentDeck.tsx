"use client";

// «🎨 محرر العرض» of «الطالب الذكي»: the shared deck editor (src/components/slides) on a deck صادق designed, with
// «🤖 اطلب من صادق» to have one slide designed again (paid like any request, the cost shown before).

import { useMemo, useState } from "react";
import DeckEditor, { type DeckApi } from "@/components/slides/DeckEditor";
import { postJson } from "@/lib/fetch";
import { STUDENT } from "@config/jawad/student";
import type { Deck } from "@/lib/slides/format";
import { PaidButton } from "./ui";

export default function StudentDeck({ outputId, projectId, title }: { outputId: string; projectId: string; title: string }) {
  const url = `/api/jawad/student/outputs/${outputId}`;
  const api = useMemo<DeckApi>(
    () => ({
      load: () => postJson(url, { action: "deck_get" }),
      save: async (deck: Deck) => {
        await postJson(url, { action: "deck_save", deck });
      },
      upload: (data) => postJson(url, { action: "deck_image", data }),
      exportFile: async (kind) => (await postJson<{ url: string }>(url, { action: "deck_export", kind })).url,
    }),
    [url],
  );
  return <DeckEditor api={api} title={title} backHref={`${STUDENT.base}/${projectId}`} backLabel="المادة" aiPanel={(i, started, save) => <AskSadiq url={url} index={i} started={started} save={save} />} />;
}

function AskSadiq({ url, index, started, save }: { url: string; index: number; started: () => void; save: () => Promise<void> }) {
  const [note, setNote] = useState("");
  return (
    <div className="space-y-2 rounded-2xl border border-violet-200 bg-violet-50/50 p-3">
      <b className="block text-sm">🤖 اطلب من صادق يعدّل الشريحة {(index + 1).toLocaleString("ar")}</b>
      <textarea className="jw-textarea" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثال: خلّ الأرقام كبيرة بالنص، غيّر الترتيب لبطاقات، حط الصورة يمين…" maxLength={2000} />
      <PaidButton
        label="أرسل لصادق"
        what="يعيد صادق تصميم هذي الشريحة بطلبك ويراجعها، وبقية العرض مثل ما هو."
        disabled={note.trim().length < 3}
        run={async (b) => {
          if (b.confirm) await save();
          const r = await postJson(url, { action: "request", note, kind: "edit", chapter: index, ...b });
          if (b.confirm) {
            setNote("");
            started();
          }
          return r;
        }}
      />
    </div>
  );
}
