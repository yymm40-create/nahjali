// «مختبر الموشن»: a program too long to be written inside the platform's time for one request is written in pieces — when
// the time comes the part written so far goes back to the page, and the next request continues from its last character
// instead of starting again. Pure.

/** The scene program written so far, read out of a reply that stopped in the middle of `{"code":"…`. */
export function partialCode(raw: string): string {
  const start = /"code"\s*:\s*"/.exec(raw);
  if (!start) return "";
  let i = start.index + start[0].length;
  let out = "";
  for (; i < raw.length; i++) {
    const c = raw[i];
    if (c === '"') break;
    if (c !== "\\") {
      out += c;
      continue;
    }
    const n = raw[i + 1];
    if (n === undefined) break;
    if (n === "u") {
      const hex = raw.slice(i + 2, i + 6);
      if (!/^[0-9a-fA-F]{4}$/.test(hex)) break;
      out += String.fromCharCode(parseInt(hex, 16));
      i += 5;
      continue;
    }
    out += ({ n: "\n", t: "\t", r: "\r", b: "\b", f: "\f", '"': '"', "\\": "\\", "/": "/" } as Record<string, string>)[n] ?? n;
    i += 1;
  }
  return out;
}

/** The written part followed by its continuation, without what the continuation repeated of the end of the written part. */
export function stitchCode(written: string, rest: string): string {
  const head = rest.replace(/^```[a-z]*\n?/, "");
  if (!written) return head;
  for (let k = Math.min(written.length, head.length, 600); k >= 40; k--) {
    if (written.endsWith(head.slice(0, k))) return written + head.slice(k);
  }
  return written + head;
}

/** The continuation request's own words (a part added after the step's request). */
export const continueAsk = (written: string) => `
YOUR REPLY WAS CUT OFF BEFORE IT ENDED. THIS IS EXACTLY WHAT YOU HAD ALREADY WRITTEN OF YOUR JSON REPLY (do not write it again):
<<<WRITTEN
${written}
WRITTEN>>>
Now output ONLY the remaining characters of that same JSON reply, as plain text: begin at the very next character after the last one above (even in the middle of a word, a string, an escape or a line), never restart, never repeat anything already written, no code fences, no commentary. The written part followed by your output must be one complete, valid JSON document that satisfies the schema you were given.`;

/** The effort below this one (the next request thinks less when a whole request went by with nothing written). */
export const lowerEffort = (e: string): "low" | "medium" | "high" | "xhigh" => (e === "xhigh" ? "high" : e === "high" ? "medium" : "low");
export const effortAtMost = <E extends "low" | "medium" | "high" | "xhigh">(e: E, cap: unknown): "low" | "medium" | "high" | "xhigh" => {
  const rank = { low: 0, medium: 1, high: 2, xhigh: 3 } as const;
  const c = typeof cap === "string" && cap in rank ? (cap as keyof typeof rank) : null;
  return c && rank[c] < rank[e] ? c : e;
};
