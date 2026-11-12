"use client";

// «📌 تعليماتي الدايمة» (in حيدرا ماكس's window): the person's editing style written once — «دايماً كابشن أصفر، لا تقص
// الأنفاس» — and followed in every request to him, in every project, unless the message itself asks otherwise. Kept
// with the account (migration 0111); before it, on this device.

import { useEffect, useState } from "react";
import { postJson } from "@/lib/fetch";
import { cleanRules, RULES_MAX } from "@/lib/editor/changes-core";
import { keepLocalRules, localRules } from "./haidara-rules";

const EXAMPLE = "مثلاً: دايماً كابشن أصفر بخط عريض، لا تقص الأنفاس، الانتقالات قصيرة وناعمة، الموسيقى واطية وقت الكلام";

export default function HaidaraRules({ projectId, readOnly }: { projectId: string; readOnly: boolean }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  // what is kept now (the box differs from it: «احفظ» lights up)
  const [kept, setKept] = useState("");
  // null: not asked yet · false: the server can't keep them yet (0111), this device does
  const [stored, setStored] = useState<boolean | null>(null);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const url = `/api/jawad/editor/projects/${projectId}`;

  // this device's copy at once, then the account's (a copy written before the update goes up the first time)
  useEffect(() => {
    let live = true;
    const t = setTimeout(() => {
      const mine = localRules();
      setText(mine);
      setKept(mine);
      postJson<{ rules: string | null; stored: boolean }>(url, { action: "rules" })
        .then((r) => {
          if (!live) return;
          setStored(r.stored);
          if (r.stored && r.rules !== null) {
            keepLocalRules(r.rules);
            setKept(r.rules);
            setText((x) => (x === mine ? r.rules! : x));
          } else if (r.stored && mine) void postJson(url, { action: "rules_save", rules: mine }).catch(() => undefined);
        })
        .catch(() => live && setStored(false));
    }, 0);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [url]);

  const save = async () => {
    const v = cleanRules(text);
    setText(v);
    keepLocalRules(v);
    setKept(v);
    setState("saving");
    try {
      const r = await postJson<{ rules: string; stored: boolean }>(url, { action: "rules_save", rules: v });
      setStored(r.stored);
      setState("saved");
    } catch {
      setState("error");
    }
  };

  const changed = cleanRules(text) !== kept;
  return (
    <>
      <button type="button" className="hm-icon relative" aria-expanded={open} onClick={() => (setOpen((v) => !v), setState("idle"))} title="تعليماتي الدايمة: أسلوبك اللي يتبعه حيدرا ماكس في كل تعديل" aria-label="تعليماتي الدايمة">
        <span aria-hidden>📌</span>
        {kept && <span className="absolute end-1 top-1 h-1.5 w-1.5 rounded-full bg-jw-accent" aria-hidden />}
      </button>
      {open && (
        <>
          <button type="button" className="fixed inset-0 z-20 cursor-default" aria-label="إغلاق" onClick={() => setOpen(false)} />
          <div className="hm-pop absolute end-2 top-full z-30 mt-1 flex w-[min(420px,calc(100vw-24px))] flex-col gap-2 p-3" role="dialog" aria-label="تعليماتي الدايمة">
            <b className="text-[13px]">📌 تعليماتي الدايمة</b>
            <p className="m-0 text-[12px] leading-5 text-jw-muted">اكتب أسلوبك مرة وحدة، وحيدرا ماكس يمشي عليه في كل تعديل وبكل مشاريعك، إلا إذا طلبت غيره في رسالتك.</p>
            <textarea
              className="jw-input min-h-32 w-full resize-y text-[14px] leading-6"
              dir="auto"
              value={text}
              maxLength={RULES_MAX}
              disabled={readOnly}
              placeholder={EXAMPLE}
              onChange={(e) => (setText(e.target.value), setState("idle"))}
              aria-label="تعليماتك الدايمة لحيدرا ماكس"
            />
            <div className="flex items-center gap-2">
              <span className="text-[11px] tabular-nums text-jw-faint" dir="ltr">
                {text.length}/{RULES_MAX}
              </span>
              <span className="flex-1 text-[12px] text-jw-muted" aria-live="polite">
                {state === "saving" ? "نحفظ…" : state === "saved" ? "انحفظت ✓" : state === "error" ? "انحفظت على هالجهاز؛ تعذّر حفظها بحسابك." : ""}
              </span>
              {kept && (
                <button type="button" className="jw-btn jw-btn-quiet !min-h-9 text-xs" disabled={readOnly || state === "saving"} onClick={() => setText("")}>
                  امسح
                </button>
              )}
              <button type="button" className="jw-btn jw-btn-primary !min-h-9 text-xs" disabled={readOnly || !changed || state === "saving"} onClick={() => void save()}>
                احفظ
              </button>
            </div>
            {stored === false && <p className="m-0 text-[11px] text-jw-muted">ℹ️ تنحفظ على هالجهاز بس لين يتحدّث الموقع (ملف 0111).</p>}
          </div>
        </>
      )}
    </>
  );
}
