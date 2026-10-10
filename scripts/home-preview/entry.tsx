// The signed-in home drawn in a plain browser page (screenshots by run.mjs).
import { createRoot } from "react-dom/client";
import Home from "@/components/jawad/Home";

const tools = [
  ["/jawad-ai/images", "صناعة الصور", "🖼️", "صور من وصفك أو من صورك، بأي مقاس وجودة.", "#f97316"],
  ["/jawad-ai/video", "صناعة الفيديو", "🎬", "فيديو من نص أو صورة، بحركة سينمائية وصوت.", "#22d3ee"],
  ["/jawad-ai/film", "الفيلم السينمائي", "🎞️", "فيلم أو مسلسل من فكرتك، مشهد بمشهد.", "#e9b546"],
  ["/jawad-ai/editor", "حيدرة كت", "✂️", "مونتاج من الجوال أو الكمبيوتر، مع «حيدرة».", "#b8f53d"],
  ["/jawad-ai/audio", "صناعة الصوت", "🎙️", "تعليق صوتي وأصوات وموسيقى ومؤثرات.", "#14b8a6"],
  ["/jawad-ai/student", "الطالب الذكي", "🎒", "ملخصات وشرح واختبارات من مادتك.", "#7c3aed"],
  ["/jawad-ai/games", "صانع الألعاب الذكي", "🎮", "«قنبر»: صمّم لعبتك وخلّ الموقع يبنيها وتلعبها برابط.", "#34d399"],
  ["/jawad-ai/content", "صانع المحتوى", "✍️", "«محمد باقر»: كاروسيل وريلز ومحتوى يبيع.", "#f472b6"],
].map(([href, name, icon, line, tint]) => ({ href, name, icon, line, tint }));
const sections = [
  { id: "images", name: "صناعة الصور", path: "/jawad-ai/images", output: "image" as const, implementation: "studio:image" },
  { id: "video", name: "صناعة الفيديو", path: "/jawad-ai/video", output: "video" as const, implementation: "studio:video" },
  { id: "audio", name: "صناعة الصوت", path: "/jawad-ai/audio", output: "audio" as const, implementation: "studio:audio" },
  { id: "film", name: "الفيلم", path: "/jawad-ai/film", output: null, implementation: "film" },
];
const recent = ["/s0.png", "/s1.png", "/s2.png", "/s3.png", "/s0.png"].map((url, i) => ({ url, kind: "image" as const, href: "#", label: `عمل رقم ${i + 1}` }));
createRoot(document.getElementById("root")!).render(<Home first="جواد" owner userId="u1" sections={sections} tools={tools} recent={recent} ads={null} />);
