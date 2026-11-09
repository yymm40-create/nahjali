import type { Metadata } from "next";
import Link from "next/link";
import { CREATIVE_BASE, CREATIVE_METHODS } from "@config/jawad/creative";
import "@/components/jawad/landing.css";
import "@/components/jawad/creative/creative.css";

export const metadata: Metadata = {
  title: "طرق إبداعية",
  description: "طرق كاملة لأفلام صنعناها بالذكاء الاصطناعي: الفكرة، والمراجع، وكل برومبت كتبناه حرفيًا، والمونتاج — خطوة بخطوة وتقدر تسويها على شخصيتك.",
};

/** «طرق إبداعية»: the list of full workflows, open to everyone (no sign-in). */
export default function CreativeMethods() {
  return (
    <div className="ld cr" dir="rtl">
      <header className="ld-hero cr-hero">
        <div className="ld-in">
          <span className="ld-eyebrow"><i aria-hidden />الطريقة كاملة · بالبرومبتات</span>
          <h1>
            طرق <span className="ld-grad">إبداعية</span>
          </h1>
          <p className="cr-lead">أفلام صنعناها بالذكاء الاصطناعي، ونفتح لك طريقتها كاملة: الفكرة، والمراجع، وكل برومبت كتبناه حرفيًا، والمونتاج. الشرح بالعربي، والبرومبت بالإنجليزي وتقدر تنسخه.</p>
        </div>
      </header>
      <section className="ld-sec">
        <div className="ld-in">
          <ul className="cr-list">
            {CREATIVE_METHODS.map((m) => (
              <li key={m.slug}>
                <Link href={`${CREATIVE_BASE}/${m.slug}`} className="cr-card">
                  <img src={m.cover} alt="" loading="lazy" />
                  <div>
                    <span className="cr-kick">{m.kicker}</span>
                    <h2>{m.title}</h2>
                    <p>{m.summary}</p>
                    <span className="cr-go">افتح الطريقة ←</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
