"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { postJson } from "@/lib/fetch";
import { prepareLinkFrames } from "../prepare-link";
import BrandPictures, { type BrandPick } from "../BrandPictures";
import { isYoutubeLink, storyLink, storyPdf, storyUpload } from "@/lib/film/story-link";
import { useClaudeModel } from "@/components/robots/claude-model";
import { FILM_KINDS, type FilmKind } from "@config/film";
import ProjectFields, { type FieldValues } from "../ProjectFields";
import { useFilmBase } from "../FilmBase";
import ResearchChoice from "../ResearchChoice";
import StepWhy from "../StepWhy";
import "../stage/stage.css";
import JourneyIntakeCard from "../JourneyIntakeCard";
import type { JourneyIntake } from "@/lib/film/intake";
import JourneyPicker from "../JourneyPicker";
import { DEFAULT_FILM_JOURNEY, FILM_JOURNEY_KEY, isFilmJourney, type FilmJourney } from "@config/film-journey";

/** The first screen of a scene: title + the user's own story. Saved as soon as it is created. */
export default function NewProject() {
  const router = useRouter();
  const filmBase = useFilmBase();
  const [values, setValues] = useState<FieldValues>({ title: "", story: "", fixedFacts: "", targetDurationSec: "" });
  // WHAT is being made: a short scene that stands on its own, a whole cinematic film, or a series (its own place)
  const [kind, setKind] = useState<FilmKind | "">("");
  const [research, setResearch] = useState<"yes" | "no" | "">("");
  // «🎓 درس لطلابك»: the shortest path — no research question (it is built on the teacher's own lesson), no story map
  const lesson = kind === "lesson";
  // «📣 إعلان»: as short as a lesson, with the brand's pictures from the start
  const ad = kind === "ad";
  const short = lesson || ad;
  const [brand, setBrand] = useState<BrandPick[]>([]);
  const chooseKind = (k: FilmKind) => {
    setKind(k);
    setIntake(null);
    // leaving a lesson's PDF: it is not a story the others read
    if (k !== "lesson" && storyPdf(values.story)) setValues((v) => ({ ...v, story: "" }));
    if (k === "lesson" || k === "ad") return setResearch("no");
    // leaving a lesson or an ad: the research question is the person's again
    if (kind === "lesson" || kind === "ad") setResearch("");
  };
  const [busy, setBusy] = useState(false);
  // the person's Claude model: «سجاد» prepares the journey with it, not always the default
  const [claude] = useClaudeModel();
  // «اختر رحلتك»: the mind that writes this film (the recommended one until the person picks; their last pick is remembered)
  const [journey, setJourney] = useState<FilmJourney>(DEFAULT_FILM_JOURNEY);
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const kept = localStorage.getItem(FILM_JOURNEY_KEY);
        if (isFilmJourney(kept)) setJourney(kept);
      } catch {
        /* private mode: the recommended journey stays */
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);
  const chooseJourney = (j: FilmJourney) => {
    setJourney(j);
    try {
      localStorage.setItem(FILM_JOURNEY_KEY, j);
    } catch {
      /* the choice lasts for this film */
    }
  };
  const [error, setError] = useState("");
  const [intake, setIntake] = useState<JourneyIntake | null>(null);
  const draftId = useRef(crypto.randomUUID());
  // «?map=1» (the link of «خريطة فيلم الدقيقة»): a short scene, written on the story map
  const [startOnMap, setStartOnMap] = useState(false);

  // Arrived from «وش تبي تصنع اليوم؟» with an idea: it is the story, and its first words the title (both editable)
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("map") === "1") {
      const t = setTimeout(() => {
        setKind((k) => k || "scene");
        setStartOnMap(true);
      }, 0);
      return () => clearTimeout(t);
    }
  }, []);

  useEffect(() => {
    const idea = new URLSearchParams(window.location.search).get("idea")?.trim();
    if (!idea) return;
    window.history.replaceState(null, "", window.location.pathname);
    const t = setTimeout(() => setValues((v) => (v.story || v.title ? v : { ...v, story: idea, title: idea.replace(/^فيلم\s*(عن|يحكي|يتكلم عن)?\s*/u, "").split(/[،,.؟!\n]/)[0].slice(0, 60).trim() || "فيلمي" })), 0);
    return () => clearTimeout(t);
  }, []);

  // «🔗 رابط يوتيوب»: what was prepared from the link (its frames as one picture), once per link — a re-check reuses it
  const linkPrep = useRef<{ url: string; sheetId: string | null } | null>(null);
  const [step, setStep] = useState("");

  /** The video of the link, downloaded and laid out as a sheet of frames for سجاد to look at (null: only its words). */
  async function prepareLink(url: string): Promise<string | null> {
    if (linkPrep.current?.url === url) return linkPrep.current.sheetId;
    const sheetId = await prepareLinkFrames(url, setStep);
    linkPrep.current = { url, sheetId };
    return sheetId;
  }

  async function understand(answers: Record<string, string> = {}) {
    setBusy(true);
    setError("");
    setStep("");
    try {
      const link = storyLink(values.story);
      if (link && !isYoutubeLink(link.url)) throw new Error("حط رابط فيديو يوتيوب صحيح. المتاح الحين روابط يوتيوب بس.");
      const upload = storyUpload(values.story);
      if (upload && !upload.video) throw new Error("ارفع الفيديو أول، وبعدها خل سجاد يفهمه.");
      const pdf = storyPdf(values.story);
      if (pdf && !pdf.pdf) throw new Error("ارفع ملف الدرس (PDF) أول، وبعدها خل سجاد يفهمه.");
      const sheetId = link ? await prepareLink(link.url) : null;
      if (link || upload) setStep("👂 سجاد يشوف الفيديو ويسمعه…");
      else if (pdf) setStep("📖 سجاد يقرا ملف الدرس…");
      if (ad && !link && !upload && brand.length) setStep("👀 سجاد يشوف صور براندك…");
      const result = await postJson<{ intake: JourneyIntake }>("/api/film/intake", { draftId: draftId.current, kind, title: values.title, story: values.story, fixedFacts: values.fixedFacts, targetDurationSec: values.targetDurationSec, answers, previous: intake, model: claude.id, journey, ...(link ? { youtube: { sheetId } } : {}), ...(ad ? { brand: brandBody() } : {}) });
      setIntake(result.intake);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setStep("");
    }
  }

  /** The brand's pictures as sent: the person's uploads and what each one is. */
  const brandBody = () => brand.map((b) => ({ fileId: b.fileId, role: b.role, name: b.name }));
  /** The reference ad's frames (the link's laid-out frames, or those of the uploaded video): kept for the director. */
  const referenceSheet = () => {
    const link = storyLink(values.story);
    if (link) return linkPrep.current?.url === link.url ? linkPrep.current.sheetId : null;
    return storyUpload(values.story)?.video?.sheetId ?? null;
  };

  async function create() {
    if (!intake) return void understand();
    setBusy(true);
    setError("");
    try {
      // a lesson's or an ad's title may be left to سجاد
      const { id } = await postJson<{ id: string }>("/api/film/projects", { ...values, title: intake.title || values.title || (lesson ? "درسي" : ad ? "إعلاني" : ""), story: intake.concept || values.story, targetDurationSec: intake.targetDurationSec ?? values.targetDurationSec, fixedFacts: intake.fixedFacts.join("\n") || values.fixedFacts, research, kind, intake, workflowVersion: 2, journey, ...(ad ? { brand: brandBody(), adReferenceSheetId: referenceSheet() } : {}) });
      // straight to the screenwriter, who starts by himself; «نعم»: سجاد opens there too and asks for the research's scope
      router.push(`${filmBase}/${id}/script?start=1${research === "yes" ? "&research=1" : ""}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="fs">
      <div className="fs-room" aria-hidden><div className="beam" /><div className="dust" /><div className="grain" /></div>
      <div className="mx-auto max-w-2xl space-y-5 px-3 pb-20">
        <header className="fs-hero">
          <p className="fs-kicker">{kind === "film" ? "فيلم جديد" : "عمل جديد"}</p>
          <h1>ابدأ من فكرتك</h1>
          <p>اكتبها بكلماتك ولو بأسطر قليلة. السيناريست بيبدأ منها، وما يغيّر قصتك بدون ما يسألك.</p>
        </header>
        <StepWhy step="new" sajjad={false} />

        {/* FIRST: what is being made — a scene, a film, or a series (which has its own place) */}
        {!intake && <section className="card space-y-2 p-3">
          <b className="block text-base">وش تبي تصنع؟</b>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {FILM_KINDS.map((k) =>
              k.id === "series" ? (
                <Link key={k.id} href={`${filmBase}/series`} className="kind-card">
                  <span className="kind-icon" aria-hidden>{k.icon}</span>
                  <b>{k.ar}</b>
                  <small>{k.hint}</small>
                </Link>
              ) : (
                <button key={k.id} type="button" className={`kind-card${kind === k.id ? " on" : ""}`} aria-pressed={kind === k.id} onClick={() => chooseKind(k.id)}>
                  <span className="kind-icon" aria-hidden>{k.icon}</span>
                  <b>{k.ar}</b>
                  <small>{k.hint}</small>
                </button>
              ),
            )}
          </div>
          {kind === "film" && <p className="text-xs leading-6 text-muted">الفيلم يُكتب كعمل كامل: بداية وتحوّل ونهاية، ومشاهد مرقّمة لكل واحد مكانه وهدفه — وكل مشهد تصنعه بعدها بنفس الأدوات (صور، فيديو، أصوات، موسيقى).</p>}
          {kind === "scene" && <p className="text-xs leading-6 text-muted">المشهد القصير يقف بنفسه: مكان واحد ولحظة واحدة — أسرع وأرخص، وما يفتح أحداثًا تحتاج مشاهد ثانية.</p>}
          {lesson && <p className="text-xs leading-6 text-muted">الدرس أقصر وأسهل مسار: سجاد يفهم درسك ويأكد معك، والسيناريست يكتب نص الدرس على طول، والشخصيات والأماكن تنصنع بستايل «الانحراف الأسلوبي» (بيكسار حديث) وتعتمدها، والتعليق الصوتي بـ ElevenLabs. الشكل: قصة قصيرة، أو مجسم ثلاثي الأبعاد، أو هايبرموشن لأدق التفاصيل.</p>}
          {ad && <p className="text-xs leading-6 text-muted">الإعلان مسار قصير: ارفع صور براندك (الشعار، المنتج، الألوان)، واكتب فكرتك أو حط إعلان تحبه (رابط يوتيوب أو فيديو) وسجاد ينقل أسلوبه وإيقاعه وكاميرته على براندك. سجاد يأكد فهمه، والسيناريست يكتب على طول، والمخرج يمشي على أسلوب الإعلان المرجعي. طلبك (المدة، المولّد، عدد الشخصيات) يمشي كما هو.</p>}
        </section>}

        {!intake && ad && <BrandPictures value={brand} onChange={(next) => { setBrand(next); setIntake(null); }} disabled={busy} />}
        {!intake && <ProjectFields key={`${lesson ? "lesson" : ad ? "ad" : "story"}-${startOnMap ? "map" : "free"}`} startOnMap={startOnMap} withLink kind={kind} values={values} onChange={(next) => { setValues(next); setIntake(null); }} />}
        {/* a lesson or an ad asks no research question (it is built on the person's own lesson / brand) */}
        {!short && <ResearchChoice value={research} onChange={setResearch} />}
        {/* which mind writes the film: before سجاد reads the idea, because his reading is the journey's first reply */}
        {!intake && kind && (
          <section className="card space-y-2 p-3">
            <b className="block text-base">اختر رحلتك</b>
            <p className="text-xs leading-6 text-muted">أي عقل يكتب نصوص فيلمك (السيناريو، أوصاف الشيتات، برومبتات الفيديو). تقدر تغيّرها بعدين من صفحة المشروع.</p>
            <JourneyPicker value={journey} onChange={chooseJourney} disabled={busy} />
          </section>
        )}
        {error && <p className="error-box">{error}</p>}
        {intake ? (
          <JourneyIntakeCard intake={intake} busy={busy} onRecheck={(answers) => void understand(answers)} onConfirm={() => void create()} onEdit={() => setIntake(null)} />
        ) : (
          <>
            {!kind && <p className="text-center text-sm font-bold text-muted">اختر أول: مشهد قصير، فيلم سينمائي، درس، أو إعلان؟</p>}
            {kind && !research && values.title.trim() && <p className="text-center text-sm font-bold text-muted">اختر: تبيني أبحث لتطوير القصة أو لا؟</p>}
            <button className="btn btn-primary w-full text-xl" onClick={() => void understand()} disabled={busy || (!short && !values.title.trim()) || values.story.trim().length < 10 || !research || !kind}>
              {busy ? step || (lesson ? "سجاد يقرا الدرس…" : ad ? "سجاد يفهم إعلانك…" : "سجاد يراجع الفكرة…") : <><span aria-hidden>🤖</span> {lesson ? "خل سجاد يفهم الدرس" : ad ? "خل سجاد يفهم إعلانك" : "خل سجاد يفهمها ويسأل الناقص"}</>}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
