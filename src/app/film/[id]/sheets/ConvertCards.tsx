"use client";

// «حوّل شخصية واقعية إلى كرتون» (config/film-prompts/convert-person.ts): per real person of the map, every real photo
// with its single images beside it — each photo turned on its own, as it is (3 attempts). The person picks the closest
// face of each photo («الأقرب لوجهه»), then «اصنع الشيت» makes the sheet from the picked single images only.

import Spinner from "@/components/Spinner";
import { credits } from "@/lib/film/credits";
import type { MapItem } from "@/lib/film/sheets";
import type { CardAsset } from "./SheetCards";

type Send = (body: Record<string, unknown>) => Promise<void> | void;

const PORTRAIT_USD = 0.08;
const SHEET_USD = 0.4;
const PER_PHOTO = 3;
const SHEETS = 2;

export default function ConvertCards({ items, assets, styleChosen, busy, send }: { items: MapItem[]; assets: CardAsset[]; styleChosen: boolean; busy: boolean; send: Send }) {
  if (!items.length) return null;
  return (
    <section className="space-y-3">
      {items.map((m) => <ConvertCard key={m.id} item={m} assets={assets} styleChosen={styleChosen} busy={busy} send={send} />)}
    </section>
  );
}

function ConvertCard({ item, assets, styleChosen, busy, send }: { item: MapItem; assets: CardAsset[]; styleChosen: boolean; busy: boolean; send: Send }) {
  const photos = assets.filter((a) => a.kind === "upload" && a.ref_key === item.id && a.meta.mode === "convert" && a.status === "uploaded");
  const singles = assets.filter((a) => a.kind === "image" && a.ref_key === `${item.id}:P`);
  const picked = photos.filter((p) => singles.some((s) => s.meta.from === p.id && s.status === "approved")).length;
  const sheetDone = assets.some((a) => a.kind === "image" && a.ref_key === item.id && a.status === "approved");
  const sheetMaking = assets.some((a) => a.kind === "image" && a.ref_key === item.id && a.status === "generating");

  const body = (
    <div className="space-y-3">
      <p className="text-sm font-bold text-muted">
        ١) نكتب ملامحه من كل صورة ← ٢) كل صورة واقعية تتحول لحالها كما هي (نفس لبسها وجلستها) إلى صورة فردية بالستايل، {PER_PHOTO} محاولات ← ٣) اختر الأقرب لوجهه من كل صورة ← ٤) «اصنع الشيت»: ينصنع من الصور الفردية المختارة بس، مو من الصورة الواقعية.
      </p>
      {!styleChosen && <p className="rounded-xl bg-surface-2 p-2 text-sm font-bold">⏳ يبدأ التحويل لحاله أول ما تعتمد الستايل.</p>}
      {photos.map((p, i) => (
        <PhotoRow key={p.id} n={i + 1} photo={p} singles={singles.filter((s) => s.meta.from === p.id)} styleChosen={styleChosen} busy={busy} send={send} sheetId={item.id} />
      ))}
      {styleChosen && (
        <div className="space-y-1">
          <button className="btn btn-primary w-full" disabled={busy || !picked || sheetMaking} onClick={() => send({ action: "convert_sheet", sheetId: item.id, count: SHEETS })}>
            {sheetMaking ? "شيته يتولد…" : `🎬 اصنع الشيت من المختارة (${picked}) ×${SHEETS} · ${credits(SHEET_USD * SHEETS, "image")}`}
          </button>
          {!picked && <p className="text-xs font-bold text-muted">اختر صورة فردية وحدة على الأقل (الأقرب لوجهه). وحدة تكفي، وأكثر من وحدة يثبّت الشبه.</p>}
          {picked > 0 && <p className="text-xs font-bold text-muted">الشيت يطلع تحت مع باقي الشيتات: اعتمده هناك، أو «ما عجبني» واكتب وش تبي.</p>}
        </div>
      )}
    </div>
  );

  return (
    <article className={`card space-y-2 p-4 ${sheetDone ? "" : "border-2 border-gold"}`}>
      {sheetDone ? (
        <details>
          <summary className="cursor-pointer font-extrabold">🔄 {item.name}: من صوره الواقعية ✅ (شيته معتمد)</summary>
          <div className="mt-2">{body}</div>
        </details>
      ) : (
        <>
          <h3 className="font-extrabold">🔄 {item.name}: من صوره الواقعية إلى ستايل الفيلم</h3>
          {body}
        </>
      )}
    </article>
  );
}

function PhotoRow({ n, photo, singles, styleChosen, busy, send, sheetId }: { n: number; photo: CardAsset; singles: CardAsset[]; styleChosen: boolean; busy: boolean; send: Send; sheetId: string }) {
  const state = String(photo.meta.likeness_state ?? "");
  const described = Boolean(photo.meta.likeness);
  const drawing = singles.some((s) => s.status === "generating");
  const shown = [...singles].reverse();
  return (
    <div className="space-y-2 rounded-2xl border border-line p-2">
      <div className="flex gap-2">
        <figure className="w-20 shrink-0 space-y-1">
          {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
          {photo.url && <img src={photo.url} alt={`الصورة الواقعية ${n}`} className="aspect-[3/4] w-full rounded-lg object-cover" />}
          <figcaption className="text-center text-[11px] font-extrabold text-muted">الواقعية {n}</figcaption>
        </figure>
        <div className="grid flex-1 grid-cols-3 gap-1.5">
          {state === "running" && !shown.length && (
            <div className="col-span-3 grid place-items-center gap-1 rounded-lg bg-surface-2 p-3 text-xs font-bold"><Spinner /> نكتب ملامحه من الصورة…</div>
          )}
          {shown.map((s) => (
            <figure key={s.id} className="space-y-1">
              {s.status === "generating" ? (
                <div className="grid aspect-[3/4] place-items-center rounded-lg bg-surface-2"><Spinner /></div>
              ) : s.status === "failed" ? (
                <p className="grid aspect-[3/4] place-items-center rounded-lg bg-surface-2 p-1 text-center text-[10px] font-bold text-red-500">فشلت: {s.error}</p>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
                <a href={s.url} target="_blank" rel="noopener"><img src={s.url} alt="" className={`aspect-[3/4] w-full rounded-lg object-cover ${s.status === "approved" ? "ring-4 ring-teal" : ""}`} /></a>
              )}
              {s.url && s.status !== "generating" && s.status !== "failed" && (
                <button className={`w-full rounded-md py-1 text-[11px] font-extrabold ${s.status === "approved" ? "bg-teal text-white" : "border border-line"}`} disabled={busy} onClick={() => send({ action: "convert_pick", assetId: s.id })}>
                  {s.status === "approved" ? "مختارة ✅" : "الأقرب لوجهه"}
                </button>
              )}
            </figure>
          ))}
        </div>
      </div>
      {state === "failed" && <p className="error-box text-xs">ما انكتبت الملامح: {String(photo.meta.likeness_error ?? "")}. ما انحسبت تكلفة.</p>}
      {styleChosen && (
        <div className="flex flex-wrap gap-1.5">
          {!described && state !== "running" && (
            <button className="btn btn-secondary min-h-9 flex-1 px-2 text-xs" disabled={busy} onClick={() => send({ action: "convert_start", sheetId, uploadIds: [photo.id] })}>
              {state === "failed" ? "🔁 أعد المحاولة" : `🔄 حوّل هذي الصورة · ${credits(PORTRAIT_USD * PER_PHOTO, "image")}`}
            </button>
          )}
          {described && (
            <>
              <button className="btn btn-ghost min-h-9 flex-1 px-2 text-xs" disabled={busy || drawing} onClick={() => send({ action: "convert_portraits", uploadId: photo.id, count: PER_PHOTO })}>
                🔁 {PER_PHOTO} محاولات ثانية · {credits(PORTRAIT_USD * PER_PHOTO, "image")}
              </button>
              <button className="btn btn-ghost min-h-9 flex-1 px-2 text-xs" disabled={busy || drawing} onClick={() => send({ action: "convert_portraits", uploadId: photo.id, count: PER_PHOTO, stylize: true })} title="يزيد على نص الستايل: fully animated, more stylized">
                🎨 طلعت شبه واقعية؟ أكثر كرتونية
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
