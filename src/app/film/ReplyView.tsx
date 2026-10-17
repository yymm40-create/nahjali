"use client";

// A film assistant's reply, made easy to read: big calm type on its own reading surface, cut at its headings into
// sections you open one at a time (the first one, and whatever asks you something, already open), each closed one
// showing a line of what is in it — instead of one long page of small text. What asks for the person is a warm amber
// callout, never red. Short replies are shown whole.

import { useState } from "react";
import Markdown from "@/components/Markdown";

interface Section {
  title: string;
  body: string;
  ask: boolean;
}

const ASK = /توضيح|تحتاج|أسئلة|سؤال|قرار|اعتمد|رأيك|اختر/;
const HEAD = /^(#{1,3})\s+(.*)$/;
// a line that is only bold («**الشخصيات**» / «**الشخصيات:**») reads as a heading too
const BOLD_HEAD = /^\*\*([^*]{2,80})\*\*:?\s*$/;

/** The reply cut at its headings: the words before the first heading, then each section. */
export function splitReply(text: string): { intro: string; sections: Section[] } {
  const lines = text.replace(/\r/g, "").split("\n");
  const sections: Section[] = [];
  const intro: string[] = [];
  let cur: { title: string; lines: string[] } | null = null;
  let inCode = false;
  for (const line of lines) {
    if (line.trim().startsWith("```")) inCode = !inCode;
    const h = inCode ? null : HEAD.exec(line) ?? BOLD_HEAD.exec(line.trim());
    if (h) {
      if (cur) sections.push({ title: cur.title, body: cur.lines.join("\n").trim(), ask: ASK.test(cur.title) });
      cur = { title: (h.length === 3 ? h[2] : h[1]).replace(/\*\*/g, "").trim(), lines: [] };
      continue;
    }
    (cur ? cur.lines : intro).push(line);
  }
  if (cur) sections.push({ title: cur.title, body: cur.lines.join("\n").trim(), ask: ASK.test(cur.title) });
  return { intro: intro.join("\n").trim(), sections: sections.filter((s) => s.body || s.title) };
}

const preview = (body: string) => body.replace(/```[\s\S]*?```/g, "").replace(/[#*`>-]/g, " ").replace(/\s+/g, " ").trim().slice(0, 90);

export default function ReplyView({ text, highlightRequests, hideCode }: { text: string; highlightRequests?: boolean; hideCode?: boolean }) {
  const { intro, sections } = splitReply(text);
  const [all, setAll] = useState<boolean | null>(null);
  // a short reply, or one without sections, is shown whole
  if (sections.length <= 2 || text.length < 900) {
    return (
      <div className="fs-read">
        <Markdown text={text} highlightRequests={highlightRequests} hideCode={hideCode} />
      </div>
    );
  }
  const openAt = (i: number, s: Section) => all ?? (i === 0 || (highlightRequests && s.ask));
  return (
    <div className="fs-read space-y-1">
      <div className="flex justify-end">
        <button type="button" className="text-sm font-bold text-muted underline-offset-4 hover:underline" onClick={() => setAll(!(all ?? false))}>
          {all ? "سكّر الأقسام" : `افتح كل الأقسام (${sections.length.toLocaleString("ar")})`}
        </button>
      </div>
      {intro && <Markdown text={intro} highlightRequests={highlightRequests} hideCode={hideCode} />}
      {sections.map((s, i) => (
        <details key={`${i}-${all}`} className="fs-sec" open={openAt(i, s) || undefined} data-ask={(highlightRequests && s.ask) || undefined}>
          <summary>
            <span>{highlightRequests && s.ask ? "👉 " : ""}{s.title}</span>
            <small>{preview(s.body)}</small>
          </summary>
          <div className="pb-2">
            <Markdown text={s.body} highlightRequests={highlightRequests && s.ask} hideCode={hideCode} />
          </div>
        </details>
      ))}
    </div>
  );
}
