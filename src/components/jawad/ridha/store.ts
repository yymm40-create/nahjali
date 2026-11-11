// «الرضا فويس» — the project in memory with its undo history, and its home on the device (IndexedDB): projects and
// their recordings are kept in this browser, saved a moment after every change, and travel between devices as one
// «.ridha» file.

import { useSyncExternalStore } from "react";
import { encodeWav } from "@/lib/ridha/dsp/wav";
import { usedSounds } from "@/lib/ridha/ops";
import { SR, uid, type Project } from "@/lib/ridha/model";
import { decodeFile, getSound, putSound } from "./engine";

const HISTORY = 80;

export class Store {
  private project: Project;
  private past: Project[] = [];
  private future: Project[] = [];
  private listeners = new Set<() => void>();
  private lastMerge = "";
  private lastAt = 0;
  constructor(p: Project) {
    this.project = p;
  }
  get = () => this.project;
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  };
  /**
   * The next state of the project. `merge` names a continuous gesture (a fader being dragged): steps with the same
   * name within a second and a half fold into one undo. `undo: false` is for what is not an edit (the loop, the click).
   */
  set(next: Project | ((p: Project) => Project), opts: { undo?: boolean; merge?: string } = {}) {
    const value = typeof next === "function" ? next(this.project) : next;
    if (value === this.project) return;
    const now = Date.now();
    if (opts.undo !== false) {
      const folding = opts.merge && opts.merge === this.lastMerge && now - this.lastAt < 1500;
      if (!folding) {
        this.past.push(this.project);
        if (this.past.length > HISTORY) this.past.shift();
      }
      this.future = [];
      this.lastMerge = opts.merge ?? "";
      this.lastAt = now;
    }
    this.project = { ...value, updatedAt: now };
    for (const fn of this.listeners) fn();
  }
  get canUndo() {
    return this.past.length > 0;
  }
  get canRedo() {
    return this.future.length > 0;
  }
  undo() {
    const prev = this.past.pop();
    if (!prev) return;
    this.future.push(this.project);
    this.project = prev;
    this.lastMerge = "";
    for (const fn of this.listeners) fn();
  }
  redo() {
    const next = this.future.pop();
    if (!next) return;
    this.past.push(this.project);
    this.project = next;
    this.lastMerge = "";
    for (const fn of this.listeners) fn();
  }
  /** Recordings anything in the history still points at (they must outlive an undo). */
  liveSounds(): Set<string> {
    const ids = usedSounds(this.project);
    for (const p of [...this.past, ...this.future]) for (const id of usedSounds(p)) ids.add(id);
    return ids;
  }
}

export const useProject = (store: Store) => useSyncExternalStore(store.subscribe, store.get, store.get);

// ───────── on the device ─────────

const DB = "ridha-voice";
let dbp: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  return (dbp ??= new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore("projects", { keyPath: "id" });
      r.result.createObjectStore("sounds", { keyPath: "id" }).createIndex("project", "projectId");
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
}
const done = <T>(r: IDBRequest<T>) => new Promise<T>((res, rej) => ((r.onsuccess = () => res(r.result)), (r.onerror = () => rej(r.error))));
const finished = (t: IDBTransaction) => new Promise<void>((res, rej) => ((t.oncomplete = () => res()), (t.onerror = () => rej(t.error)), (t.onabort = () => rej(t.error))));

export interface ProjectCard {
  id: string;
  name: string;
  updatedAt: number;
  tracks: number;
  seconds: number;
}

export async function listProjects(): Promise<ProjectCard[]> {
  const all = await done((await db()).transaction("projects").objectStore("projects").getAll() as IDBRequest<Project[]>);
  return all
    .map((p) => ({ id: p.id, name: p.name, updatedAt: p.updatedAt, tracks: p.tracks.length, seconds: p.clips.reduce((m, c) => Math.max(m, c.start + c.dur), 0) }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

interface SoundRow {
  id: string;
  projectId: string;
  name: string;
  channels: Float32Array[];
}

const stored = new Set<string>();

/** The project and every recording it (or its undo history) needs, written; recordings nothing points at any more are removed. */
export async function saveProject(p: Project, keep: Set<string>): Promise<void> {
  const d = await db();
  const t = d.transaction(["projects", "sounds"], "readwrite");
  t.objectStore("projects").put(p);
  const sounds = t.objectStore("sounds");
  for (const id of keep) {
    if (stored.has(id)) continue;
    const s = getSound(id);
    if (!s) continue;
    sounds.put({ id, projectId: p.id, name: s.name, channels: s.channels } satisfies SoundRow);
    stored.add(id);
  }
  const mine = await done(sounds.index("project").getAllKeys(p.id));
  for (const k of mine) {
    if (!keep.has(String(k))) {
      sounds.delete(k);
      stored.delete(String(k));
    }
  }
  await finished(t);
}

export async function openProject(id: string): Promise<Project | null> {
  const d = await db();
  const p = await done(d.transaction("projects").objectStore("projects").get(id) as IDBRequest<Project | undefined>);
  if (!p) return null;
  const rows = await done(d.transaction("sounds").objectStore("sounds").index("project").getAll(id) as IDBRequest<SoundRow[]>);
  for (const r of rows) {
    putSound(r.channels, r.name, r.id);
    stored.add(r.id);
  }
  return p;
}

export async function deleteProject(id: string): Promise<void> {
  const d = await db();
  const t = d.transaction(["projects", "sounds"], "readwrite");
  t.objectStore("projects").delete(id);
  const keys = await done(t.objectStore("sounds").index("project").getAllKeys(id));
  for (const k of keys) t.objectStore("sounds").delete(k);
  await finished(t);
}

/** How much room the device has left for recordings, in MB (null when the browser will not say). */
export async function roomLeftMb(): Promise<number | null> {
  try {
    const e = await navigator.storage.estimate();
    return e.quota && e.usage != null ? Math.round((e.quota - e.usage) / 1e6) : null;
  } catch {
    return null;
  }
}

// ───────── one file, to move a project to another device or keep a copy ─────────

export async function exportProjectFile(p: Project): Promise<Blob> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  zip.file("project.json", JSON.stringify(p));
  const names: Record<string, string> = {};
  for (const id of usedSounds(p)) {
    const s = getSound(id);
    if (!s) continue;
    names[id] = s.name;
    zip.file(`sounds/${id}.wav`, await encodeWav(s.channels, SR, 32).arrayBuffer());
  }
  zip.file("sounds.json", JSON.stringify(names));
  return zip.generateAsync({ type: "blob", compression: "STORE" });
}

export async function importProjectFile(file: Blob): Promise<Project> {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(file);
  const raw = await zip.file("project.json")?.async("string");
  if (!raw) throw new Error("هذا الملف ليس مشروع «الرضا فويس».");
  const src = JSON.parse(raw) as Project;
  const names = JSON.parse((await zip.file("sounds.json")?.async("string")) ?? "{}") as Record<string, string>;
  // a fresh id for the project and for every recording: importing the same file twice never collides
  const map = new Map<string, string>();
  for (const id of usedSounds(src)) {
    const f = zip.file(`sounds/${id}.wav`);
    if (!f) continue;
    const s = putSound(await decodeFile(new Blob([await f.async("arraybuffer")])), names[id] ?? "صوت");
    map.set(id, s.id);
  }
  return { ...src, id: uid(), name: src.name, clips: src.clips.filter((c) => map.has(c.assetId)).map((c) => ({ ...c, assetId: map.get(c.assetId)! })), updatedAt: Date.now() };
}

export function downloadBlob(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30_000);
}
