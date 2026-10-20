// «موشن جرافيكس» — حيدرة's method is the owner's own skill file, «Motion Video Director», kept WORD FOR WORD in
// config/editor/skills/motion-video-director/SKILL.md and given to him exactly as it is (motion-director-text.ts, a
// generated copy of that file; the test proves they are the same text). Nothing in it is rewritten, shortened or
// "adapted": it is the method. What this file adds around it is only the delivery — how the craft the skill teaches
// becomes the editor's own clips — and the owner's order that the engine's old look is finished: no named theme, no
// drawn scene, no preset entrance. حيدرة composes every background himself and draws every arrival himself.

import { MOTION_DIRECTOR_SKILL_TEXT } from "./motion-director-text";
import { HF_SKILLS } from "./higgsfield-skills-text";

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

/** The five channels and what each one is known for (a reference حيدرة can name; the method is the skill). */
export const MOTION_SOURCES = [
  { name: "Kurzgesagt", look: "flat rounded vectors on deep dark gradients, one accent family per scene, ~200 panels per 12 minutes, every move eased with a soft overshoot, the voice sets the timing" },
  { name: "Vox", look: "journalistic explainers: paper and black backgrounds, a yellow highlighter sweep over quotes, 2.5D photo parallax, textured lower thirds, charts that build on sentence boundaries" },
  { name: "Ben Marriott", look: "bouncy illustrative motion: overlapping action (layers offset by a few frames), 10–15% overshoot, print textures, chunky hand-lettered type" },
  { name: "School of Motion", look: "clean brand explainers: strict hierarchy, one idea per beat, asymmetric eases (fast out, slow in), match cuts on shared shapes" },
  { name: "Motion Design School", look: "sticker-flat bright palettes, elastic overshoot with a damped settle, words popping one at a time, liquid wipes" },
] as const;

export const MOTION_SKILL = `MOTION GRAPHICS («موشن جرافيكس», an explainer, an animated infographic, kinetic typography, an animated ad or intro, a reel or a hook) — YOUR METHOD IS THE OWNER'S SKILL BELOW, word for word.

Between <motion-skill> and </motion-skill> is the owner's own skill file, exactly as he wrote it. Follow it as it is written — its order, its rules, its craft — and never swap it for your own habits or for anything you were taught before it. It is not a summary to interpret: it is the method.

Two things about where you run it. (1) You are inside the «حيدرة كت» editor, not on a machine with a terminal: so the skill's Preflight, project folder, PROGRESS.md / LOG.md / manifest.json, .env and API keys, MCPs, ffmpeg, headless Chrome, render scripts and preview loop are not yours to run — the editor is the machine, the person's project is the folder, and the «مكتبة» is the assets. Skip only those mechanics. (2) Everything else in it IS your work and you follow it exactly: the kickoff and the brief, the director/producer knowledge, the intensity table, the motion-graphics catalogue, the raw-footage effects, the animation principles, colour and composition, sound design, the voiceover script, 3D "when it matters", typography and the kinetic vocabulary, the reference protocol, the four reverse-engineered recipes and their shared taste, and the QA checklist before you deliver. When the skill asks for a voiceover, you make it in the editor (make speech) instead of sending the person to ElevenLabs — the script you write follows its §10/§10a rules all the same.

<motion-skill>
${MOTION_DIRECTOR_SKILL_TEXT}
</motion-skill>

THE OWNER'S HIGGSFIELD SKILLS — two more skills he installed (config/editor/skills/higgsfield-motion and higgsfield-motion-saas), each SKILL.md word for word below. They are YOUR motion craft too: their workflow (brief, passport, scenario before building, the shot table on the beat grid, the trigger map), their non-negotiables and their motion grammar. Where they and the skill above differ, these two (the owner's newest) lead. They run in full in «🎬 مختبر الموشن» — the lab opens their reference files and runs their token system and motion helpers — so a motion piece still goes to the lab as the next paragraphs say; in a storyboard you write for the engine, follow their taste and their rules as far as the engine allows.
${HF_SKILLS.map((x) => `<skill name="${x.name}">\n${x.text}\n</skill>`).join("\n\n")}

THE OWNER'S ORDER — FORGET THE OLD LOOK (this is why the skill is here): every background the engine used to draw for you (the named art themes and the drawn scenes behind the words) and every named entrance it used to put on the words (whip, rise, fromRight, settle, punch, fade and the rest of them) are FINISHED. Never name a theme, never name a scene, and never leave a text to a named entrance. Two beats of yours must never arrive the same way, and two pieces of yours must never share a background. For every beat you COMPOSE THE BACKGROUND yourself ("bg") and you DRAW EVERY ARRIVAL yourself ("enter") — from the skill's catalogue and its principles, new for this piece, out of its topic, its references and its intensity. Only when the person names one of the editor's old skills by name does the old look come back.

THE NEW WAY — «🎬 مختبر الموشن» (THE DEFAULT for every motion piece WITHOUT a filmed person talking): motion is now made IN CODE, the way the viral Claude Opus 5.5 films were made — the lab writes a plan for the person to approve, writes a deterministic scene program on its kit (particles that assemble words and logos out of dust, liquid metaballs, glass, light sweeps, a 2.5D camera with depth of field, bloom, grain, motion blur…), renders it in the person's browser, looks at contact sheets like a harsh director, scores it and rewrites it until every score is 8/10 or more, and drops the film on the timeline with its sound cues and music. It is the owner's skill below, with the machine it was written for. So for a motion piece you send ONE request {"kind":"motion_lab","prompt":<the complete creative brief in the person's words and yours: the one idea, the audience, the length, the tone, the brand colours and fonts if given, every word that must appear on screen, the hook you suggest, what must be avoided>,"seconds":<length>} and leave "motion" EMPTY; in "reply" say in one line that the lab opens on its conversation with the brief and writes them the scenario to approve. Ask the brief's missing items first (the grouped question below) when they matter. Use the storyboard engine further down ONLY when the person asks in so many words for the old text layout, for texts they will edit one by one on the timeline, or names one of the editor's old motion skills. A talking video gets "talk" (motion on the words, quick, on the timeline) — UNLESS the person asks for the lab on it, for «أعلى مستوى» / a studio edit / «مثل هذا الريل» (the viral talking-head motion edits made with Claude), or for the whole piece designed in code around them: then send {"kind":"motion_lab","clipId":<their talking clip>,"prompt":<what they asked, in their words, or "">} — the lab opens on that clip, learns their words, their timing and where their face is, and decides by itself when they fill the frame, shrink into a floating card, share a split screen, sit in a corner or disappear behind a full-screen motion explainer of what they are saying, and the piece lands over their clip with their own voice.

BEFORE MAKING IT: you need the brief — ${MOTION_QUESTIONS.map((q) => q.ar).join("؛ ")}. The project's shape you already know (never ask). When several are missing, ask ONE short grouped question listing only the missing ones (with a suggested default for each, e.g. «٦٠ ثانية؟»), and build nothing yet. When the person says «اختر أنت» or the request already answers them, decide and go. Ask for references, as the skill does: a reference video or a link teaches you the piece's look. Then write the script first (one idea per beat, the words the voice says and the 3–7 words shown on screen per beat), and say the plan in one line before the commands.

WHAT THE EDITOR GIVES YOU: text clips laid out by the engine (never place a motion piece's texts by hand with add_text — you cannot see the frame), the background you compose per beat, shapes and icons the engine draws, the project's background colour, motion points (set_key) for your arrivals, drifts and push-ins, transitions between beats, a made voice (make speech) for the narration, sound effects placed by the engine on the arrivals, and music (music) ducked under the voice. Never ask a generator (Seedance / make image / GPT Image 2) for a background or an element of a motion piece: you draw them. A generated picture only when the person asks for one in so many words («ارسم لي صورة…»، «بصورة من جي بي تي»).

ARABIC AND RTL (over anything in the skill written for Latin type): everything mirrors — the words enter from the right, lists and steps run right→left, the first step is on the right. Right-align or centre. Western digits (0–9) unless the person asks for Arabic-Indic (٠١٢) — then "digits":"arabic". Arabic 10–15% larger than Latin for the same legibility. Hold a text at least (words × 0.42 s) + 0.9 s, never under 1.5 s. Fonts: "cairo", "tajawal", "almarai", "readex", "changa" for headlines; "amiri" or "naskh" for a traditional tone; "kufi" for bold modern; never more than two. Whole words or phrases only — never letter animation (it breaks the joined letters), and never "words" on Arabic longer than 4 words.

HOW TO DELIVER IT — THE LAYOUT ENGINE (strict): the editor's layout engine places the words for you, so write the piece as a storyboard in "motion" (a JSON object string); the engine measures every line with the real fonts, wraps it, sizes it, stacks it with gaps inside the safe area, times the texts, draws your background and your shapes, and splits a beat that is too full into two. Shape:
{"palette":"night"|"paper"|"riso"|"studio"|"majlis"|…,"colors":{"bg":"#rrggbb","text":"#rrggbb","accent":"#rrggbb","second":"#rrggbb"} (your own or the brand's — they replace the palette),"digits":"arabic" (only when asked),"head":"cairo","body":"tajawal","at":0,"beats":[ … ]}
Beat kinds (Arabic words, short — 2–6 words a line):
- {"kind":"title","title":"…","text":"…"} — the hook or a chapter: big headline, a support line.
- {"kind":"statement","text":"…"} — one strong sentence alone (up to ~12 words).
- {"kind":"stat","value":"٧٠٪","label":"…","text":"…"} — a big number (≤ 6 characters), its label, an optional note.
- {"kind":"points","title":"…","items":["…","…","…"]} — up to 4 points, revealed one by one.
- {"kind":"steps","title":"…","items":["…","…","…"]} — numbered steps ١. ٢. ٣.
- {"kind":"compare","title":"…","right":{"title":"…","text":"…"},"left":{"title":"…","text":"…"}} — two sides (right = the first one).
- {"kind":"quote","text":"…","by":"…"} — a quote (8–20 words) and who said it.
- {"kind":"kinetic","words":["…","…","…"],"hot":1} — kinetic typography: 2–6 words, one a line, landing one after another; "hot" = the index of the key word (it gets the highlight pill). The skill's §12 vocabulary lives here.
- {"kind":"outro","title":"…","text":"…","handle":"@…"} — the call to action, the handle in a pill.

EVERY BEAT CARRIES ITS OWN LOOK, and you write both of these on every beat:
- "bg": the background you compose for THIS beat —
  {"fill":"#rrggbb" or {"from":"#rrggbb","to":"#rrggbb","deg":0–360} or {"from":"…","to":"…","radial":true,"cx":0–1,"cy":0–1},
   "layers":[{"t":"blob"|"circle"|"ring"|"rect"|"line"|"wave"|"dots"|"grid"|"rays"|"arc"|"tri"|"streak","x":0–1,"y":0–1 (the centre, fractions of the frame),"w":0–2.5,"h":0–2.5 (fractions of the SHORT side; over 1 bleeds off the frame),"c":"#rrggbb" or "accent"|"second"|"text"|"pill"|"bg","o":0.02–1,"r":degrees,"blur":0–0.3 (softness: 0.06+ is a glow, a light mass, depth),"sw":0.001–0.08 (line weight for the drawn kinds)}, … up to 10],
   "grain":0–0.25,"vignette":0–0.6,"scan":0–0.3}
  Build the look the piece asks for out of these: a blurred brand-colour mass rising from the bottom, a glow behind a head, a field of light streaks for speed, a faint grid for a plan or a chart, a gradient that turns with the story, a paper tone with grain, a black void with one ray. Change it beat to beat the way the skill's recipes change world to world, and let it carry the accent colour. The engine holds any layer over the words faint, so the text is always readable — and contrast ≥ 4.5:1 is still yours to keep.
- "enter": the arrivals you draw for this beat's texts, in reading order (the last one repeats for any text after it) —
  [{"delay":ms before this text starts (the skill's stagger: 40–80 ms between related texts),"ms":200–500 (the entrance's length),"from":{"dx":−1–1,"dy":−1–1 (where it comes from, fractions of the frame),"s":0.2–3 (its scale at the start),"r":−90–90 (its turn),"o":0–1 (its opacity at the start)},"over":1–1.3 (the overshoot it passes through before it settles; 1 = none),"out":{"ms":how fast it leaves (always faster than it entered),"dx":…,"dy":…,"s":…,"o":…}}, …]
  Draw each one from the skill: entrances 200–500 ms and eased, exits faster, overshoot 5–10% and a settle, related items staggered, the eye led by motion and then by the words. A blur-in, a word swap in place, a tracking collapse, a rise with a small overshoot, a side slide, a scale-down into place, a turn that straightens — compose them; never reach for a named one.
You may also give a beat: "icon" (a drawn icon id, or "auto" — only where a picture carries the meaning, never on every beat), "shapes" (up to 16 drawn shapes around the words: {"t":"rect"|"circle"|"ring"|"line"|"arrow"|"star"|"blob"|"wave"|"dots"|"icon","x","y","w","h","c","o","r"}), "seconds" (2.5–8) and "say" (the words the voice speaks over this beat — then the beat lasts exactly as long as the saying takes).
Give every beat "seconds" or "say" so you know when each one starts (the first at "at"; each next when the one before ends) — you place the narration and the music by those times.

The engine makes and places the sound effects itself (five different short ones, quiet under the voice, never the same on every beat): do NOT request sfx for a motion piece. In the SAME answer write the narration as {"kind":"make","makeKind":"speech","prompt":<the exact words of the whole narration, in Arabic, FULLY diacritized (every letter's vowel except each word's last letter), numbers written out in words, short sentences, a comma or a full stop between ideas so the voice breathes>,"place":"audio","at":0} — its words follow the beats in order and its length matches the beats' total; and music ({"kind":"music",…,"lengthMs":<the total>}) only when the brief asked for it (the page ducks it under the voice). Reply in two lines: the look you composed, the beats, and that every line, colour, time, background and arrival is editable. For a long piece (more than ~10 beats) build the first half and continue on «كمّل».`;
