"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PROJECT_KINDS, type ProjectKind } from "@/lib/editor/model";
import { api, postJson } from "@/lib/fetch";
import Icon from "../Icon";
import SectionHint from "../SectionHint";
import type { ProjectSummary } from "./types";

const ago = (iso: string, now: number) => {
  const m = Math.round((now - new Date(iso).getTime()) / 60_000);
  if (m < 60) return m <= 1 ? "الحين" : `قبل ${m} دقيقة`;
  const h = Math.round(m / 60);
  if (h < 24) return `قبل ${h} ساعة`;
  return `قبل ${Math.round(h / 24)} يوم`;
};

/** «الممنتج الذكي»'s front page: what kind of video, then straight into the editor; the person's edits under it. */
export default function EditorHome({ name, projects: initial, loginHref }: { name: string; projects: ProjectSummary[] | null; loginHref: string | null }) {
  const router = useRouter();
  const [projects, setProjects] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setNow(Date.now()), 0);
    return () => clearTimeout(t);
  }, []);

  const start = async (kind: ProjectKind) => {
    if (loginHref) return router.push(loginHref);
    setBusy(kind);
    setError(null);
    try {
      const r = await postJson<{ id: string }>("/api/jawad/editor/projects", { kind });
      router.push(`/jawad-ai/editor/${r.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر.");
      setBusy(null);
    }
  };

  const remove = async (p: ProjectSummary) => {
    if (!confirm(`نحذف «${p.title}» وكل ملفاته؟ ما يرجع.`)) return;
    try {
      await api(`/api/jawad/editor/projects/${p.id}`, { method: "DELETE" });
      setProjects((xs) => xs?.filter((x) => x.id !== p.id) ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر الحذف.");
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 pb-16 pt-6">
      <SectionHint kind="editor" />
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Icon name="scissors" size={24} className="text-jw-accent" /> {name}
        </h1>
        <p className="text-sm text-jw-muted">مونتاج سهل من الجوال أو الكمبيوتر: ارفع مقاطعك، قصّها ورتّبها، أضف نصًا، وصدّرها فيديو واحد بدقة 720p أو 1080p. كل شي يصير داخل متصفحك.</p>
      </header>

      <section aria-labelledby="ed-new" className="space-y-3">
        <h2 id="ed-new" className="text-sm font-medium text-jw-muted">ابدأ مونتاج جديد</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(Object.keys(PROJECT_KINDS) as ProjectKind[]).map((k) => (
            <button key={k} type="button" disabled={!!busy} onClick={() => start(k)} className="jw-panel group flex flex-col items-start gap-2 p-4 text-start transition hover:border-jw-accent disabled:opacity-60">
              <span className="text-3xl" aria-hidden>{PROJECT_KINDS[k].icon}</span>
              <span className="font-semibold">{PROJECT_KINDS[k].label}</span>
              <span className="text-xs text-jw-muted" dir="ltr">{PROJECT_KINDS[k].ratio}</span>
              {busy === k && <span className="jw-spinner" />}
            </button>
          ))}
        </div>
        {loginHref && (
          <p className="text-sm text-jw-muted">
            تقدر تتفرج بدون حساب؛ للمونتاج والحفظ <Link href={loginHref} className="text-jw-accent underline">سجّل دخولك</Link> (مجانًا).
          </p>
        )}
        {error && <p className="error-box text-sm">{error}</p>}
      </section>

      {projects === null ? (
        <p className="error-box text-sm">قاعدة بيانات الممنتج غير جاهزة بعد (ملف 0030).</p>
      ) : (
        projects.length > 0 && (
          <section aria-labelledby="ed-mine" className="space-y-3">
            <h2 id="ed-mine" className="text-sm font-medium text-jw-muted">مشاريعي</h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {projects.map((p) => {
                const left = p.purgeAt && now ? Math.max(0, Math.ceil((new Date(p.purgeAt).getTime() - now) / 3_600_000)) : null;
                return (
                  <li key={p.id} className="jw-panel flex items-center gap-3 p-3">
                    <span className="text-2xl" aria-hidden>{p.filmProjectId ? "🎬" : PROJECT_KINDS[p.kind]?.icon}</span>
                    <Link href={`/jawad-ai/editor/${p.id}`} className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{p.title}</span>
                      <span className="block text-xs text-jw-muted">
                        {p.clips} مقطع · {now ? ago(p.updatedAt, now) : ""}
                        {p.purged ? " · انحذفت ملفاته" : left != null ? ` · تنحذف ملفاته خلال ${left > 24 ? `${Math.ceil(left / 24)} أيام` : `${left} ساعة`}` : ""}
                      </span>
                    </Link>
                    <button type="button" className="jw-btn jw-btn-quiet jw-btn-icon" onClick={() => remove(p)} aria-label={`احذف ${p.title}`} title="احذف">
                      <Icon name="trash" size={16} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )
      )}

      <p className="text-xs text-jw-faint">
        <Icon name="clock" size={12} className="inline" /> بعد تصدير أي مشروع بـ٣ أيام تنحذف مقاطعه وملفاته من عندنا (ننبهك قبلها)، فاحتفظ بالفيديو اللي نزل على جهازك.
      </p>
    </div>
  );
}
