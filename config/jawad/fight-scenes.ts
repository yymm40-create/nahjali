// «الجواد الذكي!» | JAWAD AI — «مشاهد القتال السينمائية»: how «جواد» writes a fight for Seedance the way the great
// fight directors stage one — the Hong Kong / Chinese school, the American school, the Arab (Egyptian, Gulf) school,
// and the Korean, Japanese and Indonesian ones — with their shot grammar, their inserts, their rhythm and their rules.
// Pure; shared by the assistant's instructions, the example bank and the tests.
//
// Where it comes from (read on 2026-10-09):
//   - The directors and choreographers, as interviews, analyses and reviews describe their work: Jackie Chan (the
//     environment as his ally; fast contact sparring made readable by clear framing and editing; big hits shown twice
//     from two angles; comedy and pain in the same beat), Yuen Woo-ping (Crouching Tiger, The Matrix: a fight that plays
//     like a ballet, synchronised movement, wire work that floats), Sammo Hung and Donnie Yen (Ip Man: Wing Chun's close
//     trapping, chain punches), Chad Stahelski (John Wick: a stuntman's eye, long takes on wider lenses so the
//     geography and the effort read, judo throws and grappling, every department rehearsed — money spent on rehearsal
//     is well spent), Gareth Evans (The Raid: silat, the pacing he took from Chan's films, corridor geography), George
//     Miller (Mad Max: Fury Road: the action kept in the centre of the frame so cuts read at speed), Park Chan-wook
//     (Oldboy: the one-take corridor fight seen from the side, exhaustion shown), the samurai films (stillness, then
//     one cut), and the Egyptian action of Sherif Arafa and Ahmed El Sakka (Mafia, Ibrahim El Abyad — street fights
//     with sticks and blades, rooftops and alleys; El Ankaboot, whose action designer Andrew McKenzie staged the
//     bridge jump), with tahtib (Upper-Egyptian stick fighting) and the desert sword duel of Gulf heritage drama.
//   - Seedance practice: a prose-only fight plays as three slow beats («walk in, raise the weapon, freeze») — a
//     character demo, not a fight; tension comes from CUT DENSITY (several shots in one clip: wide → medium → insert →
//     wide), each 1–3 s, one move per shot; a template's rules — continuous momentum, a clear spatial relationship,
//     reversals, the environment reacting (dust, debris, splinters), a heavy hit marked by a two-frame freeze, a flash
//     and a slight shake then back to speed, hair and cloth trailing the motion, fast attacks with brief pauses and one
//     or two 0.5–1 s slow moments, escalation to one environment move and one decisive finish.
// The site's rules hold: generic people, never a known actor's
// likeness; no blood, gore, wounds or death shown — the impact is felt in sound, reaction and the frame.

export const FIGHT_PLAYBOOK_ID = "fight-scene";

/** The schools of screen fighting jawad knows, with what makes each one. */
export const FIGHT_SCHOOLS = [
  {
    id: "hongkong",
    ar: "قتال صيني / هونغ كونغ",
    style: "Hong Kong kung fu choreography",
    grammar: "full-body framing on a medium-wide lens so every limb reads, the camera at the fighters' height, rhythm of hit-hit-hit-pause, blocks as loud as strikes, the environment used as a weapon and a shield (chairs, ladders, tables, poles), the biggest hit shown twice from two angles, a beat of pain or humour after it",
    masters: "Jackie Chan, Yuen Woo-ping, Sammo Hung",
  },
  {
    id: "wuxia",
    ar: "ووشيا (طيران وسيوف صينية)",
    style: "wuxia wire-work sword choreography",
    grammar: "graceful floating leaps and runs along walls and bamboo, synchronised movement like a dance, long flowing arcs of the blade, wide shots against the landscape, slow sweeping crane moves, fabric and leaves trailing each move",
    masters: "Yuen Woo-ping, Tsui Hark",
  },
  {
    id: "wingchun",
    ar: "وينغ تشون (قتال قريب)",
    style: "Wing Chun close-range combat",
    grammar: "close trapping hands and chain punches at chest height, centre-line attacks, medium two-shots and tight inserts on the forearms, very fast hands with a still head, one opponent after another stepping in",
    masters: "Donnie Yen, Sammo Hung",
  },
  {
    id: "american",
    ar: "قتال أمريكي (جون ويك)",
    style: "modern American tactical close-combat (judo throws, grappling, joint locks)",
    grammar: "long takes on wider lenses with the camera following at a steady distance so the geography and the effort read, judo throws and arm locks, the fighter tired and reloading his breath, no shaky camera, clear entrances and exits of each opponent",
    masters: "Chad Stahelski, David Leitch",
  },
  {
    id: "brawl",
    ar: "عراك شوارع واقعي",
    style: "gritty realistic street brawl",
    grammar: "handheld but readable framing, clumsy heavy swings, grabbing and shoving, falling over furniture, exhaustion and heavy breathing, close inserts on fists and feet slipping",
    masters: "the realistic brawls of crime cinema",
  },
  {
    id: "silat",
    ar: "سيلات (ذا ريد)",
    style: "Indonesian pencak silat",
    grammar: "low stances, fast elbows and knees, takedowns in a narrow corridor, the camera moving through the corridor with the fighter, relentless pace with short breaths between waves",
    masters: "Gareth Evans, Iko Uwais",
  },
  {
    id: "corridor",
    ar: "لقطة الممر الواحدة (أولد بوي)",
    style: "one-take corridor fight seen from the side",
    grammar: "a single lateral tracking shot along a corridor, the hero pushing through a crowd of opponents with a short wooden stick, no cuts at all, exhaustion visible, the camera keeping everyone in frame",
    masters: "Park Chan-wook",
  },
  {
    id: "samurai",
    ar: "مبارزة ساموراي",
    style: "samurai sword duel",
    grammar: "long stillness and staring, wind and grass moving, then one or two lightning-fast cuts, a held silence after, wide symmetrical framing with a low horizon",
    masters: "the samurai cinema of Kurosawa",
  },
  {
    id: "egyptian",
    ar: "أكشن مصري (شوارع وأسطح)",
    style: "Egyptian street action",
    grammar: "fights in crowded alleys, rooftops and markets, wooden sticks and chains, the hero facing several men, a run across rooftops ending in a jump, the crowd scattering, warm dusty light, the camera at street level",
    masters: "Sherif Arafa and Ahmed El Sakka's action films, action designer Andrew McKenzie",
  },
  {
    id: "tahtib",
    ar: "تحطيب صعيدي (عصا)",
    style: "Upper-Egyptian tahtib stick fighting",
    grammar: "two men in galabiyas circling with long sticks, the sticks spinning and clashing in rhythm, a duel of honour with a ring of men around, drums under it, dust rising from the ground",
    masters: "the traditional tahtib of Upper Egypt",
  },
  {
    id: "desert-sword",
    ar: "مبارزة سيوف في الصحراء (تراثي خليجي)",
    style: "Arabian desert sword duel",
    grammar: "two men in thobes and shemaghs with curved swords on a dune, the wind lifting sand and cloth, circling, the swords ringing, wide shots on the dunes then tight inserts on the grips, a sunset behind",
    masters: "Gulf heritage drama",
  },
] as const;
export type FightSchool = (typeof FIGHT_SCHOOLS)[number]["id"];

/** The inserts directors cut to (each a 0.5–1 s shot that sells a moment). */
export const INSERTS = [
  "extreme close-up of the fist tightening",
  "insert of the back foot pivoting on the ground, dust kicked up",
  "insert of the knuckles meeting the blocking forearm",
  "close-up of the eyes narrowing before the move",
  "insert of the weapon's grip shifting in the hand",
  "insert of a bead of sweat flying off on the impact",
  "close-up of the shoulder dipping to slip the punch",
  "insert of the sticks clashing, splinters in the light",
  "insert of the blade catching the sun",
  "insert of the opponent's feet sliding back on the ground",
];

export const FIGHT_METHOD = `METHOD — a cinematic fight for Seedance (how the great fight directors stage it):
1. ASK what matters: who fights (describe each one clearly: age, build, clothes, so they never swap), where, which school (صيني/هونغ كونغ، ووشيا، وينغ تشون، أمريكي، عراك شوارع، سيلات، لقطة الممر، ساموراي، أكشن مصري، تحطيب، مبارزة سيوف صحراوية), bare hands or which weapon, the feeling (حماس، تراجيدي، مضحك), the length and the shape (9:16 / 16:9).
2. A FIGHT IS SHOTS, NOT PROSE: a prose-only fight plays as three slow beats («walk in, raise the weapon, freeze»). Write 3–6 numbered SHOTS for the clip, each 1–3 s, each ONE move: «SHOT 1 (0–2 s, wide): … CUT TO SHOT 2 (2–3 s, insert): …». Wide to establish the space and the distance between the fighters, medium for the exchange, an INSERT (0.5–1 s: a fist, a foot pivoting, eyes, a grip, a block) to sell a moment, back to wide for the payoff. The one-take school (لقطة الممر، أمريكي طويل) is the exception: one continuous shot, said as such.
3. CLEAR GEOGRAPHY: who is screen-left and who is screen-right, kept through every cut (the 180° line), the camera at the fighters' height, the action in the centre of the frame so it reads at speed.
4. PHYSICS: weight transfer from the back foot, follow-through, the blocked arm giving way, the body reacting to every hit (head snapping, staggering back, falling over the table), hair and cloth trailing the move; the environment reacts — dust, splinters, a chair skidding, a lamp swinging. A heavy hit: a two-frame freeze, a slight camera shake, then straight back to speed.
5. RHYTHM: fast exchanges with short pauses to breathe, at most one or two slow moments of 0.5–1 s on the biggest hit, escalation to one move with the environment and ONE decisive finish, then a held beat after it.
6. THE SCHOOL'S GRAMMAR, written into the shots (the schools below).
7. SOUND (Seedance makes it): whooshes, the thud of each blow, blocks clacking, cloth snapping, feet scraping, grunts and breaths with no words (unless a line is asked), and the school's music bed when it has one (drums for tahtib, strings for wuxia).
8. RULES: no blood, gore, wounds or death shown — the impact is felt in sound, reaction and framing; generic people, NON-IP, never a known actor's or character's likeness; Seedance takes 4–15 s; a longer fight is several clips, each its own beat (opening, exchange, turn, finish).`;

export const SCHOOLS_BRIEF = FIGHT_SCHOOLS.map((s) => `- ${s.id} «${s.ar}» (${s.masters}): ${s.grammar}.`).join("\n");

// ───────────────────────────── the bank ─────────────────────────────

interface Noun {
  ar: string;
  en: string;
}
const n = (ar: string, en: string): Noun => ({ ar, en });

const FIGHTERS: Noun[] = [
  n("شاب بثوب أبيض", "a young man in a white thobe"), n("رجل بشماغ أحمر", "a broad man in a thobe and red shemagh"), n("شاب بجاكيت جلد", "a lean young man in a black leather jacket"), n("رجل ببدلة سوداء", "a man in a black suit and white shirt"),
  n("مقاتل بزي كونغ فو", "a martial artist in a white kung fu uniform"), n("راهب شاولين", "a shaolin monk in saffron robes"), n("رجل بجلابية", "a tall man in a grey galabiya"), n("شيخ كبير", "a grey-bearded old master in a dark robe"),
  n("شاب رياضي بهودي", "an athletic young man in a grey hoodie"), n("مقاتل ساموراي", "a samurai in a dark kimono"), n("فارس بدوي", "a bedouin horseman in a brown bisht"), n("ولد مراهق", "a teenage boy in a school uniform"),
];
const OPPONENTS: Noun[] = [
  n("رجل ضخم", "a huge bald man in a vest"), n("ثلاث رجال", "three men in dark tracksuits"), n("خمس حراس", "five guards in black uniforms"), n("مقاتل ملثم", "a masked fighter in black"),
  n("زعيم عصابة", "a gang boss in a white suit"), n("مبارز منافس", "a rival swordsman in red"), n("مجموعة بلطجية", "a group of thugs with sticks"), n("مدرب قديم", "an old rival master"),
];
const PLACES: Noun[] = [
  n("في زقاق ضيق", "a narrow alley at night, wet ground, one hanging bulb"), n("على سطح بناية", "a rooftop at sunset, water tanks and satellite dishes"), n("في سوق شعبي", "a crowded old souq with lanterns and stalls"), n("في مطعم", "a busy restaurant kitchen, pots and steam"),
  n("في ممر طويل", "a long dim hotel corridor"), n("في معبد", "a stone temple courtyard with red pillars"), n("في غابة خيزران", "a misty bamboo forest"), n("على كثبان الصحراء", "golden desert dunes at sunset"),
  n("في موقف سيارات", "an empty underground car park"), n("في نادي ملاكمة", "an old boxing gym"), n("في مستودع", "a dusty warehouse full of crates"), n("في ساحة قرية", "a village square at dusk with a ring of watching men"),
];
const WEAPONS: Noun[] = [n("بدون سلاح", "bare hands"), n("بالعصي", "wooden sticks"), n("بالسيوف", "curved swords"), n("بالسكاكين", "short knives (no cuts shown)"), n("بعصا طويلة", "a long staff"), n("بالسلاسل", "a chain"), n("بالكراسي", "whatever is at hand: chairs and bottles")];
const MOODS: Noun[] = [n("حماسي", "high-energy and heroic"), n("تراجيدي", "grim and tragic"), n("مضحك", "playful, with comic beats of pain"), n("هادي وقاتل", "cold and controlled"), n("ملحمي", "epic and grand")];
const RATIOS = [{ ar: "للريلز", r: "9:16" }, { ar: "لليوتيوب", r: "16:9" }, { ar: "سينمائي", r: "21:9" }, { ar: "", r: "16:9" }];
const SECONDS = [5, 6, 8, 8, 10, 10, 12, 15];
const FINISHES = ["a spinning back kick sends the opponent crashing through a stack of crates", "a hip throw slams the opponent flat onto the ground, dust bursting up", "a final palm strike to the chest drives the opponent back several steps and down to one knee", "the hero disarms the opponent and the weapon spins away and lands in the dust", "the hero sweeps the legs and the opponent falls hard; the hero stands over him, breathing", "one clean final strike, then silence; the opponent slowly sinks to his knees"];
const ENV_MOVES = ["runs up the wall and flips over the opponent", "kicks a chair into the opponent's path", "swings around a pole to kick two men at once", "rolls across a table and comes up behind the opponent", "uses a ladder as a shield and then a lever", "slides under a swinging stick on the wet ground"];

class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = (seed >>> 0) || 1;
  }
  next() {
    let x = this.s;
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    this.s = x >>> 0;
    return this.s / 4294967296;
  }
  pick<T>(list: readonly T[]): T {
    return list[Math.floor(this.next() * list.length)];
  }
}

export interface FightCase {
  id: string;
  school: FightSchool;
  ask: string;
  settings: { ratio: string; resolution: string; duration: number; audio: boolean };
  /** the shots: [start, end, size, what happens] */
  shots: { from: number; to: number; size: string; action: string }[];
  prompt: string;
}

const f = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(1));

/** The shots of a clip: a wide opening, the exchange, an insert, the environment move, the finish (fitted to its seconds). */
function shotsFor(r: Rng, school: (typeof FIGHT_SCHOOLS)[number], sec: number, hero: string, foe: string, weapon: string) {
  if (school.id === "corridor" || (school.id === "american" && r.next() < 0.5)) {
    return [{ from: 0, to: sec, size: "one continuous take", action: `${school.id === "corridor" ? "a single lateral tracking shot from the side: " : "a long take on a wide lens following at a steady distance: "}${hero} pushes forward through ${foe}, ${weapon === "bare hands" ? "striking and throwing" : `fighting with ${weapon}`}, each opponent entering from screen-right and dropping out of frame, the hero slowing and breathing hard by the end; ${r.pick(FINISHES)}` }];
  }
  if (school.id === "samurai") {
    const still = Math.max(2, Math.round(sec * 0.55));
    return [
      { from: 0, to: still, size: "wide, symmetrical, low horizon", action: `${hero} and ${foe} stand still facing each other, wind moving the grass and their clothes, hands near the hilts` },
      { from: still, to: still + 1, size: "insert", action: "the hand closes on the hilt" },
      { from: still + 1, to: sec, size: "wide", action: `one lightning-fast exchange of cuts, then both stand still back to back; ${foe} slowly sinks to one knee, silence` },
    ];
  }
  const cuts = sec <= 6 ? [0.3, 0.45, 0.75, 1] : [0.2, 0.4, 0.5, 0.75, 1];
  const t = cuts.map((c) => Math.round(sec * c * 2) / 2);
  const out = [
    { from: 0, to: t[0], size: "wide", action: `${hero} screen-left faces ${foe} screen-right, the distance between them clear, ${weapon === "bare hands" ? "fists up" : `holding ${weapon}`}, a breath before the move` },
    { from: t[0], to: t[1], size: "medium two-shot", action: `a fast exchange: ${school.grammar.split(",")[0]}; strike, block, counter, each with weight from the back foot` },
  ];
  if (cuts.length === 5) out.push({ from: t[1], to: t[2], size: "insert", action: r.pick(INSERTS) });
  const k = cuts.length === 5 ? 2 : 1;
  out.push({ from: t[k], to: t[k + 1], size: "medium, camera circling low", action: `${hero} ${r.pick(ENV_MOVES)}, the environment reacting (dust, splinters, something skidding)` });
  out.push({ from: t[k + 1], to: sec, size: "wide", action: `${r.pick(FINISHES)}; a two-frame freeze and a slight shake on the impact, then a held beat` });
  return out;
}

export const FIGHT_CASES = 1000;
let bank: FightCase[] | null = null;

/** A thousand worked fights (the same every time), spread over the schools. */
export function fightCases(count = FIGHT_CASES): FightCase[] {
  if (bank && count === FIGHT_CASES) return bank;
  const r = new Rng(91_177);
  const out: FightCase[] = [];
  const seen = new Set<string>();
  let guard = 0;
  while (out.length < count && guard++ < count * 30) {
    const school = FIGHT_SCHOOLS[out.length % FIGHT_SCHOOLS.length];
    let hero = r.pick(FIGHTERS);
    // a samurai or a shaolin monk belongs to his own school's fights
    while ((hero.ar === "مقاتل ساموراي" && school.id !== "samurai") || (hero.ar === "راهب شاولين" && !["hongkong", "wuxia", "wingchun"].includes(school.id))) hero = r.pick(FIGHTERS);
    const foe = r.pick(OPPONENTS);
    const place = school.id === "desert-sword" ? n("على كثبان الصحراء", "golden desert dunes at sunset") : school.id === "tahtib" ? n("في ساحة قرية", "a village square at dusk with a ring of watching men") : school.id === "corridor" ? n("في ممر طويل", "a long dim hotel corridor") : r.pick(PLACES);
    const weapon = school.id === "desert-sword" || school.id === "samurai" ? n("بالسيوف", "curved swords") : school.id === "tahtib" ? n("بالعصي", "long wooden sticks") : school.id === "wingchun" || school.id === "silat" ? n("بدون سلاح", "bare hands") : r.pick(WEAPONS);
    const mood = r.pick(MOODS);
    const shape = r.pick(RATIOS);
    const sec = r.pick(SECONDS);
    const ask = r.pick([
      `أبي مشهد قتال ${school.ar} بين ${hero.ar} و${foe.ar} ${place.ar}`,
      `سوّ لي مشهد أكشن ${school.ar} ${weapon.ar} ${place.ar} ${shape.ar}`,
      `مشهد قتال ${mood.ar} ${school.ar}: ${hero.ar} ضد ${foe.ar}`,
      `فايت سين ${school.ar} ${place.ar}، ${sec} ثواني`,
      `أبي معركة ${weapon.ar} ${school.ar} ${place.ar} بجو ${mood.ar}`,
    ]).replace(/\s+/g, " ").trim();
    const shots = shotsFor(r, school, sec, hero.en, foe.en, weapon.en);
    const lines = shots.map((s, i) => `${i ? "CUT TO " : ""}SHOT ${i + 1} (${f(s.from)}–${f(s.to)} s, ${s.size}): ${s.action}.`);
    const prompt = [
      `Cinematic fight scene, ${sec} seconds, ${shape.r}, ${school.style}, ${mood.en}. Photoreal, film grain, natural motion blur. NON-IP — generic people, no known actor's likeness. No blood, no gore, no wounds.`,
      `Setting: ${place.en}. ${cap(hero.en)} (screen-left) against ${foe.en} (screen-right), ${weapon.en}; each keeps his side of the frame through every cut, the camera at their height, the action in the centre of the frame.`,
      `Choreography (${school.masters}): ${school.grammar}.`,
      lines.join(" "),
      "Physics: weight shifting from the back foot, follow-through on every strike, the body reacting to each hit, hair and cloth trailing the motion, the environment reacting.",
      `Sound: whooshes, the thud of each blow, blocks clacking, cloth snapping, feet scraping, grunts and breaths, no words${school.id === "tahtib" ? ", tahtib drums under it" : school.id === "wuxia" ? ", soaring strings" : school.id === "desert-sword" ? ", wind and ringing blades" : ""}.`,
    ].join("\n\n");
    const sig = `${ask}|${prompt}`;
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push({ id: `${FIGHT_PLAYBOOK_ID}-${out.length + 1}`, school: school.id, ask, settings: { ratio: shape.r, resolution: "720p", duration: sec, audio: true }, shots, prompt });
  }
  if (count === FIGHT_CASES) bank = out;
  return out;
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** The school a request names (by its Arabic or English words), or null. */
export function detectSchool(text: string): FightSchool | null {
  const t = text.toLowerCase();
  const by: [FightSchool, RegExp][] = [
    ["corridor", /لقطة الممر|أولد بوي|اولد بوي|oldboy|one.?take/],
    ["wuxia", /ووشيا|wuxia|طيران/],
    ["wingchun", /وينغ تشون|وينج تشون|wing chun|ip man|ايب مان/],
    ["silat", /سيلات|silat|ذا ريد|the raid/],
    ["samurai", /ساموراي|samurai|كاتانا/],
    ["tahtib", /تحطيب|tahtib/],
    ["desert-sword", /مبارزة سيوف في الصحراء|سيوف صحراوية|تراثي خليجي|desert sword/],
    ["egyptian", /أكشن مصري|اكشن مصري|مصري/],
    ["american", /أمريكي|امريكي|جون ويك|john wick|american/],
    ["brawl", /عراك شوارع|عراك|brawl/],
    ["hongkong", /صيني|هونغ كونغ|هونج كونج|جاكي شان|kung fu|كونغ فو|hong kong/],
  ];
  for (const [id, re] of by) if (re.test(t)) return id;
  return null;
}

/** The closest worked fights to a message (its school first, then shared words). */
export function nearestFightCases(message: string, k = 3): FightCase[] {
  const school = detectSchool(message);
  const words = new Set(message.split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 3));
  const seenAsk = new Set<string>();
  const scored = fightCases().flatMap((c) => {
    if (seenAsk.has(c.ask)) return [];
    seenAsk.add(c.ask);
    let score = c.ask === message ? 100 : 0;
    if (school && c.school === school) score += 6;
    for (const w of c.ask.split(/[^\p{L}\p{N}]+/u)) if (words.has(w)) score += 1;
    return [{ c, score }];
  });
  scored.sort((a, b) => b.score - a.score || a.c.id.localeCompare(b.c.id));
  return scored.slice(0, k).map((x) => x.c);
}

export function fightCasesBrief(list: FightCase[]) {
  if (!list.length) return "";
  return `WORKED FIGHTS like this one (follow their shape — shots with seconds, sizes, one move each; the content is this person's own):\n${list.map((c, i) => `${i + 1}. Request: «${c.ask}» (${c.school})\n   generator options: ${JSON.stringify(c.settings)}\n   prompt: ${c.prompt.replace(/\n\n/g, " ")}`).join("\n")}`;
}
