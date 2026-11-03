"use client";

// «ولّد كل الجمل»: before the lines are spoken one by one, their pronunciation («النطق الدقيق») is prepared for all of
// them in ONE request (one Claude call on the server instead of one per line). Each line's prepared text comes back
// sealed and goes with that line's «speak».

import { postJson } from "@/lib/fetch";

/** Lines prepared in one request at most (the server's PREPARE_MAX_LINES): a longer film is prepared in groups. */
export const PREPARE_GROUP = 40;

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

/** The sealed prepared text of each line; nothing when it can't be prepared now (each line is then checked on its own). */
export async function prepareLines(url: string, keys: string[], o: { diction?: string; model: string }): Promise<Record<string, string>> {
  if (keys.length < 2 || o.diction === "off") return {};
  try {
    const r = await postJson<{ prepared?: Record<string, string> }>(url, { action: "prepare", keys, idempotencyKey: uid(), model: o.model, ...(o.diction ? { diction: o.diction } : {}) });
    return r.prepared ?? {};
  } catch {
    return {};
  }
}
