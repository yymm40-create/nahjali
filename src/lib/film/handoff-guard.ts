// The screenwriter's handoff is what the sheet maker starts from. A light mind once answered a lesson's «اعتمد» with an
// empty handoff — only its title and its end line (23 Nov 2026) — and the sheet maker got no story, no screenplay and
// planned nothing. A handoff that short carries the approved screenplay itself. Pure.

const END = "نهاية رسالة التسليم";
/** A real handoff is thousands of characters; below this it is treated as empty. */
export const HANDOFF_MIN_CHARS = 600;

/** The handoff, with the approved screenplay added when the handoff is (nearly) empty and does not already hold it. */
export function completeHandoff(handoff: string, screenplay: string | null | undefined): string {
  const h = String(handoff ?? "").trim();
  const sp = String(screenplay ?? "").trim();
  if (!sp || h.length >= HANDOFF_MIN_CHARS || h.includes(sp.slice(0, 200))) return h;
  const body = h.split(END).join("").trim();
  return `${body ? `${body}\n\n` : ""}# السيناريو المعتمد (كما اعتمده المستخدم)\n\n${sp}\n\n${END}`;
}
