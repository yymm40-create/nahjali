// A film assistant's conversation (one per stage): stored messages, and the Claude turns built from them.

import { createAdminClient } from "@/lib/supabase/admin";
import type { ClaudePart, ClaudeTurn } from "./anthropic";
import { FILM_BUCKET } from "./types";

import { storage } from "@/lib/storage";
const db = () => createAdminClient();

/** [[image:<asset id>]] inside a user message is sent to Claude as the real picture. */
export const IMAGE_MARK = /\[\[image:([0-9a-f-]{36})\]\]/g;

export async function addMessage(projectId: string, stage: string, content: string) {
  const { data, error } = await db().from("film_messages").insert({ project_id: projectId, stage, role: "user", content }).select("id").single();
  if (error) throw error;
  return data.id as string;
}

/** Builds Claude turns; [[image:id]] markers become real images (short-lived links). */
export async function buildTurns(projectId: string, stage: string): Promise<ClaudeTurn[]> {
  const client = db();
  const { data } = await client
    .from("film_messages")
    .select("role,content")
    .eq("project_id", projectId)
    .eq("stage", stage)
    .order("created_at", { ascending: true });
  const msgs = (data ?? []) as { role: "user" | "assistant"; content: string }[];
  const ids = [...new Set(msgs.flatMap((m) => [...m.content.matchAll(IMAGE_MARK)].map((x) => x[1])))];
  const urls: Record<string, string> = {};
  if (ids.length) {
    // only this project's pictures (an id typed into a message can't pull in someone else's)
    const { data: rows } = await client.from("film_assets").select("id,storage_path").eq("project_id", projectId).in("id", ids);
    for (const r of rows ?? []) {
      if (!r.storage_path) continue;
      const s = await storage.from(FILM_BUCKET).createSignedUrl(r.storage_path, 3600);
      if (s.data) urls[r.id] = s.data.signedUrl;
    }
  }
  const toParts = (text: string): ClaudePart[] => {
    const parts: ClaudePart[] = [];
    let last = 0;
    for (const m of text.matchAll(IMAGE_MARK)) {
      if (m.index! > last) parts.push({ type: "text", text: text.slice(last, m.index) });
      if (urls[m[1]]) parts.push({ type: "image", url: urls[m[1]] });
      else parts.push({ type: "text", text: "(الصورة غير متاحة)" });
      last = m.index! + m[0].length;
    }
    if (last < text.length) parts.push({ type: "text", text: text.slice(last) });
    return parts.length ? parts : [{ type: "text", text }];
  };
  const turns: ClaudeTurn[] = [];
  for (const m of msgs) {
    const parts = m.role === "user" ? toParts(m.content) : [{ type: "text" as const, text: m.content }];
    const prev = turns.at(-1);
    if (prev && prev.role === m.role) (prev.content as ClaudePart[]).push({ type: "text", text: "\n\n" }, ...parts);
    else turns.push({ role: m.role, content: parts });
  }
  return turns;
}
