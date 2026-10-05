"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode, useCallback, useTransition } from "react";
import { api, postJson } from "@/lib/fetch";
import { createClient } from "@/lib/supabase/client";
import Markdown from "@/components/Markdown";
import Spinner from "@/components/Spinner";
import QuestionsForm from "../../QuestionsForm";
import ActionBar, { EditsLeftContext, type SendMode } from "../../ActionBar";
import StepCard, { statusChip as chip } from "../../StepCard";
import type { MapChoice, MapItem, SheetVersion } from "@/lib/film/sheets";

const MAX_REFERENCE_UPLOADS = 4; // same as lib/film/sheets.ts (that file is server-only)
const SHEET_COST = "تقريبًا $0.40";
import { STATUS_LABELS } from "@config/film";
import { useFilmBase } from "../../FilmBase";

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
  /** Edits left in this stage (the owner's limits); null = no limit. */
  editsLeft: number | null;
}

const MASTER = "STY-00";
const TEST = "STYLE-TEST";

export default function SheetsWorkspace({ projectId, stage, versions, assets, job, imagesRunning, styles, editsLeft }: Props) {
  const router = useRouter();
  const filmBase = useFilmBase();
  const [writing, setWriting] = useState(job?.status === "running");
  const [painting, setPainting] = useState(imagesRunning > 0);
  const [sending, setBusy] = useState(false);
  // Busy until the new page data has arrived: the old screen's buttons can't be pressed a second time
  const [refreshing, startRefresh] = useTransition();
  const refresh = useCallback(() => startRefresh(() => router.refresh()), [router]);
  const busy = sending || refreshing;
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // The page's data changed (a refresh, another tab): follow it, so a picture started elsewhere is followed here too
  const [seen, setSeen] = useState({ job: job?.status, images: imagesRunning });
  if (seen.job !== job?.status || seen.images !== imagesRunning) {
    setSeen({ job: job?.status, images: imagesRunning });
    if (job?.status === "running") setWriting(true);
    if (imagesRunning > 0) setPainting(true);
  }

  // Poll while the sheet maker writes or pictures are generated
  useEffect(() => {
    if (!writing && !painting) return;
    const timer = setInterval(async () => {
      try {
        const s = await api<{ status: string | null; imagesRunning: number }>(`/api/film/projects/${projectId}/sheets`);
        const w = s.status === "running";
        const p = s.imagesRunning > 0;
        if (w !== writing || p !== painting) refresh();
        setWriting(w);
        setPainting(p);
      } catch {
        // keep polling
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [writing, painting, projectId, router, refresh]);

  // Once this section's last step is done, go straight to the next one (only when it happens here, not on later visits)
  const openedAt = useRef(stage);
  useEffect(() => {
    if (openedAt.current === "sheets" && stage === "director") router.push(`${filmBase}/${projectId}/director`);
  }, [stage, projectId, router, filmBase]);

  async function send(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { jobId, images, warning } = await postJson<{ jobId: string | null; images?: number; warning?: string }>(`/api/film/projects/${projectId}/sheets`, body);
      if (jobId) setWriting(true);
      if (images) setPainting(true);
      if (warning) setNotice(warning);
      // «finish» found the project already with the director: go there
      if (body.action === "finish" && !jobId) router.push(`${filmBase}/${projectId}/director`);
      refresh();
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
  const masterApproved = assets.some((a) => a.kind === "image" && a.ref_key === MASTER && a.status === "approved");
  const approvedIds = new Set(assets.filter((a) => a.status === "approved").map((a) => a.ref_key));
  // «كل الشيتات مع بعض»: prompts waiting, new pictures waiting, and sheets still without a prompt
  const waitingPrompts = orderedSheets.filter((sid) => sid !== MASTER && latestOf("sheet_prompt", sid)?.status === "awaiting_approval");
  const readyImages = map.filter((m) => m.id !== MASTER && !approvedIds.has(m.id) && assets.some((a) => a.kind === "image" && a.ref_key === m.id && a.status === "generated"));
  const noPrompt = mapVersion?.status === "approved" ? map.filter((m) => m.id !== MASTER && choices[m.id] !== "as_is" && !promptIds.includes(m.id)) : [];
  const allApproved = stage === "sheets" && map.length > 0 && mapVersion?.status === "approved" && map.every((m) => approvedIds.has(m.id));

  // Arrived from the screenwriter (…/sheets?start=1): the sheet maker starts by itself, no second press
  const autoStarted = useRef(false);
  useEffect(() => {
    if (autoStarted.current || started || new URLSearchParams(window.location.search).get("start") !== "1") return;
    autoStarted.current = true;
    window.history.replaceState(null, "", window.location.pathname);
    const t = setTimeout(() => send({ action: "start" }), 0);
    return () => clearTimeout(t);
  });
  // Every picture approved: the handoff to the director is prepared by itself (once)
  const autoFinished = useRef(false);
  useEffect(() => {
    if (autoFinished.current || !allApproved || writing || failed || busy) return;
    autoFinished.current = true;
    const t = setTimeout(() => send({ action: "finish" }), 0);
    return () => clearTimeout(t);
  });
  const revise = (v: SheetVersion) => (mode: SendMode, text: string) => send({ action: "revise", text, versionId: v.id, mode });
  const backToSheets = stage === "director" ? " والمشروع انتقل للمخرج، فبيرجع لصانع الشيت لين تعتمد صورة جديدة." : "";
  // Sheets whose approved picture used this sheet as a reference (the master is every sheet's style reference)
  const dependents = (sid: string) =>
    orderedSheets.filter((id) => id !== sid && assets.some((a) => a.kind === "image" && a.ref_key === id && a.status === "approved") &&
      (sid === MASTER || versions.some((v) => v.kind === "sheet_prompt" && v.ref_key === id && v.status === "approved" && v.data.references?.some((r) => r.sheet_id === sid))));
  const nameOf = (id: string) => map.find((m) => m.id === id)?.name ?? id;
  const affects = (sid: string) => {
    const d = dependents(sid);
    return d.length ? ` الصور المعتمدة اللي انبنت عليه (${d.map(nameOf).join("، ")}) تظل مثل ما هي، ولو تبيها تتبع التغيير أعد توليدها.` : "";
  };

  return (
    <EditsLeftContext value={editsLeft}>
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
        <StepCard title="الفهم وخريطة الشيتات" v={understanding} current={current?.id === understanding.id} busy={busy || writing} onSend={revise(understanding)} noActions>
          <MapChoices
            projectId={projectId}
            map={map}
            locked={understanding.status !== "awaiting_approval"}
            savedChoices={choices}
            assets={assets}
            busy={busy || writing}
            onRefresh={refresh}
            onRemove={(assetId) => send({ action: "remove_upload", assetId })}
            onApprove={(c) => send({ action: "approve", versionId: understanding.id, choices: c })}
            onSend={revise(understanding)}
            warning={understanding.status === "approved" ? `الخريطة معتمدة. تعديلها ممكن يضيف أو يحذف شيتات؛ اللي اعتمدته يظل محفوظ، وصانع الشيت يوضح وش يتأثر.${backToSheets}` : undefined}
          />
        </StepCard>
      )}

      {/* 2. Design questions */}
      {questions && (
        <StepCard
          title="أسئلة التصميم"
          v={questions}
          current={false}
          busy={busy || writing}
          hideBody={questions.status === "awaiting_approval"}
          onSend={questions.status === "approved" ? revise(questions) : undefined}
          warning="غيّرت إجابة؟ اكتبها هنا. الستايل والشيتات اللي بعدها ما تتغيّر تلقائيًا، وصانع الشيت يوضح وش يتأثر."
        >
          {questions.status === "awaiting_approval" ? (
            <QuestionsForm key={questions.id} questions={questions.data.questions ?? []} busy={busy || writing} onSubmit={(answers) => send({ action: "answers", versionId: questions.id, answers })} />
          ) : (
            <p className="text-sm font-bold text-muted">تمت الإجابة.</p>
          )}
        </StepCard>
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
          actions={
            <ActionBar
              busy={busy || writing}
              onSend={revise(styleTest)}
              warning={style ? "الستايل معتمد ومستخدم في كل البرومبتات بعده. تغييره يعني إعادة الماستر والشيتات وصورها (تكلفة صور جديدة)." : undefined}
            />
          }
        />
      )}

      {/* 4. Master and every sheet — with one-click buttons for all of them together */}
      {(waitingPrompts.length > 1 || readyImages.length > 1 || (masterApproved && noPrompt.length > 0 && !writing)) && (
        <section className="card space-y-2 border-2 border-gold p-4 shadow-lg">
          <p className="text-sm font-extrabold">⚡ اصنعهم كلهم مع بعض</p>
          {waitingPrompts.length > 1 && (
            <button className="btn btn-primary w-full" disabled={busy || writing} onClick={() => send({ action: "approve_all_prompts" })}>
              {busy ? "نرسل…" : `✅ اعتمد كل البرومبتات (${waitingPrompts.length}) وولّد صورها مرة وحدة · تقريبًا $${(waitingPrompts.length * 0.4).toFixed(2)}`}
            </button>
          )}
          {readyImages.length > 1 && (
            <button className="btn btn-secondary w-full" disabled={busy} onClick={() => send({ action: "approve_all_images" })}>
              ✅ اعتمد كل الصور الجديدة ({readyImages.length})
            </button>
          )}
          {masterApproved && noPrompt.length > 0 && !writing && !waitingPrompts.length && (
            <button className="btn btn-ghost w-full" disabled={busy} onClick={() => send({ action: "write_all" })}>
              ✍️ اكتب برومبتات الباقي ({noPrompt.length}) دفعة وحدة
            </button>
          )}
          <p className="text-xs font-bold text-muted">تبي تعدّل وحدة بس؟ عدّلها في بطاقتها تحت، وبعدين اضغط الزر هنا للباقي.</p>
        </section>
      )}
      {orderedSheets.map((sid) => {
        const v = latestOf("sheet_prompt", sid)!;
        const item = map.find((m) => m.id === sid);
        const imgs = assets.filter((a) => a.kind === "image" && a.ref_key === sid);
        return (
          <StepCard
            key={sid}
            title={`${sid} · ${sid === MASTER ? "الماستر" : (item?.name ?? "")}`}
            v={v}
            current={current?.id === v.id}
            busy={busy || writing}
            onApprove={v.status === "awaiting_approval" ? () => send({ action: "approve", versionId: v.id }) : undefined}
            approveLabel={`اعتمد وولّد الصورة ✅ · ${SHEET_COST}`}
            onSend={revise(v)}
            warning={v.status === "approved" ? `هذا البرومبت معتمد. بعد التعديل يوصلك برومبت جديد، ولما تعتمده تتولد صورة جديدة (${SHEET_COST}).${affects(sid)}` : undefined}
          >
            {sid === MASTER && v.status === "awaiting_approval" && (
              <p className="rounded-2xl bg-surface-2 p-3 text-sm font-bold">💡 هذا «الماستر»: شكل الرسم لكل الفيلم. اعتمده أول، وبعد ما تعتمد صورته نكتب كل الشيتات الباقية مع بعض.</p>
            )}
            {(v.status === "approved" || imgs.some((i) => i.status !== "rejected")) && (
              <SheetImages
                sheetId={sid}
                images={imgs}
                canGenerate={v.status === "approved"}
                busy={busy}
                onGenerate={() => send({ action: "generate_image", sheetId: sid })}
                onApprove={(id) => send({ action: "approve_image", assetId: id })}
                onReject={(id) => send({ action: "reject_image", assetId: id })}
                onUnapprove={(id) => send({ action: "unapprove_image", assetId: id })}
                unapproveWarning={`تبي تتراجع عن اعتماد هذي الصورة؟ بعدها تقدر تولّد صورة ثانية أو ترسل تعديل.${affects(sid)}${backToSheets}`}
              />
            )}
          </StepCard>
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
            <p className="font-extrabold">{masterApproved && noPrompt.length > 1 ? `صانع الشيت يكتب ${noPrompt.length} شيتات مع بعض…` : "صانع الشيت يكتب…"}</p>
            <p className="text-sm font-bold text-muted">من دقيقة إلى ٣ دقائق. لا تضغط شي، الصفحة بتتحدّث لحالها ⏳ وتقدر تسكّرها وترجع.</p>
          </div>
        </div>
      )}
      {failed && (
        <div className="card space-y-3 p-5">
          <p className="error-box">ما كمل الرد: {job?.error}. ما انحسبت عليك تكلفة.</p>
          <button className="btn btn-primary w-full" disabled={busy} onClick={() => send({ action: "retry" })}>أعد المحاولة</button>
        </div>
      )}
      {allApproved && !writing && !failed && (
        <div className="card space-y-2 p-5 text-center">
          <p className="text-lg font-extrabold">✅ كل الصور معتمدة</p>
          <p className="text-sm font-bold text-muted">نجهّز التسليم وننقلك للمخرج تلقائيًا. لو ما انتقلت، اضغط هنا (ما ينحسب من تعديلاتك).</p>
          <button className="btn btn-primary w-full" disabled={busy} onClick={() => send({ action: "finish" })}>🎥 جهّز التسليم وانتقل للمخرج</button>
        </div>
      )}
      {stage === "director" || stage === "voices" || stage === "done" ? (
        <div className="card space-y-1 p-5 text-center">
          <p className="text-lg font-extrabold">✅ الشيتات كلها معتمدة وانتقلت للمخرج السينمائي</p>
          <Link href={`${filmBase}/${projectId}/director`} className="btn btn-primary w-full">🎥 افتح المخرج</Link>
        </div>
      ) : null}
      {notice && <p className="rounded-2xl border border-gold bg-surface-2 p-3 text-sm font-bold">⚠️ {notice}</p>}
      {error && <p className="error-box">{error}</p>}
    </div>
    </EditsLeftContext>
  );
}

/** Per map item: generate it, or use the user's own picture (as is / as a reference for a new sheet). */
function MapChoices({
  projectId, map, locked, savedChoices, assets, busy, onRefresh, onRemove, onApprove, onSend, warning,
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
  onSend: (mode: SendMode, text: string) => void;
  warning?: string;
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
      const mode = choices[sheetId] ?? "make";
      // Up to 4 photos to convert a real person; one picture otherwise
      const room = mode === "convert" ? MAX_REFERENCE_UPLOADS - uploadsOf(sheetId).length : 1;
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
      {!locked && <p className="text-sm font-bold text-muted">💡 هذي الشخصيات والأماكن اللي بنرسمها. ما عندك صورة؟ خلّها على «اصنعه لي» واضغط «اعتمد» تحت.</p>}
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={(e) => upload(Array.from(e.target.files ?? []))} />
      {map.map((m) => {
        const c = (locked ? savedChoices[m.id] : choices[m.id]) ?? "make";
        const ups = uploadsOf(m.id);
        const shown = c === "convert" ? ups : ups.slice(-1);
        return (
          <div key={m.id} className="space-y-2 rounded-2xl border border-line p-3">
            <p className="font-extrabold">{m.id} · {m.name}</p>
            <p className="text-sm font-bold text-muted">{m.coverage}</p>
            {m.id === "STY-00" ? (
              <p className="text-xs font-bold text-muted">الماستر يتصنع دائمًا؛ هو مرجع الستايل لكل الفيلم.</p>
            ) : locked ? (
              <span className="chip">{c === "make" ? "🎨 نصنعه" : c === "as_is" ? "📤 صورتك كما هي" : c === "reference" ? "🖼️ شيت من صورتك" : "🔄 نحوّل الشخصية الواقعية إلى كرتون"}</span>
            ) : (
              <div className="flex flex-wrap gap-2 text-sm font-bold">
                {([["make", "🎨 اصنعه لي"], ["as_is", "📤 عندي جاهز (كما هو)"], ["reference", "🖼️ عندي صورة، اصنع منها شيت"], ["convert", "🔄 حوّل شخصية واقعية إلى كرتون (حتى ٤ صور)"]] as const).map(([k, label]) => (
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
                    {!locked && c === "convert" && (
                      <button aria-label="احذف الصورة" className="absolute -end-1 -top-1 size-6 rounded-full bg-red-500 text-xs font-extrabold text-white" onClick={() => onRemove(u.id)}>×</button>
                    )}
                  </div>
                ))}
                {!locked && (c !== "convert" || ups.length < MAX_REFERENCE_UPLOADS) && (
                  <button className="btn btn-ghost min-h-10 px-3 text-sm" disabled={Boolean(uploading)} onClick={() => { fileFor.current = m.id; input.current?.click(); }}>
                    {uploading === m.id ? "نرفع…" : c === "convert" ? `أضف صور (${ups.length}/${MAX_REFERENCE_UPLOADS})` : ups.length ? "غيّر الصورة" : "ارفع الصورة"}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
      {error && <p className="error-box">{error}</p>}
      {!locked && !busy && missing.length > 0 && <p className="text-sm font-bold text-red-500">ارفع صورة: {missing.map((m) => m.name).join("، ")}</p>}
      <ActionBar
        busy={busy}
        onApprove={!locked && missing.length === 0 ? () => onApprove(choices) : undefined}
        approveLabel="اعتمد الفهم والخريطة ✅"
        onSend={onSend}
        warning={warning}
      />
    </div>
  );
}

function StyleTest({
  v, styles, tests, chosen, busy, onTest, onChoose, actions,
}: {
  v: SheetVersion;
  styles: StyleCard[];
  tests: Asset[];
  chosen: string | null;
  busy: boolean;
  onTest: (ids: string[]) => void;
  onChoose: (id: string) => void;
  actions?: ReactNode;
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
          <p className="text-sm font-bold text-muted">💡 اختر ٢ أو ٣ أشكال رسم، نجرّبها على لقطة من قصتك، وبعدين تختار اللي يعجبك.</p>
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
      {actions}
    </article>
  );
}

function SheetImages({
  sheetId, images, canGenerate, busy, onGenerate, onApprove, onReject, onUnapprove, unapproveWarning,
}: {
  sheetId: string;
  images: Asset[];
  /** Only with an approved prompt (a new prompt waiting for approval still shows the pictures made before). */
  canGenerate: boolean;
  busy: boolean;
  onGenerate: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onUnapprove: (id: string) => void;
  unapproveWarning: string;
}) {
  const shown = images.filter((i) => i.status !== "rejected");
  const generating = images.some((i) => i.status === "generating");
  const approved = images.some((i) => i.status === "approved");
  return (
    <div className="space-y-3">
      {shown.some((i) => i.status === "generated") && <p className="text-sm font-bold text-muted">💡 عجبتك الصورة؟ اعتمدها. ما عجبتك؟ ولّد نسخة ثانية أو اكتب تعديل.</p>}
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
            {img.status === "approved" && !busy && (
              <button className="btn btn-ghost min-h-10 px-4 text-sm" onClick={() => window.confirm(unapproveWarning) && onUnapprove(img.id)}>↩️ تراجع عن الاعتماد</button>
            )}
          </div>
        </figure>
      ))}
      {canGenerate && !generating && !busy && (
        <button className={`btn w-full ${approved ? "btn-ghost" : "btn-secondary"}`} onClick={onGenerate}>
          {shown.length ? "🔁 ولّد نسخة ثانية" : "🖼️ ولّد الصورة"} · {SHEET_COST}
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
