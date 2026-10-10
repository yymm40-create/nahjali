// Draws the launch pages with fake data (no server): ?view=landing|credits|salman
import { createRoot } from "react-dom/client";
import Landing from "@/components/jawad/Landing";
import CreditsShop from "@/components/jawad/credits/CreditsShop";
import Salman from "@/components/Salman";
import { DEFAULT_CREDIT_SETTINGS } from "@config/credits";
import "../../src/app/jawad-ai/course/course.css";
import "../../src/app/jawad-ai/credits/credits.css";

const q = new URLSearchParams(location.search);
const view = q.get("view") ?? "landing";
const s = DEFAULT_CREDIT_SETTINGS;
const tools = [
  { href: "/jawad-ai/images", icon: "🖼️", name: "صناعة الصور", line: "صور من وصفك أو من صورك، بأي مقاس وجودة.", tint: "#f97316" },
  { href: "/jawad-ai/videos", icon: "🎬", name: "صناعة الفيديو", line: "فيديو من نص أو صورة، بحركة سينمائية وصوت.", tint: "#22d3ee" },
  { href: "/jawad-ai/audio", icon: "🎙️", name: "صناعة الصوت", line: "تعليق صوتي وأصوات وموسيقى ومؤثرات.", tint: "#14b8a6" },
  { href: "/jawad-ai/film", icon: "🎞️", name: "صانع الأفلام", line: "فيلم أو مسلسل من فكرتك، مشهد بمشهد.", tint: "#e9b546" },
  { href: "/jawad-ai/editor", icon: "✂️", name: "حيدرة كت", line: "مونتاج من الجوال أو الكمبيوتر، مع «حيدرة».", tint: "#b8f53d" },
  { href: "/jawad-ai/content", icon: "✍️", name: "صانع المحتوى", line: "«محمد باقر»: كاروسيل وريلز ومحتوى يبيع.", tint: "#f472b6" },
  { href: "/jawad-ai/designer", icon: "🎨", name: "المصمم الذكي", line: "«كاظم»: بطاقات وإعلانات بخطوط عربية.", tint: "#a78bfa" },
  { href: "/jawad-ai/photo", icon: "📸", name: "زهراء فوتو ماستر", line: "«زهراء»: تحرير صورك وتصاميمك بلمسة محترف.", tint: "#fb7185" },
];
const samples = Array.from({ length: 8 }, (_, i) => `/sample${i % 4}.png`);
const root = createRoot(document.getElementById("root")!);
if (view === "landing") root.render(<><Landing loginHref="/jawad-ai/login" samples={samples} tools={tools} models={["GPT Image 2", "Seedance 2.5", "Kling 3", "ElevenLabs v4", "MiniMax Speech", "Nano Banana Pro"]} packs={s.packs} featured={s.featured} /><Salman /></>);
else root.render(<><CreditsShop packs={s.packs} featured={s.featured} payable hasSupport user={q.get("signed") === "1" ? { email: "me@example.com" } : null} balance={350} owner={false} waiting={q.get("waiting") === "1" ? [{ id: "x", packName: "المحترف", price: 119, credit: 140, support: "https://wa.me/1" }] : []} initialPack={q.get("sheet") ? "pro" : null} loginHref="/jawad-ai/login" lastName="" lastPhone="" />{view === "salman" ? null : <Salman />}</>);
