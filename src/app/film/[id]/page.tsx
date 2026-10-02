import { redirect } from "next/navigation";
import { requireFilmUser, requireProject } from "@/lib/film/access";
import { projectCost } from "@/lib/film/usage";
import { FILM_BUCKET, type FilmAsset } from "@/lib/film/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { FILM_STAGES, STATUS_LABELS } from "@config/film";
import ProjectEditor from "./ProjectEditor";
import References from "./References";

export const metadata = { title: "مشروع فيلم | نهج علي" };
export const dynamic = "force-dynamic";

export default async function FilmProjectPage({ params }: PageProps<"/film/[id]">) {
  const { id } = await params;
  const { user, allowed } = await requireFilmUser(`/film/${id}`);
  if (!allowed) redirect("/film");
  const project = await requireProject(id, user.id);

  const db = createAdminClient();
  const { data } = await db
    .from("film_assets")
    .select("*")
    .eq("project_id", project.id)
    .eq("kind", "upload")
    .order("created_at", { ascending: true });
  const uploads = (data ?? []) as FilmAsset[];
  // Short-lived links: the files stay private
  const urls = uploads.length
    ? (await db.storage.from(FILM_BUCKET).createSignedUrls(uploads.map((u) => u.storage_path!), 3600)).data ?? []
    : [];
  const references = uploads.map((u, i) => ({ id: u.id, name: u.file_name ?? "", url: urls[i]?.signedUrl ?? "" }));

  const cost = await projectCost(project.id);
  const current = FILM_STAGES.findIndex((s) => s.key === project.stage);

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <h1 className="display text-4xl">{project.title}</h1>
        {/* Stage tracker */}
        <ol className="grid grid-cols-5 gap-1 text-center" aria-label="مراحل المشروع">
          {FILM_STAGES.map((s, i) => (
            <li key={s.key} aria-current={i === current ? "step" : undefined} className="space-y-1">
              <span className={`grid h-11 place-items-center rounded-2xl text-xl ${i < current ? "bg-teal text-white" : i === current ? "bg-gold text-on-gold" : "bg-surface-2 opacity-60"}`}>
                {s.icon}
              </span>
              <span className={`block text-[11px] font-extrabold ${i === current ? "text-ink" : "text-muted"}`}>{s.label}</span>
            </li>
          ))}
        </ol>
      </header>

      <section className="card space-y-2 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold">المرحلة الحالية: {FILM_STAGES[current]?.label}</h2>
          <span className="chip">{STATUS_LABELS.draft}</span>
        </div>
        <p className="text-sm font-bold text-muted">
          راجع قصتك تحت (تنحفظ تلقائيًا). المساعد السيناريست ينضاف في المرحلة الجاية من التطوير، ويبدأ من هذا النص.
        </p>
      </section>

      <ProjectEditor
        projectId={project.id}
        initial={{
          title: project.title,
          story: project.story,
          fixedFacts: project.fixed_facts,
          targetDurationSec: project.target_duration_sec ? String(project.target_duration_sec) : "",
        }}
      />

      <References projectId={project.id} initial={references} />

      <section className="card space-y-2 p-4">
        <h2 className="text-lg font-extrabold">تكلفة المشروع إلى الآن</h2>
        <p className="display text-3xl" dir="ltr">${cost.total.toFixed(2)}</p>
        <p className="text-sm font-bold text-muted">كل عملية توليد تنحسب هنا بتكلفتها الفعلية، والعمليات اللي تفشل ما تنحسب.</p>
      </section>
    </div>
  );
}
