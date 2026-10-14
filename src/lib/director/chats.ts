import { createAdminClient } from "@/lib/supabase/admin";
import { JAWAD_ATTACHMENT_LIMIT } from "@config/jawad/limits";

const db = () => createAdminClient();
const str = (value: unknown, max: number) => (typeof value === "string" ? value.replace(/\u0000/g, "").slice(0, max) : "");

export interface DirectorAttachment {
  id: string;
  kind: "image" | "video" | "audio" | "doc";
  name: string;
  durationMs: number | null;
}

export interface DirectorQuestion {
  label: string;
  options: string[];
  multi: boolean;
}

export interface DirectorMedia {
  id: string;
  kind: "image" | "video";
  name: string;
  prompt: string;
  generatorId: string;
  aspect: string;
  quality: string;
  resolution: string;
  seconds: number;
  withSound: boolean;
  coins: number | null;
  jobId?: string;
  state?: "running" | "done" | "failed";
  status?: string;
  fileId?: string;
  error?: string;
}

export interface DirectorTurn {
  role: "user" | "assistant";
  text: string;
  files?: DirectorAttachment[];
  questions?: DirectorQuestion[];
  media?: DirectorMedia[];
  error?: boolean;
}

export interface DirectorChat {
  id: string;
  title: string;
  messages: DirectorTurn[];
  handoff: string;
  parentChatId: string | null;
  updatedAt: string;
  context: DirectorContext;
}

export interface DirectorContext {
  level: "safe" | "warning" | "critical";
  percent: number;
  turns: number;
  chars: number;
  shouldHandoff: boolean;
}

const ASPECTS = ["1:1", "16:9", "9:16", "3:2", "2:3", "4:3", "3:4", "21:9"];

const readFiles = (value: unknown): DirectorAttachment[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const files = value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && typeof item.id === "string")
    .map((item) => ({
      id: item.id as string,
      kind: (item.kind === "video" || item.kind === "audio" || item.kind === "doc" ? item.kind : "image") as DirectorAttachment["kind"],
      name: str(item.name, 200),
      durationMs: typeof item.durationMs === "number" ? item.durationMs : null,
    }))
    .slice(0, JAWAD_ATTACHMENT_LIMIT);
  return files.length ? files : undefined;
};

export function readQuestions(value: unknown): DirectorQuestion[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const questions = value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => ({
      label: str(item.label, 300),
      options: (Array.isArray(item.options) ? item.options : []).filter((option): option is string => typeof option === "string").map((option) => option.slice(0, 180)).slice(0, 8),
      multi: item.multi === true,
    }))
    .filter((item) => item.label && item.options.length)
    .slice(0, 4);
  return questions.length ? questions : undefined;
}

export function readMedia(value: unknown, at = Date.now()): DirectorMedia[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const media = value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item, index): DirectorMedia => {
      const video = item.kind === "video";
      const aspect = str(item.aspect, 10);
      const resolution = str(item.resolution, 10);
      return {
        id: str(item.id, 60) || `director-${at}-${index}`,
        kind: video ? "video" : "image",
        name: str(item.name, 160) || (video ? `لقطة ${index + 1}` : `صورة ${index + 1}`),
        prompt: str(item.prompt, 10000),
        generatorId: str(item.generatorId ?? item.generator_id, 100),
        aspect: ASPECTS.includes(aspect) ? aspect : video ? "16:9" : "1:1",
        quality: ["low", "medium", "high"].includes(str(item.quality, 10)) ? str(item.quality, 10) : "high",
        resolution: video ? (["480p", "720p", "1080p", "4k"].includes(resolution.toLowerCase()) ? resolution.toLowerCase() : "1080p") : resolution === "hi" ? "hi" : "std",
        seconds: video ? Math.max(4, Math.min(15, Math.round(Number(item.seconds) || 5))) : 0,
        withSound: video ? item.withSound !== false && item.with_sound !== false : false,
        coins: typeof item.coins === "number" ? item.coins : null,
        ...(typeof item.jobId === "string" ? { jobId: item.jobId } : {}),
        ...(item.state === "running" || item.state === "done" || item.state === "failed" ? { state: item.state } : {}),
        ...(typeof item.status === "string" ? { status: str(item.status, 160) } : {}),
        ...(typeof item.fileId === "string" ? { fileId: item.fileId } : {}),
        ...(typeof item.error === "string" ? { error: str(item.error, 500) } : {}),
      };
    })
    .filter((item) => item.prompt)
    .slice(0, 12);
  return media.length ? media : undefined;
}

export function cleanTurns(value: unknown): DirectorTurn[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): DirectorTurn[] => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const role = row.role === "assistant" ? "assistant" : row.role === "user" ? "user" : null;
    if (!role) return [];
    const text = str(row.text, role === "user" ? 20000 : 50000);
    const files = readFiles(row.files);
    const questions = role === "assistant" ? readQuestions(row.questions) : undefined;
    const media = role === "assistant" ? readMedia(row.media) : undefined;
    if (!text.trim() && !files && !media) return [];
    return [{ role, text, ...(files ? { files } : {}), ...(questions ? { questions } : {}), ...(media ? { media } : {}), ...(row.error === true ? { error: true } : {}) }];
  }).slice(-160);
}

export function contextOf(messages: DirectorTurn[]): DirectorContext {
  const chars = messages.reduce((sum, turn) => sum + turn.text.length + (turn.media?.reduce((n, media) => n + media.prompt.length, 0) ?? 0) + (turn.files?.length ?? 0) * 2500, 0);
  const turns = messages.filter((turn) => turn.role === "user").length;
  const pressure = Math.max(chars / 120000, turns / 30);
  const percent = Math.min(100, Math.round(pressure * 100));
  const level = pressure >= 0.82 ? "critical" : pressure >= 0.6 ? "warning" : "safe";
  return { level, percent, turns, chars, shouldHandoff: level !== "safe" };
}

const titleOf = (text: string) => text.replace(/\s+/g, " ").trim().slice(0, 70) || "مشروع إخراج جديد";

const view = (row: Record<string, unknown>): DirectorChat => {
  const messages = cleanTurns(row.messages);
  return {
    id: String(row.id),
    title: String(row.title || "مشروع إخراج جديد"),
    messages,
    handoff: str(row.handoff, 50000),
    parentChatId: typeof row.parent_chat_id === "string" ? row.parent_chat_id : null,
    updatedAt: String(row.updated_at ?? ""),
    context: contextOf(messages),
  };
};

export async function listDirectorChats(userId: string) {
  const { data, error } = await db().from("jawad_director_chats").select("id,title,updated_at,handoff").eq("user_id", userId).order("updated_at", { ascending: false }).limit(100);
  if (error) throw error;
  return (data ?? []).map((row) => ({ id: String(row.id), title: String(row.title || "مشروع إخراج جديد"), updatedAt: String(row.updated_at), handoffReady: Boolean(row.handoff) }));
}

export async function getDirectorChat(userId: string, id: string): Promise<DirectorChat | null> {
  const { data, error } = await db().from("jawad_director_chats").select("*").eq("id", id).eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data ? view(data as Record<string, unknown>) : null;
}

export async function createDirectorChat(userId: string, messages: DirectorTurn[], parentChatId: string | null = null) {
  const first = messages.find((turn) => turn.role === "user")?.text ?? "";
  const { data, error } = await db().from("jawad_director_chats").insert({ user_id: userId, parent_chat_id: parentChatId, title: titleOf(first), messages }).select("id").single();
  if (error) throw error;
  return String(data.id);
}

export async function saveDirectorChat(userId: string, id: string, messages: DirectorTurn[], addUsd = 0) {
  const { data } = await db().from("jawad_director_chats").select("usd").eq("id", id).eq("user_id", userId).maybeSingle();
  if (!data) throw new Error("chat not found");
  const { error } = await db().from("jawad_director_chats").update({ messages: cleanTurns(messages), usd: Number(data.usd ?? 0) + addUsd, updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", userId);
  if (error) throw error;
}

export async function saveHandoff(userId: string, id: string, handoff: string) {
  const { error } = await db().from("jawad_director_chats").update({ handoff: handoff.slice(0, 50000), updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", userId);
  if (error) throw error;
}

export async function deleteDirectorChat(userId: string, id: string) {
  const { error } = await db().from("jawad_director_chats").delete().eq("id", id).eq("user_id", userId);
  if (error) throw error;
}

export function findDirectorMedia(chat: DirectorChat, mediaId: string) {
  for (let index = chat.messages.length - 1; index >= 0; index--) {
    const media = chat.messages[index].media?.find((item) => item.id === mediaId);
    if (media) return { turn: index, media };
  }
  return null;
}

export function replaceDirectorMedia(messages: DirectorTurn[], turn: number, media: DirectorMedia) {
  return messages.map((message, index) => index === turn && message.media ? { ...message, media: message.media.map((item) => item.id === media.id ? media : item) } : message);
}
