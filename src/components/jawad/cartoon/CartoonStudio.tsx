"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CARTOON_STYLES, CARTOON_AGES, CARTOON_MOVES, CARTOON_STORIES, type CartoonInput } from "@config/jawad/cartoon";
import { fmtSar } from "@config/coins";
import { stageLabel, type JobView } from "@/lib/jawad/labels";
import { uploadImage } from "../studio/upload";
import type { UploadView } from "../studio/types";

type Quote = { imageCoins: number; videoCoins: number; totalCoins: number };
type Run = { key: string; input: CartoonInput; error?: string; jobs: JobView[] };
const INITIAL: CartoonInput = { style: "cinematic-3d", age: "same", desiredAge: "", movement: "still", outfit: "", interests: "", story: "garden", customStory: "", count: 1, video: false, consent: false };
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
        const data = await api<{ runs: Run[] }>();
        if (!stopped) setRuns(data.runs);
      } catch (error) {
        if (!stopped) setError((error as Error).message);
      } finally {
        if (!stopped) timer = setTimeout(refresh, 8000);
      }
    };
    void refresh();
    return () => { stopped = true; clearTimeout(timer); };
  }, [userId]);
  async function add(files: FileList | null) {
    if (!files || lock.current) return;
    if (uploads.length + files.length > 3) { setError("ارفع من صورة إلى ثلاث صور فقط للشخص نفسه."); return; }
    lock.current = true; setBusy("رفع صورك وفحصها…"); setError(""); setQuote(null); requestKey.current = null;
    try {
      for (const file of Array.from(files)) {
        const upload = await uploadImage(file);
        setUploads(current => [...current, upload]);
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
        const data = await api<{ quote: Quote; free: boolean }>({ action: "quote", input });
        setQuote({ value: data.quote, free: data.free, snapshot });
      } else {
        requestKey.current ??= crypto.randomUUID();
        await api({ action: "start", input, uploads: uploads.map(upload => upload.id), key: requestKey.current, expectedCoins: validQuote.value.totalCoins });
        const data = await api<{ runs: Run[] }>();
        setRuns(data.runs);
        setQuote(null);
        requestKey.current = null;
        setError("بدأ طلبك. تقدر تغادر وترجع؛ النتائج محفوظة هنا وفي أعمالك.");
      }
    } catch (error) { setError((error as Error).message); }
    finally { lock.current = false; setBusy(""); }
  }
  return <main className="ct-page" dir="rtl">
    <Link href="/jawad-ai/images" className="ct-back">← رجوع للاستوديو الإبداعي</Link>
    <header className="ct-hero"><span className="ct-eyebrow">جواد · عالمك الكرتوني</span><h1>صورتك… بطل حكايتك ✨</h1><p>حولني الى الستايل الكرتوني</p><p>١–٣ صور، اختيارات بسيطة، وشخصية كرتونية كاملة تستلهم ملامحك.</p><div className="ct-tags"><span>الصورة بـ ٢ ريال</span><span>GPT Image 2 · قياسي</span><span>فيلم اختياري · ٣٠ ثانية</span></div></header>
    <div className="ct-layout"><section className="ct-card">
      <fieldset disabled={!!busy}>
        <h2>١. صور الشخصية</h2><p>شخص واحد، وجه واضح. صورة أمامية تكفي؛ زاويتان إضافيتان تساعدان على توضيح الملامح.</p>
        <label className="ct-upload">＋ أضف صورك <input type="file" accept="image/png,image/jpeg,image/webp" multiple disabled={uploads.length >= 3 || !!busy} onChange={event => { void add(event.target.files); event.target.value = ""; }} /></label>
        <div className="ct-refs">{uploads.map(upload => <div key={upload.id}>{upload.url && <img src={upload.url} alt="مرجع الشخصية" />}<button type="button" aria-label="حذف المرجع" onClick={() => { setUploads(current => current.filter(item => item.id !== upload.id)); setQuote(null); requestKey.current = null; }}>×</button></div>)}</div>
        <h2>٢. اختر عالمك</h2><div className="ct-styles">{CARTOON_STYLES.map((style, index) => <button type="button" className={input.style === style.id ? "chosen" : ""} aria-pressed={input.style === style.id} key={style.id} onClick={() => change({ style: style.id })}><span>{["🌟", "🎨", "📖", "⚡", "🧸"][index]}</span>{style.name}{index === 0 && <small>موصى به</small>}</button>)}</div>
        <div className="ct-fields">
          <label>العمر بالتحديد (اختياري)<input maxLength={60} value={input.desiredAge} placeholder="مثلًا: ٨ أشهر، ٧ سنوات…" onChange={event => change({ desiredAge: event.target.value })} /></label>
          <label>العمر في الصورة الجديدة<select value={input.age} onChange={event => change({ age: event.target.value as CartoonInput["age"] })}>{Object.entries(CARTOON_AGES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
          <label>الحركة<select value={input.movement} onChange={event => change({ movement: event.target.value as CartoonInput["movement"] })}>{Object.entries(CARTOON_MOVES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
          <label>وش تبيه يلبس؟<input maxLength={400} value={input.outfit} placeholder="بطل فضاء، فستان، ملابسه نفسها…" onChange={event => change({ outfit: event.target.value })} /></label>
          <label>اهتماماته (اختياري)<input maxLength={400} value={input.interests} placeholder="الكواكب، الحيوانات، كرة القدم…" onChange={event => change({ interests: event.target.value })} /></label>
          <label>عدد الصور<select value={input.count} onChange={event => change({ count: Number(event.target.value) })}>{[1, 2, 3, 4].map(count => <option key={count} value={count}>{count} — {count * 2} ريال</option>)}</select></label>
        </div>
        <p className="ct-note">تغيير العمر تخيّل فني، وليس استرجاعًا دقيقًا للشكل الحقيقي. التشابه غير مضمون ١٠٠٪.</p>
        <h2>٣. صورة… أو رحلة فيلم؟</h2><label className="ct-check"><input type="checkbox" checked={input.video} onChange={event => change({ video: event.target.checked })} /> أضف فيلمًا بالشخصية نفسها — Seedance 2.5 · 720p · ٣٠ ثانية</label>
        {input.video && <div className="ct-story"><label>القصة<select value={input.story} onChange={event => change({ story: event.target.value as CartoonInput["story"] })}>{Object.entries(CARTOON_STORIES).map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select></label>{input.story === "custom" && <label>قصتك<textarea value={input.customStory} maxLength={3000} rows={5} placeholder="اكتب قصة قصيرة واضحة تناسب ٣٠ ثانية…" onChange={event => change({ customStory: event.target.value })} /></label>}<p>نجهّز الشخصية أولًا ثم نحركها تلقائيًا. سعر الفيلم منفصل ويظهر قبل التنفيذ.</p></div>}
        <label className="ct-check"><input type="checkbox" checked={input.consent} onChange={event => change({ consent: event.target.checked })} /> لدي إذن استخدام الصور، وموافقة ولي الأمر إذا كانت لطفل.</label>
      </fieldset>
    </section><aside className="ct-card ct-summary"><h2>رحلتك جاهزة</h2><p>صورك ← شخصيتك الكرتونية ← صور إضافية أو فيلم</p><p>نحفظ مرجع الشخصية ونستخدمه في بقية الطلب. لا حاجة لكتابة برومبتات.</p>
      {validQuote && <div className="ct-price"><p>الصور: {fmtSar(validQuote.value.imageCoins)} ريال</p>{input.video && <p>الفيديو: {fmtSar(validQuote.value.videoCoins)} ريال</p>}<strong>الإجمالي: {validQuote.free ? "مجاني لحسابك" : fmtSar(validQuote.value.totalCoins) + " ريال"}</strong></div>}
      <p className="ct-note">يُخصم سعر كل مرحلة عند بدئها. إن فشلت مرحلة يُرد مبلغها حسب نظام التوليد؛ الصور المكتملة تبقى لك. لا إعادة توليد مدفوعة تلقائية.</p>
      <button className="ct-primary" disabled={!!busy || !input.consent || uploads.length === 0} onClick={() => void submit()}>{busy || (validQuote ? "أوافق على الإجمالي · اصنع الآن ✨" : "اعرض السعر النهائي")}</button>
      {error && <p className="ct-feedback" role="status">{error}</p>}
      <Link href="/jawad-ai/works">كل أعمالي المحفوظة ↗</Link>
    </aside></div>
    <section className="ct-results"><h2>رحلاتك الأخيرة</h2>{!runs.length && <p>هنا تظهر شخصيتك ونتائجك بعد البدء.</p>}{runs.map(run => <article className="ct-card" key={run.key}><h3>{CARTOON_STYLES.find(style => style.id === run.input.style)?.name} · {run.input.count} صور{run.input.video ? " + فيلم" : ""}</h3>{run.error && <p role="alert">{run.error}</p>}<div className="ct-gallery">{run.jobs.map(job => <div key={job.id}><p>{job.outputKind === "video" ? "الفيلم" : "الشخصية"} · {stageLabel(job.status)}</p>{job.error && <p role="alert">{job.error}</p>}{job.outputs.map(output => <figure key={output.id}>{output.url && (output.kind === "video" ? <video src={output.url} controls playsInline /> : <img src={output.url} alt="شخصيتك الكرتونية" />)}<a href={output.downloadUrl} download>تنزيل النتيجة ↓</a></figure>)}</div>)}</div></article>)}</section>
  </main>;
}

