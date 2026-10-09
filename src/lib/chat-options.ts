// Clickable answers in every chat of JAWAD AI: a reply ends with a few short options the person can press, and the
// page always adds «✍️ اكتب إجابة مختلفة». A chat whose answer is plain text carries them in a closing block (below);
// a chat whose answer is structured (the content maker) has an `options` field and needs none of this.
// Colours written as #RRGGBB anywhere in a reply or an option are drawn as swatches. Pure (server and browser).

export const OPTIONS_OPEN = "[[خيارات]]";
export const OPTIONS_CLOSE = "[[/خيارات]]";

/** What a plain-text persona is told (added to its platform rules, after the owner's template). */
export const OPTIONS_RULE = `خيارات قابلة للضغط (تسري دائمًا): اختم كل ردّ فيه سؤال أو قرار يحتاجه العميل بكتلة خيارات قصيرة يضغط عليها بدل أن يكتب، بهذه الصيغة حرفيًا في آخر الردّ:
${OPTIONS_OPEN}
- الخيار الأول
- الخيار الثاني
- الخيار الثالث
${OPTIONS_CLOSE}
من ٢ إلى ٦ خيارات، كل خيار جملة قصيرة تصلح أن تُرسل كما هي ردًّا منه (مثل «أبي لعبة جماعية»)، وتغطي الإجابات المرجّحة. الموقع يضيف دائمًا زر «اكتب إجابة مختلفة»، فلا تكتبه أنت. إذا كان الخيار لونًا أو لوحة ألوان فاكتب رموزها بصيغة #RRGGBB داخل الخيار (مثل «كحلي وذهبي — #0B1F3A #D4AF37 #FFFFFF») ليراها العميل ألوانًا. لا تكرر الخيارات في متن الردّ، وإذا لم يكن في ردّك سؤال أو قرار فلا تكتب الكتلة.`;

const BLOCK = /\[\[\s*خيارات\s*\]\]([\s\S]*?)(?:\[\[\s*\/\s*خيارات\s*\]\]|$)/;

/** The reply without its options block, and the options (at most 8, each at most 140 characters). */
export function splitOptions(text: string): { body: string; options: string[] } {
  const all = [...text.matchAll(new RegExp(BLOCK.source, "g"))];
  const m = all[all.length - 1];
  if (!m || m.index === undefined) return { body: text, options: [] };
  const options = m[1]
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-•*▪◆]|\d+[.)]|[٠-٩]+[.)])\s*/, "").trim())
    .filter((l) => l.length > 0)
    .map((l) => l.slice(0, 140))
    .slice(0, 8);
  const body = (text.slice(0, m.index) + text.slice(m.index + m[0].length)).replace(/\s+$/, "");
  return { body, options };
}

/** The colours written as #RRGGBB in a text, upper-cased, without repeats (at most 8). */
export function hexColors(s: string): string[] {
  return [...new Set((s.match(/#[0-9a-fA-F]{6}\b/g) ?? []).map((c) => c.toUpperCase()))].slice(0, 8);
}

/** A text cut into plain runs and #RRGGBB colours (the browser draws the colours as swatches). */
export function splitColors(s: string): { text: string; color: boolean }[] {
  const out: { text: string; color: boolean }[] = [];
  let last = 0;
  for (const m of s.matchAll(/#[0-9a-fA-F]{6}\b/g)) {
    if (m.index! > last) out.push({ text: s.slice(last, m.index), color: false });
    out.push({ text: m[0].toUpperCase(), color: true });
    last = m.index! + m[0].length;
  }
  if (last < s.length) out.push({ text: s.slice(last), color: false });
  return out;
}
