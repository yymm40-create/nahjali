"use client";

// «الجولة التعريفية» — a ring in the header that shows how much of the tour is done; it opens the tour. The tour opens
// by itself the first time a signed-in person comes in, can be skipped («تخطَّ الآن»), and is always there from the
// ring. Progress is kept on this device per account. Content: config/jawad/tour.ts.

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { TOUR_ASK, TOUR_DONE, TOUR_PATHS, TOUR_TRY, TOUR_TRY_MAX, TOUR_WELCOME, tourProgress, type TourAnswers, type TourPath } from "@config/jawad/tour";

type Page = "welcome" | "ask" | "try" | "paths" | TourPath["id"] | "done";
interface Saved {
  done: string[];
  path: TourPath["id"] | null;
  seen: boolean;
  /** the person's free image, made small (a JPEG data URL) */
  image?: string;
}
const keyOf = (uid: string) => `jw-tour:${uid}`;
const EMPTY: Saved = { done: [], path: null, seen: false };

async function small(dataUrl: string): Promise<string> {
  const img = new window.Image();
  img.src = dataUrl;
  await img.decode();
  const s = Math.min(1, 480 / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * s);
  c.height = Math.round(img.height * s);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.82);
}

function Ring({ p }: { p: number }) {
  const r = 14,
    len = 2 * Math.PI * r;
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden>
      <circle cx="17" cy="17" r={r} fill="none" stroke="currentColor" strokeOpacity="0.18" strokeWidth="3.5" />
      <circle cx="17" cy="17" r={r} fill="none" stroke="var(--jw-accent)" strokeWidth="3.5" strokeLinecap="round" strokeDasharray={len} strokeDashoffset={len * (1 - p)} transform="rotate(-90 17 17)" />
      <text x="17" y="21" textAnchor="middle" fontSize="10" fontWeight="700" fill="currentColor">{Math.round(p * 100)}</text>
    </svg>
  );
}

export default function Tour({ userId }: { userId: string }) {
  const [s, setS] = useState<Saved>(EMPTY);
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState<Page>("welcome");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [answers, setAnswers] = useState<TourAnswers>({});
  const [words, setWords] = useState("");
  const pick = (id: keyof TourAnswers, v: string, multi: boolean) =>
    setAnswers((a) => {
      const cur = a[id] ?? [];
      return { ...a, [id]: multi ? (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]) : [v] };
    });
  async function sendAnswers() {
    mark("welcome", "ask");
    go("try");
    await fetch("/api/jawad/tour/interests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers, words }) }).catch(() => {});
  }

  useEffect(() => {
    queueMicrotask(() => {
      let got = EMPTY;
      try {
        got = { ...EMPTY, ...(JSON.parse(localStorage.getItem(keyOf(userId)) ?? "null") as Saved | null) };
      } catch {
        /* a fresh start */
      }
      setS(got);
      setImage(got.image ?? null);
      // the first visit after signing in: the tour opens by itself
      if (!got.seen) setOpen(true);
    });
  }, [userId]);
  const save = (next: Saved) => {
    setS(next);
    try {
      localStorage.setItem(keyOf(userId), JSON.stringify(next));
    } catch {
      /* kept for this visit only */
    }
  };
  const mark = (...ids: string[]) => save({ ...s, seen: true, done: [...new Set([...s.done, ...ids])] });
  const close = () => {
    save({ ...s, seen: true });
    setOpen(false);
  };
  const go = (p: Page) => {
    setError("");
    setPage(p);
  };
  const progress = tourProgress(s.done, s.path);

  async function tryIt() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/jawad/tour/try", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt }) });
      const body = (await res.json().catch(() => ({}))) as { image?: string; error?: string };
      if (!res.ok || !body.image) throw new Error(body.error ?? "تعذّر صنع الصورة الآن.");
      setImage(body.image);
      const thumb = await small(body.image).catch(() => undefined);
      save({ ...s, seen: true, image: thumb, done: [...new Set([...s.done, "welcome", "try"])] });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const path = TOUR_PATHS.find((p) => p.id === page);
  const done = (id: string) => s.done.includes(id);

  return (
    <>
      <button type="button" className="relative grid size-9 place-items-center rounded-full text-jw-text hover:bg-jw-surface-2" onClick={() => (setOpen(true), setPage(s.done.includes("try") ? (s.path ?? "paths") : "welcome"))} title={progress < 1 ? "الجولة التعريفية — لم تكتمل بعد" : "الجولة التعريفية"} aria-label={`الجولة التعريفية، مكتملة ${Math.round(progress * 100)}٪`}>
        <Ring p={progress} />
        {progress < 1 && <span className="absolute -end-0.5 -top-0.5 size-2.5 rounded-full bg-jw-accent" aria-hidden />}
      </button>

      {open && (
        <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/60 sm:items-center sm:p-6" role="dialog" aria-label="الجولة التعريفية" dir="rtl">
          <div className="jw-panel flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl">
            <header className="flex items-center gap-3 border-b border-jw-line px-4 py-3">
              <Ring p={progress} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">الجولة التعريفية: كيف تصنع فيلمًا من الصفر</p>
                <p className="text-xs text-jw-muted">تقدر تتخطاها الآن وترجع لها متى شئت من الدائرة أعلى الصفحة.</p>
              </div>
              <button type="button" className="jw-btn !min-h-9 text-xs" onClick={close}>
                تخطَّ الآن
              </button>
            </header>

            <div className="jw-scroll min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
              {page === "welcome" && (
                <>
                  <div className="grid grid-cols-4 gap-2">
                    {TOUR_WELCOME.images.map((src) => (
                      <Image key={src} src={src} alt="" width={240} height={135} className="aspect-video w-full rounded-lg object-cover" />
                    ))}
                  </div>
                  <h2 className="text-xl font-black">{TOUR_WELCOME.title}</h2>
                  <p className="leading-8">{TOUR_WELCOME.body}</p>
                  <ul className="space-y-1.5 text-sm">
                    {TOUR_WELCOME.points.map((p) => (
                      <li key={p}>✅ {p}</li>
                    ))}
                  </ul>
                  <button type="button" className="jw-btn jw-btn-primary !min-h-11" onClick={() => (mark("welcome"), go("ask"))}>
                    لنبدأ ←
                  </button>
                </>
              )}

              {page === "ask" && (
                <>
                  <div className="flex items-center gap-3">
                    <span className="grid size-12 place-items-center rounded-full bg-jw-accent text-2xl text-[var(--jw-on-accent)]" aria-hidden>✨</span>
                    <h2 className="text-xl font-black">{TOUR_ASK.title}</h2>
                  </div>
                  <p className="leading-8">{TOUR_ASK.body}</p>
                  {TOUR_ASK.questions.map((q) => (
                    <fieldset key={q.id} className="space-y-2">
                      <legend className="font-bold">{q.q}{q.multi && <span className="text-xs font-normal text-jw-muted"> (يمكنك اختيار أكثر من واحد)</span>}</legend>
                      <div className="flex flex-wrap gap-2">
                        {q.options.map((o) => {
                          const on = (answers[q.id] ?? []).includes(o);
                          return (
                            <button key={o} type="button" aria-pressed={on} className={`rounded-full border px-3 py-1.5 text-sm ${on ? "border-jw-accent bg-jw-accent/15 font-bold" : "border-jw-line"}`} onClick={() => pick(q.id, o, q.multi)}>
                              {o}
                            </button>
                          );
                        })}
                      </div>
                    </fieldset>
                  ))}
                  <label className="block space-y-1">
                    <span className="font-bold">{TOUR_ASK.words}</span>
                    <input className="jw-input w-full" maxLength={120} value={words} onChange={(e) => setWords(e.target.value)} placeholder="مثال: قصص أطفال، إعلانات مطعم" dir="auto" />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="jw-btn jw-btn-primary !min-h-11" onClick={sendAnswers}>
                      التالي: صورتك الأولى ←
                    </button>
                    <button type="button" className="jw-btn" onClick={() => (mark("welcome", "ask"), go("try"))}>
                      تخطَّ الأسئلة
                    </button>
                  </div>
                </>
              )}

              {page === "try" && (
                <>
                  <h2 className="text-xl font-black">{TOUR_TRY.title}</h2>
                  <p className="leading-8">{TOUR_TRY.body}</p>
                  <ul className="flex flex-wrap gap-2 text-xs">
                    {TOUR_TRY.tips.map((t) => (
                      <li key={t} className="rounded-full bg-jw-surface-2 px-3 py-1">{t}</li>
                    ))}
                  </ul>
                  {image ? (
                    <div className="space-y-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={image} alt="صورتك الأولى" className="mx-auto max-h-80 rounded-xl" />
                      <p className="text-center font-bold text-jw-ok">هذه صورتك الأولى، صنعتها بوصفك.</p>
                      <button type="button" className="jw-btn jw-btn-primary !min-h-11 w-full" onClick={() => (mark("welcome", "try"), go("paths"))}>
                        التالي: كيف أحولها إلى فيلم؟ ←
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <textarea className="jw-textarea w-full" rows={3} maxLength={TOUR_TRY_MAX} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="مثال: طفل يقرأ كتابًا تحت شجرة نخيل عند الغروب…" disabled={busy} dir="auto" />
                      <div className="flex flex-wrap gap-1.5">
                        {TOUR_TRY.examples.map((x) => (
                          <button key={x} type="button" className="rounded-full border border-jw-line px-3 py-1 text-xs hover:bg-jw-surface-2" onClick={() => setPrompt(x)} disabled={busy}>
                            {x.slice(0, 34)}…
                          </button>
                        ))}
                      </div>
                      {error && <p className="text-sm text-jw-danger" role="alert">{error}</p>}
                      <div className="flex flex-wrap gap-2">
                        <button type="button" className="jw-btn jw-btn-primary !min-h-11" disabled={busy || prompt.trim().length < 8} onClick={tryIt}>
                          {busy ? <span className="jw-spinner !border-white/40 !border-t-white" aria-hidden /> : "🎨"} {busy ? "تُرسم صورتك الآن (دقيقة تقريبًا)…" : "اصنع صورتي المجانية"}
                        </button>
                        <button type="button" className="jw-btn" onClick={() => (mark("welcome"), go("paths"))} disabled={busy}>
                          لاحقًا
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {page === "paths" && (
                <>
                  <h2 className="text-xl font-black">من الصورة إلى الفيلم: اختر طريقك</h2>
                  <p className="leading-8">في الجواد الذكي طريقان لصناعة الفيلم. كلاهما يوصلك للنتيجة نفسها، والفرق في مقدار ما تتحكم به بنفسك.</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {TOUR_PATHS.map((p) => (
                      <button key={p.id} type="button" className={`overflow-hidden rounded-2xl border text-start hover:border-jw-accent ${s.path === p.id ? "border-jw-accent ring-2 ring-jw-accent/30" : "border-jw-line"}`} onClick={() => (save({ ...s, seen: true, path: p.id, done: [...new Set([...s.done, "path"])] }), go(p.id))}>
                        <Image src={p.image} alt="" width={480} height={270} className="aspect-video w-full object-cover" />
                        <span className="block space-y-1 p-3">
                          <b className="block">{p.title}</b>
                          <span className="block text-sm text-jw-muted">{p.lead}</span>
                          <span className="block text-xs text-jw-faint">{p.steps.length} خطوات</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {path && (
                <>
                  <h2 className="text-xl font-black">{path.title}</h2>
                  <p className="leading-8 text-jw-muted">{path.lead}</p>
                  <ol className="space-y-3">
                    {path.steps.map((st) => (
                      <li key={st.id} className={`flex gap-3 rounded-2xl border p-3 ${done(st.id) ? "border-jw-ok/50 bg-jw-ok/5" : "border-jw-line"}`}>
                        {st.image && <Image src={st.image} alt="" width={160} height={90} className="hidden aspect-video w-32 shrink-0 rounded-lg object-cover sm:block" />}
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <b className="block">{done(st.id) ? "✅ " : ""}{st.title}</b>
                          <p className="text-sm leading-7">{st.body}</p>
                          <div className="flex flex-wrap gap-2">
                            {st.href && (
                              <Link href={st.href} className="jw-btn jw-btn-primary !min-h-9 text-xs" onClick={() => (mark(st.id), setOpen(false))}>
                                {st.cta ?? "افتح"}
                              </Link>
                            )}
                            {!done(st.id) && (
                              <button type="button" className="jw-btn !min-h-9 text-xs" onClick={() => mark(st.id)}>
                                فهمت هذه الخطوة
                              </button>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="jw-btn" onClick={() => go("paths")}>
                      → الطريق الآخر
                    </button>
                    <button type="button" className="jw-btn jw-btn-primary" onClick={() => (mark(...path.steps.map((x) => x.id)), go("done"))}>
                      أنهيت الجولة
                    </button>
                  </div>
                </>
              )}

              {page === "done" && (
                <div className="space-y-3 text-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {image && <img src={image} alt="" className="mx-auto max-h-48 rounded-xl" />}
                  <h2 className="text-2xl font-black">🎉 {TOUR_DONE.title}</h2>
                  <p className="leading-8">{TOUR_DONE.body}</p>
                  <button type="button" className="jw-btn jw-btn-primary !min-h-11" onClick={close}>
                    ابدأ الآن
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
