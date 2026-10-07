// Who may use what: ONE list, on the dashboard (/admin/limits → «السماح»). An email in it gets the sections ticked for it,
// free and unlimited; everyone else finds them closed. «لأجل المهدي» is not in it: it stays open to everyone.
// The owner and the co-owner (config/site.ts) always have everything. Pure (pages and server alike).

export const PERMS = [
  { key: "image", label: "🖼️ صناعة الصور", hint: "مولّدات الصور في الجواد" },
  { key: "video", label: "🎬 صناعة الفيديو", hint: "مولّدات الفيديو والتعديل الذكي" },
  { key: "voice", label: "🎙️ الأصوات", hint: "قراءة النص وتغيير الصوت" },
  { key: "music", label: "🎵 الموسيقى والمؤثرات", hint: "موسيقى ومؤثرات صوتية" },
  { key: "film", label: "🎞️ صانع الأفلام الذكي", hint: "المشهد القصير والمسلسل الذكي، بكل ما فيهم" },
  { key: "editor", label: "✂️ حيدرة كت", hint: "المحرر نفسه" },
  { key: "editor_ai", label: "🤖 حيدرة (الذكاء الاصطناعي)", hint: "المحادثة مع حيدرة وكل ما يصنعه (كابشن، تلوين، صناعة…)" },
  { key: "student", label: "🎓 الطالب الذكي", hint: "بكل ما فيه (صوره وأصواته معه)" },
  { key: "booklet", label: "📖 كتيب نهج علي", hint: "بلا حد للتجارب" },
] as const;

export type Perm = (typeof PERMS)[number]["key"];
export const ALL_PERMS: Perm[] = PERMS.map((p) => p.key);
export const isPerm = (v: unknown): v is Perm => typeof v === "string" && (ALL_PERMS as string[]).includes(v);
