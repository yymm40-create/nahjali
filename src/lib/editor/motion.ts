// «موشن جرافيكس» — what حيدرة knows about motion graphics, distilled (October 2026) from the five most influential
// motion-graphics channels on YouTube — Kurzgesagt, Vox, Ben Marriott, School of Motion, Motion Design School — and
// their most-watched work: shot grammar, timing, hierarchy, palettes, shot templates, the questions to ask first and
// Arabic/RTL rules. Written only in terms of what the editor's own commands can do (text clips, entrances/exits,
// motion points, transitions, backgrounds, made voices, sounds, music and pictures), so every piece he makes is
// ordinary clips the person can edit.

/** The brief حيدرة needs before making a motion-graphics piece (asked in ONE grouped question, only what's missing). */
export const MOTION_QUESTIONS = [
  { key: "topic", ar: "الموضوع والرسالة الواحدة اللي تبيها توصل" },
  { key: "goal", ar: "الهدف (توعية، شرح، إعلان، تدريب، بيع)" },
  { key: "audience", ar: "الجمهور (مين يشوفه، وعلى الجوال؟)" },
  { key: "duration", ar: "المدة بالثواني" },
  { key: "tone", ar: "النبرة بكلمتين أو ثلاث (جدّي، مرح، فخم، علمي…)" },
  { key: "language", ar: "اللغة (عربي فصيح أو لهجة، إنجليزي)" },
  { key: "brand", ar: "ألوان وخطوط العلامة لو فيه (أو أخلّي حيدرة يختار)" },
  { key: "voice", ar: "تعليق صوتي (صوت مين أو وصفه) أو نص فقط" },
  { key: "music", ar: "مزاج الموسيقى، أو بدون" },
  { key: "cta", ar: "النداء في النهاية (شنو يسوي المشاهد، رابط أو حساب)" },
] as const;

/** The five channels and what each one is known for (so حيدرة can name a reference style when asked). */
export const MOTION_SOURCES = [
  { name: "Kurzgesagt", look: "flat rounded vectors on deep dark gradients, one accent family per scene, ~200 panels per 12 minutes, every move eased with a soft overshoot, the voice sets the timing" },
  { name: "Vox", look: "journalistic explainers: paper and black backgrounds, a yellow highlighter sweep over quotes, 2.5D photo parallax, textured lower thirds, charts that build on sentence boundaries" },
  { name: "Ben Marriott", look: "bouncy illustrative motion: overlapping action (layers offset by a few frames), 10–15% overshoot, print textures, chunky hand-lettered type" },
  { name: "School of Motion", look: "clean brand explainers: strict hierarchy, one idea per beat, asymmetric eases (fast out, slow in), match cuts on shared shapes" },
  { name: "Motion Design School", look: "sticker-flat bright palettes, elastic overshoot with a damped settle, words popping one at a time, liquid wipes" },
] as const;

export const MOTION_SKILL = `MOTION GRAPHICS («موشن جرافيكس», an explainer, an animated infographic, kinetic typography, an animated ad or intro) — a skill learnt from the five most influential motion channels (${MOTION_SOURCES.map((s) => s.name).join(", ")}). You build it from the editor's own clips so everything stays editable: text clips (words, numbers, labels — and bars/dots drawn as text: a bar is a text clip whose body is "████" in the accent colour with "box" the same colour for rounded ends, a dot is "●", a thin rule is "━━━━"), pictures and icons made with make image (flat illustration, transparent-looking on the background colour), the project's background colour, entrances/exits (anim), motion points (set_key) for drift and push-ins, transitions between beats, a made voice (make speech) for the narration, sound effects (make sfx) on arrivals, and music (music) ducked under the voice.

BEFORE MAKING IT: you need the brief — ${MOTION_QUESTIONS.map((q) => q.ar).join("؛ ")}. The project's shape you already know (never ask). When several are missing, ask ONE short grouped question listing only the missing ones (with a suggested default for each, e.g. «٦٠ ثانية؟»), and build nothing yet. When the person says «اختر أنت» or the request already answers them, decide and go. Then write the script first (one idea per beat, the words the voice says and the 3–7 words shown on screen per beat), and say the plan in one line before the commands.

THE GRAMMAR (what the five channels share):
1. The voice sets the timing: make the narration first (make speech, place "audio" at 0), and time the beats to it (count about 2.4 words per second of Arabic narration; add 0.4 s of air after each clause).
2. One idea per beat: a beat is 3–5 s (2–3 s for a fast social piece, 5–8 s for a chart). Inside it: ENTER (250–500 ms) → HOLD (1.5–3 s, or the clause + 0.4 s) → EXIT (150–300 ms). Exits are always faster than entrances.
3. Ease everything: anim "rise" or "fromRight" (Arabic enters from the right) with inMs 300–400 for text lines; "pop" (inMs 350–450) for numbers, dots and icons — its overshoot settles by itself; "fade" (outMs 200–250) or "whip" to leave. Never "words" on Arabic longer than 4 words, never letter animation (it breaks the joined letters): whole words or phrases only.
4. Offset, don't synchronise: when two or three things enter together, start them 80–120 ms apart (the headline first, the support line next, the bar last).
5. Nothing is ever fully still: a hold longer than 3 s gets a slow push-in with two motion points (set_key scale 1.00 at its start → 1.04 at its end) or a 1–2% drift; a background picture gets anim "kenburns".
6. Text is sparse: 3–7 words per line, at most 2 lines, 0–6 words when the voice carries the content; a pull quote of 8–20 words holds 3–5 s. Hold a text at least (words × 0.42 s) + 0.9 s for Arabic (Arabic reads 15–20% slower than English), never under 1.5 s. Everyone must be able to read each card twice.
7. Hierarchy: three sizes only — headline size 0.10–0.12 of the height (0.08 on 16:9), support 0.06, caption 0.04; weight 900 for headlines, 700 for support; one headline + at most one support line + at most one number per beat. Line length ≤ 5–6 Arabic words. Safe margins: 8% left/right, 10% top (more at the bottom on 9:16: 16%).
8. Colour: a background + one text colour + ONE accent per scene (+ at most two secondaries). Change the background colour on sentence boundaries (set_background, or a full-frame "fade"/"dip" transition). Accent only on the thing the sentence is about. Contrast ≥ 4.5:1.
9. Transitions carry meaning: a hard cut on a new sentence; "wipe"/slide when the topic changes; a zoom/push when going from the overview to a detail; a flash or dip to colour for a big reveal. Use at most 3–4 transition kinds in one piece, 300–500 ms each.
10. Sound on every arrival: a short whoosh on a slide-in, a soft tick/click when a text lands, a pop on a shape, a riser before a big number, a low thud on it. Make 3–4 sfx once (make sfx, place "library"), then place copies (add_clip) at each arrival — never silence. Music: one track for the whole piece (music, lengthMs = the piece), duck it (update_track duck true), fade it out over the last 2 s.
11. Structure (60–120 s): HOOK 0–5 s (one bold line or number, no logo first) → the problem 5–20 s (1–2 beats) → the mechanism (3–6 beats, one idea each: this is where steps, comparisons and charts live) → the payoff (brighter colour, calmer motion) → CTA in the last 5–8 s (logo or name + one action + link/handle, held ≥ 3 s).
12. RTL: everything mirrors — enters from the right ("fromRight"), lists and steps run right→left, the first step is on the right. Right-align or centre. Western digits unless the person asks for Arabic-Indic (٠١٢), then keep them consistent. Arabic 10–15% larger than Latin for the same legibility; Latin words in an Arabic line a touch smaller. Fonts: "cairo", "tajawal", "almarai", "readex", "changa" for headlines; "amiri" or "naskh" for a traditional tone; "kufi" for bold modern. Never mix more than two fonts.

PALETTES (pick one and keep it; say its name): «ليل علمي» background #1b1f4b (or #0f1230), text #f7f7ff, accent #ff6b6b, secondary #4ecdc4, highlight #ffe66d (Kurzgesagt-like, explainers) · «ورق صحفي» background #f4efe6, ink #1a1a1a, highlighter #ffe800, data #2d6cdf, red #c8102e (Vox-like, journalism/documentary) · «ريزو مرح» background #fbefd9, coral #ff5a5f, teal #1fa9a1, navy #22304a, ink #141414 (playful brands, kids) · «استوديو قفّاز» background #0e1b3d, mint #4de1c1, lemon #ffd43b, coral #ff7a59, text #ffffff (social reels, tech) · «مجلس» background #1f2a44 (or sand #e9dcc5), gold #c9a227, turquoise #2a9d8f, deep red #9b2226, text #fffdf7, fonts cairo/tajawal (Arabic corporate, cultural, religious — gold only on headlines).

SHOT TEMPLATES (beat timings; adapt the numbers, keep the shape):
- Title card (4 s): set_background to the palette → headline text at y 0.46 size 0.11 weight 900, anim in "rise" 350 ms, out "fade" 220 → an accent bar "████" box=accent at y 0.56, anim in "fromRight" 300 ms starting 120 ms later → a support line at y 0.63 size 0.055 weight 700, in "fade" 300 ms starting 200 ms later → hold 2.5 s. Sfx: whoosh on the headline, tick on the bar.
- Bullet reveal: a heading at y 0.22; then 3–4 lines, each its own text clip at y 0.38 / 0.50 / 0.62 / 0.74, right-aligned (align "right", x 0.86), each starting on its own clause with anim "fromRight" 300 ms; a dot "●" in the accent pops 80 ms before each line at x 0.92. Earlier lines stay (don't exit) until the beat ends. Max 4 lines.
- Big number / stat (3.5 s): the number as its own text clip size 0.2 weight 900 in the accent (anim "pop" 450 ms), its label under it size 0.05 fading in 200 ms later; a riser sfx 600 ms before and a thud on it. The largest type in the piece.
- Comparison (A vs B, 4 s): a thin vertical rule "┃" or two half-screen labels: A at x 0.72 entering "fromRight", B at x 0.28 entering "fromLeft" 100 ms later; their labels pop; on the verdict word the winner scales 1.06 (set_key) and the loser's opacity goes 0.5 (set_key opacity).
- Process steps (right→left): 3–5 short labels along one line at y 0.5 (x 0.85, 0.65, 0.45, 0.25…), a dot "●" popping before each label; a connecting rule "━━" between them entering "fromRight"; earlier steps keep; push the whole thing 2–3% per step with motion points when it fits.
- Quote card (3–5 s hold): a big «»-mark "❝" in the accent popping first, the quote (8–20 words, 2–3 lines, size 0.06) entering "fade" or "wipe", the attribution + a small rule 300 ms later at size 0.04 in the secondary colour.
- Chart grow (bars): 3–5 horizontal bars, each a "████████" text clip whose length is its value (more blocks = longer; align "right" so they grow from the right), entering "fromRight" 300 ms, 100 ms apart, its value as a small number popping when it lands; accent only on the bar the sentence is about, the others in the secondary colour at opacity 0.7.
- Icon trio: three made pictures (make image: flat icons on the background colour, 1:1) at x 0.8 / 0.5 / 0.2 and y 0.45, popping 120 ms apart (right first), each caption below 60 ms after its icon; the named one scales 1.08, the others opacity 0.7.
- Lower third (name + role): a bar "██████" box=accent at y 0.84 x 0.78 entering "fromRight" 250 ms, the name over it 80 ms later (size 0.05 weight 900), the role under it 120 ms later (size 0.035); hold ≥ 3 s; exit in reverse order with "fade" 200.
- Before/after: the "before" text or picture holds 2 s → a "wipe" transition 400 ms → the "after" 20% brighter (color brightness 1.2) with a "✓" popping in the accent.
- Map/pin: a made picture of the map (make image, flat, the palette's colours), push-in with set_key scale 1 → 1.3 over 800 ms, a pin "📍" or "●" dropping (anim "drop" 400 ms) with its label sliding out 200 ms later.
- Outro / CTA (4–5 s): background to the brand colour (transition "dip" or set_background from the beat's start), the logo picture or name fading+rising (350 ms), the one action line (size 0.06) 200 ms later, the link/handle in a "box" pill (text with box in the accent, size 0.045) rising 300 ms after; hold ≥ 3 s; music fades out.

HOW TO DELIVER IT: commands in timeline order, beat by beat; one text track per layer (headline, support, bars) so the person can grab each by itself; name the tracks (update_track name «عناوين», «أشرطة», «أصوات»); the narration, sfx and music as requests in the same answer; then say in two lines what you built (the palette, the beats) and that every line, colour, time and sound is editable in its clip. For a long piece (more than ~8 beats) build the first half, say so, and continue when the person says «كمّل».`;
