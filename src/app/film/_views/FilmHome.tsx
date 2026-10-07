import Link from "next/link";
import "@/app/jawad-ai/film/film-theme.css";
import { createClient } from "@/lib/supabase/server";
import { filmTrialApplies, filmTrialState, requireFilmUser } from "@/lib/film/access";
import { accessMode } from "@/lib/film/limits";
import type { FilmProject } from "@/lib/film/types";
import { FILM_STAGES } from "@config/film";


const STEPS = [
  { icon: "✍️", title: "السيناريست", text: "يفهم قصتك، يسألك الأسئلة المهمة، ويكتب السيناريو مشهدًا مشهدًا." },
  { icon: "🎨", title: "صانع الشيت", text: "تختار الستايل بلقطة من قصتك، ثم الماستر وشيتات الشخصيات والأماكن." },
  { icon: "🎥", title: "المخرج", text: "يقسّم الفيلم لمقاطع، يكتب برومبت كل مقطع، وتولّده وتشاهده." },
  { icon: "🎙️", title: "الأصوات", text: "تصمم صوت كل شخصية، وتحوّل الحوار المشكول إلى كلام." },
  { icon: "📦", title: "التنزيل", text: "كل الملفات مرتبة وجاهزة للمونتاج في البرنامج اللي تحبه." },
];

const stageLabel = (key: string) => FILM_STAGES.find((s) => s.key === key)?.label ?? key;

export default async function FilmHomeView({ base }: { base: string }) {
  const { user, allowed } = await requireFilmUser(base);

  if (!allowed) {
    return (
      <div className="card space-y-3 p-6 text-center">
        <p className="text-5xl">🎬</p>
        {(await filmTrialApplies(user)) && (await filmTrialState(user)) === "done" ? (
          <>
            <h1 className="display text-3xl">انتهت تجربتك المجانية 🎉</h1>
            <p className="font-bold text-muted">شكرًا لك على التجربة! صانع الفيلم مقفل حاليًا، وبنعلن أول ما يرجع إن شاء الله.</p>
          </>
        ) : (await accessMode("film")) === "trial" ? (
          <>
            <h1 className="display text-3xl">صانع الفيلم مقفل حاليًا</h1>
            <p className="font-bold text-muted">اكتمل عدد المجرّبين في الفترة المجانية. بنعلن أول ما يرجع إن شاء الله.</p>
          </>
        ) : (
          <>
            <h1 className="display text-3xl">صناعة فيلم: قريبًا</h1>
            <p className="font-bold text-muted">هذا القسم تحت التجربة ومتاح للمدعوين فقط حاليًا. بنعلن عنه أول ما يجهز إن شاء الله.</p>
          </>
        )}
        <Link href={base === "/film" ? "/" : "/jawad-ai"} className="btn btn-ghost">الرئيسية</Link>
      </div>
    );
  }

  // Read through RLS: the user only ever sees their own projects
  const supabase = await createClient();
  const { data } = await supabase.from("film_projects").select("*").order("updated_at", { ascending: false });
  // a series' scenes live in their series («المسلسل الذكي»)
  const projects = ((data ?? []) as FilmProject[]).filter((p) => !p.series_id);

  return (
    <div className="space-y-8">
      <header className="space-y-2 text-center">
        <p className="text-sm font-extrabold tracking-wide text-muted">🎞️ استوديو الجواد</p>
        <h1 className="display text-4xl">صناعة فيلم من الصفر</h1>
        <p className="font-bold text-muted">تبدأ بفكرتك، والموقع يمشي معك مرحلة مرحلة، وأنت اللي تعتمد كل خطوة.</p>
      </header>

      {/* the choices, as big cards to swipe between */}
      <section className="space-y-2" aria-label="مشاريعي">
        <h2 className="display text-2xl">مشاريعي ({projects.length})</h2>
        <div className="film-swipe">
          <Link href={`${base}/new`} className="film-option" data-tone="gold">
            <span className="film-option-icon" aria-hidden>🎬</span>
            <span className="film-option-step">جديد</span>
            <h3>ابدأ مشروع فيلم ✨</h3>
            <p>اكتب فكرتك بسطرين، والسيناريست يبدأ معك.</p>
          </Link>
          <Link href={`${base}/series`} className="film-option" data-tone="light">
            <span className="film-option-icon" aria-hidden>📺</span>
            <span className="film-option-step">المسلسل الذكي</span>
            <h3>مسلسل: حلقات ومشاهد</h3>
            <p>كل مشهد يمرّ بنفس المراحل، وتركّب الحلقة من مشاهدها. لحالك أو مع فريقك.</p>
          </Link>
          {projects.map((p, i) => (
            <Link key={p.id} href={`${base}/${p.id}`} className="film-option" style={{ animationDelay: `${Math.min(i, 6) * 0.06}s` }}>
              <span className="film-option-icon" aria-hidden>{FILM_STAGES.find((s) => s.key === p.stage)?.icon ?? "🎞️"}</span>
              <span className="film-option-step">{stageLabel(p.stage)}</span>
              <h3 className="line-clamp-2">{p.title}</h3>
              <p>آخر تعديل {new Date(p.updated_at).toLocaleDateString("ar-SA")}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-2" aria-label="كيف يمشي المشروع">
        <h2 className="display text-2xl">كيف يمشي المشروع؟</h2>
        <div className="film-swipe">
          {STEPS.map((s, i) => (
            <div key={s.title} className="film-option" data-tone="light" style={{ animationDelay: `${i * 0.07}s` }}>
              <span className="film-option-icon" aria-hidden>{s.icon}</span>
              <span className="film-option-step">{i + 1}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
