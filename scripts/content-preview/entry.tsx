// Draws the table of carousel styles (and, with ?fonts=1, the list of fonts) with its real data (no server): node scripts/content-preview/run.mjs
import { createRoot } from "react-dom/client";
import "@/app/jawad-ai/content/content.css";
import { Questions } from "@/components/jawad/content/ContentChat";
import { CAROUSEL_NICHES, CAROUSEL_STYLES, carouselSample } from "@config/content-carousel-styles";
import { CONTENT_FONTS, FONT_GROUPS } from "@config/content-fonts";

const carousels = CAROUSEL_STYLES.map((s) => ({ id: s.id, n: s.n, niche: s.niche, name: s.name, description: s.description, bestFor: s.bestFor, winner: !!s.winner, realistic: !!s.photoIdea, cover: carouselSample(s, "cover"), slide: carouselSample(s, "slide"), ...(s.font ? { font: s.font } : {}) }));
const fonts = CONTENT_FONTS.map((f) => ({ id: f.id, name: f.name, group: f.group, feel: f.feel, bestFor: f.bestFor, top: !!f.top, ...(f.seen ? { seen: f.seen } : {}) }));
const q = new URLSearchParams(location.search);
const options = q.get("rec") ? q.get("rec")!.split(",") : [];
const batch = q.get("batch") === "1";
const fontsQ = q.get("fonts") === "1";

createRoot(document.getElementById("root")!).render(
  <div className="ct" style={{ overflow: "visible", padding: 12 }}>
    <div className="ct-msg bot" style={{ maxWidth: 900, margin: "0 auto" }}>
      <p>تمام، قبل نبدأ اختر شكل الكاروسيل.</p>
      <Questions
        questions={[...(batch ? [{ label: "المنصة", kind: "choice" as const, options: ["انستغرام", "لينكدإن"], multi: false }] : []), fontsQ ? { label: "اختر الخط", kind: "fonts" as const, options, multi: false } : { label: "اختر ستايل الكاروسيل", kind: "carousels" as const, options, multi: false }]}
        gal={{ templates: [], styles: [], carousels, niches: [...CAROUSEL_NICHES], fonts, fontGroups: [...FONT_GROUPS] }}
        styleId={fontsQ ? "soft-3d" : null}
        disabled={false}
        onSend={(t) => { document.getElementById("log")!.textContent = t; }}
        onWrite={() => {}}
      />
      <pre id="log" style={{ color: "#fff", whiteSpace: "pre-wrap" }} />
    </div>
  </div>,
);
