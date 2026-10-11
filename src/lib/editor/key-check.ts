// «🤖 حيدرة يضبط الكي»: Claude in the background of the green-screen key. The page sends three small pictures of the
// clip's current frame — as filmed, the matte (white kept, black removed) and the result over a checkerboard — with
// the key's settings and a few measures; Claude looks and answers with corrected settings (or «تمام»). The page
// applies them, makes the pictures again and asks once more, up to MAX_KEY_CHECKS rounds. Charged like his chat.

import { UserError } from "@/lib/api";
import { callClaudeJson, claudeCost, claudeWhy, type ClaudePart } from "@/lib/film/anthropic";
import { readKey } from "./model";
import { claudeCharged, type Who } from "./pricing";
import { stillOpen, type EditorProject } from "./server";

export const MAX_KEY_CHECKS = 3;

const SYSTEM = `You are حيدرة, the editor robot of «حيدرة كت», tuning a CHROMA KEY (removing a green/blue screen or a plain coloured wall) like a senior compositor who knows Keylight, Ultra Key, Primatte and Resolve's 3D keyer.

The keyer: a pixel is the screen when its HUE is within the tolerance of the key colour's hue, its SATURATION is close to the key's, and its colour strength (max−min) is not much weaker than the key's (so the screen's shadows go but a dark shirt with a little green glow stays). Settings, all 0–1:
- color "#rrggbb": the screen's colour. If the pictures show the screen is clearly another shade than the key colour (e.g. a darker or bluer green), correct it to the screen's real colour as filmed.
- tolerance (≈0.25–0.6): wider takes more around the colour (uneven light, shadows, folds); too wide eats the person (green/teal clothes, dark clothes, hair).
- soft (0.1–0.3): the edge's softness.
- clean («تنظيف الخلفية», Clip Black, 0–0.5): clears faint leftovers of the screen (grey haze, noise) in the black of the matte.
- fill («سد الفراغات», Clip White, 0–0.5): fills holes and see-through spots inside the person in the white of the matte.
- choke (0–0.5): pulls the edge in to remove a coloured fringe/halo; too much eats hair.
- spill (0–1): the despill, the screen's glow taken off the person's edges and hair (0.5–0.8 normal; 1 for heavy green fringe).
- hair (0–1, 0.5 normal): the colour-difference edge — how much a strand of hair over the screen keeps the alpha of its mix instead of being eaten (hue says "screen") or kept hard. Raise it when hair looks eaten or jagged; lower it when the screen's dim parts next to the person show through.
- steady (0–1, 0.5 normal): the matte pulled toward the previous frame's where the change is small, against flicker at the edge; raise for a noisy, flickering edge, lower if a fast move leaves a ghost.

How to judge the three pictures: in the MATTE the screen must be pure black and the person pure white with a clean edge (hair a little grey is fine). In the RESULT over the checkerboard: no green/blue fringe, no leftover patches of screen, no holes in the person. Change only what the pictures show is wrong, by modest steps (±0.05–0.15), and keep what is right. When it is good, ok=true with no changes. The measures help: "left" = share of the frame that still looks like the screen but is kept (leftovers), "holes" = share of the person's area that is partly see-through.

Reply in Gulf Arabic in "verdict" — one or two short sentences to the person on what you saw and changed (never name any AI model or company).`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["ok", "verdict", "key"],
  properties: {
    ok: { type: "boolean", description: "true when the key is right as it is." },
    verdict: { type: "string" },
    key: {
      type: "object",
      additionalProperties: false,
      description: "Only the settings to change (leave out the rest).",
      properties: {
        color: { type: "string" },
        tolerance: { type: "number" },
        soft: { type: "number" },
        clean: { type: "number" },
        fill: { type: "number" },
        choke: { type: "number" },
        spill: { type: "number" },
        hair: { type: "number" },
        steady: { type: "number" },
      },
    },
  },
};

const jpeg = (v: unknown) => (typeof v === "string" && /^[A-Za-z0-9+/=]+$/.test(v) && v.length < 600_000 ? v : null);

export async function keyCheck(p: EditorProject, who: Who, b: { clipId?: unknown; round?: unknown; key?: unknown; shots?: unknown; stats?: unknown; model?: unknown }) {
  stillOpen(p);
  if (!process.env.ANTHROPIC_API_KEY) throw new UserError("حيدرة غير مفعّل على الخادم.", 503);
  const key = readKey(b.key);
  const shots = (b.shots ?? {}) as Record<string, unknown>;
  const orig = jpeg(shots.orig),
    matte = jpeg(shots.matte),
    result = jpeg(shots.result);
  if (!key || key.kind !== "chroma" || !orig || !matte || !result) throw new UserError("ما وصلتني صور الكي.", 400);
  const round = Math.max(1, Math.min(MAX_KEY_CHECKS, Math.round(Number(b.round) || 1)));
  const st = (b.stats ?? {}) as Record<string, unknown>;
  const pct = (v: unknown) => `${Math.round(Math.min(1, Math.max(0, Number(v) || 0)) * 1000) / 10}%`;
  const { color, tolerance, soft, clean, fill, choke, spill } = key;
  const text = `ROUND ${round} of ${MAX_KEY_CHECKS}${round === MAX_KEY_CHECKS ? " (the last: give your best final settings)" : ""}.
THE KEY NOW: ${JSON.stringify({ color, tolerance, soft, clean, fill, choke, spill })}
MEASURES: kept ${pct(st.kept)} of the frame · left (screen-like but kept) ${pct(st.left)} · holes (partly see-through inside the person) ${pct(st.holes)} · the screen's colour as filmed (median) ${typeof st.screen === "string" && /^#[0-9a-f]{6}$/i.test(st.screen) ? st.screen : "?"}.`;
  const parts: ClaudePart[] = [
    { type: "text", text },
    { type: "text", text: "1) AS FILMED:" },
    { type: "image64", data: orig, mediaType: "image/jpeg" },
    { type: "text", text: "2) THE MATTE (white kept, black removed):" },
    { type: "image64", data: matte, mediaType: "image/jpeg" },
    { type: "text", text: "3) THE RESULT over a checkerboard:" },
    { type: "image64", data: result, mediaType: "image/jpeg" },
  ];
  const r = await claudeCharged(
    who,
    b.model,
    "حيدرة يضبط الكي في حيدرة كت",
    () =>
      callClaudeJson<{ ok: boolean; verdict: string; key: Record<string, unknown> }>({ system: SYSTEM, turns: [{ role: "user", content: parts }], schema: SCHEMA, maxTokens: 2000, effort: "low", fallback: true }).catch((e) => {
        console.error("key check", e);
        throw new UserError(claudeWhy(e, "ما قدر حيدرة يشيك الكي الحين.", who.email), 502);
      }),
    (x) => claudeCost(x.usage),
  );
  const change = cleanChange(r.data.key ?? {});
  const ok = r.data.ok || !Object.keys(change).length;
  return { ok, verdict: String(r.data.verdict ?? "").slice(0, 600), key: ok ? {} : change };
}

/** Only the settings Claude may change, each inside its bounds. */
export function cleanChange(v: Record<string, unknown>) {
  const out: Record<string, number | string> = {};
  if (typeof v.color === "string" && /^#[0-9a-f]{6}$/i.test(v.color)) out.color = v.color.toLowerCase();
  const lim: Record<string, [number, number]> = { tolerance: [0.1, 0.85], soft: [0, 0.6], clean: [0, 0.6], fill: [0, 0.6], choke: [0, 0.6], spill: [0, 1], hair: [0, 1], steady: [0, 1] };
  for (const [k, [lo, hi]] of Object.entries(lim)) {
    const n = Number(v[k]);
    if (v[k] !== undefined && v[k] !== null && Number.isFinite(n)) out[k] = Math.round(Math.min(hi, Math.max(lo, n)) * 100) / 100;
  }
  return out;
}
