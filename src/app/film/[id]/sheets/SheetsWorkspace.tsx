"use client";

import GptImagePicker from "@/components/jawad/GptImagePicker";
import { credits, creditsRange } from "@/lib/film/credits";
import Coined from "@/components/Coined";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode, useCallback, useTransition } from "react";
import { api, postJson } from "@/lib/fetch";
import { useClaudeModel } from "@/components/robots/claude-model";
import ReplyView from "../../ReplyView";
import Spinner from "@/components/Spinner";
import QuestionsForm from "../../QuestionsForm";
import ActionBar, { EditsLeftContext, type SendMode } from "../../ActionBar";
import StepCard from "../../StepCard";
import type { MapChoice, MapItem, SheetVersion } from "@/lib/film/sheets";
import SheetCards, { OwnUpload } from "./SheetCards";
import ConvertCards from "./ConvertCards";
import { styleTestCandidate, styleTestPictures, styleTestRef, testRefOn } from "@/lib/film/style-test-ref";
import { LESSON_MAP_QUESTION } from "@config/film-lesson";
import { AD_MAP_QUESTION, adBrandRole, type AdBrandRole } from "@config/film-ad";
import StyleBrowser, { StyleThumb, type StyleCardView } from "@/components/style-map/StyleBrowser";

const MAX_REFERENCE_UPLOADS = 4; // same as lib/film/sheets.ts (that file is server-only)
const SHEET_COST = `تقريبًا ${credits(0.4, "image")}`;
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
  version_id: string | null;
}
/** a style of the library («خريطة الستايلات»), with its picture or null (its family's tile) */
type StyleCard = StyleCardView;
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
  /** a series' scene: its series' ready characters, places and style */
  seriesCast?: SeriesCast[];
  /** «🎓 درس لطلابك»: the style is fixed (no style test), and the map asks about the teacher's own characters first */
  lesson?: boolean;
  /** «📣 إعلان»: the brand's pictures (the project's «مراجع»), put on the map's logo and product items as they are */
  brand?: BrandRef[];
}

type BrandRef = { id: string; role: AdBrandRole; name: string; url: string };

/** The brand picture standing for a map item of an ad: LOG-01 the first logo, PRD-02 the second product… */
function brandFor(m: MapItem, brand: BrandRef[]) {
  const hit = /^(LOG|PRD)-(\d{2})$/.exec(m.id);
  if (!hit) return null;
  return brand.filter((b) => b.role === (hit[1] === "LOG" ? "logo" : "product"))[Number(hit[2]) - 1] ?? null;
}

type SeriesCast = { id: string; kind: "style" | "character" | "place"; name: string; url: string };

/** The series' picture standing for a map item: the style for the master, else the same name (or one containing the other). */
function castFor(m: MapItem, cast: SeriesCast[]) {
  if (m.id === MASTER) return cast.find((c) => c.kind === "style") ?? null;
  const kind = m.kind === "character" ? "character" : "place";
  const n = (s: string) => s.replace(/[\s«»"'()]/g, "");
  const same = cast.filter((c) => c.kind === kind);
  return same.find((c) => n(c.name) === n(m.name)) ?? same.find((c) => n(m.name).includes(n(c.name)) || n(c.name).includes(n(m.name))) ?? null;
}

const MASTER = "STY-00";
const TEST = "STYLE-TEST";

export default function SheetsWorkspace({ projectId, stage, versions, assets, job, imagesRunning, styles, editsLeft, seriesCast = [], lesson = false, brand = [] }: Props) {
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
      if (document.hidden) return;
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

  const [claude] = useClaudeModel();

  async function send(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { jobId, images, warning } = await postJson<{ jobId: string | null; images?: number; warning?: string }>(`/api/film/projects/${projectId}/sheets`, { ...body, model: claude.id });
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
  // «📎 أرفق صورة الاختبار» on every sheet card: the test picture a drawing can be sent with
  const testCandidate = styleTestCandidate(style, assets.filter((a) => a.ref_key === TEST), (a) => Boolean(a.url));
  const mapVersion = versions.filter((v) => v.kind === "sheet_understanding" && v.status === "approved").at(-1) ?? understanding;
  const map = mapVersion?.data.sheet_map ?? [];
  const choices = mapVersion?.status === "approved" ? (mapVersion.data.choices ?? {}) : {};
  const promptIds = [...new Set(versions.filter((v) => v.kind === "sheet_prompt").map((v) => v.ref_key))];
  // a card per sheet described so far — and per item standing on the person's own picture («صورتك كما هي»), so that
  // choice can be changed from its card at any time
  const orderedSheets = [...map.map((m) => m.id).filter((id) => promptIds.includes(id) || (id !== MASTER && choices[id] === "as_is")), ...promptIds.filter((id) => !map.some((m) => m.id === id))];
  const library = assets.filter((a) => a.status === "approved" && a.ref_key !== TEST && typeof a.meta.at_name === "string");
  const current = [...versions].filter((v) => v.kind !== "sheet_handoff" && v.kind !== "style").sort((a, b) => a.created_at.localeCompare(b.created_at)).at(-1);
  const failed = job?.status === "failed" && !writing;
  const started = versions.length > 0 || writing || failed;
  const masterApproved = assets.some((a) => a.kind === "image" && a.ref_key === MASTER && a.status === "approved");
  const approvedIds = new Set(assets.filter((a) => a.status === "approved").map((a) => a.ref_key));
  // «كل الشيتات مع بعض»: prompts waiting, new pictures waiting, and sheets still without a prompt
  const waitingPrompts = orderedSheets.filter((sid) => sid !== MASTER && choices[sid] !== "as_is" && latestOf("sheet_prompt", sid)?.status === "awaiting_approval");
  const readyImages = map.filter((m) => m.id !== MASTER && !approvedIds.has(m.id) && assets.some((a) => a.kind === "image" && a.ref_key === m.id && a.status === "generated"));
  // a real person to convert gets his sheet from his chosen single images («🔄» cards), not from the batch
  const noPrompt = mapVersion?.status === "approved" ? map.filter((m) => m.id !== MASTER && choices[m.id] !== "as_is" && choices[m.id] !== "convert" && !promptIds.includes(m.id)) : [];
  const toConvert = mapVersion?.status === "approved" ? map.filter((m) => choices[m.id] === "convert") : [];
  const allApproved = stage === "sheets" && map.length > 0 && mapVersion?.status === "approved" && map.every((m) => approvedIds.has(m.id));

  // «الصور مباشرة»: a sheet's description that arrives is drawn straight away, five pictures at a time (and always
  // after the person's own edit of that sheet), so the person sees pictures, not texts
  const [autoMake, setAutoMake] = useState(true);
  const autoAfterEdit = useRef(new Set<string>());
  const autoSent = useRef(new Set<string>());
  useEffect(() => {
    if (busy || writing) return;
    const drawing = assets.filter((a) => a.kind === "image" && a.status === "generating").length;
    if (drawing >= 5) return;
    const next = orderedSheets
      .map((sid) => latestOf("sheet_prompt", sid))
      // (never for an item the person now keeps as their own picture: nothing is drawn for it)
      .find((v) => v && v.status === "awaiting_approval" && choices[v.ref_key] !== "as_is" && !autoSent.current.has(v.id) && (autoMake || autoAfterEdit.current.has(v.ref_key)));
    if (!next) return;
    autoSent.current.add(next.id);
    autoAfterEdit.current.delete(next.ref_key);
    setTimeout(() => void send({ action: "approve", versionId: next.id, count: 1 }), 0);
  });

  // Arrived from the screenwriter (…/sheets?start=1): the sheet maker starts by itself, no second press
  const autoStarted = useRef(false);
  useEffect(() => {
    if (autoStarted.current || started || new URLSearchParams(window.location.search).get("start") !== "1") return;
    autoStarted.current = true;
    window.history.replaceState(null, "", window.location.pathname);
    // not cleared on the next render: a render in that moment cancelled it for good (the ref is already set)
    setTimeout(() => send({ action: "start" }), 0);
  });
  // Every picture approved: the handoff to the director is prepared by itself (once)
  // (only when the last approval happens on this page: arriving with everything already approved, e.g. after going
  // back to edit a sheet, must not send the project on by itself)
  const autoFinished = useRef(false);
  const sawOpen = useRef(false);
  useEffect(() => {
    if (!allApproved) sawOpen.current = true;
    if (autoFinished.current || !sawOpen.current || !allApproved || writing || failed || busy) return;
    autoFinished.current = true;
    setTimeout(() => send({ action: "finish" }), 0);
  });
  // «وش باقي عشان تنتقل للمخرج؟»: every map item still without an approved picture, with the way out of each
  const mapApproved = mapVersion?.status === "approved";
  const blockers = stage === "sheets" && mapApproved && approvedIds.has(MASTER) ? map.filter((m) => m.id !== MASTER && !approvedIds.has(m.id)) : [];
  const mapEditWaiting = understanding?.status === "awaiting_approval" && versions.some((v) => v.kind === "sheet_understanding" && v.status === "approved");
  const revise = (v: SheetVersion) => (mode: SendMode, text: string) => send({ action: "revise", text, versionId: v.id, mode });
  // «اعتمد المحدد»: new pictures ticked on their cards
  const [selected, setSelected] = useState<string[]>([]);
  const toggleSelect = (assetId: string) => setSelected((s) => (s.includes(assetId) ? s.filter((x) => x !== assetId) : [...s, assetId]));
  const backToSheets = stage === "director" ? " والمشروع انتقل للمخرج، فبيرجع لصانع الشيت لين تعتمد صورة جديدة." : "";
  return (
    <EditsLeftContext value={editsLeft}>
    <div className="space-y-4">
      {/* «نسخة GPT Image»: the style tests, the master and every sheet are painted by the version picked here */}
      <section className="card p-4">
        <GptImagePicker />
      </section>
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
          <p className="text-xs font-bold text-muted">كل رد <Coined text={creditsRange(0.05, 0.8, "claude")} /></p>
        </div>
      )}

      {/* 1. Understanding + sheet map with the user's choice per item */}
      {understanding && (
        <StepCard title="خريطة الشيتات" v={understanding} current={current?.id === understanding.id} busy={busy || writing} onSend={revise(understanding)} noActions hideBody>
          <MapChoices
            projectId={projectId}
            map={map}
            lesson={lesson}
            brand={brand}
            locked={understanding.status !== "awaiting_approval"}
            savedChoices={choices}
            assets={assets}
            seriesCast={seriesCast}
            busy={busy || writing}
            onRefresh={refresh}
            onRemove={(assetId) => send({ action: "remove_upload", assetId })}
            onApprove={(c) => send({ action: "approve", versionId: understanding.id, choices: c })}
            onSend={revise(understanding)}
            warning={understanding.status === "approved" ? `الخريطة معتمدة. تعديلها ممكن يضيف أو يحذف شيتات؛ اللي اعتمدته يظل محفوظ، وصانع الشيت يوضح وش يتأثر.${backToSheets}` : undefined}
          />
          {mapEditWaiting && (
            <button className="btn btn-ghost w-full text-sm" disabled={busy || writing} onClick={() => send({ action: "cancel_map_edit" })}>
              ↩️ غيّرت رأيي: ألغِ تعديل الخريطة وخلّ المعتمدة كما هي
            </button>
          )}
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
          style={style ?? null}
          onTestRef={(on, assetId) => send({ action: "set_test_ref", on, ...(assetId ? { assetId } : {}) })}
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

      {/* 3b. A real person: each real photo → its own single image in the style → the sheet from the chosen ones */}
      <ConvertCards items={toConvert} assets={assets} styleChosen={style?.status === "approved"} busy={busy} send={send} />

      {/* 4. Master and every sheet — with one-click buttons for all of them together */}
      {(waitingPrompts.length > 1 || readyImages.length > 1 || (masterApproved && noPrompt.length > 0 && !writing)) && (
        <section className="card space-y-2 border-2 border-gold p-4 shadow-lg">
          <p className="text-sm font-extrabold">⚡ اصنعهم كلهم مع بعض</p>
          {waitingPrompts.length > 1 && (
            <button className="btn btn-primary w-full" disabled={busy || writing} onClick={() => send({ action: "approve_all_prompts" })}>
              <Coined text={busy ? "نرسل…" : `✅ اعتمد كل البرومبتات (${waitingPrompts.length}) وولّد صورها مرة وحدة · تقريبًا ${credits(waitingPrompts.length * 0.4, "image")}`} />
            </button>
          )}
          {readyImages.length > 1 && (
            <div className="grid gap-2 sm:grid-cols-2">
              <button className="btn btn-secondary w-full" disabled={busy} onClick={() => send({ action: "approve_all_images" })}>
                ✅ اعتمد الكل ({readyImages.length})
              </button>
              <button className="btn btn-primary w-full" disabled={busy || !selected.length} onClick={() => { const ids = selected; setSelected([]); void send({ action: "approve_images", assetIds: ids }); }}>
                ☑️ اعتمد المحدد ({selected.length})
              </button>
            </div>
          )}
          {masterApproved && noPrompt.length > 0 && !writing && !waitingPrompts.length && (
            <button className="btn btn-ghost w-full" disabled={busy} onClick={() => send({ action: "write_all" })}>
              ✍️ اكتب برومبتات الباقي ({noPrompt.length}) دفعة وحدة
            </button>
          )}
          <p className="text-xs font-bold text-muted">تبي تعدّل وحدة بس؟ عدّلها في بطاقتها تحت، وبعدين اضغط الزر هنا للباقي.</p>
        </section>
      )}
      {orderedSheets.includes(MASTER) && !masterApproved && (
        <p className="rounded-2xl bg-surface-2 p-3 text-sm font-bold">💡 «الماستر»: لوحة الستايل والألوان وطريقة الرسم لكل الفيلم (بدون شخصيات ولا أماكن). ينرسم ويُعتمد لحاله، وبعدها تنكتب كل الشيتات وتنرسم مع بعض — أنت بس تعتمد صورها: الكل، أو المحدد، أو وحدة وحدة.</p>
      )}
      {orderedSheets.length > 0 && (
        <label className="flex items-center gap-2 text-sm font-bold">
          <input type="checkbox" className="size-5" checked={autoMake} onChange={(e) => setAutoMake(e.target.checked)} /> ولّد الصور أول ما توصل أوصافها (٥ في نفس الوقت) · كل صورة <Coined text={SHEET_COST} />
        </label>
      )}
      <SheetCards
        // the cards' «📎» start again from the film's setting when it changes
        key={testRefOn(style) ? "test-on" : "test-off"}
        projectId={projectId}
        test={testCandidate ? { id: testCandidate.id, url: testCandidate.url } : null}
        testOn={testRefOn(style)}
        items={orderedSheets.map((sid) => ({ id: sid, title: `${sid} · ${sid === MASTER ? "الماستر" : (map.find((m) => m.id === sid)?.name ?? "")}` }))}
        versions={versions}
        assets={assets}
        busy={busy || writing}
        send={send}
        onEdit={(sid) => autoAfterEdit.current.add(sid)}
        selected={selected}
        onSelect={toggleSelect}
        choices={choices}
        ownable={mapApproved}
      />

      {/* «وش باقي؟»: what still stands between the person and the director, each with its way out */}
      {blockers.length > 0 && !writing && !painting && (
        <section className="card space-y-2 border-2 border-gold p-4">
          <p className="font-extrabold">🧭 باقي {blockers.length === 1 ? "عنصر واحد" : `${blockers.length} عناصر`} عشان تنتقل للمخرج</p>
          <p className="text-xs font-bold text-muted">كل عنصر يحتاج صورة معتمدة وحدة: شيت يعجبك، أو صورتك أنت كما هي. اختر اللي يناسبك:</p>
          {blockers.map((m) => {
            const pics = assets.filter((a) => a.kind === "image" && a.ref_key === m.id);
            const fresh = pics.filter((a) => a.status === "generated" && a.url).at(-1);
            const drawing = pics.some((a) => a.status === "generating");
            const mine = assets.filter((a) => a.kind === "upload" && a.ref_key === m.id && a.status !== "rejected" && a.url).at(-1);
            const described = promptIds.includes(m.id);
            return (
              <div key={m.id} className="space-y-2 rounded-2xl border border-line p-3">
                <p className="text-sm font-extrabold">{m.id} · {m.name} <span className="font-bold text-muted">— {drawing ? "شيتها ينرسم الحين…" : fresh ? "شيتها جاهز وينتظر اعتمادك" : choices[m.id] === "convert" ? "تتحول من صورها الواقعية (فوق)" : described ? "ما لها صورة معتمدة" : "شيتها ما انكتب وصفه بعد"}</span></p>
                <div className="flex flex-wrap items-center gap-2">
                  {fresh && <button className="btn btn-primary min-h-9 flex-1 px-2 text-xs" disabled={busy} onClick={() => send({ action: "approve_image", assetId: fresh.id })}>✅ اعتمد آخر شيت</button>}
                  {mine && <button className="btn btn-secondary min-h-9 flex-1 px-2 text-xs" disabled={busy} onClick={() => send({ action: "use_own_picture", sheetId: m.id, assetId: mine.id })}>📤 استخدم صورتي كما هي</button>}
                  <OwnUpload projectId={projectId} sheetId={m.id} busy={busy} send={send} label={mine ? "ارفع غيرها" : "📤 ارفع صورة جاهزة"} />
                </div>
              </div>
            );
          })}
        </section>
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
      {allApproved && !writing && (
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
  projectId, map, lesson, brand = [], locked, savedChoices, assets, seriesCast, busy, onRefresh, onRemove, onApprove, onSend, warning,
}: {
  projectId: string;
  /** «📣 إعلان»: the brand's pictures, taken as they are (the logo and the products by themselves, any other by a tap) */
  brand?: BrandRef[];
  /** «🎓 درس لطلابك»: asked first whether the teacher has characters of his own to use or turn into the style */
  lesson?: boolean;
  map: MapItem[];
  seriesCast: SeriesCast[];
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

  // a series' scene: take the series' own picture for an item, as it is
  async function takeFromSeries(items: { sheetId: string; castId: string }[]) {
    setError("");
    try {
      for (const it of items) {
        setUploading(it.sheetId);
        await postJson(`/api/film/projects/${projectId}/sheets`, { action: "use_series_cast", sheetId: it.sheetId, castId: it.castId });
      }
      setChoices((c) => ({ ...c, ...Object.fromEntries(items.map((it) => [it.sheetId, "as_is" as MapChoice])) }));
      onRefresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading("");
    }
  }
  // the series' characters, places and style already made are taken by themselves the first time the map shows
  const auto = useRef(false);
  useEffect(() => {
    if (locked || auto.current || !seriesCast.length) return;
    auto.current = true;
    const items = map.flatMap((m) => {
      const c = castFor(m, seriesCast);
      return c && !savedChoices[m.id] && !assets.some((a) => a.kind === "upload" && a.ref_key === m.id && a.status !== "rejected") ? [{ sheetId: m.id, castId: c.id }] : [];
    });
    if (items.length) {
      setTimeout(() => void takeFromSeries(items), 0);
    }
  });

  // an ad: one of the brand's pictures as an item's picture, as it is (goes to every generation as a reference)
  async function takeFromBrand(items: { sheetId: string; assetId: string }[]) {
    setError("");
    try {
      for (const it of items) {
        setUploading(it.sheetId);
        await postJson(`/api/film/projects/${projectId}/sheets`, { action: "use_brand", sheetId: it.sheetId, assetId: it.assetId });
      }
      setChoices((c) => ({ ...c, ...Object.fromEntries(items.map((it) => [it.sheetId, "as_is" as MapChoice])) }));
      onRefresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading("");
    }
  }
  // the logo and the products are put on their items by themselves the first time each item shows (also on a new
  // version of the map that adds them — once per item, so the person's own change afterwards is kept)
  const autoBrand = useRef(new Set<string>());
  useEffect(() => {
    if (locked || !brand.length) return;
    const items = map.flatMap((m) => {
      const b = brandFor(m, brand);
      if (!b || autoBrand.current.has(m.id)) return [];
      autoBrand.current.add(m.id);
      return !savedChoices[m.id] && !assets.some((a) => a.kind === "upload" && a.ref_key === m.id && a.status !== "rejected") ? [{ sheetId: m.id, assetId: b.id }] : [];
    });
    if (items.length) setTimeout(() => void takeFromBrand(items), 0);
  });

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
        const put = await fetch(token, { method: "PUT", headers: { "content-type": file.type }, body: file }).catch(() => null);
        if (!put?.ok) throw new Error("تعذّر رفع الصورة.");
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
      {!locked && brand.length > 0 && <p className="rounded-xl border-2 border-[var(--film-hl)] bg-[var(--film-soft)] p-3 text-sm font-black leading-7">🏷️ {AD_MAP_QUESTION}</p>}
      {!locked && lesson && <p className="rounded-xl border-2 border-[var(--film-hl)] bg-[var(--film-soft)] p-3 text-sm font-black leading-7">❓ {LESSON_MAP_QUESTION}</p>}
      {!locked && !lesson && !brand.length && <p className="text-sm font-bold text-muted">💡 هذي الشخصيات والأماكن اللي بنرسمها. ما عندك صورة؟ خلّها على «اصنعه لي» واضغط «اعتمد» تحت.</p>}
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={(e) => upload(Array.from(e.target.files ?? []))} />
      {map.map((m) => {
        const c = (locked ? savedChoices[m.id] : choices[m.id]) ?? "make";
        const ups = uploadsOf(m.id);
        const shown = c === "convert" ? ups : ups.slice(-1);
        return (
          <div key={m.id} className="space-y-2 rounded-2xl border border-line p-3">
            <p className="font-extrabold">{m.id} · {m.name}</p>
            <p className="text-sm font-bold text-muted">{m.coverage}</p>
            {m.id === "STY-00" && !castFor(m, seriesCast) ? (
              <p className="text-xs font-bold text-muted">الماستر يتصنع دائمًا؛ هو مرجع الستايل لكل الفيلم.</p>
            ) : m.id === "STY-00" && !locked ? (
              <div className="flex flex-wrap gap-2 text-sm font-bold">
                <button className={`chip ${c === "as_is" ? "bg-gold text-on-gold" : ""}`} disabled={!!uploading} onClick={() => takeFromSeries([{ sheetId: m.id, castId: castFor(m, seriesCast)!.id }])}>📚 ستايل المسلسل (كما هو)</button>
                <button className={`chip ${c === "make" ? "bg-gold text-on-gold" : ""}`} onClick={() => setChoices({ ...choices, [m.id]: "make" })}>🎨 اصنع ماستر جديد</button>
              </div>
            ) : locked ? (
              <span className="chip">{c === "make" ? "🎨 نصنعه" : c === "as_is" ? "📤 صورتك كما هي" : c === "reference" ? "🖼️ شيت من صورتك" : "🔄 نحوّل الشخصية الواقعية إلى ستايل الفيلم"}</span>
            ) : (
              <div className="flex flex-wrap gap-2 text-sm font-bold">
                {([["make", "🎨 اصنعه لي"], ["as_is", "📤 عندي جاهز (كما هو)"], ["reference", "🖼️ عندي صورة، اصنع منها شيت"], ["convert", "🔄 حوّل شخصية واقعية إلى ستايل الفيلم (حتى ٤ صور، كل صورة تتحول لحالها)"]] as const).map(([k, label]) => (
                  <button key={k} className={`chip ${c === k ? "bg-gold text-on-gold" : ""}`} onClick={() => setChoices({ ...choices, [m.id]: k })}>{label}</button>
                ))}
                {brand.map((b) => (
                  <button key={b.id} className="chip border-2 border-[var(--film-blue)]" disabled={!!uploading} onClick={() => takeFromBrand([{ sheetId: m.id, assetId: b.id }])} title={b.name}>
                    {adBrandRole(b.role)?.icon} من براندك: {adBrandRole(b.role)?.ar}
                    {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
                    {b.url && <img src={b.url} alt="" className="ms-1 inline size-6 rounded object-cover" />}
                  </button>
                ))}
                {castFor(m, seriesCast) && (
                  <button className="chip border-2 border-[var(--film-blue)]" disabled={!!uploading} onClick={() => takeFromSeries([{ sheetId: m.id, castId: castFor(m, seriesCast)!.id }])}>
                    📚 من المسلسل: {castFor(m, seriesCast)!.name}
                  </button>
                )}
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
                {shown.some((u) => u.meta?.series_cast) && <span className="chip text-xs">📚 من شخصيات المسلسل</span>}
                {shown.some((u) => u.meta?.brand_asset) && <span className="chip text-xs">🏷️ من صور براندك</span>}
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
  v, styles, tests, chosen, style, onTestRef, busy, onTest, onChoose, actions,
}: {
  v: SheetVersion;
  styles: StyleCard[];
  tests: Asset[];
  chosen: string | null;
  /** the approved style's row: «صورة الاختبار مرجع» is kept on it */
  style: SheetVersion | null;
  onTestRef: (on: boolean, assetId?: string) => void;
  busy: boolean;
  onTest: (ids: string[]) => void;
  onChoose: (id: string) => void;
  actions?: ReactNode;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const nameOf = (id: string) => styles.find((s) => s.id === id)?.name ?? id;
  const toggle = (id: string) => setPicked(picked.includes(id) ? picked.filter((x) => x !== id) : picked.length < 4 ? [...picked, id] : picked);
  // «صورة الاختبار مرجع»: which test picture goes with the master and the sheets (on until switched off)
  const refPics = styleTestPictures(style, tests, (t) => Boolean(t.url));
  const used = styleTestRef(style, tests, (t) => Boolean(t.url));
  const refOn = testRefOn(style);

  return (
    <article className="card space-y-4 p-5">
      <h2 className="text-xl font-extrabold">اختبار الستايل</h2>
      <details>
        <summary className="cursor-pointer text-sm font-extrabold text-muted">اللقطة المختارة من قصتك وبرومبتها</summary>
        <ReplyView text={v.body} />
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
                  <figcaption className="flex items-center gap-2 text-sm font-extrabold">
                    {styles.find((s) => s.id === sid) && <span className="w-14 shrink-0 overflow-hidden rounded-md"><StyleThumb s={styles.find((s) => s.id === sid)!} /></span>}
                    {nameOf(sid)}
                  </figcaption>
                  {!chosen && t.status === "generated" && (
                    <button className="btn btn-primary min-h-10 w-full text-sm" disabled={busy} onClick={() => onChoose(sid)}>اعتمد هذا الستايل</button>
                  )}
                  {used?.id === t.id && <p className="text-center text-xs font-extrabold text-teal">📎 مرجع الستايل للماستر والشيتات</p>}
                  {refOn && refPics.length > 1 && used?.id !== t.id && refPics.some((p) => p.id === t.id) && (
                    <button className="btn btn-ghost min-h-9 w-full text-xs" disabled={busy} onClick={() => onTestRef(true, t.id)}>📎 خلّ هذي هي المرجع</button>
                  )}
                </figure>
              );
            })}
          </div>
        </div>
      )}

      {chosen ? (
        <div className="space-y-2">
          <p className="rounded-2xl bg-surface-2 p-3 font-extrabold">🔒 الستايل المعتمد: {nameOf(chosen)} — نصه ينكتب حرفيًا في كل برومبت.</p>
          {refPics.length > 0 && (
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line p-3">
              <input type="checkbox" className="mt-1 size-5 shrink-0" checked={refOn} disabled={busy} onChange={(e) => onTestRef(e.target.checked)} />
              <span className="space-y-1">
                <b className="block text-sm">🖼️ استخدم صورة الاختبار مرجع للستايل</b>
                <span className="block text-xs leading-6 text-muted">
                  تنرفق مع الماستر وكل شيت وتكون هي الحاكمة في الشكل: الألوان والأشكال والنسب والرسم والإضاءة، حتى لو البرومبت قال غير. وصف الشخصية نفسها (مين هو ووش لابس) يبقى من البرومبت، وتعديلاتك اللي تكتبها على الشيت فوق الكل. ما تنسخ شخصياتها ولا مكانها، ويمشي على الصور اللي تتولد من الحين.
                </span>
              </span>
            </label>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <h3 className="font-extrabold">اختر من ٢ إلى ٤ ستايلات للتجربة ({picked.length}/٤)</h3>
          <p className="text-sm font-bold text-muted">💡 خريطة {styles.length} ستايل في ١٤ عائلة، كل واحد تحت شركته أو مدرسته (دوّر بالاسم أو بالشركة). اختر ٢ أو ٣ أشكال رسم، نجرّبها على لقطة من قصتك، وبعدين تختار اللي يعجبك — وبعد الاعتماد ينرسم الماستر وكل الشيتات لحالهم.</p>
          <StyleBrowser skin="film" styles={styles} selected={picked} onPick={toggle} cols="grid-cols-2" />
          <button className="btn btn-primary sticky bottom-3 w-full" disabled={busy || picked.length === 0} onClick={() => { onTest(picked); setPicked([]); }}>
            ولّد صور الاختبار ({picked.length}) · تقريبًا <Coined text={credits(picked.length * 0.06, "image")} />
          </button>
        </div>
      )}
      {actions}
    </article>
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
