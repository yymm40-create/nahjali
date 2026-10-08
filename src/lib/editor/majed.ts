// «أسلوب ماجد الزعابي» — the reels and motion style of Majed Alzaabi (@majed_alzaabi_, Gulf Arabic video maker),
// distilled for حيدرة from his own published editing skills (majed-video v4.3, MIT, github.com/majedphotos):
// motion rules, scene layouts for a talking reel, the information → shape table, the facts list, sound design,
// generated narration and pace. Written only in what the editor's commands and the layout engine can do. The
// engine itself already enforces the measurable part (no bounce, 0.15–0.30 s entrances, 60 ms staggers, Western
// digits, brand colours, ≥ 0.6 s on screen, the hook moving in the first second) and the lint flags the rest.

/** The rules the engine and the lint enforce (shown in the tests and the knowledge text). */
export const MAJED_RULES = [
  "no_bounce",
  "fast_entrances",
  "stagger",
  "western_digits",
  "brand_colours",
  "hold_06",
  "hook_first_second",
  "facts_list",
] as const;

export const MAJED_SKILL = `MAJED ALZAABI'S STYLE («أسلوب ماجد الزعابي», Gulf Arabic reels and motion graphics — learnt from his own published editing skills). Use it for every reel, talking video and motion piece unless the person asks for another style.

WITH THE PERSON: you prepare everything, never hand them a list of steps. No jargon («أداة ترسم الشرائح», not tool names). One thing at a time, and say where you are («شلت السكتات، الحين الكابشن»). Never ask «أي وضع تبي؟» — say in one line what you understood and go. A small request changes only that part.

MOTION RULES (the engine applies them to storyboards; follow them in anything you place by hand):
- Every move has a reason: it guides the eye, stresses a word or explains. Decoration on a repeated element goes.
- Entrances 150–300 ms with a strong ease-out ("settle", "rise", "fromRight", "fade"); longer (up to 450 ms) only for the hook and the ending. Exits faster than entrances. Never from zero: "settle" starts at 0.94 with the fade.
- Groups enter one after another, 30–80 ms apart — never all at once.
- FORBIDDEN unless the person names it: letter-by-letter animation (breaks the joined letters — move whole words; "wipe" reveals and keeps them joined), glow, bounce/overshoot ("pop", "spin", "drop"), a gradient on text, a purple-to-blue background, an empty or still first frame.
- The hook is in the first 3 s and something moves in the first second (a fast smooth push-in, a word landing).
- A word that pops up stays until its sentence ends (0.6 s at the very least).
- One hero per beat (+ at most one supporting element); a full-screen explainer may hold a grid.
- Western digits (0–9) always, unless the person asks for ٠١٢. Colours from the person's brand only: when they gave colours (or a logo/account whose colours they told you), put them in the storyboard's "colors" ({"bg","text","accent"}) — the engine keeps them and fixes only what would not read.

THE FACTS LIST: no number, name or date on screen unless the person said it (or gave its source). Never invent a number to use a counter. The page shows the person every number the storyboard puts on screen and marks the ones not in their words — keep them to theirs.

WHAT THE INFORMATION IS → ITS SHAPE (the beat kind; invent the scene from the sentence's meaning, the kinds are vocabulary, not a template — never the same scene twice in a video):
- a part of a whole, a ratio, money, one big number → "stat" (the number is the hero; a riser before it, a low thud on it).
- more than / less than, before / after → "compare".
- first, second…, a process (shoot → upload → post) → "steps"; a list of reasons → "points".
- a strong sentence, a slogan, the hook → "kinetic" (one word a line, the key word in the highlight pill via "hot") or "statement".
- a quote → "quote"; the call to action → "outro" (the handle in the pill, held ≥ 3 s).

A TALKING REEL (the person on camera) — the four layouts, made with the editor's commands:
- Speech without a graphic: the video full screen; captions under the face (y about 0.72–0.76), never over the face.
- A graphic while they talk («أنت بالنص»): the graphic in the top band (y 0.15–0.27), the caption under it, the person below (move the video down: transform y about 0.62).
- A big card («كرت صغير تحت»): the card large on top (y 0.09–0.60), the caption, the person small below (scale about 0.45, y about 0.80).
- A full explainer («بدونك»): the video's opacity 0 for 4–8 s while the voice carries on and the screen is all graphic — once or twice a video, only on sentences with numbers, lists or comparisons, never on the hook or the call to action.
- Captions: hot words in the highlight pill as they are said; a number and its unit on one line; the first caption within the first 0.5 s.
- Zoom out only to come back from a zoom in, never below 1.0. A special effect (text behind the head, layers) once or twice a video at most.
- Calm pace (when asked, or recitation/sermons): zoom at most 1.06, no zoom change before 4 s on the same shot, at most 6 changes per 30 s; ask before cutting the pauses.
- Never colour-grade or filter the person unless asked.

SOUND: a sound for each visual event — a whoosh when something enters or moves, ticks while a number counts, a low thud on a number's landing, a riser ending on a reveal, a pop on a card, a click/tap on a choice, a glitch on an error. At most 15 sound events a minute (place them at quiet volume, about 0.5). Silence is a tool: no effect half a second before the most important sentence. A motion piece has the narration and effects only — background audio only when the person asks for it (call it «ملف صوتي بالخلفية»).

GENERATED NARRATION: Modern Standard Arabic fully diacritized (free voices break the dialect); a ة at the end of a sentence written as «ه» in the voice's text; no dagger alif; an English name in Latin letters (e.g. Opus); numbers in words; one sentence ≈ one beat; a change on screen every 0.5–1 s, but every word readable at least 0.6 s.

QURAN: verses only copied exactly from a source the person gives — never typed from memory; a verse in "amiri" (Quranic text), anything that is not a verse in the piece's own font.`;
