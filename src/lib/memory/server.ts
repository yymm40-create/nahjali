// «ذاكرتي» on the server: one memory per account — what the robots learned about the person (their goals, projects,
// usual ideas, style, preferences, who they make for). Read before every robot turn (unless the person turned it off,
// for good or for this conversation), and updated after it by a short call. The person sees, edits and clears it at
// /jawad-ai/memory. Server only.

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { callClaudeJson } from "@/lib/film/anthropic";
import { MEMORY_OFF_HEADER } from "./context";

const db = () => createAdminClient();
const missing = (e: { code?: string; message?: string } | null) => !!e && (e.code === "42P01" || e.code === "PGRST205" || /relation .* does not exist|Could not find the table/i.test(e.message ?? ""));
let tableOff = false;

export const MEMORY_MAX = 4000;

export interface Memory {
  enabled: boolean;
  notes: string;
  updatedAt: string | null;
  ready: boolean;
}

export async function getMemory(userId: string): Promise<Memory> {
  if (tableOff) return { enabled: true, notes: "", updatedAt: null, ready: false };
  const { data, error } = await db().from("user_memory").select("enabled,notes,updated_at").eq("user_id", userId).maybeSingle();
  if (error) {
    if (missing(error)) tableOff = true;
    return { enabled: true, notes: "", updatedAt: null, ready: !missing(error) };
  }
  // a new account: on, empty (the owner's choice)
  return { enabled: data ? data.enabled !== false : true, notes: String(data?.notes ?? ""), updatedAt: (data?.updated_at as string | null) ?? null, ready: true };
}

export async function saveMemory(userId: string, patch: { enabled?: boolean; notes?: string }) {
  const row: Record<string, unknown> = { user_id: userId, updated_at: new Date().toISOString() };
  if (patch.enabled !== undefined) row.enabled = patch.enabled;
  if (patch.notes !== undefined) row.notes = patch.notes.slice(0, MEMORY_MAX);
  const { error } = await db().from("user_memory").upsert(row, { onConflict: "user_id" });
  if (error) throw error;
}

/** Whether the page asked for this conversation to go without the memory. */
async function offHere(): Promise<boolean> {
  try {
    return (await headers()).get(MEMORY_OFF_HEADER) === "off";
  } catch {
    return false;
  }
}

/** What a robot's turn reads: the notes when the memory is on (for the account and for this conversation), else "". */
export async function memoryFor(userId: string): Promise<{ notes: string; learn: boolean }> {
  if (await offHere()) return { notes: "", learn: false };
  const m = await getMemory(userId);
  if (!m.ready || !m.enabled) return { notes: "", learn: false };
  return { notes: m.notes, learn: true };
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["changed", "notes"],
  properties: {
    changed: { type: "boolean", description: "true only when this exchange taught something new and lasting about the person" },
    notes: { type: "string", description: "The whole memory, rewritten (when changed), as short Arabic bullet lines; empty when unchanged" },
  },
};

const SYSTEM = `أنت تحدّث «ذاكرة» شخص في منصة الجواد الذكي: ملاحظات قصيرة تعرّف الروبوتات به في كل محادثة.
احفظ فقط ما يدوم ويفيد لاحقًا: اسمه إن ذكره، عمله ومجاله، مشاريعه الجارية (اسم المشروع وما هو)، جمهوره، أسلوبه وذوقه (ألوان، خطوط، نبرة، لهجة)، أفكاره المعتادة، ما يحبه وما يكرهه، أدواته وقنواته.
لا تحفظ: تفاصيل طلب واحد عابر، كلمات سر أو أرقام حسابات أو بيانات بنكية أو هويات أو عناوين بيوت أو أرقام جوالات، صحته أو أموره الحساسة إلا إن طلب حفظها صراحة، ولا أي شي عن غيره من الناس.
إن طلب الشخص «تذكّر كذا» فاحفظه. إن طلب «انسَ كذا» فاحذفه.
اكتب الذاكرة كاملة من جديد إذا تغيّرت: نقاط قصيرة بالعربية، مجمّعة، بلا تكرار، لا تتجاوز ٢٥ نقطة؛ وإن لم يتغير شي فاجعل changed=false.`;

/** After a turn: the memory learns what lasted from it (a short, cheap call; never fails the turn). */
export async function learn(userId: string, said: string, reply: string, notes: string) {
  const s = said.trim();
  if (!s) return;
  try {
    const r = await callClaudeJson<{ changed: boolean; notes: string }>({
      system: SYSTEM,
      turns: [{ role: "user", content: `الذاكرة الحالية:\n${notes || "(فاضية)"}\n\n────\n\nما قاله الشخص الآن:\n${s.slice(0, 3000)}\n\n────\n\nرد الروبوت (للسياق فقط):\n${reply.slice(0, 1500)}` }],
      schema: SCHEMA,
      maxTokens: 2000,
      effort: "low",
    });
    if (r.data.changed && r.data.notes.trim() && r.data.notes.trim() !== notes.trim()) await saveMemory(userId, { notes: r.data.notes.trim() });
  } catch (e) {
    console.error("memory learn", e instanceof Error ? e.message : e);
  }
}
