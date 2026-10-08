// «مصدر الحوار» — where a film's dialogue voices come from, as the person answered the screenwriter's question
// (written in his handoff's «قرارات الإخراج» as one line «مصدر الحوار: …»). The generation page starts every shot
// on that choice; it can still be changed per shot. Pure, no I/O.

/** make: JAWAD's voices made here, attached as reference audio · upload: the person's own audio, attached · self: the
 * generator speaks the lines itself · later: no dialogue in the video (added in the montage). */
export type DialogueSource = "make" | "upload" | "self" | "later";

/** The choice in a handoff, or null when it has none (an older film, or a story without spoken lines). */
export function dialogueSource(handoff: string | null | undefined): DialogueSource | null {
  const line = /مصدر\s*الحوار\s*[:：]\s*([^\n]+)/.exec(handoff ?? "")?.[1];
  if (!line) return null;
  if (/جهاز|أرفع|ارفع/.test(line)) return "upload";
  if (/بدون\s*حوار|المونتاج|بعدين/.test(line)) return "later";
  if (/بدون\s*أصوات\s*مرجعية|بنفسه/.test(line)) return "self";
  if (/تتولّ?د|الفويسات|أصوات\s*الجواد|هنا/.test(line)) return "make";
  return null;
}

/** The per-shot dialogue mode the generation page starts on. */
export function startingMode(source: DialogueSource | null, voicesOn: boolean): "make" | "upload" | "none" {
  if (source === "upload") return "upload";
  if (source === "self" || source === "later") return "none";
  return voicesOn ? "make" : "none";
}
