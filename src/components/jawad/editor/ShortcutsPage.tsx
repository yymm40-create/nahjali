"use client";

// «⌨️ الاختصارات» — the page of every key in حيدرة كت, from the top bar. Premiere Pro, DaVinci Resolve, CapCut and
// Final Cut Pro shortcuts all work here; where two programs give the same key to different jobs the person's program
// wins. The first time on a computer it opens as a question («أي برنامج تعودت عليه؟») before the table.

import { useMemo, useState } from "react";
import "./shortcuts.css";
import { ACTIONS, BIG_STEP, BROWSER_KEPT, clashes, KEYMAPS, PROGRAM_ORDER, PROGRAMS, keyTable, showCombo, type ActionId, type ProgramId } from "@/lib/editor/shortcuts";

const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

export default function ShortcutsPage({ open, first, program, onPick, onClose }: { open: boolean; first: boolean; program: ProgramId; onPick: (p: ProgramId) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const mac = useMemo(isMac, []);
  const table = useMemo(() => keyTable(program), [program]);
  const clash = useMemo(() => clashes(program), [program]);
  if (!open) return null;

  // a key works for this job only if this job is what wins it
  const live = (combo: string, action: ActionId) => table.get(combo)?.action === action;
  const kbd = (combo: string, action: ActionId) => (
    <kbd key={combo} dir="ltr" className={`sc-kbd ${live(combo, action) ? "" : "off"}`} title={live(combo, action) ? (BROWSER_KEPT.has(combo) ? "في المتصفح ياخذه المتصفح؛ يشتغل في تطبيق الكمبيوتر" : "") : `هالزر عندك لـ«${ACTIONS.find((a) => a.id === table.get(combo)?.action)?.ar}» حسب أولويتك`}>
      {showCombo(combo, mac)}
      {BROWSER_KEPT.has(combo) && <sup>*</sup>}
    </kbd>
  );
  const words = q.trim();
  const rows = ACTIONS.filter((a) => !words || a.ar.includes(words) || PROGRAM_ORDER.some((p) => (KEYMAPS[p][a.id] ?? []).some((c) => showCombo(c, mac).toLowerCase().includes(words.toLowerCase()))));
  const groups = [...new Set(rows.map((r) => r.group))];

  const picker = (
    <div className="sc-progs" role="radiogroup" aria-label="البرنامج اللي له الأولوية">
      {PROGRAM_ORDER.map((p) => (
        <button key={p} type="button" role="radio" aria-checked={program === p && !first} className={`sc-prog ${program === p && !first ? "on" : ""}`} onClick={() => onPick(p)}>
          <span aria-hidden>{PROGRAMS[p].icon}</span>
          <b>{PROGRAMS[p].ar}</b>
          <small dir="ltr">{PROGRAMS[p].en}</small>
        </button>
      ))}
    </div>
  );

  if (first)
    return (
      <div className="sc-back" role="dialog" aria-modal="true" aria-label="الاختصارات" dir="rtl" onClick={onClose}>
        <div className="sc-box sc-ask" onClick={(e) => e.stopPropagation()}>
          <b className="sc-title">⌨️ أي برنامج مونتاج تعودت عليه؟</b>
          <p className="sc-sub">اختصارات بريمير ودافنشي وكاب كت وفاينل كت كلها تشتغل هنا. لو زر واحد له شغلتين مختلفتين بين برنامجين، يمشي على البرنامج اللي تختاره.</p>
          {picker}
          <button type="button" className="sc-link" onClick={onClose}>
            ولا واحد: خلها على اختصارات حيدرة كت
          </button>
          <p className="sc-foot">تقدر تغيّره بعدين من زر «⌨️ الاختصارات» فوق.</p>
        </div>
      </div>
    );

  return (
    <div className="sc-back" role="dialog" aria-modal="true" aria-label="الاختصارات" dir="rtl" onClick={onClose}>
      <div className="sc-box" onClick={(e) => e.stopPropagation()}>
        <header className="sc-head">
          <b className="sc-title">⌨️ الاختصارات</b>
          <input className="sc-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="دوّر: قص، Ctrl+K، علامة…" aria-label="دوّر في الاختصارات" />
          <button type="button" className="sc-x" onClick={onClose} aria-label="إغلاق">
            ✕
          </button>
        </header>
        <div className="sc-scroll">
          <p className="sc-sub">
            كل البرامج تشتغل مع بعض. <b>الأولوية لـ{PROGRAMS[program].ar}</b>: لو زر له شغلتين، يسوي شغلته في {PROGRAMS[program].ar}. الزر الباهت معناه إن شغلته عندك غير هذي.
          </p>
          {picker}

          <div className="sc-table" role="table">
            <div className="sc-row sc-th" role="row">
              <span role="columnheader">الشغلة</span>
              {PROGRAM_ORDER.map((p) => (
                <span key={p} role="columnheader" className={p === program ? "mine" : ""}>
                  {PROGRAMS[p].ar}
                </span>
              ))}
            </div>
            {groups.map((g) => (
              <div key={g} role="rowgroup">
                <div className="sc-group">{g}</div>
                {rows
                  .filter((r) => r.group === g)
                  .map((a) => (
                    <div key={a.id} className="sc-row" role="row">
                      <span role="cell" className="sc-act">
                        {a.ar}
                        {(a.id === "bigBack" || a.id === "bigFwd") && <small> ({BIG_STEP[program].ar})</small>}
                      </span>
                      {PROGRAM_ORDER.map((p) => (
                        <span key={p} role="cell" className={p === program ? "mine" : ""}>
                          {(KEYMAPS[p][a.id] ?? []).map((c) => kbd(c, a.id))}
                          {!(KEYMAPS[p][a.id] ?? []).length && <i className="sc-none">—</i>}
                        </span>
                      ))}
                    </div>
                  ))}
              </div>
            ))}
          </div>

          {clash.length > 0 && (
            <section className="sc-clash">
              <b>⚡ الأزرار المتداخلة ({clash.length}) — وش يسوي كل واحد عندك الحين</b>
              <ul>
                {clash.map((c) => (
                  <li key={c.combo}>
                    <kbd dir="ltr" className="sc-kbd">
                      {showCombo(c.combo, mac)}
                    </kbd>{" "}
                    ← <b>{ACTIONS.find((a) => a.id === c.wins.action)?.ar}</b> <small>(حسب {PROGRAMS[c.wins.from].ar})</small>
                    <span className="sc-others">
                      {c.uses
                        .filter((u) => u.action !== c.wins.action)
                        .map((u) => `${PROGRAMS[u.p].ar}: ${ACTIONS.find((a) => a.id === u.action)?.ar}`)
                        .join(" · ")}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <p className="sc-foot">
            * المتصفح ياخذ هالأزرار لنفسه (تبويب جديد وغيره)، فتشتغل بس في تطبيق الكمبيوتر. ما ينحط هنا إلا اللي يقدر حيدرة كت يسويه؛ أدوات البرامج الثانية اللي ما عندنا ما لها زر. على الماك ⌘ مكان Ctrl.
          </p>
        </div>
      </div>
    </div>
  );
}
