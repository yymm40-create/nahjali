"use client";

// «هل تريد أن تحولها إلى فيلم؟» — under every picture of the person's cartoon runs (old ones too): the film is asked for
// AFTER the picture is made. A redrawn photograph simply comes alive; a character is filmed in one of the three places,
// in parts of 15 seconds the person writes (each developed by «المخرج الخارق»). The owner can also ask for the director's
// prompts alone, to make the film elsewhere.

import { useRef, useState } from "react";
import { CARTOON_PARTS_MAX, CARTOON_PLACES, type CartoonInput, type CartoonPlace } from "@config/jawad/cartoon";
import Riyal from "@/components/Riyal";

type Quote = { videoCoins: number; directorCoins?: number; parts?: number; totalCoins: number };
type Prompts = { prompts: string[]; settings: Record<string, string | number | boolean>; placeSheet: string | null };

async function post<T>(body: unknown): Promise<T> {
  const response = await fetch("/api/jawad/cartoon", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "تعذّر الاتصال. حاول مرة أخرى.");
  return data;
}

export default function FilmPanel({ outputId, input, places, owner, onStarted }: { outputId: string; input: CartoonInput; places: Record<string, string>; owner: boolean; onStarted: () => void }) {
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<CartoonPlace>("garden");
  const [scenes, setScenes] = useState<string[]>([""]);
  const [quote, setQuote] = useState<{ value: Quote; snapshot: string; free: boolean; freeVideo: boolean } | null>(null);
  const [prompts, setPrompts] = useState<Prompts | null>(null);
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const key = useRef<string | null>(null);
  const still = input.mode === "scene";
  const film = { place, scenes };
  const snapshot = JSON.stringify(film);
  const valid = quote?.snapshot === snapshot ? quote : null;
  const missing = !still && scenes.some(text => !text.trim());
  const edit = (next: string[]) => { setScenes(next); setQuote(null); key.current = null; };

  if (!open) return <button type="button" className="ct-film-ask" onClick={() => setOpen(true)}>🎬 هل تريد أن تحوّلها إلى فيلم؟</button>;

  async function go(action: "film_quote" | "film" | "film_prompt") {
    if (busy) return;
    setNote("");
    setBusy(action === "film_quote" ? "حساب السعر…" : !still ? "المخرج الخارق يطوّر قصتك… (حتى دقيقة)" : "بدء الفيلم…");
    try {
      if (action === "film_prompt") setPrompts(await post<Prompts>({ action, outputId, film }));
      else if (action === "film_quote") {
        const data = await post<{ quote: Quote; free: boolean; freeVideo?: boolean }>({ action, outputId, film });
        setQuote({ value: data.quote, free: data.free, freeVideo: data.freeVideo === true, snapshot });
      } else if (valid) {
        key.current ??= crypto.randomUUID();
        await post({ action, outputId, film, key: key.current, expectedCoins: valid.value.totalCoins });
        key.current = null;
        setQuote(null);
        setOpen(false);
        onStarted();
      }
    } catch (error) { setNote((error as Error).message); }
    finally { setBusy(""); }
  }

  return <div className="ct-story ct-film">
    <h3>🎬 حوّلها إلى فيلم · Seedance 2.0 · 480p · ١٥ ثانية لكل جزء</h3>
    {still ? <p>صورتك المحوّلة تدب فيها الحياة: الناس يتنفسون ويرمشون وتتحرك ملابسهم وشعرهم، والكاميرا تقترب ببطء. بدون أحداث جديدة ولا أحد يخرج من الكادر.</p> : <>
      <p>الفيلم يطلع بنفس ستايل الصورة وبنفس الشخصية.</p>
      <h3>وين يصير الفيلم؟</h3>
      <div className="ct-styles ct-places">{(Object.entries(CARTOON_PLACES) as [CartoonPlace, (typeof CARTOON_PLACES)[CartoonPlace]][]).map(([id, info], index) => { const sheet = places[id + "--" + input.style]; return <button type="button" key={id} className={place === id ? "chosen" : ""} aria-pressed={place === id} onClick={() => { setPlace(id); setQuote(null); key.current = null; }}>{sheet ? <img className="ct-pic" src={sheet} alt={info.name} loading="lazy" /> : <span className={"ct-tile t" + (index % 6)} aria-hidden="true">{info.icon}</span>}<span className="ct-name">{info.icon} {info.name}</span></button>; })}</div>
      <h3>شنو يصير في الفيلم؟</h3>
      <p className="ct-note">⚠️ اكتب شي يناسب <b>١٥ ثانية</b> بس: حدث واحد واضح ونهايته. وتنبيه: Seedance 2.0 ما يفهم العربي عدل — المخرج الخارق يترجم قصتك ويطوّرها تلقائيًا، لكن الكلام المنطوق بالعربي داخل الفيلم ما يطلع مضبوط.</p>
      {scenes.map((text, i) => <label key={i}>{scenes.length > 1 ? `الجزء ${i + 1} · من ${i * 15} إلى ${(i + 1) * 15} ثانية` : "الـ ١٥ ثانية"}<textarea value={text} maxLength={1500} rows={4} placeholder={i ? "شنو يصير بعدها؟ كمّل القصة من وين وقف الجزء اللي قبله…" : "مثلًا: يلقى كورة في الحديقة، يلعب فيها ويضحك، وبالأخير يلوّح لنا."} onChange={event => edit(scenes.map((old, j) => (j === i ? event.target.value : old)))} />{i > 0 && <button type="button" className="ct-remove" onClick={() => edit(scenes.filter((_, j) => j !== i))}>× احذف هذا الجزء</button>}</label>)}
      {scenes.length < CARTOON_PARTS_MAX && <button type="button" className="ct-add" onClick={() => edit([...scenes, ""])}>＋ أضف ١٥ ثانية تكمّل القصة</button>}
      <p>✨ كل قصة تكتبها يطوّرها «المخرج الخارق» تلقائيًا. الأجزاء تتصوّر بالترتيب، وسعر كل جزء نفس سعر Seedance 2.0 (١٥ ثانية · 480p).</p>
    </>}
    {valid && <div className="ct-price">{valid.freeVideo && <p>🎁 عرض الافتتاح: أول ١٥ ثانية من فيلمك علينا — محسوبة في الأسعار تحت</p>}<p>الفيديو{(valid.value.parts ?? 1) > 1 ? ` (${valid.value.parts} أجزاء × ١٥ ثانية)` : ""}: <Riyal halalas={valid.value.videoCoins} /></p>{!!valid.value.directorCoins && <p>المخرج الخارق: <Riyal halalas={valid.value.directorCoins} /></p>}<strong>الإجمالي: {valid.free || valid.value.totalCoins === 0 ? "مجاني" : <Riyal halalas={valid.value.totalCoins} size={20} />}</strong></div>}
    {missing && <p className="ct-note">اكتب شنو يصير في كل جزء، أو احذف الجزء الفاضي.</p>}
    <div className="ct-film-actions">
      <button type="button" className="ct-primary" disabled={!!busy || missing} onClick={() => void go(valid ? "film" : "film_quote")}>{busy || (valid ? "أوافق على الإجمالي · اصنع الفيلم 🎬" : "اعرض سعر الفيلم")}</button>
      {owner && <button type="button" className="ct-add" disabled={!!busy || missing} onClick={() => void go("film_prompt")}>📝 اطلع برومبت الفيديو بس (بالمخرج الخارق)</button>}
      <button type="button" className="ct-remove" disabled={!!busy} onClick={() => setOpen(false)}>إغلاق</button>
    </div>
    {note && <p className="ct-feedback" role="status">{note}</p>}
    {owner && prompts && <div className="ct-prompts">
      <p className="ct-note">للقائد بس · الإعدادات: {Object.entries(prompts.settings).map(([k, v]) => `${k}: ${v}`).join(" · ")}. المراجع: @character = هذه الصورة{prompts.placeSheet ? <> · @place = <a href={prompts.placeSheet} target="_blank" rel="noreferrer">شيت البيئة ↗</a></> : ""}.</p>
      {prompts.prompts.map((text, i) => <label key={i}>{prompts.prompts.length > 1 ? `برومبت الجزء ${i + 1}` : "برومبت الفيديو"}<textarea readOnly dir="ltr" rows={10} value={text} /><button type="button" className="ct-remove" onClick={() => void navigator.clipboard?.writeText(text)}>📋 انسخ</button></label>)}
    </div>}
  </div>;
}
