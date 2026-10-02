import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireFilmUser } from "@/lib/film/access";
import type { FilmProject } from "@/lib/film/types";
import { FILM_STAGES } from "@config/film";

export const metadata = { title: "صناعة فيلم | نهج علي" };

const STEPS = [
  { icon: "✍️", title: "السيناريست", text: "يفهم قصتك، يسألك الأسئلة المهمة، ويكتب السيناريو مشهدًا مشهدًا." },
  { icon: "🎨", title: "صانع الشيت", text: "تختار الستايل بلقطة من قصتك، ثم الماستر وشيتات الشخصيات والأماكن." },
  { icon: "🎥", title: "المخرج", text: "يقسّم الفيلم لمقاطع، يكتب برومبت كل مقطع، وتولّده وتشاهده." },
  { icon: "🎙️", title: "الأصوات", text: "تصمم صوت كل شخصية، وتحوّل الحوار المشكول إلى كلام." },
  { icon: "📦", title: "التنزيل", text: "كل الملفات مرتبة وجاهزة للمونتاج في البرنامج اللي تحبه." },
];

const stageLabel = (key: string) => FILM_STAGES.find((s) => s.key === key)?.label ?? key;

export default async function FilmHome() {
  const { allowed } = await requireFilmUser("/film");

  if (!allowed) {
    return (
      <div className="card space-y-3 p-6 text-center">
        <p className="text-5xl">🎬</p>
        <h1 className="display text-3xl">صناعة فيلم: قريبًا</h1>
        <p className="font-bold text-muted">هذا القسم تحت التجربة ومتاح للمدعوين فقط حاليًا. بنعلن عنه أول ما يجهز إن شاء الله.</p>
        <Link href="/" className="btn btn-ghost">الرئيسية</Link>
      </div>
    );
  }

  // Read through RLS: the user only ever sees their own projects
  const supabase = await createClient();
  const { data } = await supabase.from("film_projects").select("*").order("updated_at", { ascending: false });
  const projects = (data ?? []) as FilmProject[];

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="display text-4xl">صناعة فيلم من الصفر</h1>
        <p className="font-bold text-muted">تبدأ بفكرتك، والموقع يمشي معك مرحلة مرحلة، وأنت اللي تعتمد كل خطوة.</p>
        <Link href="/film/new" className="btn btn-primary w-full text-xl">ابدأ مشروع فيلم ✨</Link>
      </header>

      <section className="space-y-3">
        <h2 className="display text-2xl">مشاريعي ({projects.length})</h2>
        {projects.length === 0 && <p className="card p-5 font-bold text-muted">ما عندك مشاريع للحين.</p>}
        {projects.map((p) => (
          <Link key={p.id} href={`/film/${p.id}`} className="card flex items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <h3 className="truncate text-lg font-extrabold">{p.title}</h3>
              <p className="text-sm font-bold text-muted">آخر تعديل {new Date(p.updated_at).toLocaleDateString("ar-SA")}</p>
            </div>
            <span className="chip shrink-0">{stageLabel(p.stage)}</span>
          </Link>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="display text-2xl">كيف يمشي المشروع؟</h2>
        <ol className="space-y-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="card flex items-center gap-4 p-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-surface-2 text-2xl">{s.icon}</span>
              <div>
                <h3 className="font-extrabold"><span className="text-gold">{i + 1}.</span> {s.title}</h3>
                <p className="text-sm font-bold text-muted">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
