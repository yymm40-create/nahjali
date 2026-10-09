"use client";

import { useMemo, useState } from "react";
import { fmtDuration } from "@config/learn";
import type { CourseView } from "@/lib/learn/server";
import SecurePlayer from "./SecurePlayer";

/** A course page: the player on one side, the days and their videos on the other. */
export default function LearnCourse({ course, initial }: { course: CourseView; initial: string | null }) {
  const lessons = useMemo(() => course.days.flatMap((d) => d.lessons.filter((l) => l.status === "ready")), [course]);
  const [id, setId] = useState(() => (lessons.find((l) => l.id === initial) ?? lessons[0])?.id ?? null);
  const cur = lessons.find((l) => l.id === id) ?? null;
  const next = cur ? lessons[lessons.indexOf(cur) + 1] : undefined;
  return (
    <>
      <div>
        <h1 className="text-2xl font-extrabold">{course.title}</h1>
        {course.summary && <p className="ln-dim mt-1">{course.summary}</p>}
      </div>
      <div className="ln-grid">
        <div className="space-y-3">
          {cur ? (
            <>
              <SecurePlayer key={cur.id} lessonId={cur.id} title={cur.title} onEnd={() => undefined} />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-extrabold">{cur.title}</h2>
                {next && <button type="button" className="btn btn-ghost" onClick={() => setId(next.id)}>التالي: {next.title} ⟵</button>}
              </div>
            </>
          ) : (
            <div className="ln-card"><p className="font-bold">ما انرفعت فيديوهات لهذي الدورة بعد. ترجع قريب بإذن الله.</p></div>
          )}
        </div>
        <aside className="ln-card" aria-label="محتوى الدورة">
          {course.days.map((d) => (
            <div key={d.id}>
              <div className="ln-day">{d.title}</div>
              {d.lessons.filter((l) => l.status === "ready").map((l) => (
                <button key={l.id} type="button" className="ln-less" aria-current={l.id === id} onClick={() => setId(l.id)}>
                  <span>▶ {l.title}</span>
                  <span className="ln-dim" dir="ltr">{fmtDuration(l.duration)}</span>
                </button>
              ))}
              {!d.lessons.some((l) => l.status === "ready") && <p className="ln-dim px-2">قريبًا</p>}
            </div>
          ))}
          {!course.days.length && <p className="ln-dim">لا أيام بعد.</p>}
        </aside>
      </div>
    </>
  );
}
