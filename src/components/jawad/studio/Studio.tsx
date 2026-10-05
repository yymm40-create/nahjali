"use client";

import SectionHint from "@/components/jawad/SectionHint";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { coinsOf, defaultSettings, DIRECTOR_PRICE_KEY, generatorById, VOICE_CLONE_KEY, VOICE_DESIGN_KEY } from "@config/jawad/generators";
import type { RefKind, RefRole, RefStyle, Settings, SettingValue } from "@config/jawad/types";
import { needsFrames, sfxFrameTimes, SMART_SPLIT_MODE, VIDEO_SFX } from "@config/jawad/smart-split";
import { evaluate, fileProblem } from "@/lib/jawad/engine";
import { cleanRefName, defaultRefName, findMentions, renameMentions, sameName } from "@/lib/jawad/mentions";
import type { LibraryItem } from "../library/LibraryPage";
import { isOpenStatus, type JobView, type OutputView, type WorkItem, type WorksFilter } from "@/lib/jawad/labels";
import SmartCoin from "@/components/SmartCoin";
import { announceBalance, BALANCE_EVENT } from "../CoinBalance";
import Dialog from "../Dialog";
import Icon from "../Icon";
import LoginLink from "../LoginLink";
import { grabFrames } from "./frames";
import { GeneratorCard, GeneratorPicker } from "./GeneratorCard";
import OutputSettings from "./OutputSettings";
import DirectorBoost from "./DirectorBoost";
import PromptBox from "./PromptBox";
import RefsStrip from "./RefsStrip";
import type { WorkSource } from "./RefAdder";
import { probeFile, putWithProgress } from "./upload";
import WorksPanel from "./WorksPanel";
import { refMeta, type Draft, type RefItem, type StudioProps } from "./types";

interface UploadView {
  id: string;
  kind: RefKind;
  fileName: string;
  mime: string;
  bytes: number;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  fps: number | null;
  status: "pending" | "ready" | "rejected";
  error: string | null;
  url: string | null;
}

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
const draftKey = (userId: string | undefined, sectionId: string) => `jawad:draft:v1:${userId ?? "anon"}:${sectionId}`;

async function call<T>(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; body: T & { error?: string } }> {
  const res = await fetch(url, { cache: "no-store", ...init });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  return { ok: res.ok, status: res.status, body };
}
const postJson = <T,>(url: string, data: unknown) => call<T>(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });

/** What designing or copying a voice costs this person (the owner pays nothing). */
const voiceCoins = (table: Record<string, number | null>, owner: boolean) => {
  const c = (k: string) => (owner ? 0 : table[k] == null ? null : coinsOf(table[k]!));
  return { design: c(VOICE_DESIGN_KEY), clone: c(VOICE_CLONE_KEY) };
};

/** The file side of a reference, from the server's view (its name and role stay the user's). */
const viewFields = (v: UploadView): Omit<RefItem, "localId" | "kind" | "name" | "role"> => ({
  uploadId: v.id,
  fileName: v.fileName,
  status: v.status === "ready" ? "ready" : v.status === "rejected" ? "rejected" : "checking",
  progress: 1,
  error: v.error,
  url: v.url,
  mime: v.mime,
  bytes: v.bytes,
  width: v.width,
  height: v.height,
  durationMs: v.durationMs,
  fps: v.fps,
});
const fromView = (v: UploadView, role: RefRole, name: string, localId = uid()): RefItem => ({ localId, kind: v.kind, name, role, ...viewFields(v) });

function readDraft(key: string): Partial<Draft> | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Partial<Draft>) : null;
  } catch {
    return null;
  }
}
function writeDraft(key: string, d: Draft) {
  try {
    // Only finished references are kept (a file being uploaded cannot survive a reload)
    const refs = d.refs.filter((r) => r.uploadId && (r.status === "ready" || r.status === "rejected" || r.status === "missing")).map((r) => ({ ...r, progress: 1 }));
    localStorage.setItem(key, JSON.stringify({ ...d, refs }));
  } catch {
    // private mode / storage full: the draft simply isn't kept
  }
}

const defaultStyle = (id: string): RefStyle => {
  const def = generatorById(id);
  return (def?.modes.map((m) => m.refStyle).find((s) => s !== "none") ?? "none") as RefStyle;
};

/** Every reference gets a name (a draft kept from before names existed gets the defaults: image1, video1…). */
function withNames(refs: RefItem[]): RefItem[] {
  const taken: string[] = refs.flatMap((r) => (cleanRefName(r.name) ? [r.name] : []));
  return refs.map((r) => {
    if (cleanRefName(r.name)) return r;
    const name = defaultRefName(r.kind, taken);
    taken.push(name);
    return { ...r, name };
  });
}
const nextName = (kind: RefKind, refs: RefItem[]) => defaultRefName(kind, refs.map((r) => r.name));

/** Roles for a reference style: frames → the first two images become first/last frame; otherwise all references. */
function withRoles(refs: RefItem[], style: RefStyle): RefItem[] {
  let firstSet = false;
  let lastSet = false;
  return refs.map((r) => {
    if (style !== "frames" || r.kind !== "image") return { ...r, role: "reference" as RefRole };
    if (!firstSet) return (firstSet = true), { ...r, role: "first_frame" as RefRole };
    if (!lastSet) return (lastSet = true), { ...r, role: "last_frame" as RefRole };
    return { ...r, role: "reference" as RefRole };
  });
}

export default function Studio({ section, generators, prices: initialPrices, user, owner, allowed, balance: initialBalance, initialWorks }: StudioProps) {
  const router = useRouter();
  const key = draftKey(user?.id, section.id);
  const first = generators[0]?.id ?? "";
  const [draft, setDraft] = useState<Draft>({ generatorId: first, prompt: "", instructions: "", settings: {}, refStyle: {}, refs: [] });
  const [hydrated, setHydrated] = useState(false);
  const [prices, setPrices] = useState(initialPrices);
  const [balance, setBalance] = useState(initialBalance);
  const [picker, setPicker] = useState(false);
  const [tab, setTab] = useState<"settings" | "works">("settings");
  const [notice, setNotice] = useState("");
  const [touched, setTouched] = useState(false);
  const files = useRef(new Map<string, File>());

  // Works
  const [items, setItems] = useState<WorkItem[]>(initialWorks?.items ?? []);
  const [next, setNext] = useState<string | null>(initialWorks?.next ?? null);
  const [filter, setFilter] = useState<WorksFilter>("all");
  const [worksLoading, setWorksLoading] = useState(false);
  const [worksError, setWorksError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);

  // Submitting
  const [submitting, setSubmitting] = useState(false);
  // «الفصل الذكي»: taking the video's frames before sending (what the button says meanwhile)
  const [preparing, setPreparing] = useState("");
  // «المخرج الخارق»: writing the prompt now, and the prompt it replaced (to bring back)
  const [directing, setDirecting] = useState(false);
  const [beforeDirector, setBeforeDirector] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState("");
  const [confirm, setConfirm] = useState<{ coins: number; was: number } | null>(null);
  // «مكتبتي»: the person's characters and places, mentioned by «@name» (null until loaded)
  const [library, setLibrary] = useState<{ items: LibraryItem[]; active: boolean } | null>(null);
  const pendingKey = useRef<string | null>(null);
  // what the pending key was made for: a changed request gets a new key (else the server returns the old job)
  const pendingSig = useRef("");

  const gen = generators.find((g) => g.id === draft.generatorId) ?? generators[0];
  const def = gen ? generatorById(gen.id) : undefined;
  const savedSettings = def ? draft.settings[def.id] : undefined;
  const settings: Settings = useMemo(() => (def ? { ...defaultSettings(def), ...(savedSettings ?? {}) } : {}), [def, savedSettings]);
  const refStyle: RefStyle = def ? draft.refStyle[def.id] ?? defaultStyle(def.id) : "none";

  // ── draft: restore once, then keep it (prompt, settings, references) ──
  function restore() {
    const saved = readDraft(key);
    if (saved) {
      setDraft((d) => ({
        generatorId: saved.generatorId && generators.some((g) => g.id === saved.generatorId) ? saved.generatorId : d.generatorId,
        prompt: typeof saved.prompt === "string" ? saved.prompt : "",
        instructions: typeof saved.instructions === "string" ? saved.instructions : "",
        settings: saved.settings ?? {},
        refStyle: saved.refStyle ?? {},
        refs: Array.isArray(saved.refs) ? withNames(saved.refs) : [],
      }));
      // Fresh links (and existence) of the kept references
      const ids = (saved.refs ?? []).flatMap((r) => (r.uploadId ? [r.uploadId] : []));
      if (ids.length && user) {
        call<{ uploads: UploadView[] }>(`/api/jawad/uploads?ids=${ids.join(",")}`).then(({ ok, body }) => {
          if (!ok) return;
          const byId = new Map(body.uploads.map((u) => [u.id, u]));
          setDraft((d) => ({
            ...d,
            refs: d.refs.map((r) => {
              const v = r.uploadId ? byId.get(r.uploadId) : undefined;
              return v ? fromView(v, r.role, r.name, r.localId) : { ...r, status: "missing", url: null, error: "الملف لم يعد موجودًا؛ احذفه." };
            }),
          }));
        });
      }
    }
    setHydrated(true);
  }
  useEffect(() => {
    let live = true;
    // After the first paint (the server rendered the empty draft), so the restored one never mismatches
    queueMicrotask(() => {
      if (live) restore();
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => {
    if (!hydrated) return;
    const t = setTimeout(() => writeDraft(key, draft), 300);
    return () => clearTimeout(t);
  }, [draft, hydrated, key]);

  useEffect(() => {
    const on = (e: Event) => setBalance((e as CustomEvent<number>).detail);
    window.addEventListener(BALANCE_EVENT, on);
    return () => window.removeEventListener(BALANCE_EVENT, on);
  }, []);

  // A performance description only goes to generators that take one (it stays in the draft for when the user switches back)
  const instructions = def?.extraText ? draft.instructions : "";
  const ev = useMemo(
    () => (def ? evaluate(def, { settings, prompt: draft.prompt, instructions, refStyle, refs: draft.refs.map(refMeta) }, prices[def.id] ?? {}) : null),
    [def, settings, draft.prompt, instructions, refStyle, draft.refs, prices],
  );

  // ── editing ──
  const setSetting = (k: string, v: SettingValue) => def && setDraft((d) => ({ ...d, settings: { ...d.settings, [def.id]: { ...settings, [k]: v } } }));
  const updateRef = (localId: string, patch: Partial<RefItem>) => setDraft((d) => ({ ...d, refs: d.refs.map((r) => (r.localId === localId ? { ...r, ...patch } : r)) }));
  const nextFrameRole = (refs: RefItem[]): RefRole => (refs.some((r) => r.role === "first_frame") ? "last_frame" : "first_frame");

  function switchGenerator(id: string) {
    if (id === draft.generatorId) return;
    const nd = generatorById(id);
    setDraft((d) => {
      // Stay in the reference style the user is working in when the new generator has it
      const supports = (s: RefStyle) => Boolean(nd?.modes.some((m) => m.refStyle === s));
      const style = d.refs.length && supports(refStyle) ? refStyle : d.refStyle[id] ?? defaultStyle(id);
      // Keep the prompt and every reference: incompatible ones are marked (and not sendable), never deleted
      return { ...d, generatorId: id, refStyle: { ...d.refStyle, [id]: style }, refs: style === refStyle ? d.refs : withRoles(d.refs, style) };
    });
    setNotice(nd ? `بدّلت إلى ${nd.name}. احتفظنا بالبرومبت والمراجع؛ غير المتوافق منها معلَّم بالأحمر.` : "");
  }

  function setRefStyle(s: RefStyle) {
    if (!def) return;
    setDraft((d) => ({ ...d, refStyle: { ...d.refStyle, [def.id]: s }, refs: withRoles(d.refs, s) }));
  }

  // ── uploads ──
  const runUpload = useCallback(async (item: RefItem, file: File) => {
    try {
      updateRef(item.localId, { status: "uploading", progress: 0, error: null });
      const probe = await probeFile(file, item.kind).catch((e: Error) => {
        updateRef(item.localId, { status: "rejected", error: e.message });
        return null;
      });
      if (!probe) return;
      const signed = await postJson<{ id: string; signedUrl: string }>("/api/jawad/uploads", { kind: item.kind, mime: probe.mime, bytes: file.size, fileName: file.name });
      if (!signed.ok) throw new Error(signed.body.error ?? "تعذّر بدء الرفع.");
      updateRef(item.localId, { uploadId: signed.body.id, mime: probe.mime, width: probe.width, height: probe.height, durationMs: probe.durationMs });
      await putWithProgress(signed.body.signedUrl, file, probe.mime, (p) => updateRef(item.localId, { progress: p }));
      updateRef(item.localId, { status: "checking", progress: 1 });
      const conf = await postJson<{ upload: UploadView }>("/api/jawad/uploads/confirm", { id: signed.body.id });
      if (!conf.ok) throw new Error(conf.body.error ?? "تعذّر فحص الملف.");
      const v = conf.body.upload;
      updateRef(item.localId, viewFields(v));
      if (v.status === "ready") files.current.delete(item.localId);
    } catch (e) {
      updateRef(item.localId, { status: "error", error: navigator.onLine ? (e as Error).message : "انقطع الاتصال أثناء الرفع." });
    }
  }, []);

  function addFiles(kind: RefKind, list: File[], role?: RefRole) {
    if (!def) return;
    // The new references and their files; each upload starts on its own (never from inside a state update,
    // which may run later). Their names and roles are given in the (pure) update below.
    const added = list.map((file) => ({
      file,
      item: {
        localId: uid(),
        uploadId: null,
        kind,
        name: "",
        role: role ?? "reference",
        fileName: file.name,
        status: "uploading",
        progress: 0,
        error: null,
        url: kind === "audio" ? null : URL.createObjectURL(file),
        mime: file.type,
        bytes: file.size,
        width: null,
        height: null,
        durationMs: null,
        fps: null,
      } as RefItem,
    }));
    setDraft((d) => {
      const refs = [...d.refs];
      for (const { item } of added) {
        refs.push({ ...item, name: nextName(kind, refs), role: refStyle === "frames" && kind === "image" ? role ?? nextFrameRole(refs) : "reference" });
      }
      return { ...d, refs };
    });
    // Early check against this generator's limits (the server checks again)
    setTimeout(() => {
      for (const { item, file } of added) {
        files.current.set(item.localId, file);
        probeFile(file, kind)
          .then((p) => {
            const problem = fileProblem(def, { id: item.localId, kind, role: item.role, mime: p.mime, bytes: file.size, width: p.width, height: p.height, durationMs: p.durationMs, status: "ready" });
            if (problem) updateRef(item.localId, { status: "rejected", error: `لا يتوافق مع ${def.name}: ${problem}`, mime: p.mime, width: p.width, height: p.height, durationMs: p.durationMs });
            else runUpload(item, file);
          })
          .catch((e: Error) => updateRef(item.localId, { status: "rejected", error: e.message }));
      }
    }, 0);
  }

  function retryUpload(localId: string) {
    const item = draft.refs.find((r) => r.localId === localId);
    const file = files.current.get(localId);
    if (!item) return;
    if (!file) return updateRef(localId, { status: "rejected", error: "الملف الأصلي غير متاح بعد إعادة تحميل الصفحة؛ احذفه وأضفه من جديد." });
    if (item.uploadId) fetch(`/api/jawad/uploads/${item.uploadId}`, { method: "DELETE" }).catch(() => {});
    runUpload({ ...item, uploadId: null }, file);
  }

  function removeRef(localId: string) {
    const item = draft.refs.find((r) => r.localId === localId);
    if (item?.url?.startsWith("blob:")) URL.revokeObjectURL(item.url);
    files.current.delete(localId);
    setDraft((d) => ({ ...d, refs: d.refs.filter((r) => r.localId !== localId) }));
    if (item?.uploadId) fetch(`/api/jawad/uploads/${item.uploadId}`, { method: "DELETE" }).catch(() => {});
  }

  // ── works ──
  const loadWorks = useCallback(async (f: WorksFilter, cursor: string | null) => {
    if (!user || !allowed) return;
    setWorksLoading(true);
    setWorksError(null);
    try {
      const { ok, body } = await call<{ items: WorkItem[]; next: string | null }>(`/api/jawad/works?filter=${f}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
      if (!ok) throw new Error(body.error ?? "تعذّر تحميل الأعمال.");
      setItems((cur) => (cursor ? [...cur, ...body.items.filter((n) => !cur.some((c) => c.id === n.id))] : [...cur.filter((c) => c.type === "job" && c.id.startsWith("temp-")), ...body.items]));
      setNext(body.next);
    } catch (e) {
      setWorksError(navigator.onLine ? (e as Error).message : "لا يوجد اتصال.");
    } finally {
      setWorksLoading(false);
    }
  }, [user, allowed]);

  function changeFilter(f: WorksFilter) {
    setFilter(f);
    setItems((cur) => cur.filter((c) => c.type === "job" && c.id.startsWith("temp-")));
    setNext(null);
    loadWorks(f, null);
  }

  // Poll unfinished jobs (their state lives on the server: a refresh or a new sign-in picks it up again)
  const openIds = items.flatMap((it) => (it.type === "job" && isOpenStatus(it.status) && !it.id.startsWith("temp-") ? [it.id] : []));
  const openKey = openIds.join(",");
  useEffect(() => {
    if (!openKey) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (stop) return;
      if (document.hidden) {
        timer = setTimeout(tick, 4000);
        return;
      }
      try {
        const { ok, body } = await call<{ jobs: JobView[]; balance: number | null }>(`/api/jawad/jobs?ids=${openKey}`);
        if (ok) {
          setOffline(false);
          const byId = new Map(body.jobs.map((j) => [j.id, j]));
          setItems((cur) => cur.map((it) => (it.type === "job" && byId.has(it.id) ? byId.get(it.id)! : it)));
          announceBalance(body.balance);
        }
      } catch {
        setOffline(true);
      }
      if (!stop) timer = setTimeout(tick, 5000);
    };
    timer = setTimeout(tick, 2500);
    const online = () => {
      setOffline(false);
      clearTimeout(timer);
      tick();
    };
    const offlineFn = () => setOffline(true);
    window.addEventListener("online", online);
    window.addEventListener("offline", offlineFn);
    return () => {
      stop = true;
      clearTimeout(timer);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offlineFn);
    };
  }, [openKey]);

  // ── «مكتبتي» ──
  useEffect(() => {
    if (!user || !allowed) return;
    let live = true;
    fetch("/api/jawad/library", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((b: { access?: { active: boolean }; items?: LibraryItem[] } | null) => {
        if (live && b?.access) setLibrary({ items: b.items ?? [], active: b.access.active });
      })
      .catch(() => null);
    return () => {
      live = false;
    };
  }, [user, allowed]);

  /** A library item as a reference of the draft (its picture is the person's own checked upload). */
  const libraryRef = (it: LibraryItem, role: RefRole): RefItem => ({
    localId: uid(),
    uploadId: it.uploadId,
    kind: "image",
    name: it.name,
    role,
    fileName: it.name,
    status: "ready",
    progress: 1,
    error: null,
    url: it.url,
    mime: it.mime,
    bytes: it.bytes,
    width: it.width,
    height: it.height,
    durationMs: null,
    fps: null,
  });
  const canUseLibrary = Boolean(library?.active && def?.refLabel && ev?.refKinds.image?.allowed);
  /** Adds a library item as a reference; why not, or null. */
  function addLibraryRef(it: LibraryItem, role?: RefRole): string | null {
    if (draft.refs.some((r) => r.uploadId === it.uploadId)) return null;
    if (!library?.active) return "«المكتبة» مقفلة.";
    if (!ev?.refKinds.image?.allowed) return ev?.refKinds.image?.reason ?? "هذا المولد لا يقبل صورًا مرجعية.";
    if (draft.refs.some((r) => sameName(r.name, it.name))) return `يوجد مرجع آخر باسم «@${it.name}»؛ غيّر اسمه أولًا.`;
    setDraft((d) => ({ ...d, refs: [...d.refs, libraryRef(it, refStyle === "frames" ? role ?? nextFrameRole(d.refs) : "reference")] }));
    return null;
  }
  /** The prompt as typed; «@name» of a library item not added yet adds its picture by itself. */
  function onPrompt(prompt: string) {
    setDraft((d) => {
      if (!canUseLibrary || !library) return { ...d, prompt };
      const named = findMentions(prompt).map((m) => m.name);
      const add = library.items.filter((it) => named.some((n) => sameName(n, it.name)) && !d.refs.some((r) => r.uploadId === it.uploadId || sameName(r.name, it.name)));
      if (!add.length) return { ...d, prompt };
      let refs = d.refs;
      for (const it of add) refs = [...refs, libraryRef(it, refStyle === "frames" ? nextFrameRole(refs) : "reference")];
      return { ...d, prompt, refs };
    });
  }
  const libraryOptions = canUseLibrary && library ? library.items.filter((it) => !draft.refs.some((r) => r.uploadId === it.uploadId)).map((it) => ({ ...libraryRef(it, "reference"), localId: `lib:${it.id}` })) : [];

  // ── generate ──
  const price = ev?.price.ok ? ev.price.coins : null;
  const busyUploads = draft.refs.some((r) => r.status === "uploading" || r.status === "checking");
  const blockers: string[] = [];
  if (!user) blockers.push("سجّل الدخول للتوليد.");
  else if (!allowed) blockers.push("المنصة مغلقة لحسابك حاليًا.");
  if (gen && !gen.live && !owner) blockers.push("هذا المولد غير متاح حاليًا.");
  if (busyUploads) blockers.push("انتظر حتى يكتمل رفع المراجع وفحصها.");
  if (directing) blockers.push("انتظر حتى ينتهي «المخرج الخارق» من كتابة البرومبت.");
  if (ev) for (const i of ev.issues) if (!blockers.includes(i.message)) blockers.push(i.message);
  if (user && !owner && price != null && balance != null && balance < price) blockers.push(`رصيدك (${balance}) لا يكفي لهذا التوليد (${price} نقدة).`);

  // «المخرج الخارق» (video making): its price, and why it can't run now
  const directorCenti = def?.priceKeys.some((k) => k.key === DIRECTOR_PRICE_KEY) ? prices[def.id]?.[DIRECTOR_PRICE_KEY] : undefined;
  const directorCoins = directorCenti == null ? null : Math.ceil(directorCenti / 100);
  const directorWhy = !user
    ? "سجّل الدخول أولًا."
    : !allowed
      ? "المنصة مغلقة لحسابك حاليًا."
      : !draft.prompt.trim()
        ? "اكتب فكرتك في البرومبت أولًا، ثم طوّرها."
        : busyUploads
          ? "انتظر حتى يكتمل رفع المراجع."
          : submitting
            ? "انتظر حتى يبدأ التوليد."
            : !owner && directorCoins != null && balance != null && balance < directorCoins
              ? `رصيدك (${balance}) لا يكفي (${directorCoins} نقدة).`
              : null;

  async function runDirector(expectedCoins: number) {
    if (!def || directing) return;
    setDirecting(true);
    setNotice("");
    const original = draft.prompt;
    try {
      const r = await postJson<{ prompt: string; coins: number; balance: number | null; code?: string }>("/api/jawad/director", {
        idempotencyKey: uid(),
        sectionId: section.id,
        generatorId: def.id,
        refStyle,
        settings: ev?.settings ?? settings,
        prompt: original,
        refs: draft.refs.filter((r) => r.uploadId && r.status === "ready").map((r) => ({ uploadId: r.uploadId, role: r.role, name: r.name })),
        expectedCoins,
      });
      if (r.status === 409 && r.body.code === "price_changed" && typeof r.body.coins === "number") {
        const coins = r.body.coins;
        setPrices((p) => ({ ...p, [def.id]: { ...(p[def.id] ?? {}), [DIRECTOR_PRICE_KEY]: coins * 100 } }));
        return setNotice(`تغيّر سعر «المخرج الخارق» إلى ${coins} نقدة. اضغط «طوّر» مرة ثانية إذا تبيه.`);
      }
      if (!r.ok) return setNotice(r.body.error ?? "تعذّر تطوير البرومبت.");
      // The new prompt replaces the old one (which can be brought back)
      setBeforeDirector(original);
      setDraft((d) => ({ ...d, prompt: r.body.prompt }));
      setTouched(true);
      announceBalance(r.body.balance);
      setNotice(r.body.coins ? `طوّر «المخرج الخارق» البرومبت وخُصمت ${r.body.coins} نقدة. راجعه ثم اضغط «توليد».` : "طوّر «المخرج الخارق» البرومبت. راجعه ثم اضغط «توليد».");
    } catch {
      setNotice("انقطع الاتصال أثناء التطوير. إذا خُصمت النقود ولم يتغير البرومبت، تواصل معنا.");
    } finally {
      setDirecting(false);
    }
  }

  /** «الفصل الذكي»: small frames of the stored video with their times (a fresh link if the old one expired). */
  async function videoFrames(): Promise<{ t: number; data: string }[]> {
    const video = draft.refs.find((r) => r.kind === "video" && r.status === "ready");
    if (!video?.uploadId || !video.durationMs) throw new Error("no video");
    const times = sfxFrameTimes(video.durationMs / 1000);
    const take = (url: string) =>
      grabFrames(url, times, VIDEO_SFX.frameSide, VIDEO_SFX.frameQuality, { by: "side", onFrame: (n) => setPreparing(`يجهّز لقطات الفيديو (${n} من ${times.length})…`) });
    const shots = await take(video.url ?? "").catch(async () => {
      const r = await call<{ uploads: UploadView[] }>(`/api/jawad/uploads?ids=${video.uploadId}`);
      const url = r.ok ? r.body.uploads[0]?.url : null;
      if (!url) throw new Error("no url");
      return take(url);
    });
    return times.map((t, i) => ({ t, data: shots[i] }));
  }

  async function submit(expectedCoins: number) {
    if (!def || !gen || submitting) return;
    let frames: { t: number; data: string }[] | undefined;
    if (ev?.mode.id === SMART_SPLIT_MODE && needsFrames(ev.settings)) {
      setSubmitting(true);
      setSubmitError("");
      setPreparing("يجهّز لقطات الفيديو…");
      try {
        frames = await videoFrames();
      } catch {
        setSubmitError("تعذّر قراءة الفيديو في المتصفح؛ جرّب مرة ثانية أو أعد رفعه بصيغة MP4.");
        return;
      } finally {
        setPreparing("");
        setSubmitting(false);
      }
    }
    const sig = JSON.stringify([section.id, def.id, refStyle, ev?.settings ?? settings, draft.prompt, instructions, draft.refs.map((r) => [r.uploadId, r.role, r.name])]);
    if (pendingSig.current !== sig) pendingKey.current = null;
    pendingSig.current = sig;
    const idem = (pendingKey.current ??= uid());
    const tempId = `temp-${idem}`;
    const temp: JobView = {
      type: "job",
      id: tempId,
      createdAt: new Date().toISOString(),
      finishedAt: null,
      status: "validating",
      providerStatus: null,
      progress: null,
      generatorId: def.id,
      generatorName: gen.name,
      sectionId: section.id,
      outputKind: def.output,
      mode: ev?.mode.id ?? "",
      prompt: draft.prompt,
      instructions,
      settings: ev?.settings ?? settings,
      refStyle,
      refs: [],
      modelPrompt: null,
      diction: [],
      priceCoins: expectedCoins,
      charged: !owner,
      chargeState: "none",
      error: null,
      cancellable: false,
      outputs: [],
    };
    setSubmitting(true);
    setSubmitError("");
    if (filter === "all" || filter === def.output) setItems((cur) => [temp, ...cur.filter((c) => c.id !== tempId)]);
    const body = {
      idempotencyKey: idem,
      sectionId: section.id,
      generatorId: def.id,
      refStyle,
      settings: ev?.settings ?? settings,
      prompt: draft.prompt,
      instructions,
      refs: draft.refs.map((r) => ({ uploadId: r.uploadId, role: r.role, name: r.name })),
      expectedCoins,
      ...(frames ? { frames } : {}),
    };
    try {
      const r = await postJson<{ job: JobView; balance: number | null; code?: string; coins?: number; prices?: Record<string, number | null>; issues?: { message: string }[] }>("/api/jawad/generate", body);
      if (r.ok) {
        pendingKey.current = null;
        setItems((cur) => {
          const rest = cur.filter((c) => c.id !== tempId && c.id !== r.body.job.id);
          return filter === "all" || filter === def.output ? [r.body.job, ...rest] : rest;
        });
        announceBalance(r.body.balance);
        setTab("works");
        return;
      }
      setItems((cur) => cur.filter((c) => c.id !== tempId));
      if (r.status === 409 && r.body.code === "price_changed" && typeof r.body.coins === "number") {
        // The price changed since the page loaded: show the new amount and ask again (same click key)
        if (r.body.prices) setPrices((p) => ({ ...p, [def.id]: r.body.prices! }));
        setConfirm({ coins: r.body.coins, was: expectedCoins });
        return;
      }
      pendingKey.current = null;
      setSubmitError(r.body.error ?? "تعذّر بدء التوليد.");
    } catch {
      // No answer: the request may have arrived. Re-sending with the same key can never make a second job
      setItems((cur) => cur.map((c) => (c.id === tempId ? { ...temp, error: "تعذّر التأكد من وصول الطلب. أعد الإرسال (لن يُكرَّر الخصم)." } : c)));
    } finally {
      setSubmitting(false);
    }
  }

  async function reuse(j: JobView) {
    if (j.sectionId !== section.id) {
      // Another section: hand over the draft and open it there
      const target = draftKey(user?.id, j.sectionId);
      const cur = readDraft(target) ?? {};
      writeDraft(target, {
        generatorId: j.generatorId,
        prompt: j.prompt,
        instructions: j.instructions,
        settings: { ...(cur.settings ?? {}), [j.generatorId]: j.settings },
        refStyle: { ...(cur.refStyle ?? {}), [j.generatorId]: j.refStyle },
        refs: [],
      });
      router.push(`/jawad-ai/${j.sectionId}`);
      return;
    }
    if (!generators.some((g) => g.id === j.generatorId)) {
      setNotice("مولد هذا العمل غير متاح الآن؛ حمّلنا البرومبت فقط.");
      setDraft((d) => ({ ...d, prompt: j.prompt, instructions: j.instructions }));
      setTab("settings");
      return;
    }
    let refs: RefItem[] = [];
    if (j.refs.length) {
      const { ok, body } = await call<{ uploads: UploadView[] }>(`/api/jawad/uploads?ids=${j.refs.map((r) => r.uploadId).join(",")}`);
      const byId = new Map((ok ? body.uploads : []).map((u) => [u.id, u]));
      refs = withNames(
        j.refs.map((r) => {
          const v = byId.get(r.uploadId);
          const name = r.name ?? "";
          return v ? fromView(v, r.role, name) : { localId: uid(), uploadId: r.uploadId, kind: r.kind, name, role: r.role, fileName: "", status: "missing", progress: 1, error: "هذا المرجع حُذف.", url: null, mime: "", bytes: 0, width: null, height: null, durationMs: null, fps: null };
        }),
      );
    }
    setDraft((d) => ({
      ...d,
      generatorId: j.generatorId,
      prompt: j.prompt,
      instructions: j.instructions,
      settings: { ...d.settings, [j.generatorId]: j.settings },
      refStyle: { ...d.refStyle, [j.generatorId]: j.refStyle },
      refs,
    }));
    setNotice("حمّلنا إعدادات هذا العمل. راجعها ثم اضغط «توليد».");
    setTab("settings");
  }

  /** One of the user's works (a JAWAD result or a film picture/video) copied into a new, checked reference. */
  async function addFromWork(source: WorkSource, role?: RefRole): Promise<string | null> {
    const { ok, body } = await postJson<{ upload: UploadView }>("/api/jawad/uploads/from-output", source);
    if (!ok) return body.error ?? "تعذّر إضافته كمرجع.";
    setDraft((d) => ({ ...d, refs: [...d.refs, fromView(body.upload, refStyle === "frames" && body.upload.kind === "image" ? role ?? nextFrameRole(d.refs) : "reference", nextName(body.upload.kind, d.refs))] }));
    return null;
  }

  /** Renames a reference (and its «@mentions» in the prompt). Returns why not, or null. */
  function renameRef(localId: string, raw: string): string | null {
    const name = cleanRefName(raw);
    if (!name) return "الاسم: حروف أو أرقام أو _ أو - بلا مسافات (حتى ٢٤ حرفًا).";
    const item = draft.refs.find((r) => r.localId === localId);
    if (!item) return null;
    if (draft.refs.some((r) => r.localId !== localId && sameName(r.name, name))) return `يوجد مرجع آخر باسم «@${name}».`;
    setDraft((d) => ({ ...d, prompt: renameMentions(d.prompt, item.name, name), refs: d.refs.map((r) => (r.localId === localId ? { ...r, name } : r)) }));
    return null;
  }

  async function useAsRef(o: OutputView) {
    const err = await addFromWork({ outputId: o.id });
    if (err) return setNotice(err);
    setNotice("أضفناه إلى المراجع.");
    setTab("settings");
  }

  async function cancel(j: JobView) {
    const { ok, body } = await postJson<{ balance: number | null }>(`/api/jawad/jobs/${j.id}/cancel`, {});
    if (!ok) return setNotice(body.error ?? "تعذّر الإلغاء.");
    announceBalance(body.balance);
    const r = await call<{ jobs: JobView[] }>(`/api/jawad/jobs?ids=${j.id}`);
    if (r.ok) setItems((cur) => cur.map((it) => (it.id === j.id ? r.body.jobs[0] ?? it : it)));
  }

  const canUseAsRef = (o: OutputView) => (!ev ? "" : ev.refKinds[o.kind]?.allowed ? null : ev.refKinds[o.kind]?.reason ?? "غير مدعوم هنا");
  const openCount = openIds.length + items.filter((i) => i.id.startsWith("temp-")).length;

  if (!gen || !def || !ev) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <span className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-jw-surface-2 text-jw-muted"><Icon name="sparkles" size={26} /></span>
        <h1 className="mb-2 text-lg font-semibold">{section.name}</h1>
        <p className="text-sm text-jw-muted">لا يوجد مولد متاح في هذا القسم حاليًا. سيظهر هنا فور تفعيله.</p>
      </div>
    );
  }

  const generateLabel = price == null ? "توليد" : `توليد`;
  return (
    <div>
      <h1 className="sr-only">{section.name}</h1>
      {/* Phones: two tabs that keep their own state */}
      <div className="sticky top-[calc(var(--jw-header-h)+var(--jw-bar-h))] z-20 grid grid-cols-2 border-b border-jw-line bg-jw-bg/95 backdrop-blur lg:hidden" role="tablist">
        {(["settings", "works"] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`relative py-2.5 text-sm ${tab === t ? "text-jw-ink" : "text-jw-muted"}`}>
            {t === "settings" ? "الإعدادات" : "أعمالي"}
            {t === "works" && openCount > 0 && <span className="ms-1.5 inline-grid size-5 place-items-center rounded-full bg-jw-accent text-[10px] text-[var(--jw-on-accent)]">{openCount}</span>}
            <span className={`absolute inset-x-6 bottom-0 h-0.5 rounded-full ${tab === t ? "bg-jw-accent" : ""}`} />
          </button>
        ))}
      </div>

      {/* Desktop: settings on the LEFT (~1/3), works on the RIGHT (~2/3), whatever the writing direction */}
      <div dir="ltr" className="mx-auto max-w-[1600px] lg:grid lg:h-[calc(100dvh-var(--jw-header-h)-var(--jw-bar-h))] lg:grid-cols-[minmax(340px,1fr)_minmax(0,2fr)]">
        <aside dir="rtl" aria-label="إعدادات التوليد" className={`${tab === "settings" ? "flex" : "hidden"} min-h-0 flex-col lg:flex lg:border-r lg:border-jw-line`}>
          <div className="jw-scroll min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
            <SectionHint kind={section.output} />
            <GeneratorCard gen={gen} owner={owner} onOpen={() => setPicker(true)} />
            {notice && (
              <p className="flex items-start gap-2 rounded-lg border border-jw-line bg-jw-surface-2 px-3 py-2 text-xs text-jw-muted" role="status">
                <Icon name="info" size={14} className="mt-0.5 shrink-0" />
                <span className="flex-1">{notice}</span>
                <button type="button" onClick={() => setNotice("")} aria-label="إخفاء"><Icon name="x" size={12} /></button>
              </p>
            )}
            <RefsStrip
              def={def}
              ev={ev}
              refStyle={refStyle}
              onRefStyle={setRefStyle}
              refs={draft.refs}
              canUpload={Boolean(user && allowed)}
              owner={owner}
              uploadBlockedReason={!user ? "سجّل الدخول لرفع المراجع." : !allowed ? "المنصة مغلقة لحسابك." : null}
              onAdd={addFiles}
              onPickWork={addFromWork}
              library={user && allowed ? library : null}
              onPickLibrary={addLibraryRef}
              onRename={renameRef}
              prompt={draft.prompt}
              onRetry={retryUpload}
              onRemove={removeRef}
              onRole={(id, role) => updateRef(id, { role })}
            />
            <PromptBox
              def={def}
              ev={ev}
              prompt={draft.prompt}
              instructions={draft.instructions}
              refs={draft.refs}
              onPrompt={onPrompt}
              library={libraryOptions}
              onPickLibrary={(localId) => {
                const it = library?.items.find((x) => `lib:${x.id}` === localId);
                const err = it ? addLibraryRef(it) : "ما لقينا هذا العنصر.";
                if (err) setNotice(err);
                return !err;
              }}
              onInstructions={(instructions) => setDraft((d) => ({ ...d, instructions }))}
              touched={touched}
              onTouched={() => setTouched(true)}
              locked={directing ? "«المخرج الخارق» يكتب البرومبت…" : null}
            />
            {directorCoins != null && (
              <DirectorBoost
                coins={directorCoins}
                owner={owner}
                disabledReason={directorWhy}
                busy={directing}
                canUndo={beforeDirector != null && beforeDirector !== draft.prompt}
                onRun={() => runDirector(directorCoins)}
                onUndo={() => {
                  setDraft((d) => ({ ...d, prompt: beforeDirector ?? d.prompt }));
                  setBeforeDirector(null);
                  setNotice("رجعنا برومبتك السابق.");
                }}
              />
            )}
            <OutputSettings
              ev={ev}
              values={ev.settings}
              onChange={setSetting}
              voiceCoins={def && def.priceKeys.some((k) => k.key === VOICE_DESIGN_KEY) ? voiceCoins(prices[def.id] ?? {}, owner) : undefined}
            />
          </div>

          {/* Always reachable: the button sticks to the bottom of the panel */}
          <div className="sticky bottom-0 space-y-2 border-t border-jw-line bg-jw-surface/95 p-3 backdrop-blur">
            {!user ? (
              <LoginLink className="jw-btn jw-btn-primary h-12 w-full text-base">سجّل الدخول للتوليد</LoginLink>
            ) : (
              <button
                type="button"
                className="jw-btn jw-btn-primary h-12 w-full text-base"
                disabled={blockers.length > 0 || submitting || price == null}
                aria-disabled={blockers.length > 0}
                aria-describedby="jw-gen-why"
                onClick={() => price != null && submit(price)}
              >
                {submitting ? <span className="jw-spinner" /> : <Icon name="sparkles" size={18} />}
                {generateLabel}
                {price != null && (
                  <span className="ms-1 flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--jw-on-accent)_15%,transparent)] px-2 py-0.5 text-sm">
                    <SmartCoin size={15} />
                    <span dir="ltr" className="tabular-nums">{price}</span>
                  </span>
                )}
              </button>
            )}
            <div id="jw-gen-why" aria-live="polite">
              {preparing && <p className="text-xs text-jw-muted" role="status">{preparing}</p>}
              {submitError && <p className="text-xs text-jw-danger" role="alert">{submitError}</p>}
              {user && blockers.length > 0 && !submitError && <p className="text-xs text-jw-muted">{blockers[0]}</p>}
              {owner && price != null && <p className="text-[11px] text-jw-faint">كصاحب المنصة لا يُخصم منك؛ يُسجَّل السعر للمتابعة فقط.</p>}
            </div>
          </div>
        </aside>

        <div dir="rtl" className={`${tab === "works" ? "flex" : "hidden"} min-h-[60dvh] min-w-0 flex-col lg:flex lg:min-h-0`}>
          <WorksPanel
            items={items}
            filter={filter}
            onFilter={changeFilter}
            loading={worksLoading}
            hasMore={Boolean(next)}
            onMore={() => next && loadWorks(filter, next)}
            error={worksError}
            offline={offline}
            signedIn={Boolean(user)}
            allowed={allowed}
            onReuse={reuse}
            onUseAsRef={useAsRef}
            onCancel={cancel}
            onRetrySubmit={(j) => submit(j.priceCoins)}
            canUseAsRef={canUseAsRef}
            onEdited={(j, balance) => {
              setItems((cur) => (filter === "all" || filter === j.outputKind ? [j, ...cur.filter((c) => c.id !== j.id)] : cur));
              announceBalance(balance);
              setTab("works");
            }}
          />
        </div>
      </div>

      <GeneratorPicker open={picker} onClose={() => setPicker(false)} generators={generators} current={gen.id} onPick={switchGenerator} owner={owner} />

      <Dialog open={Boolean(confirm)} onClose={() => setConfirm(null)} title="تغيّر السعر">
        {confirm && (
          <div className="space-y-4 p-4">
            <p className="text-sm">
              تغيّر سعر هذا التوليد من <b dir="ltr">{confirm.was}</b> إلى <b dir="ltr">{confirm.coins}</b> نقدة ذكية. لم يُخصم شيء بعد.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" className="jw-btn" onClick={() => setConfirm(null)}>إلغاء</button>
              <button
                type="button"
                className="jw-btn jw-btn-primary"
                onClick={() => {
                  const c = confirm.coins;
                  setConfirm(null);
                  submit(c);
                }}
              >
                أوافق على {confirm.coins} وولّد
              </button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
