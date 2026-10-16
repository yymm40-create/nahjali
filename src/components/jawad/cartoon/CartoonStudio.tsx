"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CARTOON_GROUPS, CARTOON_PRICE, CARTOON_STYLES, CARTOON_AGES, CARTOON_AUDIENCES, CARTOON_MODES, CARTOON_MOVES, CARTOON_STORIES, movementAsked, nearestAspect, type CartoonInput } from "@config/jawad/cartoon";
import Riyal from "@/components/Riyal";
import { stageLabel, type JobView } from "@/lib/jawad/labels";
import { uploadImage } from "../studio/upload";
import type { UploadView } from "../studio/types";
import Doodles from "./Doodles";
import { FREE_FIRST_ENDS_AT, FREE_FIRST_HOURS } from "@config/jawad/free-first";

type Quote = { imageCoins: number; videoCoins: number; totalCoins: number };
/** the end of «أول تجربة مجانية» (config/jawad/free-first.ts), shown to the person in their own clock */
const offerEnd = () => new Date(FREE_FIRST_ENDS_AT).toLocaleString("ar", { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" });
type Run = { key: string; input: CartoonInput; error?: string; jobs: JobView[] };
const INITIAL: CartoonInput = { mode: "scene", aspect: "9:16", style: "cinematic-3d", audience: "family", age: "same", desiredAge: "", movement: "still", outfit: "", interests: "", story: "garden", customStory: "", count: 1, video: false, consent: false };
async function api<T>(body?: unknown): Promise<T> {
  const response = await fetch("/api/jawad/cartoon", body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "تعذّر الاتصال. حاول مرة أخرى.");
  return data;
}
export default function CartoonStudio({ userId }: { userId: string }) {
  const [input, setInput] = useState(INITIAL);
  const [uploads, setUploads] = useState<UploadView[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [quote, setQuote] = useState<{ value: Quote; snapshot: string; free: boolean } | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  // the shelf of looks shown («all» = every look) and the looks' pictures (drawn once by the owner; none yet = a coloured tile)
  const [shelf, setShelf] = useState<"all" | keyof typeof CARTOON_GROUPS>("all");
  const [pictures, setPictures] = useState<Record<string, string>>({});
  // «أول تجربة مجانية»: this account's first picture is free while the offer is open
  const [firstFree, setFirstFree] = useState(false);
  const requestKey = useRef<string | null>(null);
  const lock = useRef(false);
  const snapshot = JSON.stringify({ input, uploads: uploads.map(upload => upload.id) });
  const validQuote = quote?.snapshot === snapshot ? quote : null;
  const change = (patch: Partial<CartoonInput>) => { setInput(current => ({ ...current, ...patch })); requestKey.current = null; setQuote(null); };
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      try {
        const data = await api<{ runs: Run[]; firstFree?: boolean }>();
        if (!stopped) { setRuns(data.runs); setFirstFree(data.firstFree === true); }
      } catch (error) {
        if (!stopped) setError((error as Error).message);
      } finally {
        if (!stopped) timer = setTimeout(refresh, 8000);
      }
    };
    void refresh();
    return () => { stopped = true; clearTimeout(timer); };
  }, [userId]);
  useEffect(() => {
    let stopped = false;
    fetch("/api/jawad/cartoon-styles")
      .then(response => (response.ok ? response.json() : null))
      .then((data: { pictures?: Record<string, string> } | null) => { if (!stopped && data?.pictures) setPictures(data.pictures); })
      .catch(() => {});
    return () => { stopped = true; };
  }, []);
  async function add(files: FileList | null) {
    if (!files || lock.current) return;
    if (uploads.length + files.length > 3) { setError("ارفع من صورة إلى ثلاث صور فقط."); return; }
    lock.current = true; setBusy("رفع صورك وفحصها…"); setError(""); setQuote(null); requestKey.current = null;
    try {
      for (const file of Array.from(files)) {
        const upload = await uploadImage(file);
        const shape = await new Promise<string | null>(done => {
          const image = new Image();
          image.onload = () => done(nearestAspect(image.naturalWidth, image.naturalHeight));
          image.onerror = () => done(null);
          image.src = URL.createObjectURL(file);
        });
        setUploads(current => {
          // the photograph's own shape, taken from the first picture added
          if (!current.length && shape) setInput(now => ({ ...now, aspect: shape as CartoonInput["aspect"] }));
          return [...current, upload];
        });
      }
    } catch (error) { setError((error as Error).message); }
    finally { lock.current = false; setBusy(""); }
  }
  async function submit() {
    if (lock.current) return;
    if (!uploads.length) { setError("أضف صورة واضحة للشخص أولًا."); return; }
    lock.current = true; setError(""); setBusy(validQuote ? "بدء رحلتك…" : "حساب السعر…");
    try {
      if (!validQuote) {
        const data = await api<{ quote: Quote; free: boolean; firstFree?: boolean }>({ action: "quote", input });
        setFirstFree(data.firstFree === true);
        setQuote({ value: data.quote, free: data.free, snapshot });
      } else {
        requestKey.current ??= crypto.randomUUID();
        await api({ action: "start", input, uploads: uploads.map(upload => upload.id), key: requestKey.current, expectedCoins: validQuote.value.totalCoins });
        const data = await api<{ runs: Run[]; firstFree?: boolean }>();
        setRuns(data.runs);
        setFirstFree(data.firstFree === true);
        setQuote(null);
        requestKey.current = null;
        setError("بدأ طلبك. تقدر تغادر وترجع؛ النتائج محفوظة هنا وفي أعمالك.");
      }
    } catch (error) { setError((error as Error).message); }
    finally { lock.current = false; setBusy(""); }
  }
  return <main className="ct-page" dir="rtl">
    <Doodles />
    <Link href="/jawad-ai/images" className="ct-back">← رجوع للاستوديو الإبداعي</Link>
    <header className="ct-hero"><span className="ct-eyebrow">جواد · عالمك الكرتوني</span><h1>صورتك… بطل حكايتك ✨</h1><p>حولني الى الستايل الكرتوني</p><p>حوّل صورتك كما هي بكل من فيها، أو اصنع منك شخصية جديدة.</p><div className="ct-tags"><span className="ct-tag-price">سعر الصورة <Riyal halalas={CARTOON_PRICE} /></span><span>GPT Image 2 · قياسي</span><span>فيلم اختياري · ٣٠ ثانية</span></div>{firstFree && <p className="ct-offer">🎁 أول تجربة مجانية! صورتك الأولى علينا لمدة {FREE_FIRST_HOURS} ساعة — العرض ينتهي {offerEnd()}</p>}</header>
    <div className="ct-layout"><section className="ct-card">
      <fieldset disabled={!!busy}>
        <h2>١. وش نسوي بصورتك؟</h2>
        <div className="ct-aud ct-modes">{(Object.entries(CARTOON_MODES) as [CartoonInput["mode"], string][]).map(([id, label]) => <button type="button" key={id} className={input.mode === id ? "chosen" : ""} aria-pressed={input.mode === id} onClick={() => change({ mode: id })}>{label}<small>{id === "scene" ? "نفس الوضعية ونفس الخلفية، وكل شخص في الصورة يتحوّل بوجهه" : "شخص واحد يطلع بشخصية جديدة: عمر وملابس ومشهد تختارهم"}</small></button>)}</div>
        <h2>٢. صورك</h2><p>{input.mode === "scene" ? "ارفع الصورة اللي تبي تحوّلها — واحدة تكفي، وتقدر تكون فيها أكثر من شخص." : "شخص واحد، وجه واضح. صورة أمامية تكفي؛ زاويتان إضافيتان تساعدان على توضيح الملامح."}</p>
        <label className="ct-upload">＋ أضف صورك <input type="file" accept="image/png,image/jpeg,image/webp" multiple disabled={uploads.length >= 3 || !!busy} onChange={event => { void add(event.target.files); event.target.value = ""; }} /></label>
        <div className="ct-refs">{uploads.map(upload => <div key={upload.id}>{upload.url && <img src={upload.url} alt="مرجع الشخصية" />}<button type="button" aria-label="حذف المرجع" onClick={() => { setUploads(current => current.filter(item => item.id !== upload.id)); setQuote(null); requestKey.current = null; }}>×</button></div>)}</div>
        <h2>٣. لمين الصورة؟</h2><p>يغيّر شكل الشخصية: صورة الطفل تنرسم أبسط وأدفأ وأوضح، وصورة الكبار بنِسب طبيعية وتفاصيل أكثر.</p>
        <div className="ct-aud">{(Object.entries(CARTOON_AUDIENCES) as [CartoonInput["audience"], string][]).map(([id, label]) => <button type="button" key={id} className={input.audience === id ? "chosen" : ""} aria-pressed={input.audience === id} onClick={() => change({ audience: id })}>{label}</button>)}</div>
        <h2>٤. اختر عالمك</h2>
        <div className="ct-shelves" role="tablist" aria-label="أقسام الستايلات"><button type="button" role="tab" aria-selected={shelf === "all"} className={shelf === "all" ? "chosen" : ""} onClick={() => setShelf("all")}>✨ الكل ({CARTOON_STYLES.length})</button>{(Object.entries(CARTOON_GROUPS) as [keyof typeof CARTOON_GROUPS, (typeof CARTOON_GROUPS)[keyof typeof CARTOON_GROUPS]][]).map(([id, group]) => <button type="button" role="tab" aria-selected={shelf === id} key={id} className={shelf === id ? "chosen" : ""} onClick={() => setShelf(id)}>{group.icon} {group.name} ({CARTOON_STYLES.filter(style => style.group === id).length})</button>)}</div>
        <div className="ct-styles">{CARTOON_STYLES.map((style, index) => ({ style, index })).filter(({ style }) => shelf === "all" || style.group === shelf).map(({ style, index }) => <button type="button" className={input.style === style.id ? "chosen" : ""} aria-pressed={input.style === style.id} key={style.id} onClick={() => change({ style: style.id })}>{pictures[style.id] ? <img className="ct-pic" src={pictures[style.id]} alt={style.name} loading="lazy" /> : <span className={"ct-tile t" + (index % 6)} aria-hidden="true">{style.icon}</span>}<span className="ct-name">{style.name}</span><small>{style.hint}</small>{style.fits === input.audience && <b>⭐ يناسب اختيارك</b>}</button>)}</div>
        <div className="ct-fields">
          {input.mode === "character" && <label>العمر بالتحديد (اختياري)<input maxLength={60} value={input.desiredAge} placeholder="مثلًا: ٨ أشهر، ٧ سنوات…" onChange={event => change({ desiredAge: event.target.value })} /></label>}
          {input.mode === "character" && <label>العمر في الصورة الجديدة<select value={input.age} onChange={event => change({ age: event.target.value as CartoonInput["age"] })}>{Object.entries(CARTOON_AGES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>}
          {/* الحركة سؤال للرضيع والطفل فقط؛ ما نسأل كبيرًا هل يحبي */}
          {movementAsked(input) && <label>الحركة<select value={input.movement} onChange={event => change({ movement: event.target.value as CartoonInput["movement"] })}>{Object.entries(CARTOON_MOVES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>}
          {input.mode === "character" && <label>وش تبيه يلبس؟<input maxLength={400} value={input.outfit} placeholder="بطل فضاء، فستان، ملابسه نفسها…" onChange={event => change({ outfit: event.target.value })} /></label>}
          <label>{input.mode === "scene" ? "شي تبيه ينتبه له (اختياري)" : "اهتماماته (اختياري)"}<input maxLength={400} value={input.interests} placeholder={input.mode === "scene" ? "مثلًا: خلّ ألوان الثوب كما هي" : "الكواكب، الحيوانات، كرة القدم…"} onChange={event => change({ interests: event.target.value })} /></label>
          <label>عدد الصور<select value={input.count} onChange={event => change({ count: Number(event.target.value) })}>{[1, 2, 3, 4].map(count => <option key={count} value={count}>{count === 1 ? "صورة واحدة" : count + " صور"}</option>)}</select></label>
        </div>
        <p className="ct-note">{input.mode === "scene" ? "نحافظ على الوضعية والخلفية وكل شخص في الصورة بوجهه. التشابه غير مضمون ١٠٠٪." : "تغيير العمر تخيّل فني، وليس استرجاعًا دقيقًا للشكل الحقيقي. التشابه غير مضمون ١٠٠٪."}</p>
        <h2>٥. صورة… أو رحلة فيلم؟</h2><label className="ct-check"><input type="checkbox" checked={input.video} onChange={event => change({ video: event.target.checked })} /> {input.mode === "scene" ? "خلّ الصورة تتحرك — Seedance 2.5 · 720p · ٣٠ ثانية" : "أضف فيلمًا بالشخصية نفسها — Seedance 2.5 · 720p · ٣٠ ثانية"}</label>
        {input.video && input.mode === "scene" && <div className="ct-story"><p>صورتك المحوّلة تدب فيها الحياة: الناس يتنفسون ويرمشون وتتحرك ملابسهم وشعرهم، والكاميرا تقترب ببطء. بدون أحداث جديدة ولا أحد يخرج من الكادر.</p></div>}
        {input.video && input.mode === "character" && <div className="ct-story"><label>القصة<select value={input.story} onChange={event => change({ story: event.target.value as CartoonInput["story"] })}>{Object.entries(CARTOON_STORIES).map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select></label>{input.story === "custom" && <label>قصتك<textarea value={input.customStory} maxLength={3000} rows={5} placeholder="اكتب قصة قصيرة واضحة تناسب ٣٠ ثانية…" onChange={event => change({ customStory: event.target.value })} /></label>}<p>نجهّز الشخصية أولًا ثم نحركها تلقائيًا. سعر الفيلم منفصل ويظهر قبل التنفيذ.</p></div>}
        <label className="ct-check"><input type="checkbox" checked={input.consent} onChange={event => change({ consent: event.target.checked })} /> لدي إذن استخدام الصور، وموافقة ولي الأمر إذا كانت لطفل.</label>
      </fieldset>
    </section><aside className="ct-card ct-summary"><h2>رحلتك جاهزة</h2><p>صورك ← شخصيتك الكرتونية ← صور إضافية أو فيلم</p><p>نحفظ مرجع الشخصية ونستخدمه في بقية الطلب. لا حاجة لكتابة برومبتات.</p>
      {validQuote && <div className="ct-price">{firstFree && <p>🎁 أول صورة مجانية — محسوبة في الأسعار تحت</p>}<p>الصور: <Riyal halalas={validQuote.value.imageCoins} /></p>{input.video && <p>الفيديو: <Riyal halalas={validQuote.value.videoCoins} /></p>}<strong>الإجمالي: {validQuote.free || validQuote.value.totalCoins === 0 ? "مجاني" : <Riyal halalas={validQuote.value.totalCoins} size={20} />}</strong></div>}
      <p className="ct-note">يُخصم سعر كل مرحلة عند بدئها. إن فشلت مرحلة يُرد مبلغها حسب نظام التوليد؛ الصور المكتملة تبقى لك. لا إعادة توليد مدفوعة تلقائية.</p>
      <button className="ct-primary" disabled={!!busy || !input.consent || uploads.length === 0} onClick={() => void submit()}>{busy || (validQuote ? "أوافق على الإجمالي · اصنع الآن ✨" : "اعرض السعر النهائي")}</button>
      {error && <p className="ct-feedback" role="status">{error}</p>}
      <Link href="/jawad-ai/works">كل أعمالي المحفوظة ↗</Link>
    </aside></div>
    <section className="ct-results"><h2>رحلاتك الأخيرة</h2>{!runs.length && <p>هنا تظهر شخصيتك ونتائجك بعد البدء.</p>}{runs.map(run => <article className="ct-card" key={run.key}><h3>{CARTOON_MODES[run.input.mode] ?? CARTOON_MODES.character} · {CARTOON_STYLES.find(style => style.id === run.input.style)?.name} · {run.input.count} صور{run.input.video ? " + فيلم" : ""}</h3>{run.error && <p role="alert">{run.error}</p>}<div className="ct-gallery">{run.jobs.map(job => <div key={job.id}><p>{job.outputKind === "video" ? "الفيلم" : "الشخصية"} · {stageLabel(job.status)}</p>{job.error && <p role="alert">{job.error}</p>}{job.outputs.map(output => <figure key={output.id}>{output.url && (output.kind === "video" ? <video src={output.url} controls playsInline /> : <img src={output.url} alt="شخصيتك الكرتونية" />)}<a href={output.downloadUrl} download>تنزيل النتيجة ↓</a></figure>)}</div>)}</div></article>)}</section>
  </main>;
}

