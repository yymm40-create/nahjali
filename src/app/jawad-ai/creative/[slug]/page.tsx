import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CREATIVE_BASE, CREATIVE_METHODS, creativeMethod } from "@config/jawad/creative";
import PromptBox from "@/components/jawad/creative/PromptBox";
import "@/components/jawad/landing.css";
import "@/components/jawad/creative/creative.css";

export const generateStaticParams = () => CREATIVE_METHODS.map((m) => ({ slug: m.slug }));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const m = creativeMethod((await params).slug);
  if (!m) return { title: "طرق إبداعية" };
  return { title: `${m.kicker}: ${m.title}`, description: m.summary, openGraph: { images: [m.cover] } };
}

const AR = "٠١٢٣٤٥٦٧٨٩";
/** Arabic text with the English bits (@img1, Seedance 2.0, STYLE…) kept left-to-right inside it. */
const rich = (t: string) => t.split(/([A-Za-z@][A-Za-z0-9@.\- ]*[A-Za-z0-9])/).map((x, i) => (i % 2 ? <bdi key={i} dir="ltr">{x}</bdi> : x));
const num = (n: number) => String(n).replace(/\d/g, (d) => AR[Number(d)]);

/** One full workflow: the film, the key facts, the numbered steps with their references and copyable prompts, fixes and questions. */
export default async function CreativeMethodPage({ params }: { params: Promise<{ slug: string }> }) {
  const m = creativeMethod((await params).slug);
  if (!m) notFound();
  return (
    <div className="ld cr" dir="rtl">
      <header className="ld-hero cr-hero cr-hero-m">
        <div className="ld-in cr-top">
          <div className="cr-intro">
            <Link href={CREATIVE_BASE} className="cr-back">→ طرق إبداعية</Link>
            <span className="ld-eyebrow"><i aria-hidden />{m.kicker}</span>
            <h1>{m.title}</h1>
            <p className="cr-lead">{m.summary}</p>
            <dl className="cr-facts">
              {m.facts.map((f) => (
                <div key={f.k}>
                  <dt>{f.k}</dt>
                  <dd>{f.v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <video className="cr-film" src={m.film.src} poster={m.film.poster} controls playsInline preload="none" />
        </div>
      </header>

      <div className="ld-in cr-body">
        <nav className="cr-toc" aria-label="الخطوات">
          <b>الخطوات</b>
          <ol>
            {m.steps.map((s, i) => (
              <li key={s.title}><a href={`#step-${i + 1}`}>{num(i + 1)}. {s.title}</a></li>
            ))}
            <li><a href="#fixes">مشاكل وحلولها</a></li>
            <li><a href="#faq">أسئلة</a></li>
          </ol>
        </nav>

        <main className="cr-main">
          {m.steps.map((s, i) => (
            <section key={s.title} id={`step-${i + 1}`} className="cr-step">
              <h2><span className="cr-n">{num(i + 1)}</span>{s.title}</h2>
              {s.body.map((t) => <p key={t}>{rich(t)}</p>)}
              {s.table && (
                <div className="cr-table">
                  <table>
                    <thead><tr>{s.table.head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
                    <tbody>{s.table.rows.map((r) => <tr key={r[0]}>{r.map((c, j) => <td key={j} dir={c.match(/^[A-Za-z]/) ? "ltr" : undefined}>{c}</td>)}</tr>)}</tbody>
                  </table>
                </div>
              )}
              {s.images?.length ? (
                <div className="cr-imgs">
                  {s.images.map((im) => (
                    <figure key={im.src} className={im.wide ? "wide" : undefined}>
                      <img src={im.src} alt={im.alt} loading="lazy" />
                      <figcaption>{im.alt}</figcaption>
                    </figure>
                  ))}
                </div>
              ) : null}
              {s.tip && <p className="cr-tip">💡 {rich(s.tip)}</p>}
              {s.prompts?.map((p) => <PromptBox key={p.label} p={p} />)}
            </section>
          ))}

          <section id="fixes" className="cr-step">
            <h2>مشاكل وحلولها</h2>
            <ul className="cr-fixes">
              {m.fixes.map((f) => (
                <li key={f.problem}><b>{rich(f.problem)}</b><span>{rich(f.fix)}</span></li>
              ))}
            </ul>
          </section>

          <section id="faq" className="cr-step">
            <h2>أسئلة</h2>
            {m.faq.map((f) => (
              <details key={f.q} className="cr-faq">
                <summary>{f.q}</summary>
                <p>{rich(f.a)}</p>
              </details>
            ))}
          </section>

          <section className="cr-cta">
            <h2>جاهز تسويه على شخصيتك؟</h2>
            <p>كل الخطوات داخل منصة الجواد: الصور والفيديو في الاستوديو الإبداعي، والمونتاج في حيدرة كت.</p>
            <div className="cr-btns">
              <Link href="/jawad-ai/images" className="cr-btn">🎨 الاستوديو الإبداعي</Link>
              <Link href="/jawad-ai/editor" className="cr-btn ghost">✂️ حيدرة كت</Link>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
