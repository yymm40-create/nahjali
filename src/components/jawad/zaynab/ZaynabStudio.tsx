"use client";

import { useEffect, useRef, useState } from "react";
import { ZAYNAB_ASPECTS, ZAYNAB_MAX_PHOTOS, ZAYNAB_VIEWS, ZAYNAB_TIMES, ZAYNAB_WEATHER, type ZaynabInput } from "@config/jawad/zaynab";
import { FREE_FIRST_ENDS_AT, FREE_FIRST_HOURS } from "@config/jawad/free-first";
import Riyal from "@/components/Riyal";
import { stageLabel, type JobView } from "@/lib/jawad/labels";
import { uploadImage } from "../studio/upload";
import type { UploadView } from "../studio/types";
import StylePicker from "../studio/StylePicker";
import { findStyle } from "@config/film-styles";

type Quote = { coins: number; fullCoins: number };
/** what «جواد» wrote for this request, sealed by the server (sent back as it is to start) */
type Written = { prompt: string; seal: string };
type Person = { upload: UploadView; label: string };
const INITIAL: Omit<ZaynabInput, "labels"> = { view: "shrine", style: "", time: "day", weather: "clear", aspect: "3:2", greeting: true, count: 1, consent: false };
const offerEnd = () => new Date(FREE_FIRST_ENDS_AT).toLocaleString("ar", { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" });

async function api<T>(body?: unknown): Promise<T> {
  const response = await fetch("/api/jawad/zaynab", body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "تعذّر الاتصال. حاول مرة أخرى.");
  return data;
}

/** «في حضرة السيدة زينب (ع)»: the people's photos → a picture of them in front of the shrine, in the look, time and weather they choose. */
export default function ZaynabStudio({ userId }: { userId: string }) {
  const [input, setInput] = useState(INITIAL);
  const [people, setPeople] = useState<Person[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [quote, setQuote] = useState<{ value: Quote; free: boolean; snapshot: string; written: Written } | null>(null);
  const [jobs, setJobs] = useState<JobView[]>([]);
  const [firstFree, setFirstFree] = useState(false);
  const requestKey = useRef<string | null>(null);
  const lock = useRef(false);
  const snapshot = JSON.stringify({ input, people: people.map(p => [p.upload.id, p.label]) });
  const validQuote = quote?.snapshot === snapshot ? quote : null;
  const reset = () => { requestKey.current = null; setQuote(null); };
  const change = (patch: Partial<typeof INITIAL>) => { setInput(current => ({ ...current, ...patch })); reset(); };

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      try {
        const data = await api<{ firstFree: boolean; jobs: JobView[] }>();
        if (!stopped) { setJobs(data.jobs); setFirstFree(data.firstFree); }
      } catch (e) {
        if (!stopped) setError((e as Error).message);
      } finally {
        if (!stopped) timer = setTimeout(refresh, 8000);
      }
    };
    void refresh();
    return () => { stopped = true; clearTimeout(timer); };
  }, [userId]);

  async function add(files: FileList | null) {
    if (!files || lock.current) return;
    if (people.length + files.length > ZAYNAB_MAX_PHOTOS) { setError(`أقصى شي ${ZAYNAB_MAX_PHOTOS} صور.`); return; }
    lock.current = true; setBusy("رفع الصور وفحصها…"); setError(""); reset();
    try {
      for (const file of Array.from(files)) {
        const upload = await uploadImage(file);
        setPeople(current => [...current, { upload, label: "" }]);
      }
    } catch (e) { setError((e as Error).message); }
    finally { lock.current = false; setBusy(""); }
  }
  const body = () => ({ input: { ...input, labels: people.map(p => p.label) }, uploads: people.map(p => p.upload.id) });
  async function submit() {
    if (lock.current) return;
    if (!people.length) { setError("أضف صورة واحدة على الأقل."); return; }
    lock.current = true; setError(""); setBusy(validQuote ? "نجهّز صورتك…" : "«جواد» يشوف صورك والشيت ويكتب البرومبت…");
    try {
      if (!validQuote) {
        const data = await api<{ quote: Quote; free: boolean; firstFree: boolean; prompt: string; seal: string }>({ action: "quote", ...body() });
        setFirstFree(data.firstFree);
        setQuote({ value: data.quote, free: data.free, snapshot, written: { prompt: data.prompt, seal: data.seal } });
      } else {
        requestKey.current ??= crypto.randomUUID();
        await api({ action: "start", ...body(), key: requestKey.current, expectedCoins: validQuote.value.coins, prompt: validQuote.written.prompt, seal: validQuote.written.seal });
        const data = await api<{ jobs: JobView[]; firstFree: boolean }>();
        setJobs(data.jobs); setFirstFree(data.firstFree);
        reset();
        setError("بدأ طلبك. تقدر تغادر وترجع؛ النتيجة تنحفظ هنا وفي أعمالك.");
      }
    } catch (e) { setError((e as Error).message); }
    finally { lock.current = false; setBusy(""); }
  }
  return <main className="zy-page" dir="rtl">
    <div className="zy-stars" aria-hidden="true" />
    <header className="zy-hero">
      <svg className="zy-dome" viewBox="0 0 220 120" aria-hidden="true"><defs><linearGradient id="zyg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffe9a0" /><stop offset="1" stopColor="#d9a01e" /></linearGradient></defs><rect x="20" y="40" width="9" height="76" rx="3" fill="#2f8f9b" /><rect x="191" y="40" width="9" height="76" rx="3" fill="#2f8f9b" /><circle cx="24.5" cy="34" r="6" fill="url(#zyg)" /><circle cx="195.5" cy="34" r="6" fill="url(#zyg)" /><rect x="70" y="72" width="80" height="44" fill="#1f6f86" /><path d="M72,72 C72,28 148,28 148,72 Z" fill="url(#zyg)" /><rect x="108" y="14" width="4" height="14" fill="#ffe9a0" /><circle cx="110" cy="11" r="4" fill="#ffe9a0" /></svg>
      <span className="zy-eyebrow">جواد</span>
      <h1>في حضرة السيدة زينب <small>عليها السلام</small></h1>
      <p>ضع نفسك وأحبابك أمام الحرم الشريف، والقبة الذهبية خلفكم — بالأسلوب والوقت والجو اللي تختاره.</p>
      {firstFree && <p className="zy-offer">🎁 أول تجربة مجانية! صورتك الأولى علينا لمدة {FREE_FIRST_HOURS} ساعة — العرض ينتهي {offerEnd()}</p>}
    </header>
    <div className="zy-layout"><section className="zy-card"><fieldset disabled={!!busy}>
      <h2>١. المكان</h2>
      <p>صحن الحرم الشريف، والقبة خلفكم. اختر الزاوية؛ شيت المكان كامل يروح مرجع مع صورك.</p>
      <div className="zy-views">{ZAYNAB_VIEWS.map(view => <button type="button" key={view.id} className={input.view === view.id ? "chosen" : ""} aria-pressed={input.view === view.id} onClick={() => change({ view: view.id })}><img src={`/zaynab/views/${view.id}.jpg`} alt={view.name} loading="lazy" /><b>{view.name}</b><small>{view.hint}</small></button>)}</div>
      <h2>٢. صورك</h2>
      <p>صور عادية من الجوال، وما يلزم تفرّغ الخلفية. ضيف أكثر من شخص: كل شخص بصورة، أو صورة وحدة فيها مجموعة وكلهم يدخلون.</p>
      <label className="zy-upload">＋ أضف صور<input type="file" accept="image/png,image/jpeg,image/webp" multiple disabled={people.length >= ZAYNAB_MAX_PHOTOS || !!busy} onChange={event => { void add(event.target.files); event.target.value = ""; }} /></label>
      <div className="zy-people">{people.map((person, index) => <div key={person.upload.id}>{person.upload.url && <img src={person.upload.url} alt={`الشخص ${index + 1}`} />}<input maxLength={40} value={person.label} placeholder="اسمه أو من هو (اختياري)" onChange={event => { const value = event.target.value; setPeople(current => current.map((item, i) => i === index ? { ...item, label: value } : item)); reset(); }} /><button type="button" aria-label="حذف الصورة" onClick={() => { setPeople(current => current.filter((_, i) => i !== index)); reset(); }}>×</button></div>)}</div>
      <h2>٣. الستايل</h2>
      <p>نفس ستايلات الجواد الذكي. اختر واحد، أو خلّه بدون ستايل وتطلع صورة طبيعية.</p>
      <StylePicker value={input.style} onChange={id => change({ style: id })} />
      <h2>٤. الوقت والجو</h2>
      <div className="zy-seg" role="radiogroup" aria-label="الوقت">{(Object.entries(ZAYNAB_TIMES) as [ZaynabInput["time"], string][]).map(([id, label]) => <button type="button" role="radio" aria-checked={input.time === id} key={id} className={input.time === id ? "chosen" : ""} onClick={() => change({ time: id })}>{label}</button>)}</div>
      <div className="zy-seg" role="radiogroup" aria-label="الجو">{(Object.entries(ZAYNAB_WEATHER) as [ZaynabInput["weather"], string][]).map(([id, label]) => <button type="button" role="radio" aria-checked={input.weather === id} key={id} className={input.weather === id ? "chosen" : ""} onClick={() => change({ weather: id })}>{label}</button>)}</div>
      <h2>٥. الصورة</h2>
      <div className="zy-fields">
        <label>الشكل<select value={input.aspect} onChange={event => change({ aspect: event.target.value as ZaynabInput["aspect"] })}>{Object.entries(ZAYNAB_ASPECTS).map(([id, label]) => <option key={id} value={id}>{label} ({id})</option>)}</select></label>
        <label>عدد الصور<select value={input.count} onChange={event => change({ count: Number(event.target.value) })}>{[1, 2, 3, 4].map(count => <option key={count} value={count}>{count === 1 ? "صورة واحدة" : count + " صور"}</option>)}</select></label>
      </div>
      <label className="zy-check"><input type="checkbox" checked={input.greeting} onChange={event => change({ greeting: event.target.checked })} /> اكتب التهنئة في السماء فوق الصورة بخط فرحان (بمناسبة ميلاد السيدة زينب عليها السلام)</label>
      <label className="zy-check"><input type="checkbox" checked={input.consent} onChange={event => change({ consent: event.target.checked })} /> لدي إذن استخدام الصور، وموافقة ولي الأمر إذا كانت لطفل.</label>
    </fieldset></section>
    <aside className="zy-card zy-summary"><h2>طلبك</h2><p>{people.length ? `${people.length} صور` : "ما أضفت صور بعد"} · {ZAYNAB_VIEWS.find(v => v.id === input.view)?.name} · {findStyle(input.style)?.name ?? "بدون ستايل"} · {ZAYNAB_TIMES[input.time]} · {ZAYNAB_WEATHER[input.weather]}</p>
      {validQuote && <div className="zy-price">{firstFree && validQuote.value.coins === 0 && <p>🎁 أول تجربة مجانية</p>}<strong>الإجمالي: {validQuote.free || validQuote.value.coins === 0 ? "مجاني" : <Riyal halalas={validQuote.value.coins} size={20} />}</strong><details className="zy-prompt"><summary>📝 البرومبت اللي كتبه «جواد»</summary><p dir="ltr">{validQuote.written.prompt}</p></details></div>}
      {firstFree && input.count > 1 && <p className="zy-note">التجربة المجانية لصورة واحدة؛ اختر «صورة واحدة» لتستفيد منها.</p>}
      <p className="zy-note">التشابه غير مضمون ١٠٠٪. يُخصم السعر عند البدء، وإن فشل التوليد يرجع لك.</p>
      <button className="zy-primary" disabled={!!busy || !input.consent || !people.length} onClick={() => void submit()}>{busy || (validQuote ? "أوافق · اصنع الصورة ✨" : "خلّ «جواد» يكتب البرومبت · اعرض السعر")}</button>
      {error && <p className="zy-feedback" role="status">{error}</p>}
    </aside></div>
    <section className="zy-results"><h2>صورك</h2>{!jobs.length && <p>هنا تظهر صورك بعد البدء.</p>}
      {jobs.map(job => <article className="zy-card" key={job.id}><p>{stageLabel(job.status, job.providerStatus)}</p>{job.error && <p role="alert">{job.error}</p>}<div className="zy-gallery">{job.outputs.map(output => output.url && <figure key={output.id}><img src={output.url} alt="صورتك في حضرة السيدة زينب عليها السلام" /><a href={output.downloadUrl} download>تنزيل الصورة ↓</a></figure>)}</div></article>)}
    </section>
  </main>;
}
