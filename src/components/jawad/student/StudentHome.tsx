"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Icon from "@/components/jawad/Icon";
import { LEVELS, OUTPUT_KINDS, STUDENT } from "@config/jawad/student";
import { post } from "./client";
import { ErrorLine, useAsync } from "./ui";

const STAGE: Record<string, string> = {
  sources: "إضافة المادة",
  review: "مراجعة النص",
  understanding: "فهم المادة",
  scope: "حدود المصدر",
  outputs: "النواتج",
};

export default function StudentHome({
  name,
  projects,
}: {
  name: string;
  projects: { id: string; title: string; level: string; stage: string; last_activity_at: string; expiresAt: string }[] | null;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [level, setLevel] = useState<string>("ثانوي");
  const [other, setOther] = useState("");
  const [audience, setAudience] = useState("");
  const { busy, error, run } = useAsync();

  const create = () =>
    run(async () => {
      const r = await post<{ id: string }>("/api/jawad/student/projects", { title, level: level === "آخر" ? other : level, audience });
      router.push(`${STUDENT.base}/${r.id}`);
    });

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-3 py-5 sm:px-5">
      <header className="space-y-2">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <span className="grid size-10 place-items-center rounded-xl bg-jw-accent-soft text-jw-accent">
            <Icon name="book" size={20} />
          </span>
          {name}
        </h1>
        <p className="max-w-2xl text-jw-muted">
          ارفع مادتك الدراسية (نص، صور، PDF)، راجع النص المستخرج كاملًا، اعتمد فهم المساعد لها، ثم اختر ما تريد: {OUTPUT_KINDS.map((o) => o.name).join("، ")}.
        </p>
      </header>

      <section className="jw-panel space-y-4 p-4" aria-labelledby="new-material">
        <h2 id="new-material" className="font-semibold">مادة جديدة</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="jw-label" htmlFor="st-title">اسم المادة</label>
            <input id="st-title" className="jw-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: الفصل الثالث — الخلية" />
          </div>
          <div>
            <label className="jw-label" htmlFor="st-aud">الجمهور المستهدف (اختياري)</label>
            <input id="st-aud" className="jw-input" value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="مثال: أنا نفسي للمراجعة، أو زملائي في الصف" />
          </div>
        </div>
        <div className="space-y-2">
          <span className="jw-label">المستوى التعليمي</span>
          <div className="jw-seg flex-wrap" role="radiogroup" aria-label="المستوى التعليمي">
            {[...LEVELS, "آخر"].map((l) => (
              <button key={l} type="button" role="radio" aria-checked={level === l} onClick={() => setLevel(l)}>
                {l}
              </button>
            ))}
          </div>
          {level === "آخر" && <input className="jw-input" value={other} onChange={(e) => setOther(e.target.value)} placeholder="اكتب المستوى والتخصص" aria-label="المستوى والتخصص" />}
          <p className="text-xs text-jw-faint">المستوى يحدد طريقة الشرح فقط؛ لا يُبسَّط شيء إلا إذا طلبت ذلك.</p>
        </div>
        <ErrorLine error={error} />
        <button type="button" className="jw-btn jw-btn-primary" onClick={create} disabled={busy}>
          {busy ? <span className="jw-spinner" aria-hidden /> : <Icon name="plus" size={16} />}
          ابدأ
        </button>
      </section>

      <section aria-labelledby="my-materials" className="space-y-3">
        <h2 id="my-materials" className="text-sm font-medium text-jw-muted">موادي</h2>
        {projects === null ? (
          <p className="jw-panel p-4 text-sm text-jw-muted">القسم قيد التجهيز (جداول قاعدة البيانات غير موجودة بعد).</p>
        ) : projects.length === 0 ? (
          <p className="jw-panel p-4 text-sm text-jw-muted">ما عندك مواد بعد.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {projects.map((p) => (
              <li key={p.id}>
                <Link href={`${STUDENT.base}/${p.id}`} className="jw-panel block space-y-1 p-4 hover:bg-jw-surface-2">
                  <b className="block truncate">{p.title || "مادة"}</b>
                  <span className="block text-sm text-jw-muted">
                    {p.level ? `${p.level} · ` : ""}المرحلة: {STAGE[p.stage] ?? p.stage}
                  </span>
                  <span className="block text-xs text-jw-faint">تُحذف تلقائيًا في {new Date(p.expiresAt).toLocaleDateString("ar")} إن لم تُستخدم ({STUDENT.keepDays} يومًا من آخر نشاط)</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
