// «🗺️ ساعدني أكتبها»: the film maker's story map. Instead of a blank box, the person answers one question per station
// (hook → setup → escalation → the turn → the ending) with an example under each; the answers become an ordinary story
// text (the same field the screenwriter and سجاد read), and that text is read back into the map when it is reopened.
// For a short scene the stations carry their seconds, scaled to its length (60 s: 0–6, 6–16, 16–32, 32–47, 47–60).

export type StationId = "hook" | "setup" | "rise" | "turn" | "end";

export interface Station {
  id: StationId;
  name: string;
  question: string;
  hint: string;
  example: string;
  /** where it ends, as a share of the whole length */
  until: number;
}

export const STATIONS: Station[] = [
  { id: "hook", name: "الخطاف", question: "وش أول صورة أو صوت يشد المشاهد؟", hint: "ابدأ من نص اللحظة، مو من أولها. خله يسأل: وش صاير؟", example: "صوت مطرقة الساعة ٣ الفجر. ولد يفتح عينه.", until: 0.1 },
  { id: "setup", name: "التأسيس", question: "مين البطل؟ وين هو؟ ووش يبي؟", hint: "شخص واحد ورغبة وحدة. المشاهد ما يحتاج يعرف كل شي.", example: "عمره ٨ سنين. دراجته انكسرت أمس، وسباق المدرسة الصبح.", until: 16 / 60 },
  { id: "rise", name: "التصعيد", question: "وش يصعّب عليه الموضوع… ويزيد كل لقطة؟", hint: "لو شلت لقطة وما تغيّر شي في القصة، فهي زايدة.", example: "يدوّر على الدراجة… مو موجودة. يحسب أحد أخذها. يركض للكراج.", until: 32 / 60 },
  { id: "turn", name: "الانقلاب", question: "وش اللحظة اللي تغيّر معنى كل اللي قبلها؟", hint: "انقلاب واحد بس: كشف، أو فقد، أو مفاجأة.", example: "يلقى أبوه نايم على الأرض جنبها. مصلّحة. وإيده ملفوفة.", until: 47 / 60 },
  { id: "end", name: "النتيجة", question: "وش آخر صورة تبقى في راس المشاهد؟", hint: "لقطة بدون شرح تقول كل شي، أو سؤال يخليه يعيد.", example: "في السباق يلتفت للمدرج… أبوه يلوّح له بنفس الإيد.", until: 1 },
];

export const IDEA_LABEL = "الفكرة";
export const IDEA_EXAMPLE = "أب يسهر الليل يصلّح دراجة ولده قبل السباق.";

export type StoryMapAnswers = { idea: string } & Record<StationId, string>;

export const emptyMap = (): StoryMapAnswers => ({ idea: "", hook: "", setup: "", rise: "", turn: "", end: "" });

const AR = "٠١٢٣٤٥٦٧٨٩";
export const arNum = (n: number) => String(n).replace(/\d/g, (d) => AR[Number(d)]);

/** Each station's seconds for a scene of this length («٠–٦»), or null when there is no length (a film, a series). */
export function stationSeconds(durationSec: number | null): ([number, number] | null)[] {
  if (!durationSec || durationSec <= 0) return STATIONS.map(() => null);
  let from = 0;
  return STATIONS.map((s) => {
    const to = s.until === 1 ? durationSec : Math.round(durationSec * s.until);
    const r: [number, number] = [from, to];
    from = to;
    return r;
  });
}

export const secondsLabel = (r: [number, number] | null) => (r ? `الثانية ${arNum(r[0])}–${arNum(r[1])}` : "");

const lineHead = (i: number, s: Station, r: [number, number] | null) => `${arNum(i + 1)}. ${s.name}${r ? ` (${secondsLabel(r)})` : ""}:`;

/** The answers as the story text. Empty stations are left out. */
export function composeStory(a: StoryMapAnswers, durationSec: number | null): string {
  const secs = stationSeconds(durationSec);
  const parts: string[] = [];
  if (a.idea.trim()) parts.push(`${IDEA_LABEL}: ${a.idea.trim()}`);
  const lines = STATIONS.map((s, i) => (a[s.id].trim() ? `${lineHead(i, s, secs[i])} ${a[s.id].trim()}` : "")).filter(Boolean);
  if (lines.length) parts.push(lines.join("\n"));
  return parts.join("\n\n");
}

/** A story written on the map, read back into its answers; null when the text was not written on the map. */
export function parseStory(text: string): StoryMapAnswers | null {
  const out = emptyMap();
  let current: keyof StoryMapAnswers | null = null;
  let found = false;
  for (const line of text.split("\n")) {
    const idea = line.match(new RegExp(`^${IDEA_LABEL}:\\s*(.*)$`));
    const st = line.match(/^[١-٥1-5]\.\s*([^:(]+?)\s*(?:\([^)]*\))?\s*:\s*(.*)$/);
    const station = st ? STATIONS.find((s) => s.name === st[1].trim()) : undefined;
    if (idea) {
      current = "idea";
      out.idea = idea[1];
      found = true;
    } else if (st && station) {
      current = station.id;
      out[station.id] = st[2];
      found = true;
    } else if (current && line.trim()) {
      out[current] = `${out[current]}\n${line}`;
    }
  }
  if (!found) return null;
  for (const k of Object.keys(out) as (keyof StoryMapAnswers)[]) out[k] = out[k].trim();
  return out;
}
