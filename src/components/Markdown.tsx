import type { ReactNode } from "react";

/** **bold** inside a line. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4 ? <strong key={i}>{part.slice(2, -2)}</strong> : part,
  );
}

/**
 * Small, safe Markdown renderer for the assistants' replies (headings, lists, bold, ``` blocks).
 * Everything is rendered as text nodes — no HTML from the model is ever injected.
 */
export default function Markdown({ text }: { text: string }) {
  const out: ReactNode[] = [];
  const lines = text.replace(/\r/g, "").split("\n");
  let list: string[] = [];
  const flushList = () => {
    if (!list.length) return;
    out.push(
      <ul key={`ul${out.length}`} className="list-disc space-y-1 ps-6">
        {list.map((l, i) => <li key={i}>{inline(l)}</li>)}
      </ul>,
    );
    list = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith("```")) {
      flushList();
      const block: string[] = [];
      while (++i < lines.length && !lines[i].trim().startsWith("```")) block.push(lines[i]);
      out.push(
        <div key={`pre${i}`} className="whitespace-pre-wrap rounded-2xl border border-line bg-surface-2 p-4 leading-8">
          {block.join("\n")}
        </div>,
      );
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      flushList();
      const cls = h[1].length === 1 ? "display text-2xl pt-2" : h[1].length === 2 ? "text-xl font-extrabold pt-2" : "text-lg font-extrabold";
      out.push(<p key={i} className={cls}>{inline(h[2])}</p>);
      continue;
    }
    const li = line.match(/^\s*[-*•]\s+(.*)$/);
    if (li) {
      list.push(li[1]);
      continue;
    }
    flushList();
    if (line.trim() === "") out.push(<div key={i} className="h-2" />);
    else if (/^---+$/.test(line.trim())) out.push(<hr key={i} className="border-line" />);
    else out.push(<p key={i}>{inline(line)}</p>);
  }
  flushList();
  return <div className="space-y-1 leading-8">{out}</div>;
}
