"use client";

// «كتيب الجداول الذكي» — the branch's page: who the booklet is for (a child or a grown-up, boy or girl, the age and the
// name), then the ready booklet (the original kids' booklet with the child's picture) or tables designed with «نور»,
// her summary with the price and «📘 اصنع الكتيب», and the person's booklets and conversations. The look is booklet.css.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import ClaudeModelPicker from "@/components/robots/ClaudeModelPicker";
import { useClaudeModel } from "@/components/robots/claude-model";
import Riyal from "@/components/Riyal";
import QuickReplies from "@/components/jawad/QuickReplies";
import { api, postJson } from "@/lib/fetch";
import { splitOptions } from "@/lib/chat-options";
import { COLUMN_KINDS, MARKS, pagesOf, THEMES, TB, type Audience, type BookletSpec } from "@config/tables-booklet";
import { STYLES, type StyleKey } from "@config/styles";

interface Msg { role: "user" | "assistant"; text: string; error?: boolean }
interface ChatItem { id: string; title: string; orderId: string | null }
interface BookletItem { id: string; status: string; child_name: string | null; template_id: string; created_at: string }
interface Chat { id: string; audience: Audience | null; messages: Msg[]; spec: BookletSpec | null; orderId: string | null }
interface Price { halalas: number; free: boolean }
type View = "home" | "who" | "path" | "ready" | "chat";

const STATUS: Record<string, string> = {
  pending_payment: "بانتظار الدفع",
  paid: "بانتظار الصورة",
  generating_character: "يرسم الشخصية",
  awaiting_approval: "اختر الشخصية",
  generating_poses: "يرسم الصفحات",
  composing: "يجهّز الكتيب",
  ready: "جاهز ✅",
  failed: "تعطّل",
};

/** «نور»'s reply without the design block she writes for the site (the summary above it is what the person reads). */
const shown = (text: string) => text.replace(/```json[\s\S]*?(```|$)/g, "").trim();

const EMPTY: { kind: Audience["kind"] | ""; gender: Audience["gender"] | ""; age: string; name: string } = { kind: "", gender: "", age: "", name: "" };

export default function BookletHome({ loginHref, name }: { loginHref: string | null; name: string }) {
  const router = useRouter();
  const [model] = useClaudeModel();
  const [view, setView] = useState<View>("home");
  const [who, setWho] = useState(EMPTY);
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [booklets, setBooklets] = useState<BookletItem[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  // the ready booklet
  const [style, setStyle] = useState<StyleKey>("pixar");
  const [message, setMessage] = useState("");
  const [readyPrice, setReadyPrice] = useState<Price | null>(null);
  // the conversation with «نور»
  const [chat, setChat] = useState<Chat | null>(null);
  const [price, setPrice] = useState<Price | null>(null);
  const [draft, setDraft] = useState("");
  const box = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (loginHref) return;
    const r = await api<{ chats: ChatItem[]; booklets: BookletItem[] }>("/api/booklet/chats").catch((e: Error) => (setError(e.message), null));
    if (r) {
      setChats(r.chats);
      setBooklets(r.booklets.filter((b) => b.status !== "pending_payment"));
    }
  }, [loginHref]);
  useEffect(() => void load(), [load]);
  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth", block: "end" }), [chat?.messages.length, busy]);

  const age = Number(who.age);
  const ageOk = who.kind === "child" ? age >= 2 && age <= 17 : age >= 13 && age <= 100;
  const whoOk = !!who.kind && !!who.gender && ageOk && /^[\p{L}\p{M} ]{1,30}$/u.test(who.name.trim());
  const audience = whoOk ? { kind: who.kind, gender: who.gender, age, name: who.name.trim() } : null;

  const send = async (text: string, fresh?: boolean) => {
    const said = text.trim();
    if (!said || busy) return;
    setError("");
    setDraft("");
    const base = fresh ? null : chat;
    setChat({ id: base?.id ?? "", audience: base?.audience ?? (audience as Audience), messages: [...(base?.messages ?? []), { role: "user", text: said }], spec: base?.spec ?? null, orderId: base?.orderId ?? null });
    setBusy("chat");
    try {
      const r = await postJson<{ chat: Chat }>("/api/booklet/chat", { chatId: base?.id || null, audience, message: said, model: model.id });
      setChat(r.chat);
      if (r.chat.spec) setPrice((await api<{ price: Price | null }>(`/api/booklet/chats?id=${r.chat.id}`)).price);
      if (!base?.id) void load();
    } catch (e) {
      setChat((c) => (c ? { ...c, messages: [...c.messages, { role: "assistant", text: (e as Error).message, error: true }] } : c));
    } finally {
      setBusy("");
    }
  };

  const openChat = async (id: string) => {
    setError("");
    setBusy("open");
    try {
      const r = await api<{ chat: Chat; price: Price | null }>(`/api/booklet/chats?id=${id}`);
      setChat(r.chat);
      setPrice(r.price);
      setView("chat");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  const removeChat = async (id: string) => {
    if (!confirm("تحذف هذي المحادثة؟")) return;
    await api(`/api/booklet/chats?id=${id}`, { method: "DELETE" }).catch(() => null);
    void load();
  };

  const start = async (body: unknown) => {
    setError("");
    setBusy("start");
    try {
      const r = await postJson<{ id: string; next: string }>("/api/booklet/start", body);
      router.push(r.next);
    } catch (e) {
      setError((e as Error).message);
      setBusy("");
    }
  };

  const toReady = async () => {
    setView("ready");
    if (!readyPrice) setReadyPrice((await api<{ price: Price }>("/api/booklet/chats?ready=1").catch(() => null))?.price ?? null);
  };

  const toDesign = () => {
    setChat(null);
    setPrice(null);
    setView("chat");
    const a = audience!;
    const forWhom = a.kind === "child" ? `${a.gender === "female" ? "بنتي" : "ولدي"} ${a.name} (${a.age} سنة)` : `${a.gender === "female" ? "لي (امرأة)" : "لي"}، اسمي ${a.name} وعمري ${a.age}`;
    void send(`أبي أصمم كتيب جداول ${forWhom}. ساعديني خطوة بخطوة.`, true);
  };

  if (loginHref) {
    return (
      <div className="tb">
        <Hero name={name} />
        <div className="tb-card tb-center">
          <p>سجّل دخولك عشان تصنع كتيبك.</p>
          <Link href={loginHref} className="tb-btn tb-primary">تسجيل الدخول</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="tb">
      {view !== "chat" && <Hero name={name} />}
      {error && <p className="tb-error" role="alert">{error}</p>}

      {view === "home" && (
        <>
          <button type="button" className="tb-btn tb-primary tb-big" onClick={() => setView("who")}>📘 اصنع كتيب جديد</button>
          {booklets.length > 0 && (
            <section className="tb-card">
              <h2>كتيباتي</h2>
              <ul className="tb-list">
                {booklets.map((b) => (
                  <li key={b.id}>
                    <Link href={`${TB.base}/${b.id}`}>
                      <b>{b.template_id === TB.customTemplate ? "📘" : "🌟"} كتيب {b.child_name || ""}</b>
                      <span>{STATUS[b.status] ?? b.status}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {chats.length > 0 && (
            <section className="tb-card">
              <h2>تصاميمي مع {TB.robot}</h2>
              <ul className="tb-list">
                {chats.map((c) => (
                  <li key={c.id}>
                    <button type="button" onClick={() => void openChat(c.id)} disabled={!!busy}>
                      <b>💬 {c.title}</b>
                      <span>{c.orderId ? "انصنع منه كتيب" : "كمّل التصميم"}</span>
                    </button>
                    <button type="button" className="tb-x" aria-label="حذف" onClick={() => void removeChat(c.id)}>✕</button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {view === "who" && (
        <section className="tb-card">
          <h2>الكتيب لمين؟</h2>
          <div className="tb-choices">
            <Choice on={who.kind === "child"} onClick={() => setWho({ ...who, kind: "child" })} ic="🧒" t="طفل" d="ولد أو بنت" />
            <Choice on={who.kind === "adult"} onClick={() => setWho({ ...who, kind: "adult" })} ic="🧑" t="شخص كبير" d="لك أنت أو لغيرك" />
          </div>
          {who.kind && (
            <>
              <div className="tb-choices">
                <Choice on={who.gender === "male"} onClick={() => setWho({ ...who, gender: "male" })} ic={who.kind === "child" ? "👦" : "👨"} t={who.kind === "child" ? "ولد" : "رجل"} />
                <Choice on={who.gender === "female"} onClick={() => setWho({ ...who, gender: "female" })} ic={who.kind === "child" ? "👧" : "🧕"} t={who.kind === "child" ? "بنت" : "امرأة"} />
              </div>
              <div className="tb-fields">
                <label>
                  الاسم
                  <input value={who.name} maxLength={30} onChange={(e) => setWho({ ...who, name: e.target.value })} placeholder="مثلًا: زينب" />
                </label>
                <label>
                  العمر
                  <input value={who.age} inputMode="numeric" maxLength={3} onChange={(e) => setWho({ ...who, age: e.target.value.replace(/[^0-9٠-٩]/g, "").replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))) })} placeholder={who.kind === "child" ? "٢ – ١٧" : "١٣ فما فوق"} />
                </label>
              </div>
              {who.age && !ageOk && <p className="tb-hint">{who.kind === "child" ? "عمر الطفل من ٢ إلى ١٧." : "العمر من ١٣ فما فوق."}</p>}
            </>
          )}
          <div className="tb-row">
            <button type="button" className="tb-btn" onClick={() => setView("home")}>رجوع</button>
            <button type="button" className="tb-btn tb-primary" disabled={!whoOk} onClick={() => setView("path")}>التالي</button>
          </div>
        </section>
      )}

      {view === "path" && audience && (
        <section className="tb-card">
          <h2>كيف تبي كتيب {audience.name}؟</h2>
          <div className="tb-choices tb-col">
            {audience.kind === "child" && <Choice on={false} onClick={() => void toReady()} ic="🌟" t="الكتيب الجاهز" d="كتيب العادات الطيبة المجهّز للأطفال (١٦ صفحة)، نحط فيه صورة طفلك كشخصية كرتونية بس." />}
            <Choice on={false} onClick={toDesign} ic="🛠️" t={`أصمم جداولي مع ${TB.robot}`} d="تختار الجداول وش فيها وطريقة تقييمها (نجوم، صح، وجوه…) والألوان، ومع صورتك أو بدون." />
          </div>
          <div className="tb-row">
            <button type="button" className="tb-btn" onClick={() => setView("who")}>رجوع</button>
          </div>
        </section>
      )}

      {view === "ready" && audience && (
        <section className="tb-card">
          <h2>الكتيب الجاهز لـ{audience.name}</h2>
          <p className="tb-hint">اختر ستايل الرسم اللي تتحول له صورة طفلك:</p>
          <div className="tb-styles">
            {(Object.entries(STYLES) as [StyleKey, (typeof STYLES)[StyleKey]][]).map(([k, s]) => (
              <button key={k} type="button" className={`tb-style ${style === k ? "on" : ""}`} onClick={() => setStyle(k)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/styles/${k}.jpg`} alt="" />
                <b>{s.label}</b>
                <span>{s.description}</span>
              </button>
            ))}
          </div>
          <label className="tb-fields">
            رسالة منك لطفلك (اختياري)
            <input value={message} maxLength={140} onChange={(e) => setMessage(e.target.value)} placeholder="مثلًا: فخورين فيك يا بطل" />
          </label>
          <PriceLine price={readyPrice} />
          <div className="tb-row">
            <button type="button" className="tb-btn" onClick={() => setView("path")}>رجوع</button>
            <button type="button" className="tb-btn tb-primary" disabled={busy === "start"} onClick={() => void start({ kind: "ready", audience, style, message })}>
              {busy === "start" ? "لحظة…" : "📘 اصنع الكتيب"}
            </button>
          </div>
        </section>
      )}

      {view === "chat" && (
        <section className="tb-chat">
          <header className="tb-chat-top">
            <button type="button" className="tb-btn" onClick={() => (setView("home"), void load())}>→ كتيباتي</button>
            <b>💬 {TB.robot} · {chat?.audience ? `كتيب ${chat.audience.name}` : "كتيب جديد"}</b>
            <ClaudeModelPicker className="tb-claude" disabled={!!busy} />
          </header>
          <div className="tb-msgs">
            {(chat?.messages ?? []).map((m, i, all) => {
              const last = i === all.length - 1;
              const { body, options } = m.role === "assistant" && !m.error ? splitOptions(shown(m.text)) : { body: m.text, options: [] as string[] };
              return (
                <div key={i} className={`tb-msg ${m.role === "user" ? "me" : "noor"} ${m.error ? "err" : ""}`}>
                  {m.role === "assistant" && <i className="tb-av">🌸</i>}
                  <div>
                    <p>{body}</p>
                    {last && <QuickReplies cls="tb" options={options} disabled={!!busy} onPick={(o) => void send(o)} onWrite={() => box.current?.focus()} />}
                  </div>
                </div>
              );
            })}
            {busy === "chat" && <div className="tb-msg noor"><i className="tb-av">🌸</i><p className="tb-typing">{TB.robot} تكتب…</p></div>}
            <div ref={end} />
          </div>
          {chat?.spec && <Summary spec={chat.spec} price={price} done={chat.orderId} busy={busy === "start"} onMake={() => void start({ kind: "custom", chatId: chat.id })} />}
          <form className="tb-send" onSubmit={(e) => (e.preventDefault(), void send(draft))}>
            <textarea ref={box} value={draft} rows={2} maxLength={TB.messageMax} placeholder={`اكتب لـ${TB.robot}…`} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(draft); } }} />
            <button type="submit" className="tb-btn tb-primary" disabled={!!busy || !draft.trim() || !chat?.audience && !audience}>إرسال</button>
          </form>
        </section>
      )}
    </div>
  );
}

function Hero({ name }: { name: string }) {
  return (
    <header className="tb-hero">
      <span className="tb-hero-ic">📘</span>
      <h1>{name}</h1>
      <p>كتيب جداول مطبوع يتابع فيه طفلك (أو أنت) عاداته ومهامه: نجوم وصح ومكافآت، بصورته كشخصية كرتونية أو بدون.</p>
    </header>
  );
}

function Choice({ on, onClick, ic, t, d }: { on: boolean; onClick: () => void; ic: string; t: string; d?: string }) {
  return (
    <button type="button" className={`tb-choice ${on ? "on" : ""}`} onClick={onClick} aria-pressed={on}>
      <i>{ic}</i>
      <b>{t}</b>
      {d && <span>{d}</span>}
    </button>
  );
}

function PriceLine({ price }: { price: Price | null }) {
  if (!price) return <p className="tb-price">…</p>;
  return (
    <p className="tb-price">
      السعر: {price.free || price.halalas === 0 ? <b>مجاني</b> : <Riyal halalas={price.halalas} size={16} />}
      <small> (يُخصم من رصيدك)</small>
    </p>
  );
}

/** «نور»'s design as the person will get it, with its price and «📘 اصنع الكتيب». */
function Summary({ spec, price, done, busy, onMake }: { spec: BookletSpec; price: Price | null; done: string | null; busy: boolean; onMake: () => void }) {
  return (
    <aside className="tb-summary" style={{ ["--tb-theme" as string]: THEMES[spec.theme].accent }}>
      <h3>📘 {spec.title}</h3>
      <ul>
        {spec.tables.map((t, i) => (
          <li key={i}>
            <b>{t.title}</b> · {t.rows.length} بنود · {COLUMN_KINDS[t.columns].label} · {MARKS[t.mark]}
            {t.copies > 1 ? ` · ${t.copies} صفحات` : ""}
          </li>
        ))}
      </ul>
      <p>
        {pagesOf(spec)} صفحة · {THEMES[spec.theme].label} · {spec.photo ? `بالصورة (${STYLES[spec.style].label})` : "بدون صورة"}
        {spec.rewards.length ? " · صفحة مكافآت" : ""}
        {spec.certificate ? " · شهادة إنجاز" : ""}
      </p>
      <PriceLine price={price} />
      {done ? (
        <Link href={`${TB.base}/${done}`} className="tb-btn tb-primary">افتح الكتيب</Link>
      ) : (
        <button type="button" className="tb-btn tb-primary" disabled={busy} onClick={onMake}>{busy ? "لحظة…" : "📘 اصنع الكتيب"}</button>
      )}
    </aside>
  );
}
