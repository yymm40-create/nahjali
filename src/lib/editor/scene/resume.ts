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

/** The continuation request's own words (appended to the writing request). */
export const continueAsk = (written: string) => `
YOUR REPLY WAS CUT OFF. THIS IS WHAT YOU HAD ALREADY WRITTEN OF THE PROGRAM (do not write it again):
<<<WRITTEN
${written}
WRITTEN>>>
Return in "code" ONLY the rest of the program: begin at the very next character after the last one above (even in the middle of a word, a string or a line), never restart and never repeat a line that is already written. The finished program is the written part followed by yours, and it must be complete.`;
