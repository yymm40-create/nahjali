"use client";

// The sheets as picture cards, side by side (swipe sideways): each character, place — and the master — shows its
// picture only, no text. «اعتمد» approves it; «ولّد» makes 1–5 more attempts at once; «ما عجبني» takes the edit
// and asks «تأكد من فهمي أول» (the sheet maker restates it, then «صح، اصنعها») or «اصنع مباشرة». Every attempt stays,
// rejected ones too, folded under the card by version, newest first. «📎 أرفق صورة الاختبار» beside «ولّد» sends the
// style test picture with THIS drawing (ticked = sent); every picture drawn with it says so («📎 انرسمت مع صورة الاختبار»).

import { useRef, useState } from "react";
import { postJson } from "@/lib/fetch";
import Spinner from "@/components/Spinner";
import { credits } from "@/lib/film/credits";
import Coined from "@/components/Coined";
import type { MapChoice, SheetVersion } from "@/lib/film/sheets";
import { drawnWithTest } from "@/lib/film/style-test-ref";

export interface CardAsset {
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

type Send = (body: Record<string, unknown>) => Promise<void> | void;

const SHEET_USD = 0.4;

export default function SheetCards({ projectId, items, versions, assets, busy, send, onEdit, selected = [], onSelect, test = null, testOn = false, choices = {}, ownable = false }: { /** the map's choice per item, and whether «صورتي كما هي» is offered (the map is approved) */ choices?: Record<string, MapChoice>; ownable?: boolean; projectId: string; items: { id: string; title: string }[]; versions: SheetVersion[]; assets: CardAsset[]; busy: boolean; send: Send; onEdit: (sheetId: string) => void; /** the style test picture a drawing can be sent with (null: none), and whether the film's setting sends it */ test?: { id: string; url: string } | null; testOn?: boolean; selected?: string[]; onSelect?: (assetId: string) => void }) {
  if (!items.length) return null;
  return (
    <section className="space-y-2">
      <p className="text-sm font-bold text-muted">اسحب يمين ويسار بين الشخصيات والأماكن 👈👉 · عجبتك؟ اعتمدها. ما عجبتك؟ «ما عجبني» واكتب وش تبي.</p>
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3" style={{ scrollbarWidth: "thin" }}>
        {items.map((it) => (
          <SheetCard key={it.id} projectId={projectId} id={it.id} title={it.title} prompts={versions.filter((v) => v.kind === "sheet_prompt" && v.ref_key === it.id)} images={assets.filter((a) => a.kind === "image" && a.ref_key === it.id)} own={assets.filter((a) => a.kind === "upload" && a.ref_key === it.id && a.status !== "rejected" && a.url)} choice={choices[it.id]} ownable={ownable && it.id !== "STY-00"} busy={busy} send={send} onEdit={onEdit} selected={selected} onSelect={onSelect} test={test} testOn={testOn} />
        ))}
      </div>
    </section>
  );
}

function SheetCard({ projectId, id, title, prompts, images, own = [], choice, ownable = false, busy, send, onEdit, selected = [], onSelect, test, testOn }: { own?: CardAsset[]; choice?: MapChoice; ownable?: boolean; projectId: string; id: string; title: string; prompts: SheetVersion[]; images: CardAsset[]; busy: boolean; send: Send; onEdit: (sheetId: string) => void; selected?: string[]; onSelect?: (assetId: string) => void; test: { id: string; url: string } | null; testOn: boolean }) {
  const latest = prompts.at(-1);
  const [count, setCount] = useState(1);
  // «📎 أرفق صورة الاختبار»: this card's own choice for its next drawing (starts as the film's setting); a real person's
  // converted sheet is drawn only from his chosen single images, so it is not offered there
  const [useTest, setUseTest] = useState(testOn);
  const canTest = Boolean(test) && !latest?.data.convert;
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [understood, setUnderstood] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [err, setErr] = useState("");
  const approved = images.find((i) => i.status === "approved");
  // the picture shown: the approved one, else the newest not rejected (of any version)
  const live = [...images].reverse().filter((i) => i.status !== "rejected");
  const main = approved ?? live[0];
  const generating = images.filter((i) => i.status === "generating").length;
  const writing = latest?.status === "awaiting_approval";
  const ready = latest?.status === "approved";
  const make = () => {
    onEdit(id);
    void send({ action: "revise", text, versionId: latest?.id, mode: "edit" });
    setEditing(false);
    setText("");
    setUnderstood(null);
  };
  const check = async () => {
    setAsking(true);
    setErr("");
    try {
      const r = await postJson<{ understanding?: string }>(`/api/film/projects/${projectId}/sheets`, { action: "understand_edit", sheetId: id, text });
      setUnderstood(r.understanding ?? "");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setAsking(false);
    }
  };
  // the attempts, newest version first, each with its pictures (rejected ones kept, faded)
  const byVersion = [...prompts].reverse().map((v) => ({ v, imgs: images.filter((i) => i.version_id === v.id) })).filter((x) => x.imgs.length);
  const loose = images.filter((i) => !i.version_id || !prompts.some((v) => v.id === i.version_id));
  const attempts = (byVersion.length > 1 || images.length > 1 || (choice === "as_is" && images.length > 0)) && (
    <details className="rounded-xl border border-line p-2 text-sm">
      <summary className="cursor-pointer font-extrabold text-muted">{choice === "as_is" ? `شيتات انرسمت لها قبل (${images.length})` : `المحاولات (${images.length})`}</summary>
      <div className="mt-2 space-y-2">
        {byVersion.map(({ v, imgs }) => (
          <details key={v.id} open={v.id === latest?.id} className="rounded-lg bg-surface-2 p-2">
            <summary className="cursor-pointer text-xs font-extrabold">النسخة {v.version}{v.id === latest?.id ? " (الأحدث)" : ""} · {imgs.length} صور</summary>
            <Thumbs imgs={imgs} busy={busy} send={send} />
          </details>
        ))}
        {loose.length > 0 && <Thumbs imgs={loose} busy={busy} send={send} />}
      </div>
    </details>
  );

  // «📤 صورتك كما هي»: the item stands on the person's own picture — no sheet, nothing to generate
  if (choice === "as_is") {
    const mine = own.find((u) => u.status === "approved") ?? own.at(-1);
    return (
      <article className="card w-[86%] max-w-[440px] shrink-0 snap-center space-y-3 border-2 border-teal p-3">
        <header className="flex items-center justify-between gap-2">
          <h3 className="truncate font-extrabold">{title}</h3>
          <span className="chip bg-teal text-white">📤 صورتك كما هي ✅</span>
        </header>
        <div className="overflow-hidden rounded-xl bg-surface-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
          {mine?.url ? <a href={mine.url} target="_blank" rel="noopener"><img src={mine.url} alt={title} className="w-full" /></a> : <div className="grid aspect-video place-items-center text-sm font-bold text-muted">صورتك</div>}
        </div>
        {typeof mine?.meta.at_name === "string" && <p className="text-xs font-bold text-muted">{mine.meta.at_name}</p>}
        <p className="text-xs font-bold text-muted">معتمدة بدون شيت: المخرج يستخدم صورتك نفسها. تقدر تغيّر رأيك أي وقت.</p>
        {ownable && (
          <div className="flex flex-wrap gap-2">
            <OwnUpload projectId={projectId} sheetId={id} busy={busy} send={send} label="🔁 غيّر صورتي" />
            <button className="btn btn-ghost min-h-9 flex-1 px-2 text-xs" disabled={busy} onClick={() => window.confirm("تبي نصنع لها شيت بدال صورتك؟ صورتك تبقى محفوظة وتقدر ترجع لها.") && send({ action: "sheet_from_picture", sheetId: id })}>🖼️ اصنع لها شيت بدالها</button>
          </div>
        )}
        {attempts}
      </article>
    );
  }
  const mine = own.at(-1);

  return (
    <article className={`card w-[86%] max-w-[440px] shrink-0 snap-center space-y-3 p-3 ${approved ? "border-2 border-teal" : ""}`}>
      <header className="flex items-center justify-between gap-2">
        <h3 className="truncate font-extrabold">{title}</h3>
        {approved ? <span className="chip bg-teal text-white">معتمدة ✅</span> : generating ? <span className="chip bg-gold text-on-gold">تتولد ({generating})</span> : null}
      </header>

      <div className="overflow-hidden rounded-xl bg-surface-2">
        {main?.status === "generating" || (!main && (writing || generating)) ? (
          <div className="grid aspect-video place-items-center gap-1 text-sm font-bold"><Spinner /> {writing && !generating ? "نكتب وصفها…" : "نولّد الصورة… (دقيقة إلى دقيقتين)"}</div>
        ) : main?.status === "failed" ? (
          <p className="error-box m-2">فشل التوليد: {main.error}. ما انحسبت تكلفة.</p>
        ) : main ? (
          // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
          <a href={main.url} target="_blank" rel="noopener"><img src={main.url} alt={title} className="w-full" /></a>
        ) : (
          <div className="grid aspect-video place-items-center text-sm font-bold text-muted">{ready ? "اضغط «ولّد» تحت" : "بانتظار وصفها"}</div>
        )}
      </div>
      {/* the proof: written on the picture by the server only when the test picture went with its drawing */}
      {main && main.status !== "failed" && (canTest || drawnWithTest(main.meta)) && (
        <p className={`text-xs font-extrabold ${drawnWithTest(main.meta) ? "text-teal" : "text-muted"}`}>
          {drawnWithTest(main.meta) ? (main.status === "generating" ? "📎 تنرسم مع صورة الاختبار" : "📎 انرسمت مع صورة الاختبار") : main.status === "generating" ? "تنرسم بدون صورة الاختبار" : "انرسمت بدون صورة الاختبار"}
        </p>
      )}

      {typeof main?.meta.at_name === "string" && <p className="text-xs font-bold text-muted">{main.meta.at_name}</p>}

      {!busy && main?.status === "generated" && !approved && (
        <div className="flex gap-2">
          {onSelect && (
            <label className="flex items-center gap-1 rounded-xl border border-line px-2 text-xs font-extrabold" title="للاعتماد مع المحدد">
              <input type="checkbox" className="size-4 accent-gold" checked={selected.includes(main.id)} onChange={() => onSelect(main.id)} /> حدّد
            </label>
          )}
          <button className="btn btn-primary min-h-10 flex-1 text-sm" onClick={() => send({ action: "approve_image", assetId: main.id })}>اعتمد ✅</button>
          <button className="btn btn-ghost min-h-10 px-3 text-sm" onClick={() => send({ action: "reject_image", assetId: main.id })}>ارفضها</button>
        </div>
      )}
      {!busy && approved && (
        <button className="btn btn-ghost min-h-9 w-full text-xs" onClick={() => window.confirm("تتراجع عن اعتماد هذي الصورة؟ تقدر بعدها تولّد غيرها أو تعدّل.") && send({ action: "unapprove_image", assetId: approved.id })}>↩️ تراجع عن الاعتماد</button>
      )}

      {!approved && (ready || writing) && canTest && test && (
        <label className={`flex cursor-pointer items-center gap-2 rounded-xl border p-2 ${useTest ? "border-teal bg-teal/10" : "border-line"}`}>
          <input type="checkbox" className="size-5 shrink-0 accent-teal" checked={useTest} disabled={busy} onChange={(e) => setUseTest(e.target.checked)} />
          {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
          <img src={test.url} alt="صورة الاختبار" className="h-10 w-14 shrink-0 rounded-md object-cover" />
          <span className="text-xs font-extrabold leading-5">
            📎 أرفق صورة الاختبار مرجع للستايل
            <span className="block font-bold text-muted">{useTest ? "بتنرسل مع الصور اللي تولّدها الحين، وتكون هي الحاكمة في الألوان والشكل. تعديلاتك فوقها." : "ما بتنرسل"}</span>
          </span>
        </label>
      )}
      {!approved && (ready || writing) && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold text-muted">كم صورة؟</span>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" className={`h-8 w-8 rounded-full border text-sm font-extrabold ${count === n ? "border-gold bg-gold/20" : "border-line"}`} onClick={() => setCount(n)} aria-pressed={count === n}>
              {n}
            </button>
          ))}
          <button className="btn btn-secondary min-h-9 flex-1 px-3 text-sm" disabled={busy || !!generating} onClick={() => send({ ...(ready ? { action: "generate_image", sheetId: id, count } : { action: "approve", versionId: latest!.id, count }), ...(canTest ? { useTest } : {}) })}>
            {live.length ? "🔁 ولّد" : "🖼️ ولّد"} ×{count} · <Coined text={credits(SHEET_USD * count, "image")} />
          </button>
        </div>
      )}

      {!approved && !editing && (
        <button className="btn btn-ghost min-h-9 w-full text-sm" disabled={busy} onClick={() => setEditing(true)}>✏️ ما عجبني، أبي تعديل</button>
      )}
      {editing && (
        <div className="space-y-2 rounded-xl border border-line p-2">
          <textarea className="input min-h-20 w-full text-sm" value={text} maxLength={4000} placeholder="وش تبي يتغيّر؟ مثلًا: خلّ الثوب أبيض وأطول، واللحية أقصر" onChange={(e) => { setText(e.target.value); setUnderstood(null); }} />
          {understood !== null ? (
            <div className="space-y-2 rounded-xl bg-surface-2 p-2 text-sm">
              <p className="font-extrabold">فهمي لتعديلك:</p>
              <p className="whitespace-pre-wrap leading-7">{understood}</p>
              <div className="flex gap-2">
                <button className="btn btn-primary min-h-9 flex-1 text-sm" disabled={busy} onClick={make}>صح، اصنعها ✅</button>
                <button className="btn btn-ghost min-h-9 px-3 text-sm" onClick={() => setUnderstood(null)}>لا، أعدّل</button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-xs font-bold text-muted">تبي أتأكد من فهمي أول، ولا أصنع مباشرة؟</p>
              <div className="flex gap-2">
                <button className="btn btn-secondary min-h-9 flex-1 px-2 text-xs" disabled={busy || asking || !text.trim()} onClick={() => void check()}>{asking ? "أفهم…" : "تأكد من فهمي أول"}</button>
                <button className="btn btn-primary min-h-9 flex-1 px-2 text-xs" disabled={busy || !text.trim()} onClick={make}>اصنع مباشرة</button>
                <button className="btn btn-ghost min-h-9 px-2 text-xs" onClick={() => { setEditing(false); setUnderstood(null); }}>إلغاء</button>
              </div>
            </>
          )}
          {err && <p className="error-box text-sm">{err}</p>}
        </div>
      )}

      {attempts}

      {/* «صورتي كما هي»: at any time, the person's own picture instead of a sheet (whatever was chosen on the map) */}
      {ownable && (
        <div className="space-y-2 rounded-xl border border-dashed border-line p-2">
          <p className="text-xs font-extrabold text-muted">ما تبي شيت؟ خلّ صورتك هي المعتمدة:</p>
          <div className="flex flex-wrap items-center gap-2">
            {mine && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
                <img src={mine.url} alt="صورتك" className="size-12 shrink-0 rounded-lg object-cover" />
                <button className="btn btn-secondary min-h-9 flex-1 px-2 text-xs" disabled={busy} onClick={() => send({ action: "use_own_picture", sheetId: id, assetId: mine.id })}>📤 استخدم صورتي كما هي (بدون شيت)</button>
              </>
            )}
            <OwnUpload projectId={projectId} sheetId={id} busy={busy} send={send} label={mine ? "ارفع غيرها" : "📤 ارفع صورة جاهزة بدال الشيت"} />
          </div>
        </div>
      )}
    </article>
  );
}

/** An attempt's pictures: a tap opens it; a rejected one stays (faded) and can still be approved. */
function Thumbs({ imgs, busy, send }: { imgs: CardAsset[]; busy: boolean; send: Send }) {
  return (
    <div className="mt-2 grid grid-cols-3 gap-1.5">
      {imgs.map((i) => (
        <figure key={i.id} className={`space-y-1 ${i.status === "rejected" ? "opacity-50" : ""}`}>
          {i.url ? (
            // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
            <a href={i.url} target="_blank" rel="noopener"><img src={i.url} alt="" className={`aspect-video w-full rounded-md object-cover ${i.status === "approved" ? "ring-2 ring-teal" : ""}`} /></a>
          ) : (
            <div className="grid aspect-video place-items-center rounded-md bg-surface text-[10px]">{i.status === "generating" ? "تتولد…" : i.status === "failed" ? "فشلت" : "…"}</div>
          )}
          <figcaption className="flex items-center justify-between text-[10px] font-bold">
            <span>{i.status === "rejected" ? "مرفوضة" : i.status === "approved" ? "معتمدة" : i.status === "generated" ? "جديدة" : ""}{drawnWithTest(i.meta) ? " 📎" : ""}</span>
            {!busy && (i.status === "generated" || i.status === "rejected") && (
              <button className="underline" onClick={() => send({ action: "approve_image", assetId: i.id })}>اعتمدها</button>
            )}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

/**
 * «📤 ارفع صورة جاهزة»: the person's own picture for one item, uploaded and taken as the item's picture as it is, at once
 * (the same two steps as the map's upload; `use` makes it the approved picture).
 */
export function OwnUpload({ projectId, sheetId, busy, send, label }: { projectId: string; sheetId: string; busy: boolean; send: Send; label: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [up, setUp] = useState(false);
  const [err, setErr] = useState("");
  async function upload(file?: File) {
    if (!file) return;
    setErr("");
    setUp(true);
    try {
      if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 20 * 1024 * 1024) throw new Error("صورة JPG أو PNG أو WEBP أقل من ٢٠ ميجا.");
      const { path, token } = await postJson<{ path: string; token: string }>(`/api/film/projects/${projectId}/sheets`, { action: "upload_url", sheetId, mime: file.type });
      const put = await fetch(token, { method: "PUT", headers: { "content-type": file.type }, body: file }).catch(() => null);
      if (!put?.ok) throw new Error("تعذّر رفع الصورة.");
      await send({ action: "upload_confirm", sheetId, path, use: true });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setUp(false);
      if (input.current) input.current.value = "";
    }
  }
  return (
    <>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => void upload(e.target.files?.[0])} />
      <button className="btn btn-ghost min-h-9 flex-1 px-2 text-xs" disabled={busy || up} onClick={() => input.current?.click()}>{up ? "نرفع…" : label}</button>
      {err && <p className="error-box w-full text-xs">{err}</p>}
    </>
  );
}
