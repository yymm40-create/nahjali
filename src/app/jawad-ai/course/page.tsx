import type { Metadata } from "next";
import Link from "next/link";
import Riyal from "@/components/Riyal";
import { jawadSession } from "@/lib/jawad/server/access";
import { loadTree, myCourses } from "@/lib/learn/server";
import { COURSE, isLadder, offersAt } from "@config/course";
import { loadSettings } from "@/lib/course/settings";
import { LEARN } from "@config/learn";
import "./course.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "الدورات", description: "دورات الجواد الذكي المسجلة: اختر دورتك واشترك." };

const ICONS = ["🎬", "🎨", "🎙️", "🧠", "📚", "⚡"];
const nowMs = () => Date.now();
const two = (n: number) => String(n).padStart(2, "0");

/** «الدورات»: every course on sale, as cards (a course already bought says so and opens in «دوراتي»). */
export default async function CoursesPage() {
  const [{ user }, list, s] = await Promise.all([jawadSession(), loadTree({ onlyPublished: true }).catch(() => []), loadSettings()]);
  const now = nowMs();
  // the clock course shows today's lowest price (and «قريبًا» before its clock starts); the others their one price
  const priceOf = (c: { id: string; priceSar?: number | null; wasSar?: number | null }) => {
    if (!isLadder(s, c.id)) return { halalas: (c.priceSar ?? 0) * 100, was: c.wasSar && c.wasSar > (c.priceSar ?? 0) ? c.wasSar * 100 : null, soon: false };
    const o = [...offersAt(s, now, c.priceSar ?? 0, c.wasSar ?? 0, c.id).offers].sort((a, b) => a.price - b.price)[0];
    return o ? { halalas: Math.round(o.price * 100), was: o.was > o.price ? Math.round(o.was * 100) : null, soon: false } : { halalas: 0, was: null, soon: true };
  };
  const sale = list.filter((c) => c.priceSar);
  const owned = new Set(user ? (await myCourses(user).catch(() => [])).map((c) => c.id) : []);
  return (
    <div className="cr" dir="rtl">
      <header className="cr-hero">
        <div className="cr-in">
          <span className="cr-kicker cr-reveal">الدورات · {two(sale.length)}</span>
          <h1 className="cr-reveal" style={{ ["--i" as string]: 1 }}>تعلّم تصنع بالذكاء الاصطناعي <em>خطوة بخطوة</em></h1>
          <p className="cr-sub cr-reveal" style={{ ["--i" as string]: 2 }}>دورات مسجلة تشوفها متى ما تبي. اختر الدورة، ادفع بتحويل بنكي، وتنفتح لك في «دوراتي» بعد التأكيد.</p>
          {user && owned.size > 0 && <Link href={LEARN.base} className="cr-btn cr-reveal" style={{ ["--i" as string]: 3 }}>📚 افتح دوراتي ({owned.size})</Link>}
        </div>
      </header>
      <section className="cr-band" style={{ paddingTop: 0 }}>
        <div className="cr-in cr-wide">
          {sale.length ? (
            <ul className="cr-shop-grid">
              {sale.map((c, i) => {
                const mine = owned.has(c.id);
                const lessons = c.days.flatMap((d) => d.lessons).filter((l) => l.status === "ready").length;
                return (
                  <li key={c.id} className="cr-reveal" style={{ ["--i" as string]: i + 3 }}>
                    <Link href={mine ? `${LEARN.base}/${c.id}` : `${COURSE.base}/${c.id}`} className="cr-course">
                      <div className="cr-course-art">
                        <span className="cr-kicker">دورة · {two(i + 1)} / {two(sale.length)}</span>
                        <b aria-hidden>{ICONS[i % ICONS.length]}</b>
                      </div>
                      {mine && <span className="cr-owned">✓ عندك</span>}
                      <h2>{c.title}</h2>
                      {c.summary && <p>{c.summary}</p>}
                      <p className="cr-mute">{isLadder(s, c.id) ? "مباشرة + مسجلة" : `${c.days.length} أيام`}{lessons ? ` · ${lessons} فيديو` : ""}</p>
                      <div className="cr-course-foot">
                        {(() => {
                          const p = priceOf(c);
                          return p.soon ? <span className="cr-mute">🔔 التسجيل يفتح قريبًا</span> : <Riyal halalas={p.halalas} was={p.was} size={22} className="cr-cn" />;
                        })()}
                        <span className="cr-course-go">{mine ? "افتحها" : "التفاصيل والاشتراك"} ←</span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="cr-lead" style={{ textAlign: "center" }}>ما فيه دورات معروضة للبيع الحين. ترقّب قريبًا.</p>
          )}
        </div>
      </section>
    </div>
  );
}
