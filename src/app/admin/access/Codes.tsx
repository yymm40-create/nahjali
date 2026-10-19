"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "@/lib/fetch";
import { codeOpen, codeWelcome, PERMS, type CodeRow, type CodeUse, type Perm } from "@config/access";
import { CLAUDE_MODELS, type ClaudeModelKey } from "@config/claude-models";
import Coined from "@/components/Coined";
import SmartCoin from "@/components/SmartCoin";
import Riyal from "@/components/Riyal";

interface Props {
  codes: CodeRow[];
  uses: CodeUse[];
  /** halalas each code's gift put in wallets so far (by code id) */
  gifted?: Record<string, number>;
}

/** Whether a code carries a gift (points, cost price, a Claude ceiling or Seedance 2.0 generations). */
const hasGift = (c: Pick<CodeRow, "giftSar" | "atCost" | "claudeModel" | "videoGens">) => c.giftSar > 0 || c.atCost || c.claudeModel !== null || c.videoGens !== null;

const fmt = (iso: string) => new Date(iso).toLocaleString("ar", { timeZone: "Asia/Riyadh", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const label = (p: Perm) => PERMS.find((x) => x.key === p)?.label ?? p;

/** The code's state now, in words. */
function state(c: CodeRow) {
  if (!c.enabled) return { text: "طافي", ok: false };
  if (c.expiresAt && new Date(c.expiresAt).getTime() <= Date.now()) return { text: "انتهى وقته", ok: false };
  return { text: "شغّال", ok: true };
}

/** «الأكواد»: many codes, each with its own sections and time, standing alone — none touches another. */
export default function Codes({ codes, uses, gifted = {} }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [perms, setPerms] = useState<Perm[]>([]);
  const [expires, setExpires] = useState("");
  const [hours, setHours] = useState("");
  const [people, setPeople] = useState("");
  const [free, setFree] = useState(false);
  // the gift: points in the wallet, everything at cost, the Claude ceiling, Seedance 2.0 generations
  const [giftSar, setGiftSar] = useState("");
  const [atCost, setAtCost] = useState(false);
  const [claudeModel, setClaudeModel] = useState<ClaudeModelKey | "">("");
  const [videoGens, setVideoGens] = useState("");

  async function send(body: Record<string, unknown>, done: string) {
    setBusy(true);
    setMsg(null);
    try {
      const r = await postJson<{ code?: string }>("/api/admin/access", body);
      setMsg({ ok: true, text: r.code ? `${done}: ${r.code}` : done });
      router.refresh();
      return true;
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "تعذّر الحفظ." });
      return false;
    } finally {
      setBusy(false);
    }
  }
  const toggle = (p: Perm) => setPerms((x) => (x.includes(p) ? x.filter((y) => y !== p) : [...x, p]));

  return (
    <section className="card space-y-4 p-4">
      <div className="space-y-1">
        <h2 className="text-xl font-extrabold">🎟️ الأكواد</h2>
        <p className="text-sm font-bold text-muted">
          كل كود مستقل: يفتح الأقسام اللي تعلّمها له بس، وله وقته، وتقدر تطفيه أو تحذفه لحاله. إطفاء كود أو انتهاؤه ما يمس أي كود ثاني ولا قائمة الإيميلات في «السماح». اللي يدخل أكثر من كود ينفتح له مجموع أقسامها.
          «🎮 صانع الألعاب» ما يفتحه إلا كود تعلّمه له بالاسم (أو إيميل في القائمة)، ولا يدخل في «الكود السري» القديم الشامل.
        </p>
      </div>

      <form
        className="space-y-3 rounded-2xl bg-surface-2 p-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const ok = await send(
            { action: "codes_new", label: name, code: text, perms, expiresAt: expires ? new Date(expires).toISOString() : null, validHours: hours || null, maxUses: people || null, unlimited: free, giftSar: giftSar || 0, atCost, claudeModel: claudeModel || null, videoGens: videoGens || null },
            "انسوى الكود",
          );
          if (ok) {
            setName("");
            setText("");
            setPerms([]);
            setExpires("");
            setHours("");
            setPeople("");
            setFree(false);
            setGiftSar("");
            setAtCost(false);
            setClaudeModel("");
            setVideoGens("");
          }
        }}
      >
        <h3 className="font-extrabold">كود جديد</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="اسمه (مثلًا: ضيوف الألعاب)" maxLength={80} aria-label="اسم الكود" />
          <input className="field" dir="ltr" value={text} onChange={(e) => setText(e.target.value)} placeholder="نصه (فاضي = أسوّيه لك)" maxLength={64} aria-label="نص الكود" />
        </div>
        <div>
          <p className="mb-1.5 text-sm font-bold">الأقسام اللي يفتحها:</p>
          <div className="flex flex-wrap gap-1.5">
            {PERMS.map((p) => (
              <button key={p.key} type="button" aria-pressed={perms.includes(p.key)} title={p.hint} className={`rounded-full border px-3 py-1.5 text-sm font-bold ${perms.includes(p.key) ? "border-teal bg-teal/15 text-teal" : "border-line text-muted"}`} onClick={() => toggle(p.key)}>
                {perms.includes(p.key) ? "✓ " : ""}
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="space-y-1 text-xs font-bold text-muted">
            ينتهي في وقت محدد (للكل)
            <input className="field" type="datetime-local" value={expires} onChange={(e) => setExpires(e.target.value)} />
          </label>
          <label className="space-y-1 text-xs font-bold text-muted">
            مدة كل شخص بالساعات من دخوله
            <input className="field" inputMode="numeric" value={hours} onChange={(e) => setHours(e.target.value.replace(/\D/g, ""))} placeholder="فاضي = بلا مدة" />
          </label>
          <label className="space-y-1 text-xs font-bold text-muted">
            أقصى عدد أشخاص
            <input className="field" inputMode="numeric" value={people} onChange={(e) => setPeople(e.target.value.replace(/\D/g, ""))} placeholder="فاضي = بلا حد" />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm font-bold">
          <input type="checkbox" checked={free} onChange={(e) => setFree(e.target.checked)} />
          ♾️ بلا حدود: اللي يدخل بهذا الكود ما ينخصم منه شي (مجاني له حتى لو الموقع مدفوع)
        </label>
        <div className="space-y-2 rounded-2xl border border-line p-3">
          <p className="font-extrabold">🎁 هدية الكود (لمن يدخل به)</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="space-y-1 text-xs font-bold text-muted">
              نقاط تنزل في حسابه (بالريال، مرة وحدة)
              <input className="field" inputMode="numeric" value={giftSar} onChange={(e) => setGiftSar(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="مثلًا 35" />
            </label>
            <label className="space-y-1 text-xs font-bold text-muted">
              أعلى موديل كلاود له
              <select className="field" value={claudeModel} onChange={(e) => setClaudeModel(e.target.value as ClaudeModelKey | "")}>
                <option value="">كل الموديلات</option>
                {CLAUDE_MODELS.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.name} · {m.tagline}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs font-bold text-muted">
              توليدات Seedance 2.0 (أقصى عدد)
              <input className="field" inputMode="numeric" value={videoGens} onChange={(e) => setVideoGens(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="فاضي = بلا حد" />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm font-bold">
            <input type="checkbox" checked={atCost} onChange={(e) => setAtCost(e.target.checked)} />
            <SmartCoin size={16} tone="orange" /> نقود برتقالية: كل شي يشتريه بسعر الأداة نفسها (ربحك صفر)، وكلاود بمدخلاته ومخرجاته، ولا يظهر البرتقالي إلا لمن دخل بهذا الكود
          </label>
          {Number(giftSar) > 0 && (
            <p className="text-sm font-bold text-teal">
              {Number(people) > 0 ? <>المجموع لـ {people} أشخاص: {giftSar} × {people} = <Riyal halalas={Number(giftSar) * Number(people) * 100} size={14} /></> : <>لكل شخص: <Riyal halalas={Number(giftSar) * 100} size={14} /> (حدد «أقصى عدد أشخاص» عشان يطلع لك المجموع)</>}
            </p>
          )}
        </div>
        <button className="btn btn-primary min-h-12 px-5" disabled={busy || !name.trim() || !perms.length}>
          سوّ الكود
        </button>
        {msg && <p className={`text-sm font-bold ${msg.ok ? "text-teal" : "text-red-600"}`}>{msg.text}</p>}
      </form>

      {codes.length ? (
        <ul className="space-y-3">
          {codes.map((c) => {
            const mine = uses.filter((u) => u.codeId === c.id);
            const st = state(c);
            return (
              <li key={c.id} className={`space-y-2 rounded-2xl border border-line p-3 ${st.ok ? "" : "opacity-70"}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <b className="min-w-0 flex-1 text-lg">{c.label}</b>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold ${st.ok ? "bg-teal/15 text-teal" : "bg-red-600/10 text-red-600"}`}>{st.text}</span>
                  <button type="button" className="btn btn-ghost min-h-9 px-3 text-xs" disabled={busy} onClick={() => send({ action: "codes_set", id: c.id, enabled: !c.enabled }, c.enabled ? "انطفى" : "اشتغل")}>
                    {c.enabled ? "أطفيه" : "شغّله"}
                  </button>
                  <button type="button" aria-pressed={c.unlimited} title="بلا حدود: ما ينخصم ممن يدخل بهذا الكود شي" className={`btn min-h-9 px-3 text-xs ${c.unlimited ? "bg-gold text-on-gold" : "btn-ghost"}`} disabled={busy} onClick={() => send({ action: "codes_set", id: c.id, unlimited: !c.unlimited }, c.unlimited ? "صار يدفع" : "صار بلا حدود")}>
                    ♾️ {c.unlimited ? "بلا حدود" : "يدفع"}
                  </button>
                  <button type="button" className="btn min-h-9 bg-red-600 px-3 text-xs text-white" disabled={busy} onClick={() => confirm(`نحذف «${c.label}»؟ ينقفل على اللي دخلوا فيه (الأكواد الثانية ما تتأثر).`) && send({ action: "codes_delete", id: c.id }, "انحذف")}>
                    احذفه
                  </button>
                </div>
                <p className="select-all rounded-xl bg-surface-2 px-3 py-2 text-center font-mono text-lg font-extrabold tracking-wider" dir="ltr">
                  {c.code}
                </p>
                {hasGift(c) && (
                  <div className="space-y-1 rounded-xl bg-gold/10 p-2.5 text-xs font-bold">
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span>🎁 هدية الكود:</span>
                      {c.giftSar > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <Riyal halalas={c.giftSar * 100} size={13} /> لكل شخص
                        </span>
                      )}
                      {c.atCost && (
                        <span className="inline-flex items-center gap-1">
                          <SmartCoin size={13} tone="orange" /> نقود برتقالية (بسعر الأداة، بدون ربح)
                        </span>
                      )}
                      {c.claudeModel && <span>🤖 كلاود حتى «{CLAUDE_MODELS.find((m) => m.key === c.claudeModel)?.name}»</span>}
                      {c.videoGens !== null && <span>🎬 Seedance 2.0: {c.videoGens} توليد</span>}
                    </p>
                    {c.giftSar > 0 && (
                      <p className="flex flex-wrap items-center gap-1 text-muted">
                        نزل للحين: <Riyal halalas={gifted[c.id] ?? 0} size={12} /> لـ {mine.length} {mine.length === 1 ? "شخص" : "أشخاص"}
                        {c.maxUses ? (
                          <>
                            {" "}· لو اكتمل العدد ({c.maxUses}): <Riyal halalas={c.giftSar * c.maxUses * 100} size={12} />
                          </>
                        ) : null}
                      </p>
                    )}
                    <details>
                      <summary className="cursor-pointer text-muted">وش يشوفه اللي يدخل بالكود</summary>
                      <ul className="mt-1 list-disc space-y-0.5 ps-5 font-semibold">
                        {codeWelcome(c).map((l) => (
                          <li key={l}><Coined text={l} size={12} /></li>
                        ))}
                      </ul>
                    </details>
                  </div>
                )}
                <GiftEditor c={c} busy={busy} send={send} />
                <div className="flex flex-wrap gap-1.5">
                  {c.perms.map((p) => (
                    <span key={p} className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-bold">
                      {label(p)}
                    </span>
                  ))}
                </div>
                <p className="text-xs font-bold text-muted">
                  {c.expiresAt ? `ينتهي ${fmt(c.expiresAt)}` : "بلا وقت انتهاء"} · {c.validHours ? `لكل شخص ${c.validHours} ساعة من دخوله` : "بلا مدة للشخص"} · {c.maxUses ? `${mine.length} من ${c.maxUses} أشخاص` : `${mine.length} دخلوا`}
                </p>
                {mine.length > 0 && (
                  <ul className="space-y-1">
                    {mine.map((u) => (
                      <li key={u.email} className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="min-w-0 flex-1 truncate font-bold" dir="ltr">{u.email}</span>
                        <span className="text-muted">{fmt(u.at)} · {codeOpen(c, u) ? "مفتوح له" : "منتهي"}</span>
                        <button type="button" className="text-red-600 underline" disabled={busy} onClick={() => confirm(`نقفل على ${u.email} في هذا الكود؟`) && send({ action: "codes_unuse", id: c.id, email: u.email }, "انقفل عليه")}>
                          اقفل عليه
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm font-bold text-muted">ما سويت أكواد للحين.</p>
      )}
    </section>
  );
}

/** Changes a code's gift after it was made (it reaches people who enter after the change; those already in keep theirs). */
function GiftEditor({ c, busy, send }: { c: CodeRow; busy: boolean; send: (body: Record<string, unknown>, done: string) => Promise<boolean> }) {
  const [gift, setGift] = useState(String(c.giftSar || ""));
  const [model, setModel] = useState<ClaudeModelKey | "">(c.claudeModel ?? "");
  const [gens, setGens] = useState(c.videoGens === null ? "" : String(c.videoGens));
  return (
    <details className="text-xs font-bold">
      <summary className="cursor-pointer text-muted">تعديل الهدية</summary>
      <div className="mt-2 grid gap-2 sm:grid-cols-4">
        <input className="field" inputMode="numeric" value={gift} onChange={(e) => setGift(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="نقاط (ريال)" aria-label="نقاط الهدية" />
        <select className="field" value={model} onChange={(e) => setModel(e.target.value as ClaudeModelKey | "")} aria-label="أعلى موديل كلاود">
          <option value="">كل موديلات كلاود</option>
          {CLAUDE_MODELS.map((m) => (
            <option key={m.key} value={m.key}>
              {m.name}
            </option>
          ))}
        </select>
        <input className="field" inputMode="numeric" value={gens} onChange={(e) => setGens(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="Seedance 2.0 (فاضي = بلا حد)" aria-label="توليدات Seedance 2.0" />
        <button type="button" className="btn btn-ghost min-h-10 px-3" disabled={busy} onClick={() => send({ action: "codes_set", id: c.id, giftSar: gift || 0, claudeModel: model || null, videoGens: gens || null }, "انحفظت الهدية")}>
          احفظ
        </button>
      </div>
      <button type="button" aria-pressed={c.atCost} className={`btn mt-2 min-h-9 px-3 text-xs ${c.atCost ? "bg-gold text-on-gold" : "btn-ghost"}`} disabled={busy} onClick={() => send({ action: "codes_set", id: c.id, atCost: !c.atCost }, c.atCost ? "رجع بالسعر العادي" : "صار بسعر الأداة")}>
        <SmartCoin size={14} tone={c.atCost ? "orange" : "sky"} /> {c.atCost ? "نقود برتقالية: بسعر الأداة (بدون ربح)" : "نقود عادية: بالسعر العادي"}
      </button>
    </details>
  );
}

