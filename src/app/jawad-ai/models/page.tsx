import Link from "next/link";
import Riyal from "@/components/Riyal";
import { livePages, type ModelPage } from "@/lib/jawad/server/model-pages";
import { MODELS_BASE, OUTPUT_LABEL } from "@config/jawad/model-pages";
import { SITE_URL } from "@config/site";
import "./models.css";

export const metadata = {
  title: "مولدات الذكاء الاصطناعي بالعربي وأسعارها بالريال",
  description: "كل مولدات الصور والفيديو والصوت في الجواد الذكي: GPT Image وNano Banana وSeedance وKling وWan وGemini Omni وElevenLabs — وش يسوي كل واحد، وسعره بالريال، وجرّبه بدون اشتراك.",
};

// the owner's switches, prices and samples change from the dashboard: read again at most every 10 minutes
export const revalidate = 600;

const ICON: Record<ModelPage["output"], string> = { image: "🖼️", video: "🎬", audio: "🎙️" };

function Card({ m }: { m: ModelPage }) {
  return (
    <Link href={`${MODELS_BASE}/${m.id}`} className="md-card">
      {m.sample ? (
        // eslint-disable-next-line @next/next/no-img-element -- a small WebP kept by the CDN (app/files/thumb)
        <img src={m.sample} alt={`مثال من ${m.name}`} width={480} height={360} loading="lazy" decoding="async" />
      ) : (
        <div className="md-ph" aria-hidden>{ICON[m.output]}</div>
      )}
      <div className="md-card-b">
        <span className="md-card-n" dir="ltr" style={{ textAlign: "right" }}>{m.name}</span>
        <span className="md-card-p">
          {m.price != null ? <>من <Riyal halalas={m.price} size={13} /> للـ{m.output === "image" ? "صورة" : m.output === "video" ? "فيديو" : "مقطع"}</> : "السعر يبين لك قبل التوليد"}
        </span>
      </div>
    </Link>
  );
}

/** «المولدات»: every generator live for users, grouped by what it makes, each linking to its own page. */
export default async function ModelsPage() {
  const pages = await livePages();
  const groups = (["image", "video", "audio"] as const).map((k) => ({ k, items: pages.filter((p) => p.output === k) })).filter((g) => g.items.length);
  const ld = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "مولدات الذكاء الاصطناعي في الجواد الذكي",
    itemListElement: pages.map((p, i) => ({ "@type": "ListItem", position: i + 1, url: `${SITE_URL}${MODELS_BASE}/${p.id}`, name: p.name })),
  }).replace(/</g, "\\u003c");
  return (
    <main className="md" dir="rtl">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld }} />
      <nav className="md-crumbs" aria-label="مسار الصفحة">
        <Link href="/jawad-ai">الجواد الذكي</Link> ‹ <span>المولدات</span>
      </nav>
      <h1>مولدات الذكاء الاصطناعي بالعربي</h1>
      <p className="md-lead">
        أشهر مولدات الصور والفيديو والصوت في العالم في مكان واحد، وتكتب لها بالعربي. تدفع بالريال على قد اللي تسويه بدون اشتراك، والسعر يبين لك قبل كل توليد،
        والتوليد اللي يفشل يرجع رصيده.
      </p>
      {groups.map((g) => (
        <section key={g.k}>
          <h2 className="md-h2">مولدات {OUTPUT_LABEL[g.k]}</h2>
          <div className="md-grid">
            {g.items.map((m) => <Card key={m.id} m={m} />)}
          </div>
        </section>
      ))}
      {!pages.length && <p className="md-note">المولدات تنعرض هنا بعد قليل إن شاء الله.</p>}
      <div className="md-actions" style={{ marginTop: 28 }}>
        <Link href="/jawad-ai/images" className="md-cta">افتح الاستوديو الإبداعي ←</Link>
        <Link href="/jawad-ai/credits" className="md-ghost">شوف الباقات</Link>
      </div>
    </main>
  );
}
