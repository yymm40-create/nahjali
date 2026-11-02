// «مختبر الموشن» — a note that is only a colour or a text the scene already exposes as a param («خلّ اللون ذهبي»،
// «خلّ لون الخلفية أسود»، «بدّل «هلا» بـ «مرحبا»»): set on the page, with NO call to حيدرا ماكس (the scene reads it with K.p and
// is drawn again with the new value — the same as «✏️ النصوص والألوان»). Anything less sure (two colours it could mean,
// another change in the same note, a word it does not know) is null, and the note goes to حيدرا ماكس as before. Pure.

export interface ParamField {
  id: string;
  label: string;
  type: "text" | "color";
  value: string;
}

/** Arabic as compared here: no diacritics or tatweel, one alef, ة → ه, ى → ي, no hamza on its own, no punctuation. */
const norm = (s: string) =>
  s
    .replace(/[ً-ْٰـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ء/g, "")
    .replace(/[^\p{L}\p{N}#]+/gu, " ")
    .trim()
    .toLowerCase();

/** The colours a note names, as the hex they are set to. */
const COLOURS: Record<string, string> = {
  ذهبي: "#d4af37",
  فضي: "#c0c0c0",
  احمر: "#e53935",
  حمرا: "#e53935",
  ازرق: "#1e88e5",
  زرقا: "#1e88e5",
  اخضر: "#43a047",
  خضرا: "#43a047",
  اصفر: "#fdd835",
  صفرا: "#fdd835",
  اسود: "#000000",
  سودا: "#000000",
  ابيض: "#ffffff",
  بيضا: "#ffffff",
  برتقالي: "#fb8c00",
  بنفسجي: "#8e24aa",
  وردي: "#ec407a",
  زهري: "#ec407a",
  رمادي: "#9e9e9e",
  كحلي: "#1a237e",
  سماوي: "#4fc3f7",
  بني: "#795548",
  عنابي: "#880e4f",
  تركوازي: "#26c6da",
};
// the feminine of the -ي ones (ذهبيه، ورديه…)
for (const [w, hex] of Object.entries(COLOURS)) if (w.endsWith("ي")) COLOURS[`${w}ه`] = hex;

/** The words a colour or text note is made of besides its target and its value (said any way). */
const FILLER = new Set(
  "خل خلي خليه خلها خله اجعل اجعله اجعلها غير غيره غيرها بدل بدله بدلها حط حطه حطها صير صيره صيرها سو سوي سويه سويها اكتب اكتبه اكتبها يكون تكون يصير تصير خلاه الى ل لل ب مكان بدال بدل اللون لون الالوان النص نص الكلام الكتابه الكلمه هو هي ممكن لو سمحت تكفى الحين طيب يا"
    .split(" ")
    .map(norm),
);

/** The colour a word names (also «الذهبي»، «بالذهبي»، «بذهبي»), or null. */
function colourOf(word: string): string | null {
  for (const pre of ["", "ال", "بال", "ب", "لل"]) if (word.startsWith(pre) && COLOURS[word.slice(pre.length)]) return COLOURS[word.slice(pre.length)];
  return null;
}

export interface QuickParams {
  /** all the values with this one set */
  values: Record<string, string>;
  field: ParamField;
  value: string;
}

/** A note read as one param set: its target (named, or not) and its one value. Null when it is surely not only that. */
interface Note {
  named: ParamField | null;
  /** the note says «اللون» / «لون» with no other target (the piece's colour, said plainly) */
  plainColour: boolean;
  colour: { hex: string; said: string } | null;
  quotes: string[];
}

function readNote(message: string, fields: readonly ParamField[]): Note | null {
  const raw = message.trim();
  if (!raw || raw.length > 160 || !fields.length) return null;
  // the quoted words are taken as they are written
  const quotes: string[] = [];
  let rest = ` ${norm(raw.replace(/«([^»]*)»|"([^"]*)"|“([^”]*)”/g, (_, a?: string, b?: string, c?: string) => (quotes.push((a ?? b ?? c ?? "").trim()), " ")))} `;
  // the field the note names by its label (the longest match; the label without «لون» / «النص» counts too)
  let named: ParamField | null = null, hit = "", tie = false;
  for (const f of fields) {
    const full = norm(f.label);
    const core = full.split(" ").filter((w) => !["لون", "اللون", "نص", "النص"].includes(w)).join(" ");
    for (const c of [full, core]) {
      if (c.length < 3 || !rest.includes(` ${c} `)) continue;
      if (c.length > hit.length) [named, hit, tie] = [f, c, false];
      else if (c.length === hit.length && named !== f) tie = true;
    }
  }
  if (tie) return null;
  if (hit) rest = rest.replace(` ${hit} `, " ");
  const words = rest.split(" ").filter(Boolean);
  // a colour: a hex written out, or one colour word
  const hex = /#(?:[0-9a-f]{6}|[0-9a-f]{3})\b/i.exec(raw)?.[0]?.toLowerCase() ?? null;
  const said = words.map((w) => [w, colourOf(w)] as const).filter((x) => x[1]);
  const left = words.filter((w) => !colourOf(w) && !/^#[0-9a-f]{3,6}$/i.test(w));
  // anything else in the note (another change, a target it does not know): not for here
  if (left.some((w) => !FILLER.has(w))) return null;
  const full = hex ? (hex.length === 4 ? `#${[...hex.slice(1)].map((c) => c + c).join("")}` : hex) : null;
  const colours = [...new Set([...(full ? [full] : []), ...said.map((x) => x[1]!)])];
  if (colours.length > 1) return null;
  if (quotes.length && (colours.length || quotes.length > 2 || quotes.some((q) => !q || q.length > 200))) return null;
  return {
    named,
    plainColour: !named && words.some((w) => w === "اللون" || w === "لون"),
    colour: colours.length ? { hex: colours[0], said: hex ?? said[0][0] } : null,
    quotes,
  };
}

/**
 * The piece's accent among its colour params: the one whose own value is the plan's accent, or else the only one whose id
 * or label says so (accent, brand, «التمييز»…). Null when it is not exactly one.
 */
export function accentField(fields: readonly ParamField[], accent?: string): ParamField | null {
  const colours = fields.filter((f) => f.type === "color");
  const byValue = accent ? colours.filter((f) => f.value.trim().toLowerCase() === accent.trim().toLowerCase()) : [];
  if (byValue.length === 1) return byValue[0];
  const byName = colours.filter((f) => /accent|brand|primary|highlight/i.test(f.id) || /تمييز|مميز|اساسي|رئيسي|براند|هويه/.test(norm(f.label)));
  return byName.length === 1 ? byName[0] : null;
}

/**
 * The note as one param set, or null when it is not surely only that. `accent`: the plan's accent colour — a plain
 * «خلّ اللون ذهبي» on a piece with several colours is its accent (the colour a person means by «اللون»).
 */
export function quickParams(message: string, fields: readonly ParamField[], values: Readonly<Record<string, string>>, accent?: string): QuickParams | null {
  const n = readNote(message, fields);
  if (!n) return null;
  const only = (type: ParamField["type"]) => {
    const of = fields.filter((f) => f.type === type);
    return n.named ? (n.named.type === type ? n.named : null) : of.length === 1 ? of[0] : null;
  };
  const set = (field: ParamField | null, value: string): QuickParams | null => (field && value ? { values: { ...values, [field.id]: value }, field, value } : null);

  if (!n.quotes.length) {
    if (!n.colour) return null;
    return set(only("color") ?? (n.plainColour && accent ? accentField(fields, accent) : null), n.colour.hex);
  }
  if (n.quotes.length === 2) {
    // «بدّل «هلا» بـ «مرحبا»»: the text field that now shows the first, if exactly one does
    const was = fields.filter((f) => f.type === "text" && (values[f.id] ?? f.value).trim() === n.quotes[0]);
    return was.length === 1 && (!n.named || n.named === was[0]) ? set(was[0], n.quotes[1]) : null;
  }
  return set(only("text"), n.quotes[0]);
}

/**
 * A note that is surely one colour or one text but names none of the piece's several fields of that kind («خلّه ذهبي»،
 * «اكتب «مرحبا»»): the person picks which, each choice a message that is then set on the page (still no call to حيدرا ماكس).
 * Null when the note is anything else, or already sure.
 */
export function quickChoices(message: string, fields: readonly ParamField[], values: Readonly<Record<string, string>>, accent?: string): string[] | null {
  if (quickParams(message, fields, values, accent)) return null;
  const n = readNote(message, fields);
  if (!n || n.named || n.quotes.length > 1) return null;
  const type = n.quotes.length ? "text" : n.colour ? "color" : null;
  if (!type) return null;
  const of = fields.filter((f) => f.type === type);
  if (of.length < 2) return null;
  return of.slice(0, 6).map((f) => (type === "color" ? `${f.label} ${n.colour!.said}` : `${f.label} «${n.quotes[0]}»`));
}

/** The words a question starts with (Gulf and standard Arabic, English). «ممكن / تقدر …» is a request, not one. */
const ASKS = new Set("هل وش ايش شو شنو كيف وشلون شلون ليش ليه لماذا متى وين اين كم مين منو ماذا what how why when where who which is are does".split(" ").map(norm));
/** The words a greeting or a thanks starts with. */
const HELLO = new Set("هلا هلو مرحبا اهلا السلام سلام هاي صباح مساء شكرا مشكور يعطيك تسلم hi hello hey thanks".split(" ").map(norm));

/**
 * The first message of a lab with nothing in it yet that is surely the brief of a piece — not a question (ends with
 * «؟» or starts with a question word), not a greeting or a thanks, at least three words: it goes straight to the plan
 * as the brief, with no conversation step before it (that step only ever answered «plan» with the same words).
 */
export function plainBrief(message: string): boolean {
  const raw = message.trim();
  if (!raw || /[؟?]\s*$/.test(raw)) return false;
  const words = norm(raw).split(" ").filter(Boolean);
  return words.length >= 3 && !ASKS.has(words[0]) && !HELLO.has(words[0]);
}
