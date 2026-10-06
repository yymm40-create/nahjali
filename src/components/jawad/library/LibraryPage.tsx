"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import SmartCoin from "@/components/SmartCoin";
import { LIBRARY_ADDON } from "@config/coins";
import { LIBRARY_KIND, LIBRARY_LIMIT, type LibraryKind } from "@config/jawad/library";
import Dialog from "../Dialog";
import Icon from "../Icon";
import { probeFile, putWithProgress } from "../studio/upload";
import { Play, VoiceStudio, type Voice } from "../studio/VoicePicker";

export interface LibraryItem {
  id: string;
  kind: LibraryKind;
  name: string;
  note: string;
  origin: "made" | "own";
  uploadId: string;
  url: string | null;
  mime: string;
  bytes: number;
  width: number | null;
  height: number | null;
  createdAt: string;
}
interface Access {
  active: boolean;
  until: string | null;
  owner: boolean;
  migrated: boolean;
}
type Tab = "voices" | LibraryKind;
interface Making {
  jobId: string;
  kind: LibraryKind;
  name: string;
  status: string;
  error: string | null;
}

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
async function api<T>(url: string, body?: unknown): Promise<{ ok: boolean; status: number; body: T & { error?: string; code?: string; coins?: number } }> {
  const res = await fetch(url, body === undefined ? { cache: "no-store" } : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { ok: res.ok, status: res.status, body: (await res.json().catch(() => ({}))) as T & { error?: string; code?: string; coins?: number } };
}

/** One picture of the person's, uploaded and checked by the server like any reference. */
async function uploadImage(file: File, onProgress: (p: number) => void) {
  const probe = await probeFile(file, "image");
  const s = await api<{ id: string; signedUrl: string }>("/api/jawad/uploads", { kind: "image", mime: probe.mime, bytes: file.size, fileName: file.name });
  if (!s.ok) throw new Error(s.body.error || "تعذّر بدء الرفع.");
  await putWithProgress(s.body.signedUrl, file, probe.mime, onProgress);
  const c = await api<{ upload?: { id: string; status: string; error: string | null } }>("/api/jawad/uploads/confirm", { id: s.body.id });
  if (!c.ok || !c.body.upload) throw new Error(c.body.error || "تعذّر فحص الصورة.");
  if (c.body.upload.status !== "ready") throw new Error(c.body.upload.error || "الصورة مرفوضة.");
  return c.body.upload.id;
}

const fmtDate = (iso: string) => new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));

/**
 * «مكتبتي» (the «المكتبة» add-on): the person's own voices, characters and places. Each is made from scratch (a
 * description) or from their own (their voice, their picture), kept, and mentioned by «@name» in any prompt.
 */
export default function LibraryPage({ owner, voiceCoins, voicesOn }: { owner: boolean; voiceCoins: { design: number | null; clone: number | null }; voicesOn: boolean }) {
  const [tab, setTab] = useState<Tab>("character");
  const [access, setAccess] = useState<Access | null>(null);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [voices, setVoices] = useState<{ mine: Voice[]; limit: number } | null>(null);
  const [error, setError] = useState("");
  const [studio, setStudio] = useState<"design" | "clone" | null>(null);
  const [adding, setAdding] = useState<{ kind: LibraryKind; how: "make" | "own" } | null>(null);
  const [making, setMaking] = useState<Making[]>([]);

  const load = useCallback(
    () =>
      Promise.all([api<{ access: Access; items: LibraryItem[] }>("/api/jawad/library"), voicesOn ? api<{ mine: Voice[]; limit: number }>("/api/jawad/voices") : null]).then(([r, v]) => {
        if (!r.ok) return setError(r.body.error || "تعذّر تحميل مكتبتك.");
        setAccess(r.body.access);
        setItems(r.body.items);
        setError("");
        if (v?.ok) setVoices({ mine: v.body.mine, limit: v.body.limit });
      }),
    [voicesOn],
  );
  useEffect(() => {
    load();
  }, [load]);

  // Pictures being made: their jobs are followed until they end (a success lands in the library by itself)
  const open = making.filter((m) => !["succeeded", "failed", "cancelled"].includes(m.status)).map((m) => m.jobId).join(",");
  useEffect(() => {
    if (!open) return;
    const t = setInterval(async () => {
      const r = await api<{ jobs: { id: string; status: string; error: string | null }[] }>(`/api/jawad/jobs?ids=${open}`);
      if (!r.ok) return;
      let done = false;
      setMaking((list) =>
        list.map((m) => {
          const j = r.body.jobs.find((x) => x.id === m.jobId);
          if (j && j.status !== m.status && ["succeeded", "failed", "cancelled"].includes(j.status)) done = true;
          return j ? { ...m, status: j.status, error: j.error } : m;
        }),
      );
      if (done) void load();
    }, 2500);
    return () => clearInterval(t);
  }, [open, load]);

  const locked = Boolean(access && !access.active);
  const ofKind = (k: LibraryKind) => items.filter((i) => i.kind === k);

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 pb-16 pt-6">
      <section className="jw-panel flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold"><Icon name="layers" size={20} className="text-jw-accent" /> مكتبتي</h1>
          <p className="text-sm text-jw-muted">أصواتك وشخصياتك وأماكنك: تصنعها مرة، وتستخدمها في كل عمل بـ «@اسمها».</p>
        </div>
        {access && (
          <span className={`jw-chip !px-3 !py-1 ${access.active ? "!border-jw-accent/50 text-jw-accent" : ""}`}>
            {access.owner ? "مفتوحة لك دائمًا (المالك)" : access.active && access.until ? `مفعّلة حتى ${fmtDate(access.until)}` : "مقفلة"}
          </span>
        )}
      </section>

      {error && <p className="rounded-lg border border-jw-danger/40 bg-jw-danger/10 p-3 text-sm text-jw-danger" role="alert">{error}</p>}
      {access && !access.migrated && <p className="rounded-lg border border-jw-warn/40 bg-jw-warn/10 p-3 text-sm text-jw-warn">«المكتبة» تحتاج ملف قاعدة البيانات 0025 في Supabase (SQL Editor ← Run).</p>}
      {locked && access?.migrated && <Offer />}

      <div className="jw-seg max-w-md" role="tablist" aria-label="أقسام المكتبة">
        {(["character", "place", "voices"] as Tab[]).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
            <Icon name={t === "voices" ? "mic" : t === "character" ? "user" : "image"} size={15} /> {t === "voices" ? "الأصوات" : LIBRARY_KIND[t].many}
            <span className="text-[10px] text-jw-faint">{t === "voices" ? voices?.mine.length ?? 0 : ofKind(t).length}</span>
          </button>
        ))}
      </div>

      {tab === "voices" ? (
        <section className="space-y-3" aria-label="الأصوات">
          {!voicesOn ? (
            <p className="text-sm text-jw-muted">أصوات ElevenLabs غير مفعّلة حاليًا (فعّل «Eleven v4» من لوحة الإدارة).</p>
          ) : (
            <>
              <div className="grid gap-2 sm:grid-cols-2">
                <button type="button" className="jw-btn h-auto flex-col items-start gap-0.5 p-3 text-start" disabled={locked || !access?.migrated} onClick={() => setStudio("design")}>
                  <span className="flex items-center gap-2 font-semibold"><Icon name="wand" size={16} /> صمّم صوتًا من الصفر</span>
                  <span className="text-[11px] text-jw-muted">تصفه بالكلام (العمر، اللهجة، النبرة…) فتسمع ٣ عينات وتحفظ أقربها</span>
                </button>
                <button type="button" className="jw-btn h-auto flex-col items-start gap-0.5 p-3 text-start" disabled={locked || !access?.migrated} onClick={() => setStudio("clone")}>
                  <span className="flex items-center gap-2 font-semibold"><Icon name="mic" size={16} /> بصمة صوتك</span>
                  <span className="text-[11px] text-jw-muted">تسجّل بصوتك من الميكروفون (أو ترفع تسجيلًا) فيُحفظ صوتك نفسه</span>
                </button>
              </div>
              {voices && voices.mine.length > 0 ? (
                <ul className="space-y-2">
                  {voices.mine.map((v) => (
                    <li key={v.id} className={`flex items-center gap-2 rounded-xl border border-jw-line bg-jw-bg-2 px-2 py-1.5 ${locked ? "opacity-60" : ""}`}>
                      <Play url={v.previewUrl} label={v.name} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{v.name}</span>
                        <span className="block text-[11px] text-jw-faint">{v.origin === "design" ? "مصمّم من الوصف" : "بصمة صوت"}</span>
                      </span>
                      <DeleteButton label={v.name} onDelete={async () => (await api("/api/jawad/voices", { action: "delete", id: v.id })).body.error ?? null} onDone={load} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-jw-muted">ما عندك أصوات محفوظة بعد.</p>
              )}
              {voices && <p className="text-[11px] text-jw-faint">الأصوات تُختار في «Eleven v4» وفي أصوات صانع الأفلام. الحد {voices.limit} أصوات.</p>}
            </>
          )}
        </section>
      ) : (
        <section className="space-y-3" aria-label={LIBRARY_KIND[tab].many}>
          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" className="jw-btn h-auto flex-col items-start gap-0.5 p-3 text-start" disabled={locked || !access?.migrated} onClick={() => setAdding({ kind: tab, how: "make" })}>
              <span className="flex items-center gap-2 font-semibold"><Icon name="sparkles" size={16} /> اصنع {LIBRARY_KIND[tab].one} من الوصف</span>
              <span className="text-[11px] text-jw-muted">تصفها بالكلام فتُرسم صورتها (بسعر توليد صورة) وتُحفظ باسمها</span>
            </button>
            <button type="button" className="jw-btn h-auto flex-col items-start gap-0.5 p-3 text-start" disabled={locked || !access?.migrated} onClick={() => setAdding({ kind: tab, how: "own" })}>
              <span className="flex items-center gap-2 font-semibold"><Icon name="upload" size={16} /> من صورة عندك</span>
              <span className="text-[11px] text-jw-muted">ترفع صورتك وتسمّيها، بلا تكلفة</span>
            </button>
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {making.filter((m) => m.kind === tab && m.status !== "succeeded").map((m) => (
              <li key={m.jobId} className="jw-panel overflow-hidden">
                <div className={`grid ${tab === "character" ? "aspect-[2/3]" : "aspect-video"} place-items-center bg-jw-bg-2 p-3 text-center text-xs`}>
                  {m.status === "failed" || m.status === "cancelled" ? <span className="text-jw-danger">{m.error ?? "تعذّر صنعها."}</span> : <span className="flex flex-col items-center gap-2"><span className="jw-spinner" /> تُرسم الآن…</span>}
                </div>
                <p className="truncate p-2 text-sm font-semibold" dir="auto">@{m.name}</p>
              </li>
            ))}
            {ofKind(tab).map((it) => (
              <li key={it.id} className={`jw-panel overflow-hidden ${locked ? "opacity-60" : ""}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {it.url ? <img src={it.url} alt={it.name} className={`w-full ${tab === "character" ? "aspect-[2/3]" : "aspect-video"} bg-jw-bg-2 object-cover`} /> : <div className="aspect-square bg-jw-bg-2" />}
                <div className="space-y-1 p-2">
                  <div className="flex items-center gap-1">
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold" dir="auto">@{it.name}</span>
                    <DeleteButton label={it.name} onDelete={async () => (await api("/api/jawad/library", { action: "delete", id: it.id })).body.error ?? null} onDone={load} />
                  </div>
                  <p className="text-[11px] text-jw-faint">{it.origin === "made" ? "مصنوعة من الوصف" : "من صورتك"}</p>
                  {it.note && <p className="line-clamp-2 text-[11px] text-jw-muted" dir="auto">{it.note}</p>}
                </div>
              </li>
            ))}
          </ul>
          {!ofKind(tab).length && !making.some((m) => m.kind === tab) && <p className="text-sm text-jw-muted">ما عندك {LIBRARY_KIND[tab].many} بعد. {LIBRARY_KIND[tab].hint}.</p>}
          <p className="text-[11px] text-jw-faint">اكتب «@» في برومبت الصور أو الفيديو تظهر لك قائمة مكتبتك، أو اكتب «@الاسم» مباشرة فتُضاف صورته مرجعًا تلقائيًا. الحد {LIBRARY_LIMIT} عنصرًا.</p>
        </section>
      )}

      {studio && (
        <VoiceStudio
          mode={studio}
          coins={voiceCoins}
          onClose={() => setStudio(null)}
          onSaved={() => {
            setStudio(null);
            void load();
          }}
        />
      )}
      {adding && (
        <AddDialog
          kind={adding.kind}
          how={adding.how}
          owner={owner}
          onClose={() => setAdding(null)}
          onAdded={() => {
            setAdding(null);
            void load();
          }}
          onMaking={(m) => {
            setAdding(null);
            setMaking((list) => [m, ...list]);
          }}
        />
      )}
    </div>
  );
}

/** What «المكتبة» opens, and its price (subscribing waits for the site's payments). */
function Offer() {
  return (
    <section className="jw-panel space-y-3 border-jw-accent/40 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold"><Icon name="lock" size={16} className="text-jw-accent" /> «{LIBRARY_ADDON.name}» إضافة باشتراك</h2>
        <p className="hide-in-app text-2xl font-bold">
          <span dir="ltr">{LIBRARY_ADDON.monthlySar}</span> <span className="text-sm font-normal text-jw-muted">ريال شهريًا</span>
        </p>
      </div>
      <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
        {LIBRARY_ADDON.features.map((f) => (
          <li key={f} className="flex items-start gap-2"><Icon name="check" size={16} className="mt-0.5 shrink-0 text-jw-accent" /> {f}</li>
        ))}
      </ul>
      <p className="text-xs text-jw-muted">الصنع نفسه (تصميم صوت أو رسم صورة) يُخصم بالنقود الذكية مثل أي توليد؛ الاشتراك هو ما يحفظها لك ويفتحها في أعمالك.</p>
      <button type="button" className="jw-btn jw-btn-primary w-full sm:w-auto" disabled>
        اشترك في المكتبة · يتفعّل الدفع في الموقع قريبًا
      </button>
    </section>
  );
}

function DeleteButton({ label, onDelete, onDone }: { label: string; onDelete: () => Promise<string | null>; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="jw-btn jw-btn-quiet jw-btn-icon shrink-0"
      disabled={busy}
      aria-label={`احذف ${label}`}
      onClick={async () => {
        if (!confirm(`حذف «${label}» من مكتبتك؟ الأعمال التي صُنعت به تبقى كما هي.`)) return;
        setBusy(true);
        const err = await onDelete();
        setBusy(false);
        if (err) alert(err);
        else onDone();
      }}
    >
      <Icon name="trash" size={15} />
    </button>
  );
}

/** Adding a character or place: made from a description (priced, then confirmed), or the person's own picture. */
function AddDialog({ kind, how, owner, onClose, onAdded, onMaking }: { kind: LibraryKind; how: "make" | "own"; owner: boolean; onClose: () => void; onAdded: () => void; onMaking: (m: Making) => void }) {
  const k = LIBRARY_KIND[kind];
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [quote, setQuote] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const key = useRef(uid());
  useEffect(() => () => (preview ? URL.revokeObjectURL(preview) : undefined), [preview]);

  const why = !name.trim() ? "سمِّها (تمنشنها به لاحقًا)." : how === "make" && note.trim().length < 10 ? "صفها في ١٠ أحرف على الأقل." : how === "own" && !file ? "اختر صورة." : null;

  async function make() {
    setBusy(true);
    setError("");
    const r = await api<{ job?: { id: string; status: string } }>("/api/jawad/library", { action: "make", key: key.current, kind, name, note, expectedCoins: quote ?? -1 });
    setBusy(false);
    if (r.status === 409 && r.body.code === "price_changed" && typeof r.body.coins === "number") return setQuote(r.body.coins);
    if (!r.ok || !r.body.job) return setError(r.body.error || "تعذّر البدء.");
    onMaking({ jobId: r.body.job.id, kind, name: name.trim().replace(/\s+/g, "_"), status: r.body.job.status, error: null });
  }
  async function own() {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const uploadId = await uploadImage(file, setProgress);
      const r = await api("/api/jawad/library", { action: "add", kind, name, note, uploadId });
      if (!r.ok) throw new Error(r.body.error || "تعذّر الحفظ.");
      onAdded();
    } catch (e) {
      setError((e as Error).message);
    }
    setProgress(null);
    setBusy(false);
  }

  return (
    <Dialog open onClose={onClose} title={how === "make" ? `اصنع ${k.one} من الوصف` : `${k.one} من صورة عندك`}>
      <div className="space-y-3 p-4">
        <label className="block">
          <span className="jw-label">الاسم</span>
          <input className="jw-input" maxLength={24} dir="auto" value={name} onChange={(e) => { setName(e.target.value); setQuote(null); }} placeholder={kind === "character" ? "مثال: أبو_فهد" : "مثال: المجلس"} />
          <span className="mt-1 block text-[11px] text-jw-faint">تمنشنها به في البرومبت: <span dir="auto">@{name.trim().replace(/\s+/g, "_") || "الاسم"}</span> (بلا مسافات، حتى ٢٤ حرفًا)</span>
        </label>
        {how === "own" && (
          <div>
            <span className="jw-label">الصورة</span>
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="" className="max-h-60 w-full rounded-lg bg-jw-bg-2 object-contain" />
            ) : null}
            <button type="button" className="jw-btn mt-2 w-full" disabled={busy} onClick={() => input.current?.click()}>
              <Icon name="upload" size={16} /> {file ? "صورة أخرى" : "اختر صورة (PNG أو JPG أو WEBP)"}
            </button>
            <input
              ref={input}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                setFile(f);
                setPreview(URL.createObjectURL(f));
              }}
            />
          </div>
        )}
        <label className="block">
          <span className="jw-label">{how === "make" ? `صف ${k.one}` : "وصف قصير (اختياري)"}</span>
          <textarea className="jw-textarea min-h-24" maxLength={1000} dir="auto" value={note} onChange={(e) => { setNote(e.target.value); setQuote(null); }} placeholder={k.example} />
        </label>
        {error && <p className="text-sm text-jw-danger" role="alert">{error}</p>}
        {how === "make" ? (
          <button type="button" className="jw-btn jw-btn-primary w-full" disabled={busy || Boolean(why)} onClick={make}>
            <Icon name="sparkles" size={16} />
            {busy ? "لحظة…" : quote == null ? "احسب السعر" : (
              <>
                اصنعها <span className="inline-flex items-center gap-1">· <span dir="ltr">{quote}</span> <SmartCoin size={14} /></span>
                {owner && <span className="text-[11px] opacity-80">(بلا خصم للمالك)</span>}
              </>
            )}
          </button>
        ) : (
          <button type="button" className="jw-btn jw-btn-primary w-full" disabled={busy || Boolean(why)} onClick={own}>
            <Icon name="check" size={16} /> {progress !== null ? `يرفع… ${Math.round(progress * 100)}٪` : busy ? "يحفظ…" : "احفظها في مكتبتي"}
          </button>
        )}
        {why && !busy && <p className="text-[11px] text-jw-muted">{why}</p>}
        {how === "make" && <p className="text-[11px] text-jw-faint">تُرسم بـ GPT Image 2 ({kind === "character" ? "صورة طولية للشخصية كاملة على خلفية سادة" : "منظر واسع للمكان بلا أشخاص"}) وتظهر أيضًا في «أعمالي». إن فشل الرسم تُعاد نقودك.</p>}
      </div>
    </Dialog>
  );
}
