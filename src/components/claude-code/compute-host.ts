// «Claude Code» in the browser — runs one program Claude wrote (a grade, an edit) in the compute page: a fresh sandboxed
// iframe for every run (scripts only, no same-origin, no network), given up on after a few seconds, then removed. The
// program can't reach the site, the account or its storage, and a program that never ends can't hang the page.

import { computeDoc, GRADE_LUT_SIZE, type ProgramKind } from "@/lib/claude-code/compute";

export class ProgramError extends Error {
  constructor(message: string, public stack2 = "") {
    super(message);
  }
}

const TIMEOUT_MS = 8000;

function run<T>(kind: ProgramKind, code: string, extra: Record<string, unknown>, pick: (m: Record<string, unknown>) => T): Promise<T> {
  return new Promise((resolve, reject) => {
    const el = document.createElement("iframe");
    el.setAttribute("sandbox", "allow-scripts");
    el.setAttribute("aria-hidden", "true");
    el.style.cssText = "position:fixed;width:1px;height:1px;left:-10px;top:-10px;opacity:0;pointer-events:none;border:0";
    let done = false;
    const end = (fn: () => void) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      window.removeEventListener("message", onMsg);
      el.remove();
      fn();
    };
    const timer = setTimeout(() => end(() => reject(new ProgramError(`the program did not finish within ${TIMEOUT_MS / 1000} s (an endless loop, or far too much work)`))), TIMEOUT_MS);
    const onMsg = (e: MessageEvent) => {
      if (e.source !== el.contentWindow) return;
      const m = (e.data ?? {}) as Record<string, unknown>;
      if (m.type === "boot") el.contentWindow?.postMessage({ type: "run", id: 1, kind, code, ...extra }, "*");
      else if (m.type === "result") end(() => resolve(pick(m)));
      else if (m.type === "error") end(() => reject(new ProgramError(String(m.message ?? "error"), String(m.stack ?? ""))));
    };
    window.addEventListener("message", onMsg);
    el.srcdoc = computeDoc();
    document.body.appendChild(el);
  });
}

/** A grade program sampled into a 3D LUT (size³ × 3 bytes, red fastest). */
export const runGrade = (code: string, size = GRADE_LUT_SIZE) => run("grade", code, { size }, (m) => m.lut as Uint8Array);

/** An edit program run on the timeline's facts: the commands it returns. */
export const runEdit = (code: string, facts: unknown) => run("edit", code, { input: facts }, (m) => (Array.isArray(m.commands) ? m.commands : []) as unknown[]);

/** Bytes as base64 (for a Lut3D's data). */
export function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
