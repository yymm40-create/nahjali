"use client";

import { useCallback, useEffect, useState } from "react";
import { api, postJson } from "@/lib/fetch";
import { putWithProgress } from "@/components/jawad/studio/upload";
import { COURSE, PRODUCT_LABEL, waLink, type CourseSettings, type Day } from "@config/course";

interface Order {
  id: string;
  email: string;
  name: string;
  phone: string;
  product: "combo" | "live" | "recorded";
  amount: number;
  was: number;
  bonus: number;
  status: "started" | "transferred" | "confirmed" | "rejected";
  transferredAt: string | null;
  createdAt: string;
  bonusGrantedAt: string | null;
}
interface Data {
  settings: CourseSettings;
  now: number;
  phase: "soon" | "A" | "B" | "C";
  orders: Order[];
  telegram: { token: boolean; chat: boolean; ready: boolean };
}
const URL = "/api/course/admin";
const PHASE: Record<Data["phase"], string> = { soon: "لم يبدأ", A: "المرحلة الأولى (أول يوم)", B: "المرحلة الثانية", C: "المرحلة الثالثة (الأخيرة)" };
const STATUS: Record<Order["status"], string> = { started: "بدأ ولم يحوّل", transferred: "ضغط تم التحويل", confirmed: "مؤكد ✅", rejected: "مرفوض ❌" };

const daysToText = (d: Day[]) => d.map((x) => [x.title, ...x.points.map((p) => `- ${p}`)].join("\n")).join("\n\n");
const textToDays = (t: string): Day[] =>
  t.split(/\n\s*\n/).map((b) => {
    const lines = b.split("\n").map((l) => l.trim()).filter(Boolean);
    return { title: lines[0] ?? "", points: lines.slice(1).map((l) => l.replace(/^[-•*]\s*/, "")) };
  }).filter((d) => d.title);
const local = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date(iso).getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : "");

function Num({ label, value, onChange, hint }: { label: string; value: number; onChange: (n: number) => void; hint?: string }) {
  return (
    <label className="grid gap-1 text-sm font-bold">
      {label}
      <input className="field" dir="ltr" inputMode="numeric" value={value} onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, "")) || 0)} />
      {hint && <span className="text-xs font-bold text-muted">{hint}</span>}
    </label>
  );
}
function Txt({ label, value, onChange, rows, ltr, ph }: { label: string; value: string; onChange: (s: string) => void; rows?: number; ltr?: boolean; ph?: string }) {
  return (
    <label className="grid gap-1 text-sm font-bold">
      {label}
      {rows ? <textarea className="field" rows={rows} dir={ltr ? "ltr" : "auto"} value={value} placeholder={ph} onChange={(e) => onChange(e.target.value)} /> : <input className="field" dir={ltr ? "ltr" : "auto"} value={value} placeholder={ph} onChange={(e) => onChange(e.target.value)} />}
    </label>
  );
}

/** The owner's view of «دورة الجواد»: the clock, the prices, the words, the video, the bank, Telegram, and the orders. */
export default function CourseAdmin() {
  const [d, setD] = useState<Data | null>(null);
  const [s, setS] = useState<CourseSettings | null>(null);
  const [daysText, setDaysText] = useState("");
  const [risksText, setRisksText] = useState("");
  const [filter, setFilter] = useState<"" | Order["status"]>("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [up, setUp] = useState("");

  const load = useCallback(async (keepForm = true) => {
    try {
      const r = await api<Data>(`${URL}${filter ? `?status=${filter}` : ""}`);
      setD(r);
      if (!keepForm) {
        setS(r.settings);
        setDaysText(daysToText(r.settings.days));
        setRisksText(r.settings.risks.join("\n"));
      }
      setErr("");
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [filter]);
  useEffect(() => {
    let on = true;
    api<Data>(URL)
      .then((r) => { if (on) { setD(r); setS(r.settings); setDaysText(daysToText(r.settings.days)); setRisksText(r.settings.risks.join("\n")); } })
      .catch((e) => on && setErr((e as Error).message));
    return () => { on = false; };
  }, []);
  // new orders show up without pressing anything
  useEffect(() => {
    const t = setInterval(() => void load(true), 20_000);
    return () => clearInterval(t);
  }, [load]);

  async function act(body: Record<string, unknown>, done = "تم ✅") {
    setErr("");
    setMsg("");
    try {
      const r = await postJson<{ settings?: CourseSettings; bot?: string; url?: string; already?: boolean }>(URL, body);
      if (r.settings) {
        setS(r.settings);
        setDaysText(daysToText(r.settings.days));
        setRisksText(r.settings.risks.join("\n"));
      }
      setMsg(r.bot ? `${done} البوت: @${r.bot}` : r.already ? "كان مؤكدًا من قبل." : done);
      await load(true);
    } catch (e) {
      setErr((e as Error).message);
    }
  }
  async function upload(which: "video" | "poster", file: File) {
    setErr("");
    setUp(which === "video" ? "أرفع الفيديو…" : "أرفع الغلاف…");
    try {
      const signed = await postJson<{ path: string; signedUrl: string }>(URL, { action: "sign", purpose: which === "video" ? "course_video" : "course_poster", mime: file.type, bytes: file.size });
      await putWithProgress(signed.signedUrl, file, file.type, (p) => setUp(`أرفع… ${Math.round(p * 100)}٪`));
      await act({ action: "file", which, path: signed.path }, which === "video" ? "انرفع الفيديو ✅" : "انرفع الغلاف ✅");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setUp("");
    }
  }

  if (!d || !s) return <p className="text-sm font-bold text-muted">{err || "…"}</p>;
  const set = <K extends keyof CourseSettings>(k: K, v: CourseSettings[K]) => setS({ ...s, [k]: v });
  const save = () => act({ action: "save", settings: { ...s, days: textToDays(daysText), risks: risksText.split("\n").map((x) => x.trim()).filter(Boolean) } }, "انحفظت الإعدادات ✅");
  const waiting = d.orders.filter((o) => o.status === "transferred").length;

  return (
    <div className="space-y-6">
      {err && <p className="error-box">{err}</p>}
      {msg && <p className="text-sm font-bold text-teal">{msg}</p>}

      <section className="card space-y-3 p-4">
        <h2 className="text-xl font-extrabold">⏱️ ساعة الأسعار</h2>
        <p className="text-sm font-bold text-muted">الأسعار تتغير حسب الساعات من نزول الريل. اضغط الزر لحظة ما تنزّل الريل، فتبدأ أول ٢٤ ساعة (الدورة كاملة بسعر واحد).</p>
        <p className="font-extrabold">الحالة الآن: {PHASE[d.phase]}{s.launchAt ? ` · بدأت ${new Date(s.launchAt).toLocaleString("ar-SA-u-ca-gregory-nu-latn", { dateStyle: "short", timeStyle: "short" })}` : ""}</p>
        <div className="flex flex-wrap items-end gap-2">
          <button type="button" className="btn btn-primary" onClick={() => window.confirm("نزل الريل الحين؟ تبدأ الساعة من هذي اللحظة.") && void act({ action: "start_now" }, "بدأت الساعة ▶️")}>▶️ نزل الريل الآن</button>
          <label className="grid gap-1 text-sm font-bold">أو وقت محدد<input className="field" type="datetime-local" value={local(s.launchAt)} onChange={(e) => set("launchAt", e.target.value ? new Date(e.target.value).toISOString() : null)} /></label>
          <button type="button" className="btn btn-ghost" onClick={() => window.confirm("نوقف الساعة؟ الصفحة ترجع «قريبًا».") && void act({ action: "stop" }, "أوقفت الساعة")}>⏹️ أوقف</button>
        </div>
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="text-xl font-extrabold">💰 الأسعار والهدية (بالريال)</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Num label="أول يوم: الدورة كاملة" value={s.prices.comboA} onChange={(n) => set("prices", { ...s.prices, comboA: n })} hint="مباشرة + مسجلة" />
          <Num label="اليوم الثاني: المباشرة" value={s.prices.liveB} onChange={(n) => set("prices", { ...s.prices, liveB: n })} />
          <Num label="اليوم الثاني: المسجلة" value={s.prices.recordedB} onChange={(n) => set("prices", { ...s.prices, recordedB: n })} />
          <Num label="بعدها: المباشرة" value={s.prices.liveC} onChange={(n) => set("prices", { ...s.prices, liveC: n })} />
          <Num label="بعدها: المسجلة" value={s.prices.recordedC} onChange={(n) => set("prices", { ...s.prices, recordedC: n })} />
          <span />
          <Num label="سعرها الأصلي: المباشرة" value={s.was.live} onChange={(n) => set("was", { ...s.was, live: n })} hint="يظهر مشطوبًا" />
          <Num label="سعرها الأصلي: المسجلة" value={s.was.recorded} onChange={(n) => set("was", { ...s.was, recorded: n })} />
          <span />
          <Num label="تنتهي المرحلة الأولى بعد (ساعة)" value={s.hoursA} onChange={(n) => set("hoursA", n)} />
          <Num label="تنتهي الثانية بعد (ساعة)" value={s.hoursB} onChange={(n) => set("hoursB", n)} />
        </div>
        <h3 className="font-extrabold">🌸 هدية الزهرات (١ زهرة = ١ ريال رصيد مجاني في الجواد، تنضاف تلقائيًا عند التأكيد)</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Num label="مع الدورة كاملة (أول يوم)" value={s.bonus.comboA} onChange={(n) => set("bonus", { ...s.bonus, comboA: n })} hint="٠ = بدون هدية" />
          <Num label="مع المسجلة (المرحلة ٢)" value={s.bonus.recordedB} onChange={(n) => set("bonus", { ...s.bonus, recordedB: n })} />
          <Num label="مع المسجلة (المرحلة ٣)" value={s.bonus.recordedC} onChange={(n) => set("bonus", { ...s.bonus, recordedC: n })} />
        </div>
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="text-xl font-extrabold">📝 كلام الصفحة</h2>
        <Txt label="العنوان الكبير (النتيجة اللي يشتريها)" value={s.headline} onChange={(v) => set("headline", v)} rows={2} />
        <Txt label="سطر تحته" value={s.subhead} onChange={(v) => set("subhead", v)} rows={2} />
        <Txt label="المشكلة اللي يعاني منها" value={s.problem} onChange={(v) => set("problem", v)} rows={3} />
        <Txt label="الأيام (عنوان اليوم في سطر، ونقاطه تحته تبدأ بـ -، وسطر فاضي بين كل يوم ويوم)" value={daysText} onChange={setDaysText} rows={10} />
        <Txt label="اللي يطمّنه (كل سطر نقطة)" value={risksText} onChange={setRisksText} rows={4} />
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="text-xl font-extrabold">🎬 مقطع الدورة</h2>
        <p className="text-sm font-bold text-muted">ارفع الريل نفسه (mp4 حتى ١٥٠ ميجا)، أو الصق رابط يوتيوب أو إنستغرام ريل.</p>
        <div className="flex flex-wrap items-center gap-2">
          <label className="btn btn-ghost cursor-pointer">⬆️ ارفع الفيديو<input type="file" accept="video/mp4" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload("video", f); e.target.value = ""; }} /></label>
          <label className="btn btn-ghost cursor-pointer">🖼️ غلاف (اختياري)<input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload("poster", f); e.target.value = ""; }} /></label>
          {s.videoPath && <button type="button" className="btn btn-ghost" onClick={() => void act({ action: "file", which: "video", path: null }, "انحذف الفيديو")}>احذف الفيديو المرفوع</button>}
          {up && <span className="text-sm font-bold">{up}</span>}
        </div>
        <p className="text-xs font-bold text-muted">{s.videoPath ? "✅ فيه فيديو مرفوع (يُقدَّم على الرابط)." : "ما فيه فيديو مرفوع."}</p>
        <Txt label="أو رابط (يوتيوب / إنستغرام / mp4)" value={s.videoUrl} onChange={(v) => set("videoUrl", v)} ltr ph="https://www.instagram.com/reel/…" />
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="text-xl font-extrabold">🏦 بيانات التحويل (تظهر للمشتري بعد «ادفع الآن»)</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Txt label="اسم صاحب الحساب" value={s.bank.holder} onChange={(v) => set("bank", { ...s.bank, holder: v })} />
          <Txt label="البنك" value={s.bank.bank} onChange={(v) => set("bank", { ...s.bank, bank: v })} />
          <Txt label="رقم الآيبان" value={s.bank.iban} onChange={(v) => set("bank", { ...s.bank, iban: v })} ltr ph="SA…" />
          <Txt label="رقم الحساب" value={s.bank.account} onChange={(v) => set("bank", { ...s.bank, account: v })} ltr />
          <Txt label="رمز السويفت" value={s.bank.swift} onChange={(v) => set("bank", { ...s.bank, swift: v })} ltr />
        </div>
        <h3 className="font-extrabold">🔗 روابط تظهر لمن يتأكد دفعه فقط</h3>
        <Txt label="رابط مجموعة الدورة (واتساب أو تيليجرام)" value={s.groupLink} onChange={(v) => set("groupLink", v)} ltr ph="https://chat.whatsapp.com/…" />
        <Txt label="رابط الدورة المسجلة (لمن اشترى المسجلة)" value={s.recordedLink} onChange={(v) => set("recordedLink", v)} ltr />
      </section>

      <div className="sticky bottom-3 z-10"><button type="button" className="btn btn-primary w-full" onClick={() => void save()}>💾 احفظ كل الإعدادات</button></div>

      <section className="card space-y-3 p-4">
        <h2 className="text-xl font-extrabold">📲 إشعار تيليجرام (عشان يوصلك التحويل)</h2>
        <p className="text-sm font-bold text-muted">لما أحد يضغط «تم التحويل» يوصلك على جوالك رسالة فيها اسمه وجواله وإيميله، وفيها أزرار: ✅ أكّد الدفع (يفتح له الصفحة ويضيف الهدية)، ❌ ارفض، 💬 واتساب (رسالة جاهزة فيها رابط المجموعة).</p>
        <ol className="list-decimal space-y-1 ps-5 text-sm font-bold">
          <li className={d.telegram.token ? "text-teal" : ""}>{d.telegram.token ? "✅" : "١."} في تيليجرام افتح <span dir="ltr">@BotFather</span> وأرسل <span dir="ltr">/newbot</span>، وانسخ الرمز اللي يعطيك.</li>
          <li>في Vercel أضف <span dir="ltr">TELEGRAM_BOT_TOKEN</span> بالرمز ثم أعد النشر. (لا ترسله لأحد.)</li>
          <li>اضغط «اربط البوت» تحت، ثم افتح البوت في تيليجرام وأرسل له <span dir="ltr">/start</span>: يرد عليك برقم محادثتك.</li>
          <li className={d.telegram.chat ? "text-teal" : ""}>{d.telegram.chat ? "✅" : ""} أضف الرقم في Vercel باسم <span dir="ltr">TELEGRAM_CHAT_ID</span> وأعد النشر، ثم اضغط «جرّب رسالة».</li>
        </ol>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-ghost" disabled={!d.telegram.token} onClick={() => void act({ action: "telegram_setup" }, "انربط البوت ✅")}>🔗 اربط البوت</button>
          <button type="button" className="btn btn-ghost" disabled={!d.telegram.ready} onClick={() => void act({ action: "telegram_test" }, "انرسلت رسالة التجربة ✅")}>جرّب رسالة</button>
        </div>
      </section>

      <section className="card space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-extrabold">🧾 الطلبات {waiting > 0 && <span className="chip bg-gold text-on-gold">{waiting} تنتظر تأكيدك</span>}</h2>
          <select className="field w-auto" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} aria-label="فلتر الحالة">
            <option value="">كل الطلبات</option>
            {(Object.keys(STATUS) as Order["status"][]).map((k) => <option key={k} value={k}>{STATUS[k]}</option>)}
          </select>
        </div>
        {!d.orders.length && <p className="text-sm font-bold text-muted">ما فيه طلبات.</p>}
        <ul className="space-y-2">
          {d.orders.map((o) => (
            <li key={o.id} className="space-y-1 rounded-2xl border border-line p-3 text-sm font-bold">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <b>{o.name || "—"}</b>
                <span className="chip">{STATUS[o.status]}</span>
              </div>
              <p dir="ltr" className="text-start text-muted">{o.phone} · {o.email}</p>
              <p>{PRODUCT_LABEL[o.product]} — <b>{o.amount} ريال</b>{o.was > o.amount ? ` (قيمتها ${o.was})` : ""}{o.bonus ? ` + ${o.bonus} زهرة${o.bonusGrantedAt ? " (انضافت)" : ""}` : ""}</p>
              <p className="text-xs text-muted">{new Date(o.transferredAt ?? o.createdAt).toLocaleString("ar-SA-u-ca-gregory-nu-latn", { dateStyle: "short", timeStyle: "short" })}</p>
              <div className="flex flex-wrap gap-2 pt-1">
                {o.status !== "confirmed" && <button type="button" className="btn btn-primary min-h-9 px-3 text-xs" onClick={() => window.confirm(`تأكيد دفع ${o.name} (${o.amount} ريال)؟`) && void act({ action: "confirm", id: o.id }, "تم التأكيد ✅")}>✅ أكّد</button>}
                {(o.status === "started" || o.status === "transferred") && <button type="button" className="btn btn-ghost min-h-9 px-3 text-xs" onClick={() => window.confirm("نرفض هذا الطلب؟") && void act({ action: "reject", id: o.id }, "تم الرفض")}>❌ ارفض</button>}
                {o.phone && <a className="btn btn-ghost min-h-9 px-3 text-xs" target="_blank" rel="noreferrer" href={waLink(o.phone, o.status === "confirmed" ? `هلا ${o.name} 🌸 تم تأكيد اشتراكك في ${COURSE.name} ✅${s.groupLink ? `\nرابط المجموعة: ${s.groupLink}` : ""}` : `هلا ${o.name}، وصلنا طلبك لـ${COURSE.name}.`)}>💬 واتساب</a>}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
