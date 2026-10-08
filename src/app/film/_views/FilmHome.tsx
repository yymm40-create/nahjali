import Link from "next/link";
import "@/app/jawad-ai/film/film-theme.css";
import "../stage/stage.css";
import { createClient } from "@/lib/supabase/server";
import { requireFilmUser } from "@/lib/film/access";
import type { FilmProject } from "@/lib/film/types";
import { FILM_STAGES } from "@config/film";
import { STEPS } from "../stage/FilmStage";

const stageLabel = (key: string) => FILM_STAGES.find((s) => s.key === key)?.label ?? key;
const stageIcon = (key: string) => FILM_STAGES.find((s) => s.key === key)?.icon ?? "🎞️";

/** The screening room's lobby: start a scene, open one of yours, or go to the series. */
export default async function FilmHomeView({ base }: { base: string }) {
  const { allowed } = await requireFilmUser(base);

  if (!allowed) {
    return (
      <div className="fs">
        <div className="fs-room" aria-hidden><div className="beam" /><div className="grain" /></div>
        <div className="card mx-auto max-w-lg space-y-3 p-6 text-center">
          <p className="text-5xl">🎬</p>
          <h1 className="display text-3xl">صانع الأفلام الذكي: قريبًا</h1>
          <p className="font-bold text-muted">هذا القسم تحت التطوير ومتاح لحسابات محددة حاليًا. بنعلن عنه أول ما يجهز إن شاء الله.</p>
          <Link href={base === "/film" ? "/" : "/jawad-ai"} className="btn btn-ghost">الرئيسية</Link>
        </div>
      </div>
    );
  }

  // Read through RLS: the user only ever sees their own projects
  const supabase = await createClient();
  const { data } = await supabase.from("film_projects").select("*").order("updated_at", { ascending: false });
  // a series' scenes live in their series («المسلسل الذكي»)
  const projects = ((data ?? []) as FilmProject[]).filter((p) => !p.series_id);

  return (
    <div className="fs">
      <div className="fs-room" aria-hidden><div className="beam" /><div className="dust" /><div className="grain" /></div>
      <div className="mx-auto max-w-5xl space-y-8 px-3 pb-20">
        <header className="fs-hero">
          <p className="fs-kicker">استوديو الجواد</p>
          <h1>مشهدك السينمائي، من الفكرة إلى الشاشة</h1>
          <p>تكتب فكرتك، والمشهد يُصنع معك خطوة خطوة في صفحة وحدة، وأنت اللي تعتمد كل شي.</p>
        </header>

        <section className="fs-posters" aria-label="وش تبي تصنع؟">
          <Link href={`${base}/new`} className="fs-poster new">
            <span className="ic" aria-hidden>🎬</span>
            <span className="st">جديد</span>
            <h3>مشهد جديد</h3>
            <p>فكرتك بسطرين، والسيناريست يبدأ معك.</p>
          </Link>
          <Link href={`${base}/series`} className="fs-poster series">
            <span className="ic" aria-hidden>📺</span>
            <span className="st">مع سجاد</span>
            <h3>المسلسل الذكي</h3>
            <p>حلقات ومشاهد، لحالك أو مع فريقك.</p>
          </Link>
          {projects.map((p, i) => (
            <Link key={p.id} href={`${base}/${p.id}`} className="fs-poster" style={{ animationDelay: `${Math.min(i, 8) * 0.05}s` }}>
              <span className="ic" aria-hidden>{stageIcon(p.stage)}</span>
              <span className="st">{stageLabel(p.stage)}</span>
              <h3 className="line-clamp-3">{p.title}</h3>
              <p>آخر تعديل {new Date(p.updated_at).toLocaleDateString("ar-SA")}</p>
            </Link>
          ))}
        </section>

        <section className="fs-glass space-y-3 p-4" aria-label="كيف يمشي المشهد">
          <h2 className="font-black">كيف يمشي المشهد؟</h2>
          <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.filter((s) => s.key !== "story").map((s, i) => (
              <li key={s.key} className="fs-step" style={{ pointerEvents: "none" }}>
                <span className="n">{i + 1}</span>
                <span className="t"><b>{s.icon} {s.label}</b><small>{s.hint}</small></span>
              </li>
            ))}
          </ol>
          <p className="text-xs font-bold text-muted">كل الخطوات في صفحة وحدة: تتقدّم وترجع متى ما تبي، واللي تغيّره ما يعيد إلا اللي يتأثر فيه فعلًا.</p>
        </section>
      </div>
    </div>
  );
}
