"use client";

// «📖 اسأل الذكاء الإسلامي» — a religious question goes to the owner's own trained library, not to the open web, and its
// answer, with its own references, becomes a source of this material. It sits in the «المادة» tier of the first page
// in EVERY mode (files, or «صادق يبحث لي»): it used to live only inside the files step, so whoever went the research
// way never saw it.

import { useBranch } from "./branch";
import { ISLAMIC_WAYS, isIslamicSource } from "@config/jawad/student";
import { useState } from "react";
import type { ProjectHook } from "./StudentProject";
import { PaidButton } from "./ui";

export default function IslamicAsk({ p }: { p: ProjectHook }) {
  const { assistant: A } = useBranch();
  const { sources, jobs } = p.state;
  const [question, setQuestion] = useState("");
  const [way, setWay] = useState<(typeof ISLAMIC_WAYS)[number]["id"]>("auto");
  const running = jobs.some((j) => j.status === "queued" || j.status === "running");
  const asked = sources.filter((s) => s.kind === "text" && isIslamicSource(s.name)).length;
  return (
    <div className="jw-panel space-y-3 p-4">
      <h2 className="font-semibold">📖 اسأل «الذكاء الإسلامي»</h2>
      <p className="text-sm text-jw-muted">
        أي شي ديني — آية، رواية، حكم، مسألة عقدية، سيرة — لا يكتبه {A} من عنده ولا يبحثه في الويب: يسأل «الذكاء الإسلامي» اللي يجاوب من مكتبة صاحب المنصة بمصادرها، وجوابه ينضاف لمادتك ومعه قائمة مصادره، وكل اللي يُبنى بعده (ملخص، كتاب، شرائح، اختبار) يقف عليه.
      </p>
      <textarea className="jw-textarea" rows={2} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="مثال: وش معنى «الصلاة معراج المؤمن»؟ أو: أدلة ولاية أمير المؤمنين عليه السلام" aria-label="السؤال للذكاء الإسلامي" />
      <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="طريقة الجواب">
        {ISLAMIC_WAYS.map((w) => (
          <button key={w.id} type="button" role="radio" aria-checked={way === w.id} title={w.hint} className={`jw-chip text-xs ${way === w.id ? "!border-jw-accent !bg-jw-accent/15 font-bold" : ""}`} onClick={() => setWay(w.id)}>
            {w.label}
          </button>
        ))}
      </div>
      {asked > 0 && <p className="text-sm text-jw-ok">✓ انضاف {asked} جواب من الذكاء الإسلامي لمادتك. تقدر تسأل سؤالًا ثانيًا أو تتابع.</p>}
      <PaidButton
        label={asked ? "اسأل سؤالًا ثانيًا" : "اسأل وضيفه لمادتي"}
        what="سؤال «الذكاء الإسلامي» من مكتبته، وجوابه بمصادره يصير مصدرًا من مصادر المادة."
        disabled={running || !question.trim()}
        run={async (bb) => {
          const r = await p.act({ action: "ask_islamic", question, mode: way, ...bb });
          if (bb.confirm) setQuestion("");
          return r;
        }}
      />
    </div>
  );
}
