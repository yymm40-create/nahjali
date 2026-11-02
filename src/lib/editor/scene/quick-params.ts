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

/** The note as one param set, or null when it is not surely only that. */
export function quickParams(message: string, fields: readonly ParamField[], values: Readonly<Record<string, string>>): QuickParams | null {
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
  const only = (type: ParamField["type"]) => {
    const of = fields.filter((f) => f.type === type);
    return named ? (named.type === type ? named : null) : of.length === 1 ? of[0] : null;
  };
  const set = (field: ParamField | null, value: string): QuickParams | null => (field && value ? { values: { ...values, [field.id]: value }, field, value } : null);

  if (!quotes.length) {
    const colours = [...new Set([...(hex ? [hex.length === 4 ? `#${[...hex.slice(1)].map((c) => c + c).join("")}` : hex] : []), ...said.map((x) => x[1]!)])];
    return colours.length === 1 ? set(only("color"), colours[0]) : null;
  }
  if (hex || said.length || quotes.length > 2 || quotes.some((q) => !q || q.length > 200)) return null;
  if (quotes.length === 2) {
    // «بدّل «هلا» بـ «مرحبا»»: the text field that now shows the first, if exactly one does
    const was = fields.filter((f) => f.type === "text" && (values[f.id] ?? f.value).trim() === quotes[0]);
    return was.length === 1 && (!named || named === was[0]) ? set(was[0], quotes[1]) : null;
  }
  return set(only("text"), quotes[0]);
}
