"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { api, postJson } from "@/lib/fetch";
import { createClient } from "@/lib/supabase/client";
import Markdown from "@/components/Markdown";
import Spinner from "@/components/Spinner";
import QuestionsForm from "../../QuestionsForm";
import type { MapChoice, MapItem, SheetVersion } from "@/lib/film/sheets";

const MAX_REFERENCE_UPLOADS = 4; // same as lib/film/sheets.ts (that file is server-only)
import { STATUS_LABELS } from "@config/film";

interface Asset {
  id: string;
  kind: string;
  ref_key: string;
  status: string;
  error: string | null;
  meta: Record<string, unknown>;
  url: string;
  created_at: string;
}
interface StyleCard {
  id: string;
  group: string;
  name: string;
  description: string;
  feel: string;
  bestFor: string;
}
interface Props {
  projectId: string;
  stage: string;
  versions: SheetVersion[];
  assets: Asset[];
  job: { status: string; error: string | null } | null;
  imagesRunning: number;
  styles: StyleCard[];
}

const MASTER = "STY-00";
const TEST = "STYLE-TEST";
const chip = (s: string) => (s === "approved" ? "bg-teal text-white" : s === "awaiting_approval" || s === "generated" ? "bg-gold text-on-gold" : s === "failed" ? "bg-red-500 text-white" : "");

export default function SheetsWorkspace({ projectId, stage, versions, assets, job, imagesRunning, styles }: Props) {
  const router = useRouter();
  const [writing, setWriting] = useState(job?.status === "running");
  const [painting, setPainting] = useState(imagesRunning > 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Poll while the sheet maker writes or pictures are generated
  useEffect(() => {
    if (!writing && !painting) return;
    const timer = setInterval(async () => {
      try {
        const s = await api<{ status: string | null; imagesRunning: number }>(`/api/film/projects/${projectId}/sheets`);
        const w = s.status === "running";
        const p = s.imagesRunning > 0;
        if (w !== writing || p !== painting) router.refresh();
        setWriting(w);
        setPainting(p);
      } catch {
        // keep polling
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [writing, painting, projectId, router]);

  async function send(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const { jobId } = await postJson<{ jobId: string | null }>(`/api/film/projects/${projectId}/sheets`, body);
      if (jobId) setWriting(true);
      if (body.action === "test_styles" || body.action === "generate_image") setPainting(true);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const latestOf = (kind: string, ref = "") => versions.filter((v) => v.kind === kind && v.ref_key === ref).at(-1);
  const understanding = latestOf("sheet_understanding");
  const questions = latestOf("sheet_questions");
  const styleTest = latestOf("style_test");
  const style = latestOf("style");
  const mapVersion = versions.filter((v) => v.kind === "sheet_understanding" && v.status === "approved").at(-1) ?? understanding;
  const map = mapVersion?.data.sheet_map ?? [];
  const choices = mapVersion?.status === "approved" ? (mapVersion.data.choices ?? {}) : {};
  const promptIds = [...new Set(versions.filter((v) => v.kind === "sheet_prompt").map((v) => v.ref_key))];
  const orderedSheets = [...map.map((m) => m.id).filter((id) => promptIds.includes(id)), ...promptIds.filter((id) => !map.some((m) => m.id === id))];
  const library = assets.filter((a) => a.status === "approved" && a.ref_key !== TEST && typeof a.meta.at_name === "string");
  const current = [...versions].filter((v) => v.kind !== "sheet_handoff" && v.kind !== "style").sort((a, b) => a.created_at.localeCompare(b.created_at)).at(-1);
  const failed = job?.status === "failed" && !writing;
  const started = versions.length > 0 || writing || failed;

  return (
    <div className="space-y-4">
      {library.length > 0 && (
        <section className="card space-y-3 p-4">
          <h2 className="text-lg font-extrabold">مكتبة المراجع ({library.length})</h2>
          <p className="text-xs font-bold text-muted">المخرج يكتب هذي الأسماء في برومبتات المشاهد، والموقع يرفق صورها تلقائيًا.</p>
          <div className="grid grid-cols-3 gap-2">
            {library.map((a) => <LibraryCard key={a.id} asset={a} busy={busy} onRename={(name) => send({ action: "rename", assetId: a.id, name })} />)}
          </div>
        </section>
      )}

      {!started && (
        <div className="card space-y-4 p-6 text-center">
          <p className="text-5xl">🎨</p>
          <p className="font-bold">صانع الشيت يستلم السيناريو المعتمد، ويعرض فهمه وخريطة الشيتات اللي يحتاجها الفيلم.</p>
          <button className="btn btn-primary w-full text-xl" disabled={busy} onClick={() => send({ action: "start" })}>
            {busy ? "نرسل…" : "ابدأ مع صانع الشيت"}
          </button>
          <p className="text-xs font-bold text-muted">كل رد تقريبًا من $0.05 إلى $0.80</p>
        </div>
      )}

      {/* 1. Understanding + sheet map with the user's choice per item */}
      {understanding && (
        <Card title="الفهم وخريطة الشيتات" v={understanding} current={current?.id === understanding.id} busy={busy || writing} onRevise={(text) => send({ action: "revise", text, versionId: understanding.id })}>
          <MapChoices
            projectId={projectId}
            map={map}
            locked={understanding.status !== "awaiting_approval"}
            savedChoices={choices}
            assets={assets}
            busy={busy || writing}
            onRefresh={() => router.refresh()}
            onRemove={(assetId) => send({ action: "remove_upload", assetId })}
            onApprove={(c) => send({ action: "approve", versionId: understanding.id, choices: c })}
          />
        </Card>
      )}

      {/* 2. Design questions */}
      {questions && (
        <Card title="أسئلة التصميم" v={questions} current={false} busy hideBody={questions.status === "awaiting_approval"}>
          {questions.status === "awaiting_approval" ? (
            <QuestionsForm questions={questions.data.questions ?? []} busy={busy || writing} onSubmit={(answers) => send({ action: "answers", versionId: questions.id, answers })} />
          ) : (
            <p className="text-sm font-bold text-muted">تمت الإجابة.</p>
          )}
        </Card>
      )}

      {/* 3. Style test on a real frame from the story */}
      {styleTest && (
        <StyleTest
          v={styleTest}
          styles={styles}
          tests={assets.filter((a) => a.ref_key === TEST)}
          chosen={style?.data.styleId ?? null}
          busy={busy || writing}
          onTest={(ids) => send({ action: "test_styles", styleIds: ids })}
          onChoose={(id) => send({ action: "choose_style", styleId: id })}
        />
      )}

      {/* 4. Master and every sheet */}
      {orderedSheets.map((sid) => {
        const v = latestOf("sheet_prompt", sid)!;
        const item = map.find((m) => m.id === sid);
        const imgs = assets.filter((a) => a.kind === "image" && a.ref_key === sid);
        return (
          <Card
            key={sid}
            title={`${sid} · ${sid === MASTER ? "الماستر" : (item?.name ?? "")}`}
            v={v}
            current={current?.id === v.id}
            busy={busy || writing}
            onApprove={v.status === "awaiting_approval" ? () => send({ action: "approve", versionId: v.id }) : undefined}
            onRevise={(text) => send({ action: "revise", text, versionId: v.id })}
          >
            {v.status === "approved" && (
              <SheetImages
                sheetId={sid}
                images={imgs}
                busy={busy}
                onGenerate={() => send({ action: "generate_image", sheetId: sid })}
                onApprove={(id) => send({ action: "approve_image", assetId: id })}
                onReject={(id) => send({ action: "reject_image", assetId: id })}
              />
            )}
          </Card>
        );
      })}

      {/* Items the user supplied "as is" need no prompt */}
      {map.filter((m) => choices[m.id] === "as_is").length > 0 && (
        <p className="card p-4 text-sm font-bold text-muted">
          مراجع من عندك معتمدة كما هي: {map.filter((m) => choices[m.id] === "as_is").map((m) => m.name).join("، ")}
        </p>
      )}

      {writing && (
        <div className="card flex items-center gap-3 p-5" role="status">
          <Spinner />
          <div>
            <p className="font-extrabold">صانع الشيت يكتب…</p>
            <p className="text-sm font-bold text-muted">من دقيقة إلى ٣ دقائق. تقدر تسكّر الصفحة وترجع.</p>
          </div>
        </div>
      )}
      {failed && (
        <div className="card space-y-3 p-5">
          <p className="error-box">ما كمل الرد: {job?.error}. ما انحسبت عليك تكلفة.</p>
          <button className="btn btn-primary w-full" disabled={busy} onClick={() => send({ action: "retry" })}>أعد المحاولة</button>
        </div>
      )}
      {stage === "director" || stage === "voices" || stage === "done" ? (
        <div className="card space-y-1 p-5 text-center">
          <p className="text-lg font-extrabold">✅ الشيتات كلها معتمدة وانتقلت للمخرج السينمائي</p>
          <p className="text-sm font-bold text-muted">المخرج ينضاف في المرحلة الجاية من التطوير.</p>
        </div>
      ) : null}
      {error && <p className="error-box">{error}</p>}
    </div>
  );
}

function Card({
  title,
  v,
  current,
  busy,
  hideBody,
  onApprove,
  onRevise,
  children,
}: {
  title: string;
  v: SheetVersion;
  current: boolean;
  busy: boolean;
  hideBody?: boolean;
  onApprove?: () => void;
  onRevise?: (text: string) => void;
  children?: ReactNode;
}) {
  const [revise, setRevise] = useState(false);
  const [text, setText] = useState("");
  const pending = v.status === "awaiting_approval";
  return (
    <article className={`card space-y-3 p-5 ${pending ? "border-2 border-gold" : ""}`}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-extrabold">{title} <span className="text-sm text-muted">· النسخة {v.version}</span></h2>
        <span className={`chip ${chip(v.status)}`}>{STATUS_LABELS[v.status]}</span>
      </header>
      {!hideBody && (
        <details open={pending || current}>
          <summary className="cursor-pointer text-sm font-extrabold text-muted">اعرض النص</summary>
          <Markdown text={v.body} highlightRequests={pending} hideCode />
          {v.data.notes && (
            <div className="mt-2 rounded-2xl bg-surface-2 p-3 text-sm">
              <p className="font-extrabold">ملاحظات</p>
              <Markdown text={v.data.notes} />
            </div>
          )}
        </details>
      )}
      {children}
      {pending && v.data.suggestion && (
        <div className="space-y-2 rounded-2xl border-2 border-gold bg-gold/10 p-4">
          <p className="font-extrabold">💡 اقتراح تعديل</p>
          <p className="font-bold leading-8">{v.data.suggestion}</p>
          {!busy && onRevise && (
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-secondary flex-1" onClick={() => onRevise(`نفّذ التعديل المقترح: ${v.data.suggestion}`)}>نفّذ التعديل</button>
              {onApprove ? (
                <button className="btn btn-primary flex-1" onClick={onApprove}>اعتمد وكمّل ✅</button>
              ) : (
                <p className="self-center text-sm font-bold text-muted">أو كمّل بدون تعديل: اعتمد الخريطة تحت.</p>
              )}
            </div>
          )}
        </div>
      )}
      {!busy && (onApprove || onRevise) && (
        <div className="space-y-2">
          <div className="flex gap-2">
            {onApprove && !v.data.suggestion && <button className="btn btn-primary flex-1" onClick={onApprove}>اعتمد وكمّل ✅</button>}
            {onRevise && (pending || v.status === "approved") && (
              <button className="btn btn-ghost flex-1" onClick={() => setRevise(!revise)}>اطلب تعديل ✏️</button>
            )}
          </div>
          {revise && onRevise && (
            <div className="space-y-2">
              <textarea className="field min-h-24" value={text} onChange={(e) => setText(e.target.value.slice(0, 4000))} placeholder="اكتب وش تبي يتغيّر" />
              <button className="btn btn-secondary w-full" disabled={!text.trim()} onClick={() => { onRevise(text); setRevise(false); setText(""); }}>أرسل التعديل</button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

/** Per map item: generate it, or use the user's own picture (as is / as a reference for a new sheet). */
function MapChoices({
  projectId, map, locked, savedChoices, assets, busy, onRefresh, onRemove, onApprove,
}: {
  projectId: string;
  map: MapItem[];
  locked: boolean;
  savedChoices: Record<string, MapChoice>;
  assets: Asset[];
  busy: boolean;
  onRefresh: () => void;
  onRemove: (assetId: string) => void;
  onApprove: (c: Record<string, MapChoice>) => void;
}) {
  const [choices, setChoices] = useState<Record<string, MapChoice>>(savedChoices);
  const [uploading, setUploading] = useState("");
  const [error, setError] = useState("");
  const fileFor = useRef<string>("");
  const input = useRef<HTMLInputElement>(null);
  const uploadsOf = (id: string) => assets.filter((a) => a.kind === "upload" && a.ref_key === id && a.status !== "rejected");
  const missing = map.filter((m) => (choices[m.id] ?? "make") !== "make" && uploadsOf(m.id).length === 0);

  async function upload(files: File[]) {
    const sheetId = fileFor.current;
    if (!files.length || !sheetId) return;
    setError("");
    setUploading(sheetId);
    try {
      const mode = (choices[sheetId] ?? "make") === "reference" ? "reference" : "as_is";
      // Up to 4 pictures for a conversion; one for "as is"
      const room = mode === "reference" ? MAX_REFERENCE_UPLOADS - uploadsOf(sheetId).length : 1;
      if (room <= 0) throw new Error(`الحد الأقصى ${MAX_REFERENCE_UPLOADS} صور لكل عنصر.`);
      for (const file of files.slice(0, room)) {
        if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 20 * 1024 * 1024) throw new Error("صورة JPG أو PNG أو WEBP أقل من ٢٠ ميجا.");
        const { path, token } = await postJson<{ path: string; token: string }>(`/api/film/projects/${projectId}/sheets`, { action: "upload_url", sheetId, mime: file.type });
        const { error: e } = await createClient().storage.from("film").uploadToSignedUrl(path, token, file, { contentType: file.type });
        if (e) throw new Error("تعذّر رفع الصورة.");
        await postJson(`/api/film/projects/${projectId}/sheets`, { action: "upload_confirm", sheetId, path, mode });
      }
      onRefresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading("");
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <h3 className="font-extrabold">خريطة الشيتات: وش تبي نصنع؟</h3>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={(e) => upload(Array.from(e.target.files ?? []))} />
      {map.map((m) => {
        const c = (locked ? savedChoices[m.id] : choices[m.id]) ?? "make";
        const ups = uploadsOf(m.id);
        const shown = c === "as_is" ? ups.slice(-1) : ups;
        return (
          <div key={m.id} className="space-y-2 rounded-2xl border border-line p-3">
            <p className="font-extrabold">{m.id} · {m.name}</p>
            <p className="text-sm font-bold text-muted">{m.coverage}</p>
            {m.id === "STY-00" ? (
              <p className="text-xs font-bold text-muted">الماستر يتصنع دائمًا؛ هو مرجع الستايل لكل الفيلم.</p>
            ) : locked ? (
              <span className="chip">{c === "make" ? "🎨 نصنعه" : c === "as_is" ? "📤 صورتك كما هي" : "🔄 نحوّل صورتك إلى شيت"}</span>
            ) : (
              <div className="flex flex-wrap gap-2 text-sm font-bold">
                {([["make", "🎨 اصنعه لي"], ["as_is", "📤 عندي جاهز (كما هو)"], ["reference", "🔄 حوّل صورتي (حتى ٤ صور) إلى شيت متكامل"]] as const).map(([k, label]) => (
                  <button key={k} className={`chip ${c === k ? "bg-gold text-on-gold" : ""}`} onClick={() => setChoices({ ...choices, [m.id]: k })}>{label}</button>
                ))}
              </div>
            )}
            {c !== "make" && (
              <div className="flex flex-wrap items-center gap-2">
                {shown.map((u) => (
                  <div key={u.id} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
                    {u.url && <img src={u.url} alt={m.name} className="size-16 rounded-xl object-cover" />}
                    {!locked && c === "reference" && (
                      <button aria-label="احذف الصورة" className="absolute -end-1 -top-1 size-6 rounded-full bg-red-500 text-xs font-extrabold text-white" onClick={() => onRemove(u.id)}>×</button>
                    )}
                  </div>
                ))}
                {!locked && (c !== "reference" || ups.length < MAX_REFERENCE_UPLOADS) && (
                  <button className="btn btn-ghost min-h-10 px-3 text-sm" disabled={Boolean(uploading)} onClick={() => { fileFor.current = m.id; input.current?.click(); }}>
                    {uploading === m.id ? "نرفع…" : c === "reference" ? `أضف صور (${ups.length}/${MAX_REFERENCE_UPLOADS})` : ups.length ? "غيّر الصورة" : "ارفع الصورة"}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
      {error && <p className="error-box">{error}</p>}
      {!locked && !busy && (
        <>
          {missing.length > 0 && <p className="text-sm font-bold text-red-500">ارفع صورة: {missing.map((m) => m.name).join("، ")}</p>}
          <button className="btn btn-primary w-full" disabled={missing.length > 0} onClick={() => onApprove(choices)}>اعتمد الفهم والخريطة ✅</button>
        </>
      )}
    </div>
  );
}

function StyleTest({
  v, styles, tests, chosen, busy, onTest, onChoose,
}: {
  v: SheetVersion;
  styles: StyleCard[];
  tests: Asset[];
  chosen: string | null;
  busy: boolean;
  onTest: (ids: string[]) => void;
  onChoose: (id: string) => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const groups = [...new Set(styles.map((s) => s.group))];
  const nameOf = (id: string) => styles.find((s) => s.id === id)?.name ?? id;
  const toggle = (id: string) => setPicked(picked.includes(id) ? picked.filter((x) => x !== id) : picked.length < 4 ? [...picked, id] : picked);

  return (
    <article className="card space-y-4 p-5">
      <h2 className="text-xl font-extrabold">اختبار الستايل</h2>
      <details>
        <summary className="cursor-pointer text-sm font-extrabold text-muted">اللقطة المختارة من قصتك وبرومبتها</summary>
        <Markdown text={v.body} />
      </details>

      {tests.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-extrabold">نفس اللقطة بستايلات مختلفة</h3>
          <div className="grid grid-cols-2 gap-3">
            {tests.map((t) => {
              const sid = String(t.meta.styleId ?? "");
              return (
                <figure key={t.id} className={`space-y-2 rounded-2xl border p-2 ${chosen === sid ? "border-teal border-2" : "border-line"}`}>
                  {t.status === "generating" ? (
                    <div className="grid aspect-[3/2] place-items-center rounded-xl bg-surface-2"><Spinner /></div>
                  ) : t.status === "failed" ? (
                    <p className="error-box text-xs">فشل: {t.error}</p>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
                    <a href={t.url} target="_blank" rel="noopener"><img src={t.url} alt={nameOf(sid)} className="aspect-[3/2] w-full rounded-xl object-cover" /></a>
                  )}
                  <figcaption className="text-sm font-extrabold">{nameOf(sid)}</figcaption>
                  {!chosen && t.status === "generated" && (
                    <button className="btn btn-primary min-h-10 w-full text-sm" disabled={busy} onClick={() => onChoose(sid)}>اعتمد هذا الستايل</button>
                  )}
                </figure>
              );
            })}
          </div>
        </div>
      )}

      {chosen ? (
        <p className="rounded-2xl bg-surface-2 p-3 font-extrabold">🔒 الستايل المعتمد: {nameOf(chosen)} — نصه ينكتب حرفيًا في كل برومبت.</p>
      ) : (
        <div className="space-y-3">
          <h3 className="font-extrabold">اختر من ٢ إلى ٤ ستايلات للتجربة ({picked.length}/٤)</h3>
          {groups.map((g) => (
            <div key={g} className="space-y-2">
              <p className="text-sm font-extrabold text-muted">{g}</p>
              <div className="grid grid-cols-2 gap-2">
                {styles.filter((s) => s.group === g).map((s) => (
                  <button key={s.id} onClick={() => toggle(s.id)} className={`rounded-2xl border p-3 text-start ${picked.includes(s.id) ? "border-2 border-gold bg-surface-2" : "border-line"}`}>
                    <p className="font-extrabold">{s.name}</p>
                    <p className="text-xs font-bold text-muted">{s.feel}</p>
                    <p className="mt-1 text-xs text-muted">{s.bestFor}</p>
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button className="btn btn-primary sticky bottom-3 w-full" disabled={busy || picked.length === 0} onClick={() => { onTest(picked); setPicked([]); }}>
            ولّد صور الاختبار ({picked.length}) · تقريبًا ${(picked.length * 0.06).toFixed(2)}
          </button>
        </div>
      )}
    </article>
  );
}

function SheetImages({
  sheetId, images, busy, onGenerate, onApprove, onReject,
}: {
  sheetId: string;
  images: Asset[];
  busy: boolean;
  onGenerate: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const shown = images.filter((i) => i.status !== "rejected");
  const generating = images.some((i) => i.status === "generating");
  const approved = images.some((i) => i.status === "approved");
  return (
    <div className="space-y-3">
      {shown.map((img) => (
        <figure key={img.id} className={`space-y-2 rounded-2xl border p-2 ${img.status === "approved" ? "border-2 border-teal" : "border-line"}`}>
          {img.status === "generating" ? (
            <div className="grid aspect-video place-items-center rounded-xl bg-surface-2"><Spinner /><p className="text-sm font-bold">نولّد الصورة… (دقيقة إلى دقيقتين)</p></div>
          ) : img.status === "failed" ? (
            <p className="error-box">فشل التوليد: {img.error}. ما انحسبت تكلفة.</p>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
            <a href={img.url} target="_blank" rel="noopener"><img src={img.url} alt={sheetId} className="w-full rounded-xl" /></a>
          )}
          <div className="flex items-center justify-between gap-2">
            <span className={`chip ${chip(img.status)}`}>{STATUS_LABELS[img.status] ?? img.status}{typeof img.meta.at_name === "string" ? ` · ${img.meta.at_name}` : ""}</span>
            {img.status === "generated" && !busy && (
              <div className="flex gap-2">
                <button className="btn btn-primary min-h-10 px-4 text-sm" onClick={() => onApprove(img.id)}>اعتمد الصورة ✅</button>
                <button className="btn btn-ghost min-h-10 px-4 text-sm" onClick={() => onReject(img.id)}>ارفضها</button>
              </div>
            )}
          </div>
        </figure>
      ))}
      {!generating && !busy && (
        <button className={`btn w-full ${approved ? "btn-ghost" : "btn-secondary"}`} onClick={onGenerate}>
          {shown.length ? "🔁 ولّد نسخة ثانية" : "🖼️ ولّد الصورة"} · تقريبًا $0.40
        </button>
      )}
    </div>
  );
}

function LibraryCard({ asset, busy, onRename }: { asset: Asset; busy: boolean; onRename: (name: string) => void }) {
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState(String(asset.meta.at_name ?? ""));
  return (
    <div className="space-y-1">
      {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
      <img src={asset.url} alt={name} className="aspect-square w-full rounded-xl object-cover" />
      {edit ? (
        <div className="flex gap-1">
          <input className="field min-h-8 px-2 text-xs" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="text-xs font-bold" disabled={busy} onClick={() => { onRename(name); setEdit(false); }}>حفظ</button>
        </div>
      ) : (
        <button className="w-full truncate text-xs font-extrabold" title="غيّر الاسم" onClick={() => setEdit(true)}>{String(asset.meta.at_name)} ✏️</button>
      )}
    </div>
  );
}
