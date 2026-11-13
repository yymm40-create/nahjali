// «🎥 حركة الكاميرا» in the video studio: the camera moves a person can pick (one at a time), each with an Arabic name,
// a short Arabic explanation, and the English camera phrase put into the prompt — written the way each video generator
// reads camera language best:
//   · Seedance (2.0 / 2.5 / وجه واقعي): «Camera: <term> (<Chinese term>) — <what the camera does>.» The Super Director's
//     camera table pairs every move with its Chinese term (config/film-prompts/director.ts, Appendix A) and Seedance is
//     prompted in English with a Chinese twin, so the move carries both.
//   · Kling: «Camera movement: <what the camera does>.» Kling's guide puts the camera language as its own sentence after
//     the subject and the scene.
//   · Wan: «<Term> shot, <what the camera does>.» Wan reads named shot types («tracking shot», «arc shot»…).
//   · Gemini Omni: «Camera motion: <term>, <what the camera does>.» It reads cinematography terms in plain prose.
//   · anything else: «Camera: <term>.»
// Pure (the studio and the tests share it). The previews are drawn in code (CameraMoves.tsx), no media.

export type CameraFamily = "seedance" | "kling" | "wan" | "omni" | "other";

export interface CameraMove {
  id: string;
  /** the name on the card */
  ar: string;
  /** one line in plain Arabic: what the viewer sees */
  hint: string;
  /** the camera term in English */
  term: string;
  /** the same move in Chinese (Seedance) */
  zh: string;
  /** what the camera does, as a sentence in English (lower case, no full stop) */
  does: string;
}

export const CAMERA_MOVES: CameraMove[] = [
  { id: "push_in", ar: "دفع للأمام", hint: "الكاميرا تتقدّم ببطء نحو الشخص", term: "slow push-in", zh: "推镜头", does: "the camera glides steadily forward toward the subject" },
  { id: "pull_out", ar: "سحب للخلف", hint: "الكاميرا ترجع وتكشف المكان حوله", term: "slow pull-back", zh: "拉镜头", does: "the camera moves steadily backward away from the subject, revealing the surroundings" },
  { id: "orbit", ar: "دوران حوله", hint: "الكاميرا تلف حول الشخص وهو بالنص", term: "orbit shot", zh: "环绕镜头", does: "the camera circles smoothly around the subject, keeping it centered" },
  { id: "crane_up", ar: "رافعة للأعلى", hint: "الكاميرا ترتفع فوق المشهد", term: "crane up", zh: "升镜头", does: "the camera rises smoothly upward, lifting above the scene" },
  { id: "crane_down", ar: "رافعة للأسفل", hint: "الكاميرا تنزل من فوق لمستوى الشخص", term: "crane down", zh: "降镜头", does: "the camera descends smoothly from high above down to the subject's level" },
  { id: "dolly_left", ar: "انزلاق لليسار", hint: "الكاميرا تمشي جانبيًا لليسار", term: "lateral dolly left", zh: "左移镜头", does: "the camera slides sideways to the left, parallel to the subject" },
  { id: "dolly_right", ar: "انزلاق لليمين", hint: "الكاميرا تمشي جانبيًا لليمين", term: "lateral dolly right", zh: "右移镜头", does: "the camera slides sideways to the right, parallel to the subject" },
  { id: "tracking", ar: "تتبّع", hint: "الكاميرا تمشي مع الشخص وهو يتحرك", term: "tracking shot", zh: "跟拍", does: "the camera follows the subject as it moves, keeping pace beside it" },
  { id: "handheld", ar: "كاميرا باليد", hint: "اهتزاز خفيف طبيعي كأنها بيد مصوّر", term: "handheld camera", zh: "手持摄影", does: "the camera is handheld with a slight natural shake, documentary feel" },
  { id: "crash_zoom", ar: "زوم خاطف", hint: "تقريب سريع جدًا على الشخص فجأة", term: "crash zoom", zh: "急推变焦", does: "the lens snaps in very fast onto the subject in a sudden zoom" },
  { id: "dolly_zoom", ar: "زوم الدوخة", hint: "الشخص ثابت والخلفية تتمدد حوله (فيرتيغو)", term: "dolly zoom (vertigo effect)", zh: "希区柯克变焦", does: "the camera moves back while zooming in, so the subject keeps its size as the background stretches" },
  { id: "fpv", ar: "طيران درون FPV", hint: "درون سريع يطير بين الأشياء", term: "FPV drone fly-through", zh: "穿越机航拍", does: "a fast FPV drone flies forward through the scene, weaving close past objects" },
  { id: "bullet_time", ar: "زمن الرصاصة", hint: "الوقت يوقف والكاميرا تلف حول اللحظة", term: "bullet time", zh: "子弹时间", does: "time freezes and the camera sweeps around the frozen subject" },
  { id: "top_down", ar: "من فوق تمامًا", hint: "نظرة عمودية من فوق الشخص", term: "top-down overhead shot", zh: "俯视镜头", does: "the camera looks straight down from directly above the subject" },
  { id: "tilt_up", ar: "إمالة للأعلى", hint: "الكاميرا مكانها وتميل من الأرض لفوق", term: "tilt up", zh: "上摇镜头", does: "the camera stays in place and tilts upward from the ground to reveal the subject's full height" },
  { id: "whip_pan", ar: "لفّة خاطفة", hint: "التفاتة سريعة مموّهة للجهة الثانية", term: "whip pan", zh: "甩镜头", does: "the camera whips sideways in a fast blurred pan to the next view" },
  { id: "static", ar: "ثابتة", hint: "الكاميرا ما تتحرك، الشخص بس يتحرك", term: "static locked-off shot", zh: "固定镜头", does: "the camera stays completely still on a tripod; only the subject moves" },
];

export const cameraMoveById = (id: string) => CAMERA_MOVES.find((m) => m.id === id);

/** How a video generator reads camera language (by its id in config/jawad/generators.ts). */
export function cameraFamily(generatorId: string): CameraFamily {
  if (generatorId.includes("seedance")) return "seedance";
  if (generatorId.startsWith("kling")) return "kling";
  if (generatorId.startsWith("wan")) return "wan";
  if (generatorId.startsWith("gemini-omni")) return "omni";
  return "other";
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The phrase a move puts into the prompt for this generator. */
export function cameraPhrase(move: CameraMove, generatorId: string): string {
  switch (cameraFamily(generatorId)) {
    case "seedance":
      return `Camera: ${move.term} (${move.zh}) — ${move.does}.`;
    case "kling":
      return `Camera movement: ${cap(move.does)}.`;
    case "wan":
      return `${cap(move.term)} shot, ${move.does}.`;
    case "omni":
      return `Camera motion: ${move.term}, ${move.does}.`;
    default:
      return `Camera: ${move.term}.`;
  }
}

const FAMILIES: CameraFamily[] = ["seedance", "kling", "wan", "omni", "other"];
const SAMPLE: Record<CameraFamily, string> = { seedance: "byteplus-seedance-2-5", kling: "kling-4", wan: "wan-3-0", omni: "gemini-omni", other: "" };

/** The move already in a prompt (written for any generator), with the exact phrase found; null when there is none. */
export function findCameraMove(prompt: string): { move: CameraMove; phrase: string } | null {
  for (const move of CAMERA_MOVES) {
    for (const f of FAMILIES) {
      const phrase = cameraPhrase(move, SAMPLE[f]);
      if (prompt.includes(phrase)) return { move, phrase };
    }
  }
  return null;
}

/** The prompt without its camera move (the line it was on goes too when it held nothing else). */
export function removeCameraMove(prompt: string): string {
  const found = findCameraMove(prompt);
  if (!found) return prompt;
  const own = prompt.includes(`\n${found.phrase}`) ? `\n${found.phrase}` : found.phrase;
  return prompt.replace(own, "").trim();
}

/** The prompt with this move (one at a time: a move already there is replaced), on its own line at the end. */
export function setCameraMove(prompt: string, move: CameraMove, generatorId: string): string {
  const rest = removeCameraMove(prompt).trim();
  const phrase = cameraPhrase(move, generatorId);
  return rest ? `${rest}\n${phrase}` : phrase;
}
