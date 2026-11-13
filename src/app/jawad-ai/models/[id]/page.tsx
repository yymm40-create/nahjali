import Link from "next/link";
import { notFound } from "next/navigation";
import Riyal from "@/components/Riyal";
import TryModel from "@/components/jawad/models/TryModel";
import { livePage, livePages } from "@/lib/jawad/server/model-pages";
import { MODELS_BASE, OUTPUT_LABEL } from "@config/jawad/model-pages";
import { SITE_URL } from "@config/site";
import "../models.css";

export const revalidate = 600;

/** an amount for a search result line (no coin logo there): «12.5» */
const amount = (halalas: number) => (halalas / 100).toLocaleString("en", { maximumFractionDigits: 2 });

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const m = await livePage((await params).id);
  if (!m) return { title: "غير موجود", robots: { index: false } };
  return {
    title: `${m.name} بالعربي: وش يسوي وكم سعره بالريال`,
    description: `${m.about.slice(0, 120)}${m.price != null ? ` وسعره بالريال في الجواد الذكي يبدأ من ${amount(m.price)}، بدون اشتراك.` : ""}`,
    openGraph: m.sampleLarge ? { images: [{ url: m.sampleLarge }] } : undefined,
  };
}

/** One generator's public page: what it is, its live price, its modes and settings, its sample, and «جرّبه» into the studio. */
export default async function ModelDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [m, all] = await Promise.all([livePage(id), livePages()]);
  if (!m) notFound();
  const related = all.filter((x) => x.output === m.output && x.id !== m.id).slice(0, 6);
  const ld = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "الجواد الذكي", item: `${SITE_URL}/jawad-ai` },
      { "@type": "ListItem", position: 2, name: "المولدات", item: `${SITE_URL}${MODELS_BASE}` },
      { "@type": "ListItem", position: 3, name: m.name, item: `${SITE_URL}${MODELS_BASE}/${m.id}` },
    ],
  }).replace(/</g, "\\u003c");

  return (
    <main className="md" dir="rtl">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld }} />
      <nav className="md-crumbs" aria-label="مسار الصفحة">
        <Link href="/jawad-ai">الجواد الذكي</Link> ‹ <Link href={MODELS_BASE}>المولدات</Link> ‹ <span dir="ltr">{m.name}</span>
      </nav>
      <div className="md-hero">
        <div>
          <span className="md-tag">مولد {OUTPUT_LABEL[m.output]} · <span dir="ltr">{m.provider}</span></span>
          <h1><span dir="ltr">{m.name}</span> بالعربي</h1>
          <p className="md-lead">{m.about}</p>
          {m.price != null ? (
            <div className="md-price">
              <b>من <Riyal halalas={m.price} size={22} /></b>
              <span>{m.priceFor} — بالإعدادات الأساسية. السعر الدقيق يبين لك قبل ما تضغط «توليد»، ويتغير مع الدقة والمدة اللي تختارها.</span>
            </div>
          ) : (
            <div className="md-price"><span>السعر يعتمد على ملفاتك (الصورة أو المقطع اللي ترفعه)، ويبين لك بالضبط قبل ما تضغط «توليد».</span></div>
          )}
          <div className="md-actions">
            <TryModel id={m.id} name={m.name} className="md-cta" />
            <Link href="/jawad-ai/credits" className="md-ghost">شوف الباقات</Link>
          </div>
        </div>
        {m.sampleLarge && (
          // eslint-disable-next-line @next/next/no-img-element -- the owner's own sample, a WebP kept by the CDN (app/files/thumb)
          <img className="md-shot" src={m.sampleLarge} alt={`مثال صنعناه بـ ${m.name}`} width={960} height={720} fetchPriority="high" decoding="async" />
        )}
      </div>

      {m.best.length > 0 && (
        <section>
          <h2 className="md-h2">أفضل استخدامات <span dir="ltr">{m.name}</span></h2>
          <ul className="md-chips">{m.best.map((b) => <li key={b}>{b}</li>)}</ul>
        </section>
      )}

      <section>
        <h2 className="md-h2">طرق الاستخدام في الجواد</h2>
        <ul className="md-chips">{m.modes.map((x) => <li key={x}>{x}</li>)}</ul>
      </section>

      {m.options.length > 0 && (
        <section>
          <h2 className="md-h2">الإعدادات اللي تقدر تختارها</h2>
          <ul className="md-list">
            {m.options.map((o) => (
              <li key={o.label}>
                <b>{o.label}</b>
                <span dir="auto">{o.values}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="md-h2">يفهم العربي؟</h2>
        <p className="md-note">
          {m.arabic ? "إيه، تقدر تكتب له وصفك بالعربي مباشرة." : "يفهم الإنجليزي أحسن، فالجواد يساعدك تكتب الوصف بالإنجليزي من كلامك العربي."}
          {m.arabicNote ? ` ${m.arabicNote}` : ""}
        </p>
      </section>

      <section>
        <h2 className="md-h2">كيف تدفع؟</h2>
        <p className="md-note">بدون اشتراك شهري: تشحن رصيدك بالريال (مدى، فيزا، ماستركارد، Apple Pay) وتدفع على قد كل توليد. أي توليد يفشل يرجع رصيده لك تلقائيًا.</p>
      </section>

      {related.length > 0 && (
        <section>
          <h2 className="md-h2">مولدات {OUTPUT_LABEL[m.output]} ثانية</h2>
          <div className="md-grid">
            {related.map((r) => (
              <Link key={r.id} href={`${MODELS_BASE}/${r.id}`} className="md-card">
                <div className="md-card-b">
                  <span className="md-card-n" dir="ltr" style={{ textAlign: "right" }}>{r.name}</span>
                  <span className="md-card-p">{r.price != null ? <>من <Riyal halalas={r.price} size={13} /></> : "السعر يبين قبل التوليد"}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
