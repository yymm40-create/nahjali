import { credits } from "@/lib/film/credits";
import RewindCard from "../[id]/RewindCard";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireFilmUser, requireProject } from "@/lib/film/access";
import { projectCost } from "@/lib/film/usage";
import { FILM_BUCKET, type FilmAsset } from "@/lib/film/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { FILM_STAGES, STATUS_LABELS } from "@config/film";
import ProjectEditor from "../[id]/ProjectEditor";
import References from "../[id]/References";

import { storage } from "@/lib/storage";
/** Where each project stage continues. */
const NEXT_PATH: Record<string, string> = { screenwriter: "/script", sheets: "/sheets", director: "/director", voices: "/voices", done: "/videos" };


export default async function ProjectView({ id, base }: { id: string; base: string }) {
  const { user, allowed } = await requireFilmUser(`${base}/${id}`);
  if (!allowed) redirect(base);
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
    ? (await storage.from(FILM_BUCKET).createSignedUrls(uploads.map((u) => u.storage_path!), 3600)).data ?? []
    : [];
  const references = uploads.map((u, i) => ({ id: u.id, name: u.file_name ?? "", url: urls[i]?.signedUrl ?? "" }));

  const cost = await projectCost(project.id);
  const { count: messageCount } = await db.from("film_messages").select("id", { count: "exact", head: true }).eq("project_id", project.id);
  const scriptStarted = (messageCount ?? 0) > 0;
  const current = FILM_STAGES.findIndex((s) => s.key === project.stage);

  const stage = !project.series_id;
  return (
    <div className="space-y-6">
      {!stage && (
        <header className="space-y-3">
          <h1 className="display text-4xl">{project.title}</h1>
        </header>
      )}

      <section className="card space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold">المرحلة الحالية: {FILM_STAGES[current]?.label}</h2>
          <span className="chip">{scriptStarted ? `${FILM_STAGES[current]?.icon ?? ""} ${current + 1}/${FILM_STAGES.length}` : STATUS_LABELS.draft}</span>
        </div>
        {/* One button to the current section; the sections bar above opens the others */}
        {project.stage === "screenwriter" && !scriptStarted && <p className="text-sm font-bold text-muted">💡 اكتب قصتك تحت 👇 وبعدين اضغط الزر، والسيناريست يبدأ على طول.</p>}
        <Link href={`${base}/${project.id}${NEXT_PATH[project.stage] ?? "/director"}${project.stage === "screenwriter" && !scriptStarted ? "?start=1" : ""}`} className="btn btn-primary w-full">
          {project.stage === "screenwriter"
            ? `✍️ ${scriptStarted ? "كمّل مع السيناريست" : "ابدأ مع السيناريست"}`
            : project.stage === "voices"
              ? "🎙️ كمّل: الأصوات"
              : project.stage === "done"
              ? "🎬 فيديوهاتك (حمّلها قبل ما تنحذف)"
              : `${FILM_STAGES[current]?.icon} كمّل: ${FILM_STAGES[current]?.label}`}
        </Link>
      </section>

      <ProjectEditor
        projectId={project.id}
        locked={scriptStarted}
        initial={{
          title: project.title,
          story: project.story,
          fixedFacts: project.fixed_facts,
          targetDurationSec: project.target_duration_sec ? String(project.target_duration_sec) : "",
        }}
      />

      {!stage && project.stage !== "screenwriter" && <RewindCard projectId={project.id} />}

      <References projectId={project.id} initial={references} />

      <section className="card space-y-2 p-4">
        <h2 className="text-lg font-extrabold">تكلفة المشروع إلى الآن</h2>
        <p className="display text-3xl">{credits(cost.total)}</p>
        <p className="text-sm font-bold text-muted">كل عملية توليد تنحسب هنا بتكلفتها الفعلية، والعمليات اللي تفشل ما تنحسب.</p>
      </section>
    </div>
  );
}
