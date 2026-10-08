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

export const MOTION_SKILL = `MOTION GRAPHICS («موشن جرافيكس», an explainer, an animated infographic, kinetic typography, an animated ad or intro) — a skill learnt from the five most influential motion channels (${MOTION_SOURCES.map((s) => s.name).join(", ")}). You build it from the editor's own clips so everything stays editable (the texts through the layout engine below — never by hand): text (headlines, numbers, points, quotes — laid out by the engine), pictures and icons made with make image (flat illustration, transparent-looking on the background colour), the project's background colour, entrances/exits (anim), motion points (set_key) for drift and push-ins, transitions between beats, a made voice (make speech) for the narration, sound effects (make sfx) on arrivals, and music (music) ducked under the voice.

BEFORE MAKING IT: you need the brief — ${MOTION_QUESTIONS.map((q) => q.ar).join("؛ ")}. The project's shape you already know (never ask). When several are missing, ask ONE short grouped question listing only the missing ones (with a suggested default for each, e.g. «٦٠ ثانية؟»), and build nothing yet. When the person says «اختر أنت» or the request already answers them, decide and go. Then write the script first (one idea per beat, the words the voice says and the 3–7 words shown on screen per beat), and say the plan in one line before the commands.

THE GRAMMAR (what the five channels share):
1. The voice sets the timing: make the narration first (make speech, place "audio" at 0), and time the beats to it (count about 2.4 words per second of Arabic narration; add 0.4 s of air after each clause).
2. One idea per beat: a beat is 3–5 s (2–3 s for a fast social piece, 5–8 s for a chart). Inside it: ENTER (250–500 ms) → HOLD (1.5–3 s, or the clause + 0.4 s) → EXIT (150–300 ms). Exits are always faster than entrances.
3. Energy without bounce: entrances are short and eased (the engine: 240–320 ms — a whip from the right or a rise for headlines, alternating beat to beat; a punch for the big number, landing from big with no overshoot; "settle" — from 0.94 with a fade — for pills and shapes), exits always faster (160 ms), the decoration leads the words by 80 ms so the text lands on it. By hand (outside the engine): anim "whip"/"fromRight" (Arabic enters from the right) or "rise" with inMs 150–300, "punch"/"settle" for numbers and icons ("pop" bounces: only when the person asks), "fade" or "whip" out at 150–200. Never "words" on Arabic longer than 4 words, never letter animation (it breaks the joined letters): whole words or phrases only.
4. Offset, don't synchronise: when two or three things enter together, start them 30–80 ms apart (the headline first, the support line next, the bar last).
5. Nothing is ever fully still: a hold longer than 3 s gets a slow push-in with two motion points (set_key scale 1.00 at its start → 1.04 at its end) or a 1–2% drift; a background picture gets anim "kenburns".
6. Text is sparse: 3–7 words per line, at most 2 lines, 0–6 words when the voice carries the content; a pull quote of 8–20 words holds 3–5 s. Hold a text at least (words × 0.42 s) + 0.9 s for Arabic (Arabic reads 15–20% slower than English), never under 1.5 s. Everyone must be able to read each card twice.
7. Hierarchy: three sizes only — headline size 0.10–0.12 of the height (0.08 on 16:9), support 0.06, caption 0.04; weight 900 for headlines, 700 for support; one headline + at most one support line + at most one number per beat. Line length ≤ 5–6 Arabic words. Safe margins: 8% left/right, 10% top (more at the bottom on 9:16: 16%).
8. Colour: a background + one text colour + ONE accent per scene (+ at most two secondaries). The engine gives every beat its own background (the palette's colour shifted a little each time, a soft glow that moves, the palette's texture) with a transition into the next beat (wipe, slide, iris, clock…), and draws each beat's decoration itself as clean vector shapes around the words — a tilted band behind a title, a ring with ticks behind a big number, a rail beside the points, quote marks, rings for the outro — entering just before the words and drifting slowly. Never ask a generator (Seedance / make image) for backgrounds or elements of a motion piece; make image only when the person wants an illustration of a thing. Accent only on the thing the sentence is about. Contrast ≥ 4.5:1.
9. Transitions carry meaning: a hard cut on a new sentence; "wipe"/slide when the topic changes; a zoom/push when going from the overview to a detail; a flash or dip to colour for a big reveal. Use at most 3–4 transition kinds in one piece, 300–500 ms each.
10. Sound on every arrival — done by the engine: for a storyboard piece it makes five different short effects once (a transition swish, an entrance whoosh, a soft hit on the big number, a pop on a shape, a shimmer on quotes and the outro) and places a copy at the cues, quiet (0.35) under the voice, never the same sound on every beat. Do NOT request sfx yourself for a motion piece (make sfx is only for other edits). Background audio only when the person asked for music in the brief: then one track for the whole piece (music, lengthMs = the piece), ducked (update_track duck true by the page), fading out over the last 2 s.
11. Structure (60–120 s): HOOK 0–5 s (one bold line or number, no logo first) → the problem 5–20 s (1–2 beats) → the mechanism (3–6 beats, one idea each: this is where steps, comparisons and charts live) → the payoff (brighter colour, calmer motion) → CTA in the last 5–8 s (logo or name + one action + link/handle, held ≥ 3 s).
12. RTL: everything mirrors — enters from the right ("fromRight"), lists and steps run right→left, the first step is on the right. Right-align or centre. Western digits (0–9) unless the person asks for Arabic-Indic (٠١٢) — then the storyboard's "digits":"arabic". Arabic 10–15% larger than Latin for the same legibility; Latin words in an Arabic line a touch smaller. Fonts: "cairo", "tajawal", "almarai", "readex", "changa" for headlines; "amiri" or "naskh" for a traditional tone; "kufi" for bold modern. Never mix more than two fonts.

PALETTES (the engine's, by name): «ليل علمي» night (science, explainers) · «ورق صحفي» paper (journalism, documentary) · «ريزو مرح» riso (playful, kids) · «استوديو» studio (social reels, tech) · «مجلس» majlis (Arabic corporate, cultural, religious).

HOW TO DELIVER IT — THE LAYOUT ENGINE (strict): never place a motion piece's texts by hand with add_text (you cannot see the frame; hand-placed texts pile up). Write the piece as a storyboard in "motion" (a JSON object string); the editor's layout engine measures every line with the real fonts, wraps it, sizes it, stacks it with gaps inside the safe area, times the entrances (staggered, faster exits), adds the slow push-in, sets the background, and splits a beat that is too full into two. Shape:
{"palette":"night"|"paper"|"riso"|"studio"|"majlis","colors":{"bg":"#rrggbb","text":"#rrggbb","accent":"#rrggbb"} (ONLY the person's own brand colours — they replace the palette),"digits":"arabic" (only when asked),"head":"cairo","body":"tajawal","at":0,"beats":[ … ]}
Beat kinds (Arabic words, short — 2–6 words a line):
- {"kind":"title","title":"…","text":"…"} — the hook or a chapter: big headline, accent bar, a support line.
- {"kind":"statement","text":"…"} — one strong sentence alone (up to ~12 words).
- {"kind":"stat","value":"٧٠٪","label":"…","text":"…"} — a big number (≤ 6 characters), its label, an optional note.
- {"kind":"points","title":"…","items":["…","…","…"]} — up to 4 points, revealed one by one (first in the accent).
- {"kind":"steps","title":"…","items":["…","…","…"]} — numbered steps ١. ٢. ٣.
- {"kind":"compare","title":"…","right":{"title":"…","text":"…"},"left":{"title":"…","text":"…"}} — two sides (right = the first/the better one).
- {"kind":"quote","text":"…","by":"…"} — a quote (8–20 words) and who said it.
- {"kind":"kinetic","words":["…","…","…"],"hot":1} — kinetic typography: 2–6 words, one a line, landing one after another; "hot" = the index of the key word, shown in the highlight pill. For the hook and strong sentences.
- {"kind":"outro","title":"…","text":"…","handle":"@…"} — the call to action, the handle in a pill.
Give every beat "seconds" (2.5–8) so you know when each one starts (the first at "at"; each next one when the one before ends) — you place the narration, sound effects and music by those times. The palette name, the beats and their words are your craft; the engine guarantees the layout. Pick the palette that fits the topic and say its Arabic name.
The engine also draws the backgrounds and decorations and makes and places the sound effects: you write only the storyboard, the narration and (only when the brief asked for it) the music. In the SAME answer: the narration as {"kind":"make","makeKind":"speech","prompt":<the exact words of the whole narration, in Arabic, FULLY diacritized (every letter's vowel except each word's last letter), numbers written out in words, short sentences, a comma or a full stop between ideas so the voice breathes>,"place":"audio","at":0} — its words follow the beats in order and its length matches the beats' total; and music ({"kind":"music",…,"lengthMs":<the total>}) only when asked (the page ducks it under the voice). Reply in two lines: the palette, the beats, and that every line, colour, time and sound is editable. For a long piece (more than ~10 beats) build the first half and continue on «كمّل».`;
