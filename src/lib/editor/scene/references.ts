// «مختبر الموشن» — what the person hands حيدرة beside the brief: REFERENCES (pictures and videos to take from or be
// inspired by; a video reaches him as frames in order, with their times, so he reads its pacing and moves) and WEB
// RESEARCH (a real search, like Claude's own, when they ask him to look something up or the answer needs fresh facts).

import type { ClaudePart } from "@/lib/film/anthropic";

export interface LabRef {
  kind: "image" | "video";
  name: string;
  /** a video's length in seconds (0 for a picture) */
  seconds: number;
  /** what the person wants from it: take it as it is («use») or only its spirit («inspire») */
  use: "use" | "inspire";
  frames: { t: number; data: string }[];
}

/** The most frames all the references may send together (a video's frames count one each). */
export const REF_FRAMES_MAX = 12;
export const REFS_MAX = 6;

const jpeg = (v: unknown) => (typeof v === "string" && /^[A-Za-z0-9+/=]+$/.test(v) && v.length < 900_000 ? v : null);
const clean = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);

/** The references of a request: the new list (`refs`), and the old drawer's pictures (`references`, plain JPEGs). */
export function readRefs(b: Record<string, unknown>): LabRef[] {
  const out: LabRef[] = [];
  for (const r of Array.isArray(b.refs) ? b.refs : []) {
    const o = (r ?? {}) as Record<string, unknown>;
    const frames = (Array.isArray(o.frames) ? o.frames : [])
      .map((f) => {
        const x = (f ?? {}) as Record<string, unknown>;
        const data = jpeg(typeof f === "string" ? f : x.data);
        return data ? { t: Math.max(0, Number(x.t) || 0), data } : null;
      })
      .filter((f): f is { t: number; data: string } => Boolean(f));
    if (!frames.length) continue;
    const video = o.kind === "video";
    out.push({ kind: video ? "video" : "image", name: clean(o.name, 80), seconds: video ? Math.max(0, Number(o.seconds) || 0) : 0, use: o.use === "use" ? "use" : "inspire", frames: video ? frames.slice(0, 8) : frames.slice(0, 1) });
  }
  for (const d of (Array.isArray(b.references) ? b.references : []).map(jpeg)) if (d) out.push({ kind: "image", name: "", seconds: 0, use: "inspire", frames: [{ t: 0, data: d }] });
  // the budget: every reference keeps at least its first frame, then the videos' others in turn while frames remain
  const refs = out.slice(0, REFS_MAX);
  let left = REF_FRAMES_MAX - refs.length;
  return refs.map((r) => {
    const extra = Math.max(0, Math.min(r.frames.length - 1, left));
    left -= extra;
    return { ...r, frames: r.frames.slice(0, 1 + extra) };
  });
}

/** How the references are read (said once, before them). */
export function refsText(refs: LabRef[]) {
  if (!refs.length) return "";
  const inspire = refs.some((r) => r.use === "inspire"), use = refs.some((r) => r.use === "use");
  return `THE PERSON'S REFERENCES: ${refs.length} below (${refs.map((r, i) => `${i + 1} = ${r.kind === "video" ? `a video${r.name ? ` «${r.name}»` : ""}, ${r.seconds.toFixed(1)} s, ${r.frames.length} frames in order` : `a picture${r.name ? ` «${r.name}»` : ""}`} · ${r.use === "use" ? "TAKE FROM IT" : "INSPIRATION"}`).join("; ")}).
${inspire ? "INSPIRATION: take its colours, type, layout, pacing, camera, transitions and finish — never its content, words, logos or people (the skill's reference protocol). Say in the plan what you took from which reference. " : ""}${use ? "TAKE FROM IT: the person wants this reference followed closely — rebuild its look, its structure and its moves (shot by shot for a video: what each frame shows, when it changes and how) with THEIR brief's words and content, never the reference's own text, logos or people. " : ""}A video's frames are in time order with their seconds: read from them its rhythm (how long each shot holds), how things enter and leave, and the cut between them.`;
}

/** The references as parts of a turn: a label, then each picture (a video's frames with their times). */
export function refsParts(refs: LabRef[]): ClaudePart[] {
  return refs.flatMap((r, i): ClaudePart[] =>
    r.kind === "video"
      ? r.frames.flatMap((f, j): ClaudePart[] => [{ type: "text", text: `REFERENCE ${i + 1} (video) · frame ${j + 1}/${r.frames.length} at ${f.t.toFixed(1)} s:` }, { type: "image64", data: f.data, mediaType: "image/jpeg" }])
      : [{ type: "text", text: `REFERENCE ${i + 1} (picture):` }, { type: "image64", data: r.frames[0].data, mediaType: "image/jpeg" }],
  );
}

/** The web research the page brings with a request (found by `lab_search`), as it is told to حيدرة. */
export function researchText(b: Record<string, unknown>) {
  const r = clean(b.research, 7000);
  return r ? `WEB RESEARCH (a real web search, done just now because the person asked for it or the answer needed fresh facts — use what it found, and never invent beyond it):\n${r}` : "";
}

/** «ابحث عن…»، «وش الترند…»: a message that asks to look something up on the web. */
export const asksToSearch = (message: string) =>
  /(^|\s)(ابحث|إبحث|دوّ?ر(لي)?|فتّ?ش|بحث|قوقل|جوجل|google|search)(\s|$)|ترند|الرائج|الأشهر الحين|أحدث|آخر (الأخبار|الإحصائيات|الأرقام)|وش (يقولون|صار)|من النت|في النت|بالنت|الإنترنت/i.test(message);

export const SEARCH_SYSTEM = `You are the web researcher of حيدرة, a motion designer in a video editor. The person asked something that needs the web (a fact, a number, a trend, how a brand or a style looks, what is viral now, a reference to find). Search, then answer in Gulf Arabic, short and concrete (at most ~220 words): the facts, numbers and names that matter for the motion piece, each from what you actually found; when it is about a look or a style, describe it so a designer can build it (colours, type, layout, moves). Never invent a fact, a number or a source. If the search found nothing useful, say so in one line.`;

/** What is searched for: the person's words, with the piece in hand so the search fits it. */
export function searchPrompt(b: Record<string, unknown>) {
  const q = clean(b.query, 1500);
  const about = clean(b.about, 600);
  return `THE PERSON'S REQUEST: ${q}${about ? `\nTHE PIECE THEY ARE MAKING: ${about}` : ""}\nSearch the web for what they need (in English and Arabic as fits), then answer as told.`;
}
