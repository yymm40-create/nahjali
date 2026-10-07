import Link from "next/link";
import { redirect } from "next/navigation";
import "@/app/jawad-ai/film/film-theme.css";
import { requireFilmUser } from "@/lib/film/access";
import { listSeries } from "@/lib/film/series";
import NewSeries from "../series/NewSeries";

/** «المسلسل الذكي»: the person's series and the teams they were added to, as big cards to swipe between. */
export default async function SeriesHomeView({ base }: { base: string }) {
  const { user, allowed } = await requireFilmUser(`${base}/series`);
  if (!allowed) redirect(base);
  const all = await listSeries(user.id);
  return (
    <div className="space-y-8">
      <header className="space-y-2 text-center">
        <Link href={base} className="text-sm font-bold text-muted">→ الفيلم السينمائي</Link>
        <p className="text-sm font-extrabold tracking-wide text-muted">📺 استوديو الجواد</p>
        <h1 className="display text-4xl">المسلسل الذكي</h1>
        <p className="font-bold text-muted">مسلسل ← حلقات ← مشاهد. كل مشهد يمرّ بنفس مراحل الفيلم (السيناريست، الشيتات، المخرج، التوليد، المونتاج)، وبعدها تركّب الحلقة من مشاهدها بالترتيب وتضيف المؤثرات والموسيقى.</p>
      </header>

      <section className="space-y-2" aria-label="مسلسلاتي">
        <h2 className="display text-2xl">مسلسلاتي ({all.length})</h2>
        <div className="film-swipe">
          <NewSeries />
          {all.map(({ series, owner }, i) => (
            <Link key={series.id} href={`${base}/series/${series.id}`} className="film-option" data-tone={owner ? undefined : "light"} style={{ animationDelay: `${Math.min(i, 6) * 0.06}s` }}>
              <span className="film-option-icon" aria-hidden>{series.mode === "team" ? "👥" : "📺"}</span>
              <span className="film-option-step">{owner ? (series.mode === "team" ? "فريق" : "فردي") : "مع فريق"}</span>
              <h3 className="line-clamp-2">{series.title}</h3>
              <p>{owner ? `آخر تعديل ${new Date(series.updated_at).toLocaleDateString("ar-SA")}` : "أضافك صاحبه لفريقه: تشتغل على مشاهده ورصيده هو"}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="card space-y-2 p-5">
        <h2 className="text-xl font-extrabold">فردي أو فريق؟</h2>
        <p className="text-sm font-bold leading-7 text-muted">
          <b>فردي:</b> أنت وحدك تشتغل على المسلسل. <b>فريق:</b> تضيف أشخاص باسم المستخدم (@) وتحدد لكل واحد خطواته (مثلًا السيناريست بس) وعدد محاولاته، وكل شي ينصنع داخل المسلسل ينقص من «نقود الفريق الذكي» اللي تشحنها من نقودك.
        </p>
      </section>
    </div>
  );
}
