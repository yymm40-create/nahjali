import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import Markdown from "@/components/Markdown";
import { createAdminClient } from "@/lib/supabase/admin";
import { projectCost } from "@/lib/film/usage";
import { FILM_BUCKET, type FilmAsset, type FilmProject } from "@/lib/film/types";
import { FILM_STAGES, STATUS_LABELS } from "@config/film";
import { isAdmin } from "@config/site";

import { storage } from "@/lib/storage";
export const metadata = { title: "مشروع فيلم | لوحة التحكم" };
export const dynamic = "force-dynamic";

const STAGE_LABELS: Record<string, string> = { screenwriter: "✍️ السيناريست", sheets: "🎨 صانع الشيت", director: "🎥 المخرج" };
const usd = (n: number) => `$${n.toFixed(2)}`;
const when = (iso: string) => new Date(iso).toLocaleString("ar-SA", { timeZone: "Asia/Riyadh", dateStyle: "medium", timeStyle: "short" });

interface Version {
  id: string;
  stage: string;
  kind: string;
  ref_key: string;
  version: number;
  body: string;
  data: Record<string, unknown>;
  status: string;
  created_at: string;
}

/** Owner only: everything one film project produced — texts, the user's messages, pictures and videos. */
export default async function AdminFilmProjectPage({ params }: PageProps<"/admin/film/[id]">) {
  const { id } = await params;
  const me = await requireUser(`/admin/film/${id}`);
  if (!isAdmin(me.email)) notFound();
  const db = createAdminClient();
  const { data: p } = await db.from("film_projects").select("*").eq("id", id).maybeSingle();
  if (!p) notFound();
  const project = p as FilmProject;

  const [owner, versions, messages, assets, cost] = await Promise.all([
    db.auth.admin.getUserById(project.user_id),
    db.from("film_versions").select("id,stage,kind,ref_key,version,body,data,status,created_at").eq("project_id", id).order("created_at"),
    db.from("film_messages").select("stage,role,content,created_at").eq("project_id", id).eq("role", "user").order("created_at"),
    db.from("film_assets").select("*").eq("project_id", id).order("created_at"),
    projectCost(id),
  ]);
  const all = (versions.data ?? []) as Version[];
  const files = (assets.data ?? []) as FilmAsset[];
  const paths = files.filter((a) => a.storage_path).map((a) => a.storage_path!);
  const signed = paths.length ? ((await storage.from(FILM_BUCKET).createSignedUrls(paths, 3600)).data ?? []) : [];
  const url: Record<string, string> = {};
  signed.forEach((s, i) => s.signedUrl && (url[paths[i]] = s.signedUrl));
  const images = files.filter((a) => a.kind === "image" || a.kind === "upload");
  const videos = files.filter((a) => a.kind === "video");
  const userMsgs = (messages.data ?? []) as { stage: string; content: string; created_at: string }[];

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <Link href="/admin/film" className="text-sm font-bold text-muted">→ فرع الفيلم</Link>
        <h1 className="display text-4xl">{project.title}</h1>
        <p className="text-sm font-bold text-muted">
          {owner.data.user?.email ?? project.user_id} · {FILM_STAGES.find((s) => s.key === project.stage)?.label} · بدأ {when(project.created_at)} · التكلفة <span dir="ltr">{usd(cost.total)}</span>
        </p>
      </header>

      <section className="card space-y-2 p-4">
        <h2 className="text-xl font-extrabold">📝 القصة</h2>
        <p className="whitespace-pre-wrap leading-8">{project.story || "—"}</p>
        {project.fixed_facts && (
          <>
            <h3 className="font-extrabold">حقائق ثابتة</h3>
            <p className="whitespace-pre-wrap leading-8">{project.fixed_facts}</p>
          </>
        )}
      </section>

      {/* Every deliverable of every assistant, in order (prompts included, unlike the client's pages) */}
      {Object.entries(STAGE_LABELS).map(([stage, label]) => {
        const vs = all.filter((v) => v.stage === stage && v.kind !== "dir_setup");
        const mine = userMsgs.filter((m) => m.stage === stage);
        if (!vs.length && !mine.length) return null;
        return (
          <section key={stage} className="card space-y-3 p-4">
            <h2 className="text-xl font-extrabold">{label} <span className="text-sm text-muted">({vs.length} نص)</span></h2>
            {vs.map((v) => (
              <details key={v.id} className="rounded-2xl border border-line p-3">
                <summary className="cursor-pointer font-extrabold">
                  {v.kind}{v.ref_key ? ` · ${v.ref_key}` : ""} · النسخة {v.version} · <span className="text-muted">{STATUS_LABELS[v.status] ?? v.status} · {when(v.created_at)}</span>
                </summary>
                <div className="mt-2 space-y-2">
                  <Markdown text={v.body} />
                  {typeof v.data.prompt === "string" && v.data.prompt && (
                    <div className="space-y-1">
                      <p className="text-sm font-extrabold">البرومبت</p>
                      <pre className="whitespace-pre-wrap rounded-2xl bg-surface-2 p-3 text-xs leading-6" dir="ltr">{v.data.prompt}</pre>
                    </div>
                  )}
                  {Array.isArray(v.data.answers) && (
                    <div className="rounded-2xl bg-surface-2 p-3 text-sm font-bold">
                      <p>إجابات المستخدم:</p>
                      {(v.data.answers as string[]).map((a, i) => <p key={i}>{i + 1}. {a}</p>)}
                    </div>
                  )}
                </div>
              </details>
            ))}
            {mine.length > 0 && (
              <details className="rounded-2xl bg-surface-2 p-3">
                <summary className="cursor-pointer font-extrabold">💬 رسائل المستخدم ({mine.length})</summary>
                <div className="mt-2 space-y-2">
                  {mine.map((m, i) => (
                    <div key={i} className="rounded-xl bg-surface p-2 text-sm">
                      <p className="text-xs font-bold text-muted">{when(m.created_at)}</p>
                      <p className="whitespace-pre-wrap leading-7">{m.content.length > 3000 ? `${m.content.slice(0, 3000)}…` : m.content}</p>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </section>
        );
      })}

      <section className="card space-y-3 p-4">
        <h2 className="text-xl font-extrabold">🖼️ الصور ({images.length})</h2>
        <div className="grid grid-cols-2 gap-3">
          {images.map((a) => (
            <figure key={a.id} className="space-y-1">
              {a.storage_path && url[a.storage_path] ? (
                <a href={url[a.storage_path]} target="_blank" rel="noopener">
                  {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
                  <img src={url[a.storage_path]} alt={a.ref_key} className="w-full rounded-xl" />
                </a>
              ) : (
                <p className="rounded-xl bg-surface-2 p-4 text-sm font-bold text-muted">{a.error ?? "ما فيه ملف"}</p>
              )}
              <figcaption className="text-xs font-bold">
                {a.ref_key} · {a.kind === "upload" ? "مرفوعة" : "مولّدة"} · {STATUS_LABELS[a.status] ?? a.status}
                {typeof a.meta?.at_name === "string" ? ` · ${a.meta.at_name}` : ""}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="text-xl font-extrabold">🎬 الفيديوهات ({videos.length})</h2>
        {videos.map((a) => (
          <figure key={a.id} className="space-y-1">
            {a.storage_path && url[a.storage_path] ? (
              <video src={url[a.storage_path]} controls playsInline className="w-full rounded-xl" />
            ) : (
              <p className="rounded-xl bg-surface-2 p-4 text-sm font-bold text-muted">{a.meta?.removed_at ? "انحذف من الموقع بعد مدة البقاء" : (a.error ?? "ما فيه ملف")}</p>
            )}
            <figcaption className="text-xs font-bold" dir="auto">
              {a.ref_key} · {STATUS_LABELS[a.status] ?? a.status} · {String(a.meta?.model ?? "")} · {String(a.meta?.resolution ?? "")} · {String(a.meta?.ratio ?? "")} · {String(a.meta?.durationSec ?? "")}s · {when(a.created_at)}
            </figcaption>
          </figure>
        ))}
      </section>
    </div>
  );
}
