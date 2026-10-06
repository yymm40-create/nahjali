"use client";

import Link from "next/link";
import InstallApp from "./InstallApp";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PROJECT_KINDS, type ProjectKind } from "@/lib/editor/model";
import { api, postJson } from "@/lib/fetch";
import Icon from "../Icon";
import { leaveStartKit } from "./start-kit";
import type { EditorAsset, ImportItem, ProjectSummary } from "./types";

const ago = (iso: string, now: number) => {
  const m = Math.round((now - new Date(iso).getTime()) / 60_000);
  if (m < 60) return m <= 1 ? "الحين" : `قبل ${m} دقيقة`;
  const h = Math.round(m / 60);
  if (h < 24) return `قبل ${h} ساعة`;
  return `قبل ${Math.round(h / 24)} يوم`;
};

/**
 * «حيدرة كت» opens like an app: the person's projects to carry on, or «مشروع جديد» (a name, a shape, and the videos
 * to start with: from the device, from their works, or none), then straight into the editor.
 */
export default function EditorHome({ name, projects: initial, loginHref }: { name: string; projects: ProjectSummary[] | null; loginHref: string | null }) {
  const router = useRouter();
  const [projects, setProjects] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const [wizard, setWizard] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setNow(Date.now()), 0);
    return () => clearTimeout(t);
  }, []);

  const startNew = () => (loginHref ? router.push(loginHref) : setWizard(true));

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
    <div data-ed-full className="relative min-h-dvh overflow-hidden bg-gradient-to-b from-jw-accent/10 via-jw-bg to-jw-bg lg:min-h-[calc(100dvh-4rem)]">
      <div aria-hidden className="pointer-events-none absolute -top-32 start-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-jw-accent/20 blur-3xl" />
      <div className="relative mx-auto max-w-5xl space-y-6 px-4 pb-16 pt-4">
        <nav className="flex items-center justify-between">
          <Link href="/jawad-ai" className="jw-btn jw-btn-quiet text-xs" aria-label="رجوع للرئيسية">
            <span aria-hidden>→</span> الرئيسية
          </Link>
          <InstallApp />
        </nav>

        <header className="flex items-center gap-3">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-jw-accent text-jw-on-accent shadow-lg shadow-jw-accent/30">
            <Icon name="scissors" size={28} />
          </span>
          <div>
            <h1 className="text-2xl font-black">{name}</h1>
            <p className="text-xs text-jw-muted">مونتاج سهل من الجوال أو الكمبيوتر، وكل شي يصير داخل متصفحك.</p>
          </div>
        </header>

        {loginHref && (
          <p className="jw-panel p-3 text-sm text-jw-muted">
            للمونتاج والحفظ <Link href={loginHref} className="font-semibold text-jw-accent underline">سجّل دخولك</Link> (مجانًا)، وبعدها تلقى مشاريعك هنا.
          </p>
        )}
        {error && <p className="error-box text-sm">{error}</p>}

        <section aria-labelledby="ed-mine" className="space-y-3">
          <h2 id="ed-mine" className="text-sm font-bold">مشاريعي</h2>
          {projects === null ? (
            <p className="error-box text-sm">قاعدة بيانات حيدرة كت غير جاهزة بعد (ملف 0030).</p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <li>
                <button type="button" onClick={startNew} className="group flex aspect-[4/5] w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-jw-accent/60 bg-jw-accent/5 p-3 text-center transition hover:bg-jw-accent/10">
                  <span className="grid h-12 w-12 place-items-center rounded-full bg-jw-accent text-jw-on-accent transition group-hover:scale-110">
                    <Icon name="plus" size={24} strokeWidth={2.5} />
                  </span>
                  <span className="font-bold">مشروع جديد</span>
                  <span className="text-[11px] text-jw-muted">سمّه واختر مقاطعك وابدأ</span>
                </button>
              </li>
              {projects.map((p) => {
                const left = p.purgeAt && now ? Math.max(0, Math.ceil((new Date(p.purgeAt).getTime() - now) / 3_600_000)) : null;
                return (
                  <li key={p.id} className="relative">
                    <Link href={`/jawad-ai/editor/${p.id}`} className="jw-panel flex aspect-[4/5] w-full flex-col overflow-hidden p-0 transition hover:border-jw-accent">
                      <span className="grid flex-1 place-items-center bg-gradient-to-br from-jw-accent/25 to-jw-bg-2 text-5xl" aria-hidden>
                        {p.filmProjectId ? "🎬" : PROJECT_KINDS[p.kind]?.icon}
                      </span>
                      <span className="space-y-0.5 p-2.5">
                        <span className="block truncate text-sm font-bold">{p.title}</span>
                        <span className="block truncate text-[11px] text-jw-muted">
                          {p.clips} مقطع{now ? ` · ${ago(p.updatedAt, now)}` : ""}
                        </span>
                        {(p.purged || left != null) && (
                          <span className="block truncate text-[10px] text-jw-danger">
                            {p.purged ? "انحذفت ملفاته" : `تنحذف ملفاته خلال ${left! > 24 ? `${Math.ceil(left! / 24)} أيام` : `${left} ساعة`}`}
                          </span>
                        )}
                      </span>
                    </Link>
                    <button type="button" className="absolute end-1.5 top-1.5 grid h-8 w-8 place-items-center rounded-full bg-black/40 text-white backdrop-blur hover:bg-jw-danger" onClick={() => remove(p)} aria-label={`احذف ${p.title}`} title="احذف">
                      <Icon name="trash" size={14} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {projects?.length === 0 && !loginHref && <p className="text-xs text-jw-faint">ما عندك مشاريع بعد؛ اضغط «مشروع جديد».</p>}
        </section>

        <p className="text-xs text-jw-faint">
          <Icon name="clock" size={12} className="inline" /> بعد تصدير أي مشروع بـ٣ أيام تنحذف مقاطعه وملفاته من عندنا (ننبهك قبلها)، فاحتفظ بالفيديو اللي نزل على جهازك.
        </p>
      </div>
      {wizard && <NewProject onClose={() => setWizard(false)} />}
    </div>
  );
}

type Source = "device" | "works" | "none";

/** «مشروع جديد»: a name, a shape, and what to start with; then the editor opens with it on the timeline. */
function NewProject({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<ProjectKind>("reel");
  const [source, setSource] = useState<Source>("none");
  const [files, setFiles] = useState<File[]>([]);
  const [works, setWorks] = useState<ImportItem[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameInput.current?.focus();
    const key = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [busy, onClose]);

  useEffect(() => {
    if (source !== "works" || works) return;
    let live = true;
    api<{ items: ImportItem[] }>("/api/jawad/editor/importables")
      .then((r) => live && setWorks(r.items))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [source, works]);

  const chosen = works ? picked.map((k) => works.find((i) => `${i.source}:${i.id}` === k)).filter((i): i is ImportItem => !!i) : [];
  const ready = source === "none" || (source === "device" && files.length > 0) || (source === "works" && chosen.length > 0);

  const go = async () => {
    setBusy(true);
    setError(null);
    try {
      const { id } = await postJson<{ id: string }>("/api/jawad/editor/projects", { kind, title: title.trim() });
      let assets: EditorAsset[] = [];
      if (source === "works" && chosen.length) {
        const r = await postJson<{ assets: EditorAsset[] }>(`/api/jawad/editor/projects/${id}`, {
          action: "import",
          items: chosen.map((i) => ({ source: i.source, id: i.id, durationMs: i.durationMs, width: i.width, height: i.height, name: i.name })),
        });
        assets = r.assets;
      }
      leaveStartKit({ projectId: id, files: source === "device" ? files : [], assets });
      router.push(`/jawad-ai/editor/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر.");
      setBusy(false);
    }
  };

  const sources: [Source, string, string][] = [
    ["device", "📱", "من جهازي"],
    ["works", "✨", "من أعمالي"],
    ["none", "⬜", "بدون، أبدأ فاضي"],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-labelledby="np-title" onClick={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="jw-panel jw-scroll max-h-[92dvh] w-full max-w-lg space-y-4 overflow-y-auto rounded-b-none p-4 sm:rounded-2xl">
        <div className="flex items-center justify-between">
          <h2 id="np-title" className="text-lg font-black">مشروع جديد</h2>
          <button type="button" className="jw-btn jw-btn-quiet jw-btn-icon" onClick={onClose} disabled={busy} aria-label="إغلاق">
            <Icon name="x" size={18} />
          </button>
        </div>

        <label className="block space-y-1">
          <span className="text-xs font-bold">اسم المشروع</span>
          <input ref={nameInput} className="jw-input w-full" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder={`${PROJECT_KINDS[kind].label} جديد`} />
        </label>

        <fieldset className="space-y-1.5">
          <legend className="text-xs font-bold">شكل الفيديو</legend>
          <div className="grid grid-cols-4 gap-1.5">
            {(Object.keys(PROJECT_KINDS) as ProjectKind[]).map((k) => (
              <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={`flex flex-col items-center gap-0.5 rounded-xl border p-2 text-center ${kind === k ? "border-jw-accent bg-jw-accent/10 ring-2 ring-jw-accent" : "border-jw-line"}`}>
                <span className="text-2xl" aria-hidden>{PROJECT_KINDS[k].icon}</span>
                <span className="text-[10px] leading-tight">{PROJECT_KINDS[k].label}</span>
                <span className="text-[10px] text-jw-faint" dir="ltr">{PROJECT_KINDS[k].ratio}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-1.5">
          <legend className="text-xs font-bold">تبي تضيف فيديوهات من عندك؟</legend>
          <div className="grid grid-cols-3 gap-1.5" role="radiogroup">
            {sources.map(([k, icon, label]) => (
              <button key={k} type="button" role="radio" aria-checked={source === k} onClick={() => setSource(k)} className={`flex flex-col items-center gap-1 rounded-xl border p-2.5 text-xs ${source === k ? "border-jw-accent bg-jw-accent/10 ring-2 ring-jw-accent" : "border-jw-line"}`}>
                <span className="text-xl" aria-hidden>{icon}</span>
                {label}
              </button>
            ))}
          </div>

          {source === "device" && (
            <div className="space-y-2 rounded-xl bg-jw-bg-2 p-2.5">
              <input ref={fileInput} type="file" multiple accept="video/*,image/*,audio/*" className="hidden" onChange={(e) => setFiles((f) => [...f, ...Array.from(e.target.files ?? [])])} />
              <button type="button" className="jw-btn w-full text-xs" onClick={() => fileInput.current?.click()}>
                <Icon name="plus" size={14} /> اختر فيديوهات أو صور
              </button>
              {files.length > 0 && (
                <ul className="space-y-1">
                  {files.map((f, i) => (
                    <li key={`${f.name}-${i}`} className="flex items-center gap-2 text-[11px]">
                      <span className="text-jw-faint">{i + 1}.</span>
                      <span className="min-w-0 flex-1 truncate" dir="auto">{f.name}</span>
                      <span className="text-jw-faint">{Math.max(1, Math.round(f.size / 1e6))}MB</span>
                      <button type="button" className="text-jw-danger" onClick={() => setFiles((xs) => xs.filter((_, j) => j !== i))} aria-label={`شيل ${f.name}`}>
                        <Icon name="x" size={12} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-[10px] text-jw-faint">تنحط في التايملاين وحدة ورا الثانية بالترتيب، وتنرفع وانت تشتغل.</p>
            </div>
          )}

          {source === "works" && (
            <div className="rounded-xl bg-jw-bg-2 p-2">
              {!works ? (
                <div className="grid h-24 place-items-center"><span className="jw-spinner" /></div>
              ) : !works.length ? (
                <p className="p-3 text-center text-xs text-jw-faint">ما عندك أعمال بعد في «الجواد الذكي!» أو صانع الفيلم.</p>
              ) : (
                <ul className="jw-scroll grid max-h-56 grid-cols-3 gap-1.5 overflow-y-auto">
                  {works.map((i) => {
                    const k = `${i.source}:${i.id}`;
                    const n = picked.indexOf(k);
                    return (
                      <li key={k}>
                        <button type="button" aria-pressed={n >= 0} onClick={() => setPicked((p) => (n >= 0 ? p.filter((x) => x !== k) : [...p, k]))} className={`relative block w-full overflow-hidden rounded-lg border ${n >= 0 ? "border-jw-accent ring-2 ring-jw-accent" : "border-jw-line"}`}>
                          <span className="block aspect-video bg-black/40">
                            {i.url && i.kind === "image" ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={i.url} alt="" className="h-full w-full object-cover" />
                            ) : i.url && i.kind === "video" ? (
                              <video src={`${i.url}#t=0.5`} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                            ) : (
                              <span className="grid h-full place-items-center text-lg">🎵</span>
                            )}
                          </span>
                          {n >= 0 && <span className="absolute end-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-jw-accent text-[10px] font-bold text-jw-on-accent">{n + 1}</span>}
                          <span className="block truncate px-1 py-0.5 text-[10px]">{i.name}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </fieldset>

        {error && <p className="error-box text-xs">{error}</p>}
        <button type="button" className="jw-btn jw-btn-primary w-full" disabled={!ready || busy} onClick={go}>
          {busy ? <span className="jw-spinner" /> : <Icon name="scissors" size={16} />} ابدأ المونتاج
        </button>
      </div>
    </div>
  );
}
